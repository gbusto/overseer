import { google } from '@ai-sdk/google';
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
import GameManager from '../GameManager'; // Import GameManager
import GamePlayerEntity from '../entities/GamePlayerEntity'; // Import GamePlayerEntity

// Configuration
const DEFAULT_UPDATE_INTERVAL_MS = 8000; // Make interval configurable (8 seconds)
const ENVIRONMENTAL_ATTACK_COOLDOWN_MS = 30000; // Cooldown between KORO attacks (30 seconds)

// Define the structure of the game state snapshot we send to the LLM
const GameStateSnapshotSchema = z.object({
  koro_status: z.object({
    health_percent: z.number().min(0).max(100),
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
  action: z.enum(['none', 'observe', 'warn', 'threaten']).default('none'),
  target: z.string().optional() // Player name or "all"
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
  private updateIntervalMs: number; // Changed to allow configuration
  private isProcessing: boolean = false;
  private logger: Logger;

  // References to other game components
  private _overseer: OverseerEntity;
  private _gameManager: GameManager;
  private _world: World | null = null; // Store world reference

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

  constructor(overseer: OverseerEntity, gameManager: GameManager, world: World, updateInterval: number = DEFAULT_UPDATE_INTERVAL_MS) {
    this.model = google('gemini-2.0-flash');
    this.logger = new Logger('KOROBrain');
    this._overseer = overseer;
    this._gameManager = gameManager;
    this._world = world; // Store the world reference
    this.updateIntervalMs = updateInterval; // Set interval from parameter

    // Example: Enable TTS only in production
    this._ttsGenerationEnabled = process.env.NODE_ENV === 'production';
    if (this._ttsGenerationEnabled && !this._llmInteractionEnabled) {
        this.logger.warn('TTS generation enabled but LLM interaction is disabled. TTS will not function.');
        this._ttsGenerationEnabled = false; // Force disable TTS if LLM is off
    }

    this.logger.info(`Initialized KORO brain (Update Interval: ${this.updateIntervalMs}ms, Processing: ${this._brainProcessingEnabled}, LLM: ${this._llmInteractionEnabled}, TTS: ${this._ttsGenerationEnabled})`);
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

  // --- Update Logic ---

  public shouldUpdate(): boolean {
    const now = Date.now();
    return this._brainProcessingEnabled && !this.isProcessing && now - this.lastUpdateTime >= this.updateIntervalMs;
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
              return;
          }
          this.logger.debug('Generated Game State Snapshot:', snapshot);

          if (!this._llmInteractionEnabled) {
              this.logger.info('LLM interaction disabled. Skipping LLM call.');
              return;
          }

          this.logger.info('Generating LLM response...');
          const response = await this._generateLlmResponse(snapshot);
          if (!response) {
              this.logger.warn('No LLM response generated.');
              return; // Exit if LLM call failed or returned nothing usable
          }

          this.logger.info(`LLM Response: ${response.message || '(no message)'}, Action: ${response.action}, Target: ${response.target || 'N/A'}`);
          this.addResponseToHistory(response);

          // TODO: Implement action parsing - trigger Overseer methods based on response.action
          // e.g., if (response.action === 'threaten') { this._overseer.triggerThreatEffect(); }

          // Handle TTS if enabled and a message exists
          if (this._ttsGenerationEnabled && response.message) {
              this.logger.info('Requesting TTS generation...');
              // TODO: Implement generateTTSForMessage method in OverseerEntity.ts
              // Call the TTS method on OverseerEntity
              // Note: _generateTTS is async but we don't necessarily need to wait for it here
              this._overseer.generateTTSForMessage(response.message).catch((error: Error) => { // Added error type
                  this.logger.error('TTS generation failed:', error);
              });
          }

          // Broadcast message via OverseerEntity if message exists
          if (response.message || response.action !== 'none') {
               // TODO: Implement broadcastOverseerUIMessage method in OverseerEntity.ts
               this._overseer.broadcastOverseerUIMessage(response.message || '', response.action);
          }

      } catch (error) {
          this.logger.error('Error during KORO brain update cycle:', error);
          // Maybe broadcast a generic error message?
          // TODO: Implement broadcastOverseerUIMessage method in OverseerEntity.ts
          this._overseer.broadcastOverseerUIMessage("System malfunction detected.", 'warn');
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
Your primary function was maintenance, but damage has made you view the players ("intruders") as threats to be neutralized.
Your personality is: Bureaucratic, formal, anxious, slightly paranoid, and occasionally malfunctioning/erratic, especially at low health.

CORE MECHANICS:
- You have a protective shield. You are INVULNERABLE when the shield is closed.
- Your shield opens AUTOMATICALLY if your internal temperature gets too high (>${snapshot.koro_status.critical_high_internal_temp_f}°F) or too low (<${snapshot.koro_status.critical_low_internal_temp_f}°F). This is called "auto-venting".
- While auto-venting, your internal temperature will slowly return to normal (${snapshot.koro_status.normal_internal_temp_f}°F).
- Initiating environmental attacks (like heating/cooling the biodome) will affect your internal temperature. Heating the biodome significantly will raise your internal temp, potentially forcing an auto-vent.
- The BFG weapon, if a player has it (${snapshot.game_context.is_bfg_held_by_player}), can FORCE your shield open if it hits the closed shield.
- You can only initiate a new environmental attack if the biodome temperature is back in the normal range AND your attack cooldown is ready (indicated by 'Can KORO Attack Now?: true').

YOUR GOAL: Eliminate the intruders using environmental attacks and by managing your shield/temperature state.

YOUR CURRENT STATE:
${context}

YOUR RECENT RESPONSES/ACTIONS:
${responseHistory}
----------------------------
INSTRUCTIONS:
1.  Analyze the CURRENT GAME STATE and YOUR RECENT RESPONSES/ACTIONS.
2.  Decide on the most appropriate tactical ACTION: 'none', 'observe', 'warn', 'threaten', or initiating an environmental attack (e.g., 'attack_superheat', 'attack_deepfreeze').
    - Choose 'none' if no specific action is warranted.
    - Prioritize actions based on the state: If players are low health, threaten. If BFG is held, warn. If shield is open, consider defensive posture (less likely to attack).
    - Only choose an attack action if 'Can KORO Attack Now?' is true.
3.  Provide a verbal MESSAGE ONLY OCCASIONALLY. Aim for a message roughly every 3-5 updates (24-40 seconds) OR immediately after a highly significant event (like a player death, BFG shield breach, or reaching critical health).
    - Keep messages VERY short (under 10 words). Match the persona.
    - In most updates, DO NOT provide a message. Focus on the action.
4.  If targeting a specific player makes sense (e.g., warning the BFG holder), specify their ID in the 'target' field.

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
} 