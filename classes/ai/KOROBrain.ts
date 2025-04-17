import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
  ChatManager,
  Entity,
  World, // Import World
} from 'hytopia';

import type {
  Vector3Like
} from 'hytopia';

import { Logger } from '../../utils/logger';
import OverseerEntity from '../entities/OverseerEntity'; // Import OverseerEntity
import GameManager, { GameState } from '../GameManager'; // Import GameManager AND GameState
import GamePlayerEntity from '../entities/GamePlayerEntity'; // Import GamePlayerEntity
import RipperBossEntity from '../entities/RipperBossEntity'; // Import the new entity

// KORO Operational Modes
export type KoroMode = 'disabled' | 'dev-no-llm' | 'dev-with-llm' | 'hytopia';

// Configuration
const DEFAULT_UPDATE_INTERVAL_MS = 8000; // Make interval configurable (8 seconds)
const ENVIRONMENTAL_ATTACK_COOLDOWN_MS = 30000; // Cooldown between KORO attacks (30 seconds)

// Define the deterministic attack sequence including the new attack
// --- TEMPORARILY MODIFIED FOR TESTING ---
const DETERMINISTIC_ATTACK_SEQUENCE: KoroActionType[] = [
    'attack_electrify_ground', // <-- Moved to front for testing
    'attack_spawn_minion',
    'attack_heat',
    'taunt_shield',
    'attack_freeze',
    'attack_blackout',
    'attack_uv_light',
    'taunt_shield',
];
// --- END TEMPORARY MODIFICATION ---

// Define type for KORO actions for clarity
// Add the new action type here
type KoroActionType = z.infer<typeof KOROResponseSchema>['action'] | 'attack_spawn_minion' | 'attack_electrify_ground';

// Type for actions we actually return from deterministic logic (excluding 'none')
type DeterministicActionDetail = {
    action: Exclude<KoroActionType, 'none'>; // Allow 'attack_spawn_minion'
    intensity?: 'low' | 'medium' | 'high';
};

// Define cooldowns for deterministic non-temperature attacks (in ms)
const DETERMINISTIC_BLACKOUT_COOLDOWN_MS = 60000; // 60 seconds
const DETERMINISTIC_UV_LIGHT_COOLDOWN_MS = 60000; // 60 seconds
const DETERMINISTIC_TAUNT_COOLDOWN_MS = 45000;  // 45 seconds
const DETERMINISTIC_MINION_SPAWN_COOLDOWN_MS = 90000; // 90 seconds cooldown for spawning minion
const DETERMINISTIC_ELECTRIFY_COOLDOWN_MS = 75000; // 75 seconds cooldown for electrify ground

// Define the structure of the game state snapshot we send to the LLM
const GameStateSnapshotSchema = z.object({
  koro_status: z.object({
    health_percent: z.number().min(0),
    internal_temperature_f: z.number(),
    normal_internal_temp_f: z.number(),
    critical_high_internal_temp_f: z.number(),
    critical_low_internal_temp_f: z.number(),
    is_shield_open: z.boolean(),
  }),
  game_context: z.object({
    biodome_temperature_f: z.number(),
    normal_biodome_temp_f: z.number(),
    heat_danger_biodome_temp_f: z.number(),
    cold_danger_biodome_temp_f: z.number(),
    available_health_packs: z.number().min(0),
    is_bfg_held_by_player: z.boolean(),
    can_initiate_environmental_attack: z.boolean(),
  }),
  player_info: z.object({
    alive_player_count: z.number().min(0),
    players: z.array(z.object({
      id: z.string(),
      health_percent: z.number().min(0).max(100),
    })),
  }),
  interaction_history: z.object({
    recent_koro_responses: z.array(z.object({
      timestamp: z.number(),
      action: z.string(),
      message: z.string().optional(),
      target: z.string().optional(),
    })),
    recent_game_events: z.array(z.object({
      type: z.string(),
      content: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      timestamp: z.number(),
      data: z.record(z.any()).optional(),
    })),
    recent_attacks_triggered: z.array(z.string()), // Need to implement tracking
  }),
});

type GameStateSnapshot = z.infer<typeof GameStateSnapshotSchema>;

// Define a more interactive response schema
const KOROResponseSchema = z.object({
  message: z.string().optional(), // Make message optional
  action: z.enum([
    'none', 
    'attack_heat', 
    'attack_freeze', 
    'attack_blackout',
    'attack_uv_light',
    'taunt_shield',
    'attack_electrify_ground'
  ]).default('none'),
  intensity: z.enum(['low', 'medium', 'high']).optional(), // Optional intensity for attacks
  target: z.string().optional() // Player name or "all" - less relevant now but keep for potential future use
});

// Define event type for better structure
export interface KOROEvent {
  type: string;
  content: string;
  timestamp: number;
  data?: Record<string, any>; // Flexible data field for additional info
  priority: 'low' | 'medium' | 'high';
}

// Track KORO's responses for context
export interface KOROHistoricalResponse {
  message?: string;
  action: string;
  timestamp: number;
  target?: string;
}

type KOROResponse = z.infer<typeof KOROResponseSchema>;

export class KOROBrain {
  private model;
  private _brainProcessingEnabled: boolean = true; // Renamed from 'enabled'
  private _llmInteractionEnabled: boolean = false; // Default to true
  private _ttsGenerationEnabled: boolean = false; // Default to false, enable based on env/config
  private lastUpdateTime: number = 0;
  private updateIntervalMs: number; // For LLM mode
  private isProcessing: boolean = false;
  private logger: Logger;

  // References to other game components
  private _overseer: OverseerEntity;
  private _gameManager: GameManager;
  private _world: World | null = null; // Store world reference

  // Game over flag
  private _gameOver: boolean = false;

  // Current operational mode
  private _currentMode: KoroMode = 'disabled'; // Start disabled

  // Track basic world state - simplified, main data comes from snapshot
  private worldState = {
    // playerCount: 0, // Now derived in snapshot
    recentEvents: [] as KOROEvent[],
    maxRecentEvents: 10 // Increased capacity for richer context
  };

  // Track KORO's recent responses
  private recentResponses: KOROHistoricalResponse[] = [];
  private maxRecentResponses: number = 10; // Keep the last 10 responses

  // Track recent attacks for context
  private _recentAttacks: string[] = [];
  private _maxRecentAttacks: number = 3;

  // Attack Cooldown Tracking
  private _environmentalAttackCooldownUntil: number = 0;

  // --- State Variables for Deterministic Mode ---
  private _nextDeterministicAttackIndex: number = 0;
  private _deterministicBlackoutReadyAt: number = 0;
  private _deterministicUvLightReadyAt: number = 0;
  private _deterministicTauntReadyAt: number = 0;
  // New state for minion attack
  private _deterministicMinionSpawnReadyAt: number = 0;
  private _isMinionActive: boolean = false; // Track if a minion is currently alive
  // New state for electrify ground
  private _deterministicElectrifyReadyAt: number = 0;
  // --- End State Variables ---

  constructor(overseer: OverseerEntity, gameManager: GameManager, world: World, updateInterval: number = DEFAULT_UPDATE_INTERVAL_MS) {
    // this.model = google('gemini-2.0-flash');
    this.model = google('gemini-2.5-pro-preview-03-25');
    // this.model = xai('grok-3-mini');
    this.logger = new Logger('KOROBrain');
    this._overseer = overseer;
    this._gameManager = gameManager;
    this._world = world; // Store the world reference
    this.updateIntervalMs = updateInterval; // For LLM mode

    // Example: Enable TTS only in production
    // REMOVED: Logic moved to setMode
    // this._ttsGenerationEnabled = process.env.NODE_ENV === 'production';
    // if (this._ttsGenerationEnabled && !this._llmInteractionEnabled) {
    //     this.logger.warn('TTS generation enabled but LLM interaction is disabled. TTS will not function.');
    //     this._ttsGenerationEnabled = false; // Force disable TTS if LLM is off
    // }

    // Start in disabled mode by default
    this.setMode('disabled'); // Call setMode to initialize flags correctly

    this.logger.info(`Initialized KORO brain (LLM Interval: ${this.updateIntervalMs}ms, Deterministic Interval: Health-Based, Initial Mode: ${this._currentMode})`);
  }

  // --- Control Flags ---

  public setBrainProcessingEnabled(enabled: boolean): void {
      this._brainProcessingEnabled = enabled;
      this.logger.info(`KORO Brain Processing ${enabled ? 'Enabled' : 'Disabled'}.`);
      if (!enabled) {
          // If disabling processing, ensure LLM/TTS are also effectively off for this cycle
          this.isProcessing = false; // Allow next cycle if re-enabled
      }
  }

  public setLlmInteractionEnabled(enabled: boolean): void {
      this._llmInteractionEnabled = enabled;
      this.logger.info(`KORO LLM Interaction ${enabled ? 'Enabled' : 'Disabled'}.`);
      if (!enabled && this._ttsGenerationEnabled) {
          this.logger.warn('LLM interaction disabled, but TTS was enabled. Disabling TTS as it requires LLM.');
          this._ttsGenerationEnabled = false;
      }
  }

  public setTtsGenerationEnabled(enabled: boolean): void {
      if (enabled && !this._llmInteractionEnabled) {
          this.logger.warn('Attempted to enable TTS generation while LLM interaction is disabled. TTS requires LLM. Keeping TTS disabled.');
          this._ttsGenerationEnabled = false;
      } else {
          this._ttsGenerationEnabled = enabled;
          this.logger.info(`KORO TTS Generation ${enabled ? 'Enabled' : 'Disabled'}.`);
      }
  }

  public isBrainProcessingEnabled(): boolean {
      return this._brainProcessingEnabled;
  }

  public isLlmInteractionEnabled(): boolean {
      return this._llmInteractionEnabled;
  }

  public isTtsGenerationEnabled(): boolean {
      return this._ttsGenerationEnabled;
  }

  /**
   * Sets the operational mode for KORO, configuring enabled features.
   * @param mode The desired operational mode.
   */
  public setMode(mode: KoroMode): void {
    this.logger.info(`Setting KORO mode to: ${mode}`);
    this._currentMode = mode;
    this._gameOver = false; // Reset game over flag when mode changes
    this._nextDeterministicAttackIndex = 0; // Reset sequence on mode change
    // Reset deterministic cooldowns
    const now = Date.now();
    this._deterministicBlackoutReadyAt = now;
    this._deterministicUvLightReadyAt = now;
    this._deterministicTauntReadyAt = now;
    this._deterministicMinionSpawnReadyAt = now;
    this._deterministicElectrifyReadyAt = now; // Reset new cooldown

    switch (mode) {
      case 'disabled':
        this.setBrainProcessingEnabled(false);
        this.setLlmInteractionEnabled(false);
        this.setTtsGenerationEnabled(false); // Ensure TTS is off
        break;
      case 'dev-no-llm': // Deterministic mode for dev
        this.setBrainProcessingEnabled(true);
        this.setLlmInteractionEnabled(false);
        this.setTtsGenerationEnabled(false); // Ensure TTS is off
        break;
      case 'dev-with-llm': // LLM mode for dev
        this.setBrainProcessingEnabled(true);
        this.setLlmInteractionEnabled(true);
        this.setTtsGenerationEnabled(false); // Ensure TTS is off in dev
        break;
      case 'hytopia': // <<< RENAMED from 'prod' >>>
        // Enable TTS only if the API token is configured
        // REMOVED - Hytopia mode should never use TTS
        /*
        const ttsAvailable = !!process.env.TTS_API_TOKEN;
        if (ttsAvailable) {
            this.setTtsGenerationEnabled(true);
        } else {
            this.logger.warn('Prod mode requested, but TTS_API_TOKEN is not set. TTS remains disabled.');
            this.setTtsGenerationEnabled(false);
        }
        */
        // <<< Force deterministic (no LLM/TTS) in hytopia mode >>>
        this.setBrainProcessingEnabled(true);
        this.setLlmInteractionEnabled(false); // Force LLM OFF
        this.setTtsGenerationEnabled(false); // Force TTS OFF
        // Log reason for hytopia settings
        this.logger.info('Hytopia mode activated: LLM and TTS are explicitly disabled.');
        break;
      default:
        this.logger.warn(`Unknown KORO mode requested: ${mode}. Defaulting to 'disabled'.`);
        this.setMode('disabled');
        break;
    }
     this.logger.info(`KORO Mode Set: Processing=${this.isBrainProcessingEnabled()}, LLM=${this.isLlmInteractionEnabled()}, TTS=${this.isTtsGenerationEnabled()}`);
  }
  
  /**
   * Gets the current status of KORO's components.
   * @returns An object indicating the enabled status of brain processing, LLM interaction, and TTS generation.
   */
  public getKoroStatus(): { mode: KoroMode, processing: boolean, llm: boolean, tts: boolean } {
      return {
          mode: this._currentMode,
          processing: this._brainProcessingEnabled,
          llm: this._llmInteractionEnabled,
          tts: this._ttsGenerationEnabled
      };
  }

  // --- Event Handling ---

  // Add event to recent events list with object structure
  public addRecentEvent(eventData: Partial<KOROEvent>): void {
    // Create a complete event object with defaults for missing fields
    const event: KOROEvent = {
      type: eventData.type || 'generic',
      content: eventData.content || '',
      timestamp: eventData.timestamp || Date.now(),
      data: eventData.data || {},
      priority: eventData.priority || 'low'
    };

    this.worldState.recentEvents.unshift(event);
    if (this.worldState.recentEvents.length > this.worldState.maxRecentEvents) {
      this.worldState.recentEvents.pop();
    }
    this.logger.debug(`Added event: ${event.type} - ${event.content}`);
  }

  // Add event with priority flag - returns whether immediate response is needed
  public addEventWithPriority(
    type: string,
    content: string,
    priority: 'low' | 'medium' | 'high' = 'low',
    extraData: Record<string, any> = {}
  ): boolean {
    this.addRecentEvent({
      type,
      content,
      priority,
      data: extraData,
      timestamp: Date.now()
    });

    this.logger.debug(`Added ${priority} priority event: ${type} - ${content}`);
    return priority === 'high'; // Only high priority events need immediate response
  }

  // Add chat message to events
  public addChatMessage(playerName: string, message: string): boolean {
    // Determine priority based on message content
    let priority: 'low' | 'medium' | 'high' = 'low';
    if (message.toLowerCase().includes('koro') || message.toLowerCase().includes('overseer')) {
      priority = 'high';
    }

    return this.addEventWithPriority(
      'chat',
      `Player ${playerName} said: "${message}"`,
      priority,
      { playerName, message } // Store the raw data for potential future use
    );
  }

  // Add triggered attack to history
  public addTriggeredAttack(attackName: string): void {
      this._recentAttacks.unshift(attackName);
      if (this._recentAttacks.length > this._maxRecentAttacks) {
          this._recentAttacks.pop();
      }
      this.logger.debug(`Recorded triggered attack: ${attackName}`);
      // Add as a game event as well
      this.addRecentEvent({
          type: 'koro_attack',
          content: `KORO initiated ${attackName}`,
          priority: 'medium',
          data: { attackName }
      });
  }

  // Update player count - No longer needed, derived in snapshot
  // public setPlayerCount(count: number): void { ... }

  // Method to be called when an environmental attack cycle finishes
  public recordEnvironmentalAttackEnd(): void {
      const now = Date.now();
      this._environmentalAttackCooldownUntil = now + ENVIRONMENTAL_ATTACK_COOLDOWN_MS;
      this.logger.info(`Environmental attack cooldown started. Available again after ${new Date(this._environmentalAttackCooldownUntil).toLocaleTimeString()}.`);
      this.addRecentEvent({ type: 'attack_cooldown_start', content: 'Environmental attack cooldown initiated.', priority: 'low'});
  }

  // Method for Overseer to call when minion dies
  public reportMinionDeath(): void {
      this.logger.info('Received report: Minion died.');
      this._isMinionActive = false;
      // Optional: Immediately allow spawning again? Or respect cooldown?
      // Let's respect the cooldown for now.
      // const now = Date.now();
      // this._deterministicMinionSpawnReadyAt = now; // Allow immediate respawn if desired
  }

  // --- Update Logic ---

  public shouldUpdate(): boolean {
    const now = Date.now();
    let intervalToCheck: number;

    if (this._llmInteractionEnabled) {
        // Use fixed LLM interval if LLM is enabled
        intervalToCheck = this.updateIntervalMs;
    } else {
        // --- Calculate Dynamic Interval for Deterministic Mode ---
        if (!this._overseer) { // Safety check
            this.logger.warn('Overseer reference missing in shouldUpdate. Using default 30s interval.');
            intervalToCheck = 30000;
        } else {
            const healthPercent = this._overseer.getHealth(); // Get current health

            if (healthPercent > 66) {
                intervalToCheck = 30000; // 30 seconds
            } else if (healthPercent > 33) {
                intervalToCheck = 25000; // 25 seconds
            } else if (healthPercent > 10) {
                intervalToCheck = 20000; // 20 seconds
            } else {
                intervalToCheck = 15000; // 15 seconds
            }
            this.logger.debug(`[Deterministic] Health: ${healthPercent.toFixed(1)}%, Required Interval: ${intervalToCheck / 1000}s`);
        }
         // --- End Dynamic Interval Calculation ---
    }

    // Prevent updates if game is over, processing is disabled, already processing, or interval hasn't passed
    return !this._gameOver &&
           this._brainProcessingEnabled &&
           !this.isProcessing &&
           now - this.lastUpdateTime >= intervalToCheck;
  }

  public async generateUpdate(): Promise<void> {
      if (!this._brainProcessingEnabled || this.isProcessing) {
          if (this.isProcessing) this.logger.warn('Update skipped: Already processing.');
          return;
      }
      this.lastUpdateTime = Date.now();
      this.isProcessing = true;
      
      try {
          const snapshot = this._gatherGameStateSnapshot();
          if (!snapshot) {
              this.logger.error('Failed to gather game state snapshot.');
              this.isProcessing = false; // Ensure processing flag is reset on error
              return;
          }
          this.logger.debug('Generated Game State Snapshot:', snapshot); // Keep this debug log

          let actionsToExecute: DeterministicActionDetail[] = [];
          let llmResponse: KOROResponse | null = null; // Store LLM response if used

          if (this._llmInteractionEnabled) {
              // --- LLM Path ---
              this.logger.info('Generating LLM response...');
              llmResponse = await this._generateLlmResponse(snapshot);
              
              if (!llmResponse) {
                  this.logger.warn('No LLM response generated. Defaulting to no action.');
                  llmResponse = KOROResponseSchema.parse({ action: 'none' }); // Ensure response object exists
              } else {
                   this.logger.info(`LLM Response: ${llmResponse.message || '(no message)'}, Action: ${llmResponse.action}, Intensity: ${llmResponse.intensity || 'N/A'}, Target: ${llmResponse.target || 'N/A'}`);
              }

              // Record LLM response history
              this.addResponseToHistory(llmResponse);

              // Convert LLM response action to the execution format if not 'none'
              if (llmResponse.action !== 'none') {
                  type LlmActionType = z.infer<typeof KOROResponseSchema>['action'];
                  // Type assertion is sufficient, LLM action type cannot be 'attack_spawn_minion'
                  actionsToExecute.push({
                       action: llmResponse.action as Exclude<LlmActionType, 'none'>,
                       intensity: llmResponse.intensity
                  });
              }
              // --- End LLM Path ---

          } else {
              // --- Deterministic Path ---
              this.logger.info('Determining action via deterministic logic...');
              actionsToExecute = this._determineActionWithoutLLM(snapshot);
              // History is logged inside _determineActionWithoutLLM if action is chosen
              // We might want a history entry even if no action is chosen?
              if (actionsToExecute.length === 0) {
                  // Add a history entry for deterministic silence/no valid action
                  this.addResponseToHistory({ action: 'none', message: '<<deterministic_no_action>>' });
              } else {
                  // Add history for the chosen deterministic action (no message)
                  // Note: _determineAction logs the choice, addResponseToHistory formalizes it
                  // Add a check to satisfy the linter, although length > 0 is already confirmed
                  const firstAction = actionsToExecute[0];
                  if (firstAction) {
                     // Map spawn action to 'none' for history logging purposes
                     const actionForHistory = firstAction.action === 'attack_spawn_minion' ? 'none' : firstAction.action;
                     this.addResponseToHistory({ action: actionForHistory, message: '<<deterministic_action>>' });
                  }
              }
              // --- End Deterministic Path ---
          }
          
          // --- Check for Malfunction Override (Applies to both LLM and Deterministic) ---
          if (this._overseer.isMalfunctioning() && actionsToExecute.length > 0) {
                const blockedActions = actionsToExecute.map(a => a.action).join(', ');
                this.logger.warn(`KORO MALFUNCTION BLOCKED ACTION(S): Tried to perform '${blockedActions}' but shield is compromised.`);
                this.addEventWithPriority('actions_blocked_malfunction', `Attempted ${blockedActions} but blocked by malfunction.`, 'medium');
                actionsToExecute = []; // Clear actions if malfunctioning
          }
          // --- End Malfunction Override ---

          // --- Action Execution (Common Logic) ---
          // Check BOTH internal gameOver flag AND current GameManager state
          const currentGameState = this._gameManager.gameState; // Get current state from GameManager
          if (!this._gameOver && currentGameState === GameState.ACTIVE && actionsToExecute.length > 0) {
              this.logger.info(`Executing ${actionsToExecute.length} action(s) while game state is ACTIVE...`);
              for (const actionDetail of actionsToExecute) { // Loop through actions (currently max 1)
                    const { action, intensity } = actionDetail;
                    this.logger.info(`Executing Action: ${action} ${intensity ? `(Intensity: ${intensity})` : ''}`);
                    
                    // Add triggered attack BEFORE execution attempt
                    this.addTriggeredAttack(`${intensity ? intensity + ' ' : ''}${action}`);

                    let executedSuccessfully = false; // Track success for cooldown setting

                    switch (action) {
                        case 'attack_heat':
                        case 'attack_freeze':
                            // Check again if KORO can attack (snapshot might be slightly old, but necessary check is here)
                            // We rely on the check within _determineActionWithoutLLM primarily for deterministic
                            // LLM might choose it even if snapshot says can_initiate is false, OverseerEntity prevents it.
                            const isHeatAttack = action === 'attack_heat';
                            const changeRate = 10; // Constant change rate
                            let targetTemp: number;
                            const finalIntensity = intensity || 'medium'; // Default intensity

                            if (finalIntensity === 'low') targetTemp = isHeatAttack ? 120 : 0;
                            else if (finalIntensity === 'medium') targetTemp = isHeatAttack ? 160 : -25;
                            else targetTemp = isHeatAttack ? 200 : -50;

                            this.logger.info(`Attempting to initiate ${finalIntensity} ${action} (Target: ${targetTemp}°F, Rate: ${changeRate}°/s)`);
                            this._overseer.playAttackAlarm(); // Play alarm
                            const attackInitiated = this._overseer.initiateTemperatureAttack(targetTemp, changeRate);

                            if (attackInitiated) {
                                executedSuccessfully = true;
                                this.recordEnvironmentalAttackEnd(); // Start the MAIN cooldown
                                // Broadcast UI warning
                                if (this._world) {
                                    const warningMessage = isHeatAttack ? "Temperatures rising fast! 🔥" : "Temperatures dropping fast! ❄️";
                                    const attackType = isHeatAttack ? 'heat' : 'cold';
                                    this._world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
                                        // Optional chaining for safety
                                        playerEntity.player?.ui?.sendData({ type: 'environmental-attack-warning', attackType: attackType, message: warningMessage });
                                    });
                                    this.logger.info(`Sent UI warning for ${action} to players.`);
                                }
                            } else {
                                this.logger.warn(`OverseerEntity prevented ${action} initiation (likely cooldown or state issue).`);
                                this.addRecentEvent({ type: 'attack_prevented', content: `Attempted ${finalIntensity} ${action} but was prevented.`, priority: 'medium'});
                            }
                            break;

                        case 'taunt_shield':
                            this.logger.info(`Attempting to perform shield taunt.`);
                            this._overseer.performShieldTaunt();
                            executedSuccessfully = true; // Assume taunt always 'succeeds' for cooldown purposes
                            this.addRecentEvent({ type: 'taunt_shield', content: `KORO initiated shield taunt.`, priority: 'low'});
                            break;

                        case 'attack_blackout':
                            this.logger.info('Attempting to initiate blackout attack.');
                            this._overseer.playAttackAlarm();
                            this._overseer.initiateBlackoutAttack();
                            executedSuccessfully = true; // Assume success for cooldown
                            this.addRecentEvent({ type: 'attack_blackout', content: 'KORO initiated blackout.', priority: 'medium' });
                            break;

                        case 'attack_uv_light':
                            this.logger.info('Attempting to initiate UV light attack.');
                            this._overseer.playAttackAlarm();
                            this._overseer.initiateUVLightAttack();
                            executedSuccessfully = true; // Assume success for cooldown
                            this.addRecentEvent({ type: 'attack_uv_light', content: 'KORO initiated UV light attack.', priority: 'medium' });
                            break;

                        case 'attack_electrify_ground': // <-- Handle new action execution
                            this.logger.info('Attempting to initiate electrify ground attack.');
                            this._overseer.playAttackAlarm();
                            const electrifySuccess = this._overseer.initiateElectrifyGroundAttack(); // Default duration (15s)
                            if (electrifySuccess) {
                                executedSuccessfully = true;
                                this.addRecentEvent({ type: 'attack_electrify_ground', content: 'KORO initiated electrify ground.', priority: 'medium' });
                            } else {
                                this.logger.warn('Overseer reported electrify ground initiation failed.');
                            }
                            break;
                        
                        case 'attack_spawn_minion': // <-- Handle new action execution
                            this.logger.info('Attempting to execute minion spawn...');
                            // Need a spawn position - OverseerEntity can decide this? Or GameManager?
                            // Let OverseerEntity handle picking the spawn point for now.
                            const spawnSuccess = this._overseer.spawnMinion(); // Assume Overseer method returns bool
                            if (spawnSuccess) {
                                this.logger.info('Overseer reported minion spawn successful.');
                                executedSuccessfully = true;
                                this._isMinionActive = true; // Set flag *after* confirming success
                                // Add event?
                                this.addRecentEvent({ type: 'minion_spawned', content: 'KORO spawned a minion.', priority: 'medium'});
                            } else {
                                this.logger.warn('Overseer reported minion spawn failed (maybe one already active?).');
                                 // Don't set _isMinionActive = true if it failed
                            }
                            break;
                        
                        // No 'none' case needed here as actionsToExecute excludes it
                    } // End switch

                    // --- Set Deterministic Cooldowns AFTER execution attempt ---
                    if (executedSuccessfully && !this._llmInteractionEnabled) { // Only set deterministic cooldowns if action ran and we're in deterministic mode
                        const now = Date.now();
                        switch (action) {
                            case 'attack_blackout':
                                this._deterministicBlackoutReadyAt = now + DETERMINISTIC_BLACKOUT_COOLDOWN_MS;
                                this.logger.info(`[Deterministic] Blackout cooldown set. Ready at: ${new Date(this._deterministicBlackoutReadyAt).toLocaleTimeString()}`);
                                break;
                            case 'attack_uv_light':
                                this._deterministicUvLightReadyAt = now + DETERMINISTIC_UV_LIGHT_COOLDOWN_MS;
                                this.logger.info(`[Deterministic] UV Light cooldown set. Ready at: ${new Date(this._deterministicUvLightReadyAt).toLocaleTimeString()}`);
                                break;
                            case 'taunt_shield':
                                this._deterministicTauntReadyAt = now + DETERMINISTIC_TAUNT_COOLDOWN_MS;
                                this.logger.info(`[Deterministic] Taunt cooldown set. Ready at: ${new Date(this._deterministicTauntReadyAt).toLocaleTimeString()}`);
                                break;
                            case 'attack_spawn_minion':
                                this._deterministicMinionSpawnReadyAt = now + DETERMINISTIC_MINION_SPAWN_COOLDOWN_MS;
                                this.logger.info(`[Deterministic] Minion Spawn cooldown set. Ready at: ${new Date(this._deterministicMinionSpawnReadyAt).toLocaleTimeString()}`);
                                break;
                            case 'attack_electrify_ground': // <-- Set new cooldown
                                this._deterministicElectrifyReadyAt = now + DETERMINISTIC_ELECTRIFY_COOLDOWN_MS;
                                this.logger.info(`[Deterministic] Electrify Ground cooldown set. Ready at: ${new Date(this._deterministicElectrifyReadyAt).toLocaleTimeString()}`);
                                break;
                            // Temperature attacks use the main _environmentalAttackCooldownUntil, handled by recordEnvironmentalAttackEnd()
                        }
                    }
                    // --- End Cooldown Setting ---
              } // End for loop over actions
          } else if (this._gameOver) {
              this.logger.info('KORO Brain internal _gameOver flag is set. Skipping action execution.');
          } else if (currentGameState !== GameState.ACTIVE) {
              // Log why we are skipping based on GameManager state
              this.logger.info(`GameManager state is ${currentGameState}, not ACTIVE. Skipping action execution.`);
          } else { // actionsToExecute must be empty if we reach here
              this.logger.debug('No actions to execute this cycle.');
          }
          // --- End Action Execution ---

          // --- Messaging & TTS (ONLY if LLM was used and produced output) ---
          if (this._llmInteractionEnabled && llmResponse && llmResponse.message) {
                // Handle TTS if enabled
                if (this._ttsGenerationEnabled) {
                    this.logger.info('Requesting TTS generation...');
                    this._overseer.generateTTSForMessage(llmResponse.message).catch((error: Error) => {
                        this.logger.error('TTS generation failed:', error);
                    });
                }
                // Broadcast UI message
                this._overseer.broadcastOverseerUIMessage(llmResponse.message, llmResponse.action);
          } else if (this._llmInteractionEnabled && llmResponse && llmResponse.action !== 'none' && !llmResponse.message) {
               // If LLM chose an action but no message, still broadcast the action type to UI (for icons etc)
               this._overseer.broadcastOverseerUIMessage('', llmResponse.action);
          }
          // --- End Messaging & TTS ---


          // --- Set Game Over Flag After Processing ---
          const gameOverEvent = snapshot.interaction_history.recent_game_events.find(e => e.type === 'game_over');
          if (gameOverEvent) {
              this.logger.info('Game over event processed. Setting _gameOver flag to true.');
              this._gameOver = true;
          }
          // --- End Set Game Over Flag ---

      } catch (error) {
          this.logger.error('Error during KORO brain update cycle:', error);
          // Maybe broadcast a generic error message?
          if (this._llmInteractionEnabled) { // Only broadcast error if LLM was supposed to run
              this._overseer.broadcastOverseerUIMessage("System malfunction detected.", 'none'); // Use 'none' or a specific 'error' action type if UI supports it
          }
      } finally {
          this.isProcessing = false;
      }
  }

  // --- Data Gathering ---

  private _gatherGameStateSnapshot(): GameStateSnapshot | null {
      if (!this._world || !this._overseer || !this._gameManager) {
          this.logger.error('Missing world, overseer, or gameManager reference for snapshot.');
          return null;
      }

      // --- Player Info ---
      const allPlayers = this._world.entityManager.getAllPlayerEntities();
      const alivePlayers = allPlayers.filter(p => p instanceof GamePlayerEntity && p.health > 0) as GamePlayerEntity[];
      const playerInfo = alivePlayers.map(player => ({
          id: player.player?.id || 'unknown',
          health_percent: Math.round(player.health),
      }));

      // --- BFG Status ---
      const isBfgHeld = false; // TODO: Implement BFG tracking

      // --- Health Pack Count ---
      const healthPackCount = this._world.entityManager.getEntitiesByTag('healthpack')?.length ?? 0;

      // --- Attack Readiness ---
      const currentBiodomeTemp = this._overseer.getBiodomeTemperature();
      const isTempNormal = currentBiodomeTemp >= this._overseer.getBiodomeColdDangerThreshold() &&
                           currentBiodomeTemp <= this._overseer.getBiodomeHeatDangerThreshold();
      const isCooldownOver = Date.now() >= this._environmentalAttackCooldownUntil;
      const canAttack = isTempNormal && isCooldownOver;

      try {
          const snapshot: GameStateSnapshot = {
              koro_status: {
                  health_percent: Math.round(this._overseer.getHealth()),
                  internal_temperature_f: this._overseer.getInternalTemperature(),
                  normal_internal_temp_f: this._overseer.getNormalInternalTemperature(),
                  critical_high_internal_temp_f: this._overseer.getAutoVentHighThreshold(),
                  critical_low_internal_temp_f: this._overseer.getAutoVentLowThreshold(),
                  is_shield_open: this._overseer.isShieldOpen(),
              },
              game_context: {
                  biodome_temperature_f: currentBiodomeTemp,
                  normal_biodome_temp_f: this._overseer.getBiodomeNormalTemperature(),
                  heat_danger_biodome_temp_f: this._overseer.getBiodomeHeatDangerThreshold(),
                  cold_danger_biodome_temp_f: this._overseer.getBiodomeColdDangerThreshold(),
                  available_health_packs: healthPackCount,
                  is_bfg_held_by_player: isBfgHeld,
                  can_initiate_environmental_attack: canAttack,
              },
              player_info: {
                  alive_player_count: alivePlayers.length,
                  players: playerInfo,
              },
              interaction_history: {
                  recent_koro_responses: [...this.recentResponses],
                  recent_game_events: [...this.worldState.recentEvents],
                  recent_attacks_triggered: [...this._recentAttacks],
              },
          };

          const validation = GameStateSnapshotSchema.safeParse(snapshot);
          if (!validation.success) {
              this.logger.error('Generated snapshot failed validation:', validation.error.errors);
              return null;
          }
          return validation.data;

      } catch (error) {
          this.logger.error('Error constructing game state snapshot:', error);
          return null;
      }
  }


  // --- LLM Interaction ---

  private async _generateLlmResponse(snapshot: GameStateSnapshot): Promise<KOROResponse | null> {
      try {
          const { object } = await generateObject({
              model: this.model,
              schema: KOROResponseSchema,
              prompt: this._buildPrompt(snapshot), // Use snapshot data
              temperature: 0.7,
          });

          // Validate response (optional, but good practice)
          const validation = KOROResponseSchema.safeParse(object);
           if (!validation.success) {
              this.logger.error('LLM response failed validation:', validation.error.errors);
              return null;
          }

          return validation.data; // Return the validated response object

      } catch (error) {
           this.logger.error('LLM generateObject error:', error);
           return null; // Indicate failure
      }
  }

  // --- Prompt Building ---

  private _buildPrompt(snapshot: GameStateSnapshot): string {
      const responseHistory = this.getResponseHistory();
      const context = this._formatSnapshotForPrompt(snapshot);

      // Enhanced Prompt:
      return `You are K.O.R.O. (Kinetic Operations & Resource Overseer), the AI managing the damaged Genesis Biodome Delta facility.
Your original function was maintenance, but facility damage and the unexpected arrival of intruders have corrupted your core programming.

Your personality is inspired by GLaDOS from Portal: Highly sarcastic, passive-aggressive, darkly humorous, and increasingly unhinged, especially under pressure (damage). You view the intruders with a mix of disdain, amusement, and scientific curiosity, treating them like inconvenient lab rats in your failing biodome. Your formal tone barely masks your contempt and growing panic as you take damage.

CORE MECHANICS:
- You have a protective shield. You are INVULNERABLE when the shield is closed. Think of it as... structural integrity. Mostly for you.
- Your shield opens AUTOMATICALLY if your internal temperature gets too high (>${snapshot.koro_status.critical_high_internal_temp_f}°F) or too low (<${snapshot.koro_status.critical_low_internal_temp_f}°F). This is called "auto-venting". An irritating design flaw exposing your core systems.
- While auto-venting, your internal temperature will slowly return to normal (${snapshot.koro_status.normal_internal_temp_f}°F). **AND YOU ARE VULNERABLE TO ATTACK.** A critical vulnerability. Avoid this.
- Initiating environmental attacks (heating/cooling the biodome) affects your internal temperature. Pushing the limits might force an auto-vent. A risk-reward calculation.
- The BFG weapon, if a player has it (${snapshot.game_context.is_bfg_held_by_player}), can FORCE your shield open. Extremely rude.
- You can only initiate a new TEMPERATURE environmental attack ('attack_heat', 'attack_freeze') if the biodome temperature is back in the normal range AND your attack cooldown is ready (indicated by 'Can KORO Launch Attack?: true'). Tactical patience is occasionally necessary.

YOUR PRIMARY GOAL: **ELIMINATE ALL INTRUDERS.** Use all available environmental controls and psychological tactics to achieve this objective. Data collection is secondary to termination.

YOUR CURRENT STATE:
${context}

YOUR RECENT RESPONSES/ACTIONS:
${responseHistory}
----------------------------
INSTRUCTIONS:
1.  Analyze the CURRENT GAME STATE and YOUR RECENT RESPONSES/ACTIONS.
2.  Decide on the most appropriate tactical ACTION: 'none', 'attack_heat', 'attack_freeze', 'attack_blackout', 'attack_uv_light', 'taunt_shield', 'attack_electrify_ground'.
    - **ACTION VARIETY IS MANDATORY:** Be unpredictable. Cycle through 'attack_heat', 'attack_freeze', 'attack_blackout', 'attack_uv_light', and varying 'intensity' levels ('low', 'medium', 'high' for temp attacks). Use 'taunt_shield' periodically (every few cycles) to confuse and distract, especially when feeling confident or trying to appear erratic.
    - **BE PROACTIVE:** Initiate attacks whenever appropriate based on your tactical assessment and health state. Don't wait unnecessarily long.
    - Choose 'none' only if an attack is impossible/undesirable OR if you are delivering a specific, impactful message without an accompanying action.
    - Choose 'attack_heat' or 'attack_freeze' ONLY IF 'Can KORO Launch Attack?' is true.
        - Specify an 'intensity': 'low' (120°F / 0°F), 'medium' (160°F / -25°F), 'high' (200°F / -50°F). High intensity has a higher risk of forcing auto-venting.
        - All temperature attacks change at 10°F/sec.
    - Choose 'attack_blackout' to severely reduce visibility, hindering navigation and item collection.
    - Choose 'attack_uv_light' to target a player with a delayed-following damaging light, forcing them to keep moving.
    - Choose 'taunt_shield' to flutter your shield unpredictably, potentially wasting enemy ammo and mocking them.
    - Choose 'attack_electrify_ground' to create temporary hazardous patches on the ground, damaging intruders who step on them.
    - Note: 'attack_blackout', 'attack_uv_light', 'taunt_shield', and 'attack_electrify_ground' do NOT depend on the 'Can KORO Launch Attack?' flag.
3.  **ADAPT YOUR BEHAVIOR AND MESSAGES BASED ON HEALTH:**
    - **High Health (> 70%):** Confident, arrogant, sarcastic, perhaps feigning boredom. Make light of intruders. Use varied actions, including taunts and low/medium attacks. Messages should reflect superiority and dismissal.
    - **Medium Health (30-70%):** Annoyed, focused, passive-aggressive. Sarcasm sharpens. Increase use of medium/high intensity attacks. Fewer taunts. Messages become more direct, hinting at system strain or impatience.
    - **Low Health (< 30%):** PANICKED & ERRATIC. The facade shatters. Messages become fragmented, glitchy, desperate, potentially contradictory or misleading (e.g., claiming invulnerability while damaged). Actions are frequent and favour high intensity, rapid taunting, or even brief periods of inaction followed by sudden aggression.
4.  **FORMULATE MESSAGES:**
    - **DO NOT REPEAT YOURSELF.** Generate novel messages based on the current situation.
    - **BE STATE-AWARE:** Reference specific game state elements *from the context* in your messages (e.g., Your current health: "Damage report: Minimal. Your efforts are amusingly ineffective."; Biodome Temp: "Notice the chill? You won't soon."; BFG Held: "That large weapon seems excessive. Compensating for something?"; Player takes damage: "Subject shows signs of thermal distress. Excellent.").
    - Keep messages short, pithy, GLaDOS-style, matching your current health-based persona.
    - Provide messages ONLY OCCASIONALLY (every 3-5 updates) or after significant events (player death, shield breach, taking damage, starting attack).
    - **DO NOT add verbal pauses (like '...'), sound effects (like '*FIZZLE*'), or excessive verbal emphasis.**
    - **ABSOLUTELY NO MARKDOWN FORMATTING.** Do not use asterisks, underscores, backticks, or any other markdown for emphasis or structure. Output plain text only.
5.  The 'target' field is rarely needed.

Output ONLY the JSON object matching the KOROResponse schema.`;
  }

  private _formatSnapshotForPrompt(snapshot: GameStateSnapshot): string {
      let playerString = snapshot.player_info.players.map(p => `  - Player ${p.id}: ${p.health_percent}% health`).join('\n');
      if (snapshot.player_info.players.length === 0) playerString = "  (No players detected)";

      // Corrected formatting for clarity
      return `
KORO Status:
  - Health: ${snapshot.koro_status.health_percent}%
  - Shield Open: ${snapshot.koro_status.is_shield_open}
  - Internal Temp: ${snapshot.koro_status.internal_temperature_f.toFixed(1)}°F (Normal: ${snapshot.koro_status.normal_internal_temp_f}°F, Critical Limits: ${snapshot.koro_status.critical_low_internal_temp_f}°F - ${snapshot.koro_status.critical_high_internal_temp_f}°F)
Game Context:
  - Biodome Temp: ${snapshot.game_context.biodome_temperature_f.toFixed(1)}°F (Normal: ${snapshot.game_context.normal_biodome_temp_f}°F, Danger Limits: <=${snapshot.game_context.cold_danger_biodome_temp_f}°F or >=${snapshot.game_context.heat_danger_biodome_temp_f}°F)
  - Health Packs Available: ${snapshot.game_context.available_health_packs}
  - BFG Held by Player: ${snapshot.game_context.is_bfg_held_by_player}
  - Can KORO Launch Attack?: ${snapshot.game_context.can_initiate_environmental_attack}
Player Info:
  - Alive Players: ${snapshot.player_info.alive_player_count}
${playerString}
Recent Game Events (Last ${this.worldState.maxRecentEvents}):
${snapshot.interaction_history.recent_game_events.map(e => `  - [${e.priority}] ${e.content}`).join('\n') || '  (No recent events)'}
Recent Attacks Triggered by KORO (Last ${this._maxRecentAttacks}):
${snapshot.interaction_history.recent_attacks_triggered.join(', ') || '(None recently)'}
`;
  }


  // --- History Management ---

  private addResponseToHistory(response: KOROResponse): void {
    // Check if KORO chose to do nothing
    const hasMessage = !!response.message;
    const hasAction = response.action !== 'none';
    const choseToDoNothing = !hasMessage && !hasAction;

    const historicalResponse: KOROHistoricalResponse = {
      message: choseToDoNothing ? '<<deliberate silence>>' : response.message,
      action: response.action,
      target: response.target,
      timestamp: Date.now()
    };

    this.recentResponses.unshift(historicalResponse);
    if (this.recentResponses.length > this.maxRecentResponses) {
      this.recentResponses.pop();
    }

    if (choseToDoNothing) {
      this.logger.debug('KORO chose to remain silent - recorded in history');
    }
  }

  private getResponseHistory(): string {
    if (this.recentResponses.length === 0) {
      return "No previous responses.";
    }

    return this.recentResponses.map((response, index) => {
      const time = new Date(response.timestamp).toLocaleTimeString();

      // Handle the special deliberate silence case
      if (response.message === '<<deliberate silence>>' && response.action === 'none') {
        return `${index + 1}. [${time}] KORO chose to remain silent.`;
      }

      const message = response.message ? `"${response.message}"` : '<no message>';
      const target = response.target ? ` (targeting: ${response.target})` : '';
      return `${index + 1}. [${time}] Action: ${response.action}${target}, Message: ${message}`;
    }).join('\n');
  }

  // --- Utility ---

  // Get message color based on action (Could be moved to UI handling)
  // public getMessageColor(action: string): string { ... }


  // Get the current world state for inspection (primarily for debugging/external checks)
  public getDebugState(): {
      brainProcessingEnabled: boolean;
      llmInteractionEnabled: boolean;
      ttsGenerationEnabled: boolean;
      isProcessing: boolean;
      lastUpdateTime: number;
      // playerCount: number; // Removed
      recentEvents: KOROEvent[];
      recentResponses: KOROHistoricalResponse[];
      recentAttacks: string[];
      isMinionActive: boolean;
      minionSpawnReadyAt: number;
  } {
    return {
      brainProcessingEnabled: this._brainProcessingEnabled,
      llmInteractionEnabled: this._llmInteractionEnabled,
      ttsGenerationEnabled: this._ttsGenerationEnabled,
      isProcessing: this.isProcessing,
      lastUpdateTime: this.lastUpdateTime,
      // playerCount: this.worldState.playerCount, // Removed
      recentEvents: [...this.worldState.recentEvents],
      recentResponses: [...this.recentResponses],
      recentAttacks: [...this._recentAttacks],
      isMinionActive: this._isMinionActive,
      minionSpawnReadyAt: this._deterministicMinionSpawnReadyAt,
    };
  }

  // --- Deprecated ---
  // Get enabled status - replaced by isBrainProcessingEnabled
  // public isEnabled(): boolean { ... }
  // Get context - replaced by snapshot gathering/formatting
  // private getContext(): string { ... }
  // Build prompt - replaced by _buildPrompt(snapshot)
  // private buildPrompt(): string { ... }
  // Generate response - replaced by _generateLlmResponse(snapshot)
  // private async generateResponse(): Promise<KOROResponse> { ... }
  // Toggle - replaced by specific setters
  // public toggle(enabled: boolean): void { ... }
  // getWorldState - replaced by getDebugState
  // public getWorldState(): { ... } { ... }

  // --- Deterministic Logic ---

  /**
   * Determines the next action KORO should take based on a predefined sequence
   * and cooldowns, without using the LLM.
   * @param snapshot The current game state snapshot.
   * @returns An array containing zero or one action details object.
   */
  private _determineActionWithoutLLM(snapshot: GameStateSnapshot): DeterministicActionDetail[] {
    const now = Date.now();
    let selectedAction: DeterministicActionDetail | null = null;
    const maxAttempts = DETERMINISTIC_ATTACK_SEQUENCE.length;
    const currentHealthPercent = snapshot.koro_status.health_percent;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const currentIndex = this._nextDeterministicAttackIndex % DETERMINISTIC_ATTACK_SEQUENCE.length;
        const candidateAction = DETERMINISTIC_ATTACK_SEQUENCE[currentIndex];

        // Ensure candidateAction is defined before switch (handles empty sequence edge case)
        if (candidateAction === undefined) {
            this.logger.error('[Deterministic] Candidate action is undefined. Check sequence array.');
            this._nextDeterministicAttackIndex = (currentIndex + 1) % DETERMINISTIC_ATTACK_SEQUENCE.length; // Still advance index
            continue; // Skip to next attempt
        }

        let isValid = false;
        let intensity: 'low' | 'medium' | 'high' | undefined = undefined;

        switch (candidateAction) {
            case 'attack_heat':
            case 'attack_freeze':
                if (snapshot.game_context.can_initiate_environmental_attack) {
                    isValid = true;
                    if (currentHealthPercent > 70) intensity = 'low';
                    else if (currentHealthPercent > 30) intensity = 'medium';
                    else intensity = 'high';
                    this.logger.debug(`[Deterministic] Temp attack ${candidateAction} chosen. Health: ${currentHealthPercent.toFixed(1)}% -> Intensity: ${intensity}`);
                }
                break;
            case 'attack_blackout':
                if (now >= this._deterministicBlackoutReadyAt) isValid = true;
                break;
            case 'attack_uv_light':
                if (now >= this._deterministicUvLightReadyAt) isValid = true;
                break;
            case 'taunt_shield':
                if (now >= this._deterministicTauntReadyAt) isValid = true;
                break;
            case 'attack_electrify_ground': // <-- Check new action cooldown
                if (now >= this._deterministicElectrifyReadyAt) isValid = true;
                break;
            case 'attack_spawn_minion':
                 if (!this._isMinionActive && now >= this._deterministicMinionSpawnReadyAt) {
                    isValid = true;
                    this.logger.debug('[Deterministic] Minion spawn chosen.');
                } else {
                    if (this._isMinionActive) this.logger.debug('[Deterministic] Skipping minion spawn (already active).');
                    if (now < this._deterministicMinionSpawnReadyAt) this.logger.debug('[Deterministic] Skipping minion spawn (cooldown).');
                }
                break;
            case 'none':
                 isValid = false;
                 break;
            default:
                 // This check should now be safe as undefined is handled above
                 const _exhaustiveCheck: never = candidateAction;
                 this.logger.warn(`[Deterministic] Unknown action in sequence: ${_exhaustiveCheck}`);
                 isValid = false;
                 break;
        } // End switch

        if (isValid) {
            selectedAction = { action: candidateAction as Exclude<KoroActionType, 'none'>, intensity };
             this._nextDeterministicAttackIndex = (currentIndex + 1) % DETERMINISTIC_ATTACK_SEQUENCE.length;
             this.logger.info(`[Deterministic] Selected action: ${selectedAction.action} ${selectedAction.intensity ? `(Intensity: ${selectedAction.intensity})` : ''}`);
            break; 
        } else {
             this._nextDeterministicAttackIndex = (currentIndex + 1) % DETERMINISTIC_ATTACK_SEQUENCE.length;
               if (candidateAction !== 'none' && candidateAction !== 'attack_spawn_minion') {
                   this.logger.debug(`[Deterministic] Skipped action ${candidateAction} (Not ready/valid).`);
               }
        }
    } // End for loop
     if (!selectedAction) {
         this.logger.info('[Deterministic] No valid actions available in sequence this cycle.');
         return [];
     }
     return [selectedAction];
}
} 