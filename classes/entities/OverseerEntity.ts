import {
  Entity,
  RigidBodyType,
  ColliderShape,
  Audio,
  EntityEvent,
  World,
  Vector3,
  ChatEvent,
  PlayerEvent
} from 'hytopia';

import type {
  EntityOptions,
  Vector3Like,
  QuaternionLike
} from 'hytopia';

import { KOROBrain } from '../ai/KOROBrain';
import type { KoroMode } from '../ai/KOROBrain';
import { Logger } from '../../utils/logger';
import GameManager from '../GameManager';
import { GameState } from '../GameManager';
import BiodomeController from '../BiodomeController';

// Configuration for TTS API
const TTS_API_URL = process.env.TTS_API_URL || 'http://localhost:8000/tts';
const TTS_API_TOKEN = process.env.TTS_API_TOKEN;

/**
 * OverseerEntity class represents the floating antagonist in the game
 * It extends the base Entity class with custom behavior
 */
export default class OverseerEntity extends Entity {
  // Track the world for later use
  private _world: World | null = null;
  
  // Entity properties
  private _floatHeight: number = 30;
  private _bobAmplitude: number = 0.5;
  private _bobSpeed: number = 0.0005;
  private _rotationSpeed: number = 0.0001;
  
  // Sound effects
  private _ttsAudio: Audio | null = null;
  
  // AI Brain
  private _brain: KOROBrain | null = null;
  
  // Biodome controller
  private _biodome: BiodomeController | null = null;
  
  // Temperature regulation properties
  private _internalTemp: number = 75; // Default internal temperature (F)
  private _normalInternalTemp: number = 75; // Baseline normal temperature
  private _biodomeInfluenceRate: number = 0.05; // How strongly biodome temp affects internal temp (per second)
  private _tempRegulationRateOpen: number = 0.2; // Rate of returning to normal temp when shield OPEN (per second)
  private _tempRegulationRateClosed: number = 0.02; // Rate of returning to normal temp when shield CLOSED (per second)
  private _lastInternalTempUpdate: number = 0; // Throttle UI updates
  private _internalTempUpdateInterval: number = 500; // Update UI every 500ms max
  
  // Auto-venting properties
  private _autoVentEnabled: boolean = false; // Is the auto-vent feature active?
  private _isAutoVenting: boolean = false; // Is KORO currently venting due to temperature?
  private readonly AUTO_VENT_HIGH_THRESHOLD: number = 105; // Temp above which auto-vent triggers
  private readonly AUTO_VENT_LOW_THRESHOLD: number = 45;  // Temp below which auto-vent triggers
  private readonly AUTO_VENT_SAFE_HIGH: number = 100; // Venting stops when temp is below this
  private readonly AUTO_VENT_SAFE_LOW: number = 50;   // Venting stops when temp is above this
  private _autoVentCooldownUntil: number = 0; // Timestamp until next auto-vent is allowed
  private readonly AUTO_VENT_COOLDOWN_MS: number = 20000; // Cooldown between auto-vents (20s)
  
  // BFG Shield Break properties
  private _bfgShieldBreakEnabled: boolean = false; // Can the BFG force the shield open?
  private readonly BFG_SHIELD_BREAK_DURATION_MS: number = 5000; // How long shield stays open after BFG hit
  
  // Next update check
  private _nextUpdateCheck: number = 0;
  private _updateCheckInterval: number = 5000; // Check every 5 seconds
  
  // Health - will affect TTS voice
  private _health: number = 100;
  
  // Flag to control whether entity takes damage
  private _invulnerable: boolean = true;
  
  // Shield entities
  private _shieldTop: Entity | null = null;
  private _shieldBottom: Entity | null = null;
  private _shieldActive: boolean = true;
  
  // Shield positioning
  private _shieldOffsets = {
    top: { x: 0, y: 1.8, z: 0 },
    bottom: { x: 0, y: -1.8, z: 0 }
  };

  private _shieldOpenOffsets = {
    top: { x: 0, y: 7, z: 0 },
    bottom: { x: 0, y: -7, z: 0 }
  };

  // Shield animation
  private _shieldAnimationSpeed = 0.05; // Units per tick
  private _isAnimating: boolean = false;
  private _shieldAnimationTimer: NodeJS.Timeout | null = null;
  
  // Logger
  private _logger: Logger;

  private _messageDisplayTimeoutId: NodeJS.Timeout | null = null;
  private _messageDisplayDuration: number = 8000; // Display messages for 8 seconds

  // Shield Taunt State
  private _isTaunting: boolean = false;

  constructor(options: Partial<EntityOptions> = {}) {
    // Set up the entity with fixed physics to stay in place
    super({
      name: 'Overseer',
      tag: 'overseer', // Set tag for easy lookup
      modelUri: 'models/overseer/koro.glb',
      modelScale: 4, // Make it larger and more imposing
      // Physics options to keep it suspended in the air
      opacity: 0.99,
      rigidBodyOptions: {
        // KINEMATIC_POSITION allows us to control the position directly
        // and it won't be affected by gravity or other forces
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [
          {
            shape: ColliderShape.CYLINDER,
            radius: 2, // Large detection radius
            halfHeight: 2,
            isSensor: true, // Make it non-solid for gameplay
          }
        ]
      },
      ...options // Allow overriding default options
    });
    
    // Create logger
    this._logger = new Logger('OverseerEntity');

    // Set up tick handler for animation
    this.on(EntityEvent.TICK, this._onTick);
    
    // Set up spawn handler to initialize components
    this.on(EntityEvent.SPAWN, this._onSpawned);
    
    // Set up despawn handler for cleanup
    this.on(EntityEvent.DESPAWN, this._onDespawned);
    
    // Check if TTS is configured
    if (!TTS_API_TOKEN) {
      this._logger.warn('TTS_API_TOKEN not set - speech functionality may be limited.');
    } else {
      this._logger.info('TTS API token found - speech functionality potentially available.');
    }
  }

  /**
   * Spawns the overseer entity in the world
   * @param world The world to spawn in
   * @param position The position to spawn at (will be adjusted to float height)
   * @param rotation Optional rotation
   */
  public spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    // Ensure the entity spawns at the correct height
    const finalPosition = {
      x: position.x,
      y: this._floatHeight, // Override with float height
      z: position.z
    };
    
    this._logger.info(`Spawning at position (${finalPosition.x}, ${finalPosition.y}, ${finalPosition.z})`);
    
    // Call the parent spawn method
    super.spawn(world, finalPosition, rotation);
    
    // Store the world reference
    this._world = world;
    
    // Pass world reference and default interval (8s)
    this._brain = new KOROBrain(this, GameManager.instance, world);
    
    // Start with the brain processing disabled until game starts
    this._brain.setBrainProcessingEnabled(true);
    this._logger.info('KORO Brain initialized but processing disabled until game starts.');
    
    // Initialize the biodome controller
    this._biodome = new BiodomeController(world);
    this._logger.info('Biodome controller initialized');
    
    // Create and spawn shield
    this._createShield(world);
    
    // Set up chat event listeners after spawn
    if (world) {
      this._setupEventListeners(world);
      
      // Send initial health to all players
      this._updateAllPlayersWithHealth();
      
      this._logger.info('Registered event listeners');
    }
  }

  /**
   * Create and initialize the shield entities
   */
  private _createShield(world: World): void {
    // Create top shield half
    this._shieldTop = new Entity({
      name: 'OverseerShieldTop',
      modelUri: 'models/overseer/shield-half.glb', // Use cube primitive which should definitely work
      modelScale: 6.5,
      opacity: 0.99,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 3,
            isSensor: true,
          }
        ]
      },
    });

    // Create bottom shield half
    this._shieldBottom = new Entity({
      name: 'OverseerShieldBottom',
      modelUri: 'models/overseer/shield-half.glb', // Use sphere primitive which should definitely work
      modelScale: 6.5,
      opacity: 0.99,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 3,
            isSensor: true,
          }
        ]
      },
    });
    
    // Calculate initial positions based on overseer position
    const topPosition = {
      x: this.position.x + this._shieldOffsets.top.x,
      y: this.position.y + this._shieldOffsets.top.y,
      z: this.position.z + this._shieldOffsets.top.z,
    };
    
    const bottomPosition = {
      x: this.position.x + this._shieldOffsets.bottom.x,
      y: this.position.y + this._shieldOffsets.bottom.y,
      z: this.position.z + this._shieldOffsets.bottom.z,
    };
    
    // Spawn shields at calculated positions
    this._shieldTop.spawn(world, topPosition);
    this._shieldBottom.spawn(world, bottomPosition);
    
    // Rotate bottom shield 180 degrees around X axis to face upward
    this._shieldBottom.setRotation({ x: 1, y: 0, z: 0, w: 0 });
    
    // Make sure the shield is closed by default (protecting KORO)
    this._shieldActive = true;
    
    this._logger.info('Created and spawned shield entities');
  }

  /**
   * Calculate the current shield positions based on overseer position and active state
   */
  private _calculateShieldPositions(): { top: Vector3Like, bottom: Vector3Like } {
    // FIXED: When shield is active (true), it's closed, so use normal offsets
    // When inactive (false), it's open, so use open offsets
    const offsets = this._shieldActive ? this._shieldOffsets : this._shieldOpenOffsets;
    
    return {
      top: {
        x: this.position.x + offsets.top.x,
        y: this.position.y + offsets.top.y,
        z: this.position.z + offsets.top.z,
      },
      bottom: {
        x: this.position.x + offsets.bottom.x,
        y: this.position.y + offsets.bottom.y,
        z: this.position.z + offsets.bottom.z,
      }
    };
  }

  /**
   * Set shield half offsets for testing
   */
  public setShieldPositions(topPos: Vector3Like, bottomPos: Vector3Like): void {
    if (this._shieldTop && this._shieldBottom) {
      this._shieldTop.setPosition(topPos);
      this._shieldBottom.setPosition(bottomPos);
      
      // Calculate and store offsets from current overseer position
      this._shieldOffsets = {
        top: {
          x: topPos.x - this.position.x,
          y: topPos.y - this.position.y,
          z: topPos.z - this.position.z
        },
        bottom: {
          x: bottomPos.x - this.position.x,
          y: bottomPos.y - this.position.y,
          z: bottomPos.z - this.position.z
        }
      };
      
      // Update open offsets based on closed offsets
      this._shieldOpenOffsets = {
        top: {
          x: this._shieldOffsets.top.x,
          y: this._shieldOffsets.top.y + 2, // Move up 2 units when open
          z: this._shieldOffsets.top.z
        },
        bottom: {
          x: this._shieldOffsets.bottom.x,
          y: this._shieldOffsets.bottom.y - 2, // Move down 2 units when open
          z: this._shieldOffsets.bottom.z
        }
      };
      
      // Log the new offsets
      this._logger.info(`Shield offsets updated - Top: (${this._shieldOffsets.top.x}, ${this._shieldOffsets.top.y}, ${this._shieldOffsets.top.z}), Bottom: (${this._shieldOffsets.bottom.x}, ${this._shieldOffsets.bottom.y}, ${this._shieldOffsets.bottom.z})`);
    }
  }

  /**
   * Open the shield
   */
  public openShield(duration?: number): boolean {
    // Stop any ongoing animation
    if (this._shieldAnimationTimer) {
      clearInterval(this._shieldAnimationTimer);
      this._shieldAnimationTimer = null;
    }
    
    // FIXED: When shield is open, it's not protecting KORO, so set to false
    this._shieldActive = false;
    
    if (this._shieldTop && this._shieldBottom) {
      // Start animation to open shield
      this._animateShield(true);
    }
    
    // If duration provided, close shield after duration
    if (duration) {
      setTimeout(() => {
        this.closeShield();
      }, duration);
    }
    
    this._logger.info(`Shield opened, KORO is now vulnerable to direct hits`);
    return !this._shieldActive; // Return true if opened (not active)
  }
  
  /**
   * Close the shield
   */
  public closeShield(): boolean {
    // Stop any ongoing animation
    if (this._shieldAnimationTimer) {
      clearInterval(this._shieldAnimationTimer);
      this._shieldAnimationTimer = null;
    }
    
    // FIXED: When shield is closed, it's protecting KORO, so set to true
    this._shieldActive = true;
    
    if (this._shieldTop && this._shieldBottom) {
      // Start animation to close shield
      this._animateShield(false);
    }
    
    this._logger.info(`Shield closed, KORO is now protected from hits`);
    return this._shieldActive; // Return true if closed (active)
  }

  /**
   * Animate shield opening/closing using setTimeout
   */
  private _animateShield(opening: boolean): void {
    if (!this._shieldTop || !this._shieldBottom) return;
    
    const targetOffsets = opening ? this._shieldOpenOffsets : this._shieldOffsets;
    const animationStepMs = 16; // ~60fps
    const animationSpeed = 0.1; // Units per step
    
    // Animation function using setInterval
    this._shieldAnimationTimer = setInterval(() => {
      let animationComplete = true;
      
      // Get current positions
      const topPos = this._shieldTop?.position;
      const bottomPos = this._shieldBottom?.position;
      
      if (!topPos || !bottomPos) return;
      
      // Calculate target positions based on overseer position
      const targetTop = {
        x: this.position.x + targetOffsets.top.x,
        y: this.position.y + targetOffsets.top.y,
        z: this.position.z + targetOffsets.top.z
      };
      
      const targetBottom = {
        x: this.position.x + targetOffsets.bottom.x,
        y: this.position.y + targetOffsets.bottom.y,
        z: this.position.z + targetOffsets.bottom.z
      };

      // Move top shield
      const topDiff = {
        y: targetTop.y - topPos.y
      };

      if (Math.abs(topDiff.y) > 0.01) {
        const topNewY = topPos.y + Math.sign(topDiff.y) * Math.min(Math.abs(topDiff.y), animationSpeed);
        this._shieldTop?.setPosition({ x: targetTop.x, y: topNewY, z: targetTop.z });
        animationComplete = false;
      } else {
        // Make sure X and Z coordinates match current overseer position
        this._shieldTop?.setPosition({ x: targetTop.x, y: topPos.y, z: targetTop.z });
      }

      // Move bottom shield
      const bottomDiff = {
        y: targetBottom.y - bottomPos.y
      };

      if (Math.abs(bottomDiff.y) > 0.01) {
        const bottomNewY = bottomPos.y + Math.sign(bottomDiff.y) * Math.min(Math.abs(bottomDiff.y), animationSpeed);
        this._shieldBottom?.setPosition({ x: targetBottom.x, y: bottomNewY, z: targetBottom.z });
        animationComplete = false;
      } else {
        // Make sure X and Z coordinates match current overseer position
        this._shieldBottom?.setPosition({ x: targetBottom.x, y: bottomPos.y, z: targetBottom.z });
      }
      
      // If animation is complete, clear the interval
      if (animationComplete) {
        if (this._shieldAnimationTimer) {
          clearInterval(this._shieldAnimationTimer);
          this._shieldAnimationTimer = null;
        }
      }
    }, animationStepMs);
  }

  /**
   * Handle tick updates for animation and movement
   */
  private _onTick = ({ entity, tickDeltaMs }: { entity: Entity; tickDeltaMs: number }): void => {
    if (!this.isSpawned || !this._world) return;
    
    // Create a subtle floating animation
    const time = Date.now();
    
    // Calculate bobbing motion
    const newY = this._floatHeight + Math.sin(time * this._bobSpeed) * this._bobAmplitude;
    
    // Calculate rotation
    const currentRotation = this.rotation;
    const rotationAmount = tickDeltaMs * this._rotationSpeed;
    
    // Update position to create floating effect
    this.setPosition({
      x: this.position.x,
      y: newY,
      z: this.position.z
    });
    
    // Slowly rotate for an ominous effect
    this.setRotation({
      x: currentRotation.x,
      y: currentRotation.y + rotationAmount,
      z: currentRotation.z,
      w: currentRotation.w
    });
    
    // Update shield positions if not animating
    if (!this._shieldAnimationTimer && this._shieldTop && this._shieldBottom) {
      const positions = this._calculateShieldPositions();
      this._shieldTop.setPosition(positions.top);
      this._shieldBottom.setPosition(positions.bottom);
    }
    
    // Update biodome controller
    if (this._biodome) {
      this._biodome.onTick(tickDeltaMs);
    }
    
    // Update internal temperature
    this._updateInternalTemperature(tickDeltaMs);
    
    // Check if auto-venting needs to start or stop
    this._checkAutoVenting();
    
    // Check for AI updates periodically to avoid checking every tick
    if (time > this._nextUpdateCheck) {
      this._nextUpdateCheck = time + this._updateCheckInterval;
      this._checkForBrainUpdate();
    }
  }

  private _setupEventListeners(world: World): void {
    world.chatManager.on(ChatEvent.BROADCAST_MESSAGE, this._onChatMessage);
    world.on(PlayerEvent.JOINED_WORLD, this._onPlayerJoined);
    world.on(PlayerEvent.LEFT_WORLD, this._onPlayerLeft);
  }

  /**
   * Makes the overseer face a direction
   * @param direction The direction to face
   */
  public setRotationToFace(direction: Vector3Like): void {
    if (!this.isSpawned) return;

    // Normalize the direction
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    if (length === 0) return;

    const normalizedDirection = {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length
    };

    // Calculate rotation quaternion to face direction
    // This uses a simplified look-at calculation that only considers yaw rotation
    const yaw = Math.atan2(normalizedDirection.x, normalizedDirection.z);
    const halfYaw = yaw / 2;

    this.setRotation({
      x: 0,
      y: Math.sin(halfYaw),
      z: 0,
      w: Math.cos(halfYaw)
    });
    
    this._logger.debug(`Rotated to face direction (${direction.x}, ${direction.y}, ${direction.z})`);
  }

  /**
   * Toggle KORO's automatic updates on/off
   * @param enabled Whether updates should be enabled
   * @returns Current enabled state
   */
  public toggleKOROUpdates(enabled: boolean): boolean {
    this._brain?.setBrainProcessingEnabled(enabled);
    return this._brain?.isBrainProcessingEnabled() || false;
  }
  
  /**
   * Get the current state of KORO's world model
   * @returns Current world state (player count and recent events)
   */
  public getKOROState(): {playerCount: number, recentEvents: any[]} {
    // Return a simplified state or use the new debug state
    const debugState = this._brain?.getDebugState();
    return {
        // Use length of players array from snapshot if available, otherwise 0
        playerCount: debugState?.recentEvents?.length || 0, // Placeholder - needs better logic if used
        recentEvents: debugState?.recentEvents || []
    };
    // Alternatively, return basic info: return { brainEnabled: this.isKOROEnabled() };
  }
  
  /**
   * Force KORO to generate a response immediately
   */
  public forceKOROUpdate(): void {
    this._logger.info('Forcing immediate KORO update');
    this._brain?.generateUpdate();
  }

  /**
   * Set KORO's health level - affects voice
   * @param health Value from 0-100
   */
  public setHealth(health: number): void {
    this._health = Math.max(0, Math.min(100, health));
    this._logger.info(`KORO health set to ${this._health}`);
    
    // Update all player UIs with the new health
    if (this._world) {
      const players = this._world.entityManager.getAllPlayerEntities().map(entity => entity.player);
      players.forEach(player => {
        player.ui.sendData({
          type: 'overseer-health-update',
          health: this._health,
          maxHealth: 100
        });
      });
    }
  }
  
  /**
   * Get KORO's current health level
   */
  public getHealth(): number {
    return this._health;
  }

  /**
   * Called when a player joins the world
   */
  private _onPlayerJoined = ({ player }: { player: any }): void => {
    if (!this._world || !this._brain) return;
    const needsImmediateResponse = this._brain.addEventWithPriority(
      'player_join',
      `Player ${player.username || player.id} entered the facility`,
      'high', // Keep high for potential greeting/initial scan?
      {
        playerId: player.id,
        playerName: player.username || player.id,
        position: player.position
      }
    );
    this._logger.info(`Player joined: ${player.username || player.id}`);
  }
  
  /**
   * Called when a player leaves the world
   */
  private _onPlayerLeft = ({ player }: { player: any }): void => {
    if (!this._world || !this._brain) return;
    const remainingPlayers = this._world.entityManager.getAllPlayerEntities().length -1;
    const priority = remainingPlayers === 0 ? 'high' : 'medium'; // Still useful priority info for LLM
    const needsImmediateResponse = this._brain.addEventWithPriority(
      'player_leave',
      `Player ${player.username || player.id} left the facility`,
      priority,
      {
        playerId: player.id,
        playerName: player.username || player.id,
        remainingPlayers: remainingPlayers
      }
    );
    this._logger.info(`Player left: ${player.username || player.id}, remaining: ${remainingPlayers}`);
  }

  /**
   * Called when the entity is spawned
   */
  private _onSpawned = (): void => {
    // Keep track of world
    this._world = this.world || null;
    
    // Initialize internal temperature
    this._internalTemp = this._normalInternalTemp;
    
    // Send initial temperature data
    if (this._world) {
      this._updateInternalTempUI();
    }
    
    this._logger.info('Spawned and initialized');
  }

  /**
   * Called when the entity is despawned
   */
  private _onDespawned = (): void => {
    
    // Remove chat event listeners
    if (this._world) {
      this._world.chatManager.off(ChatEvent.BROADCAST_MESSAGE, this._onChatMessage);
      this._world.off(PlayerEvent.JOINED_WORLD, this._onPlayerJoined);
      this._world.off(PlayerEvent.LEFT_WORLD, this._onPlayerLeft);
      
      this._logger.info('Unregistered event listeners');
    }
    
    // Clear message timeout if it exists
    if (this._messageDisplayTimeoutId) {
      clearTimeout(this._messageDisplayTimeoutId);
      this._messageDisplayTimeoutId = null;
    }
    
    // Clean up biodome controller reference
    this._biodome = null;
    
    this._world = null;
  }
  
  /**
   * Handle chat messages
   */
  private _onChatMessage = ({ player, message }: { player?: any, message: string }): void => {
    if (!player || !message || !this._brain) return;
    // Add chat message, brain decides priority
    const needsImmediateResponse = this._brain.addChatMessage(player.username || player.id, message);
    this._logger.debug(`Chat message from ${player.username || player.id}: ${message}`);
  }
  
  /**
   * Check if the brain should generate a new response
   */
  private _checkForBrainUpdate(): void {
    if (this._brain && this._brain.shouldUpdate()) {
      this._logger.debug('KORO update check triggered');
      this._brain.generateUpdate();
    }
  }
  
  /**
   * Generate and handle an AI response
   */
  private async _generateBrainResponse(): Promise<void> {
    if (!this._brain || !this._brain.isBrainProcessingEnabled()) {
      this._logger.info('KORO brain processing is disabled - skipping update');
      return;
    }

    if (!this._world) {
      this._logger.error('No world - cannot generate response');
      return;
    }

    try {
      // Trigger the update in KOROBrain
      await this._brain.generateUpdate();
    } catch (error) {
      this._logger.error('Error generating brain response', error);
    }
  }
  
  /**
   * Broadcast a message to all player UIs
   * @param message The message to broadcast
   * @param action The action type (none, observe, warn, threaten)
   */
  private _broadcastOverseerMessage(message: string, action: string): void {
    if (!this._world) return;
    
    // Get all players in the world
    const players = this._world.entityManager.getAllPlayerEntities().map(entity => entity.player);
    
    // Send message to each player's UI
    players.forEach(player => {
      player.ui.sendData({
        type: 'overseer-message',
        message,
        action
      });
    });
    
    this._logger.debug(`Sent overseer message to ${players.length} players: "${message}" (${action})`);
  }
  
  /**
   * Generate TTS for a message and play it
   */
  private async _generateTTS(message: string): Promise<void> {
    if (!this._world || !TTS_API_TOKEN) return;
    
    try {
      this._logger.debug(`Generating TTS for message: "${message}"`);
      
      // Make API request to generate TTS
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': TTS_API_TOKEN
        },
        body: JSON.stringify({
          text: message,
          health: this._health
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`TTS API error: ${error}`);
      }
      
      // Define the expected response type
      interface TTSResponse {
        success: boolean;
        filepath: string;
        message: string;
      }
      
      const data = await response.json() as TTSResponse;
      
      if (!data.success || !data.filepath) {
        throw new Error(`TTS API returned invalid response: ${JSON.stringify(data)}`);
      }
      
      this._logger.debug(`TTS generated successfully: ${data.filepath}`);
      
      // Stop any previous TTS audio
      if (this._ttsAudio) {
        this._ttsAudio.pause();
        this._ttsAudio = null;
      }
      
      // Create and play the new TTS audio
      this._ttsAudio = new Audio({
        attachedToEntity: this,
        uri: data.filepath, // Now points to a .wav file
        loop: false,
        volume: 0.8,
        referenceDistance: 30
      });
      
      this._ttsAudio.play(this._world);
      
    } catch (error) {
      this._logger.error('Error generating TTS', error);
    }
  }

  /**
   * Get whether KORO's automatic updates are enabled
   * @returns True if automatic updates are enabled, false otherwise
   */
  public isKOROEnabled(): boolean {
    return this._brain?.isBrainProcessingEnabled() || false;
  }

  /**
   * Update all connected players with current health
   */
  private _updateAllPlayersWithHealth(): void {
    if (!this._world) return;
    
    // Check if game is active before sending health updates
    if (GameManager.instance.gameState !== 'ACTIVE') {
      return; // Don't send health updates unless game is active
    }
    
    const players = this._world.entityManager.getAllPlayerEntities().map(entity => entity.player);
    players.forEach(player => {
      player.ui.sendData({
        type: 'overseer-health-update',
        health: this._health,
        maxHealth: 100
      });
    });
  }

  /**
   * Check if the shield is currently open
   * @returns True if the shield is open, false if it's closed
   */
  public isShieldOpen(): boolean {
    // FIXED: Shield is open when _shieldActive is false
    return !this._shieldActive;
  }

  /**
   * Set whether the overseer is invulnerable to damage
   * @param invulnerable True to make invulnerable, false to make vulnerable
   */
  public setInvulnerable(invulnerable: boolean): void {
    this._invulnerable = invulnerable;
    this._logger.info(`KORO invulnerability set to: ${invulnerable}`);
  }

  /**
   * Check if the overseer is currently invulnerable
   * @returns True if invulnerable, false if vulnerable
   */
  public isInvulnerable(): boolean {
    return this._invulnerable;
  }

  /**
   * Apply damage to the overseer if it's vulnerable
   * @param amount Amount of damage to apply
   * @returns Whether damage was applied
   */
  public takeDamage(amount: number): boolean {
    // FIXED: If invulnerable or shield is active (closed), ignore damage
    if (this._invulnerable || this._shieldActive) {
      this._logger.info(`Damage ignored: ${amount} (invulnerable: ${this._invulnerable}, shield closed: ${this._shieldActive})`);
      // Maybe log a 'shield_hit' event?
      // this._brain?.addEventWithPriority('shield_hit', `Shield blocked ${amount} damage`, 'low');
      return false;
    }

    // Calculate new health value
    const newHealth = Math.max(0, this._health - amount);

    // Only update if health actually changed
    if (newHealth !== this._health) {
      const oldHealth = this._health;
      this._logger.info(`Taking damage: ${amount}, health: ${oldHealth} -> ${newHealth}`);
      this.setHealth(newHealth); // This updates UI

      // Log the damage event to the brain
      this._brain?.addEventWithPriority(
          'koro_damage',
          `KORO took ${amount} damage.`,
          'medium', // Medium priority - notable, but maybe not worth immediate interrupt
          { amount: amount, oldHealth: oldHealth, newHealth: newHealth }
      );

      // Check if health dropped below critical threshold
      const criticalThreshold = 10; // Example threshold
      if (oldHealth >= criticalThreshold && newHealth < criticalThreshold) {
          this._logger.warn('KORO health critical!');
          this._brain?.addEventWithPriority(
              'koro_health_critical',
              `KORO health dropped below ${criticalThreshold}%`,
              'high', // High priority - this IS a significant state change
              { health: newHealth }
          );
      }

      // TODO: Play non-verbal damage sound effect here
      // Example: AudioManager.instance.playAttachedSound(this, 'koro_damage_sfx', { volume: 0.8 });

      return true;
    }

    return false;
  }

  /**
   * Public interface for controlling the biodome temperature
   * @param temperature Target temperature in Fahrenheit
   * @param changeRate Optional: Speed of temperature change in degrees per second
   * @param autoReset Optional: Whether to automatically reset to normal temperature after a delay
   */
  public setBiodomeTemperature(temperature: number, changeRate?: number, autoReset: boolean = true): void {
    if (this._biodome) {
      this._biodome.setTemperature(temperature, changeRate, autoReset);
    } else {
      this._logger.error('Cannot set biodome temperature: Biodome controller not initialized');
    }
  }

  /**
   * Reset biodome temperature to normal
   */
  public resetBiodomeTemperature(): void {
    if (this._biodome) {
      this._biodome.resetTemperature();
    }
  }

  /**
   * Get current biodome temperature
   */
  public getBiodomeTemperature(): number {
    return this._biodome ? this._biodome.getCurrentTemperature() : this._normalInternalTemp;
  }

  /**
   * Toggle biodome status UI visibility for a specific player or all players
   * @param player Optional specific player to toggle UI for
   */
  public toggleBiodomeUI(player?: any): void {
    if (this._biodome) {
      this._biodome.toggleBiodomeUI(player);
    } else {
      this._logger.error('Cannot toggle biodome UI: Biodome controller not initialized');
    }
  }

  /**
   * Enable or disable biodome environmental damage effects
   * @param enabled Whether damage should be applied
   * @returns Current enabled state
   */
  public setBiodomeEnvironmentalDamageEnabled(enabled: boolean): boolean {
    if (this._biodome) {
      this._biodome.setEnvironmentalDamageEnabled(enabled);
      return this._biodome.isEnvironmentalDamageEnabled();
    } else {
      this._logger.error('Cannot toggle biodome environmental damage: Biodome controller not initialized');
      return false;
    }
  }

  /**
   * Check if biodome environmental damage is enabled
   * @returns True if environmental damage is enabled, false otherwise
   */
  public isBiodomeEnvironmentalDamageEnabled(): boolean {
    return this._biodome ? this._biodome.isEnvironmentalDamageEnabled() : false;
  }

  /**
   * Update internal temperature based on internal regulation and biodome influence.
   * @param tickDeltaMs Time since last tick in milliseconds
   */
  private _updateInternalTemperature(tickDeltaMs: number): void {
    if (!this._biodome) return;
    
    const biodomeTemp = this._biodome.getCurrentTemperature();
    const normalBiodomeTemp = this._biodome.getNormalTemperature();
    const deltaSeconds = tickDeltaMs / 1000;
    let totalChange = 0;
    
    // 1. Internal Regulation: Always try to return to normal temp
    const tempDifferenceFromNormal = this._internalTemp - this._normalInternalTemp;
    if (Math.abs(tempDifferenceFromNormal) > 0.1) { // Only regulate if significantly different
      const regulationRate = this._shieldActive ? this._tempRegulationRateClosed : this._tempRegulationRateOpen;
      const regulationChange = -tempDifferenceFromNormal * regulationRate * deltaSeconds;
      totalChange += regulationChange;
      // this._logger.debug(`Internal regulation change: ${regulationChange.toFixed(3)} (Rate: ${regulationRate}, ShieldClosed: ${this._shieldActive})`);
    }
    
    // 2. Biodome Influence: External temperature pushes internal temp away from normal
    const biodomeDifferenceFromNormal = biodomeTemp - normalBiodomeTemp;
    if (Math.abs(biodomeDifferenceFromNormal) > 1.0) { // Only apply influence if biodome temp is notably different
      const normalRange = 50; // How many degrees from normal is considered "full extremity"
      const extremityFactor = Math.min(Math.abs(biodomeDifferenceFromNormal) / normalRange, 1);
      const biodomeInfluenceChange = biodomeDifferenceFromNormal * this._biodomeInfluenceRate * extremityFactor * deltaSeconds;
      totalChange += biodomeInfluenceChange;
      // this._logger.debug(`Biodome influence change: ${biodomeInfluenceChange.toFixed(3)} (Extremity: ${extremityFactor.toFixed(2)})`);
    }
    
    // Apply the total change
    if (Math.abs(totalChange) > 0.001) {
      this._internalTemp += totalChange;
      // this._logger.debug(`Total internal temp change: ${totalChange.toFixed(3)} -> New temp: ${this._internalTemp.toFixed(1)}°F`);
    }
    
    // Clamp temperature just in case (e.g., prevent extreme overshoot)
    this._internalTemp = Math.max(-100, Math.min(300, this._internalTemp)); // Wider safety range
    
    // Update UI at regulated intervals
    const currentTime = Date.now();
    if (currentTime - this._lastInternalTempUpdate >= this._internalTempUpdateInterval) {
      this._updateInternalTempUI();
      this._lastInternalTempUpdate = currentTime;
    }
  }
  
  /**
   * Send internal temperature updates to all player UIs
   */
  private _updateInternalTempUI(): void {
    if (!this._world) return;
    
    const players = this._world.entityManager.getAllPlayerEntities().map(entity => entity.player);
    players.forEach(player => {
      player.ui.sendData({
        type: 'overseer-temp-update',
        temperature: Math.round(this._internalTemp), // Round to integer for display
        normal: this._normalInternalTemp
      });
    });
  }
  
  /**
   * Get the current internal temperature of the Overseer
   * @returns Current internal temperature in Fahrenheit
   */
  public getInternalTemperature(): number {
    return this._internalTemp;
  }
  
  /**
   * Get the normal internal temperature baseline
   * @returns Normal internal temperature in Fahrenheit
   */
  public getNormalInternalTemperature(): number {
    return this._normalInternalTemp;
  }
  
  /**
   * Set the internal temperature of the Overseer
   * @param temp New temperature in Fahrenheit
   */
  public setInternalTemperature(temp: number): void {
    this._internalTemp = Math.max(0, Math.min(200, temp)); // Clamp to reasonable range
    this._updateInternalTempUI();
    this._logger.debug(`Internal temperature set to ${this._internalTemp.toFixed(1)}°F`);
  }

  /**
   * Enable or disable the automatic shield venting mechanism based on internal temperature.
   * @param enabled Whether auto-venting should be enabled.
   */
  public setAutoVentEnabled(enabled: boolean): void {
    this._autoVentEnabled = enabled;
    this._logger.info(`KORO Auto-Venting ${enabled ? 'Enabled' : 'Disabled'}.`);
    // If disabling while venting, stop the vent immediately
    if (!enabled && this._isAutoVenting) {
      this._stopAutoVenting();
    }
  }

  /**
   * Check if the automatic shield venting mechanism is enabled.
   * @returns True if auto-venting is enabled, false otherwise.
   */
  public isAutoVentEnabled(): boolean {
    return this._autoVentEnabled;
  }

  /**
   * Check if KORO is currently auto-venting due to temperature.
   * @returns True if currently auto-venting, false otherwise.
   */
  public isCurrentlyAutoVenting(): boolean {
    return this._isAutoVenting;
  }

  /**
   * Check conditions and potentially trigger or stop auto-venting.
   * Called from the main tick update.
   */
  private _checkAutoVenting(): void {
    if (!this._autoVentEnabled) return; // Feature disabled

    const currentTime = Date.now();

    // Check if we need to START venting
    // Conditions: Auto-vent enabled, not currently venting, not on cooldown, 
    //             AND biodome is actively auto-resetting, AND internal temp is critical.
    if (!this._isAutoVenting && 
        currentTime >= this._autoVentCooldownUntil &&
        this._biodome?.isAutoResetting()) 
    {
      const isTooHot = this._internalTemp > this.AUTO_VENT_HIGH_THRESHOLD;
      const isTooCold = this._internalTemp < this.AUTO_VENT_LOW_THRESHOLD;
      
      if (isTooHot || isTooCold) {
        this._startAutoVenting(isTooHot ? 'overheating' : 'freezing');
      }
    }
    // Check if we need to STOP venting
    else if (this._isAutoVenting) {
      const tempIsSafe = this._internalTemp < this.AUTO_VENT_SAFE_HIGH && this._internalTemp > this.AUTO_VENT_SAFE_LOW;
      if (tempIsSafe) {
        this._stopAutoVenting();
      }
    }
  }

  /**
   * Force the shield open for auto-venting without a duration.
   * @param reason Reason for venting ('overheating' or 'freezing')
   */
  private _startAutoVenting(reason: string): void {
    if (this._isAutoVenting) return; // Already venting

    this._isAutoVenting = true;
    this.openShield(); // Open shield indefinitely
    this._logger.warn(`KORO Auto-Venting triggered due to ${reason}! Internal Temp: ${this._internalTemp.toFixed(1)}°F. Shield forced open.`);

    // Log event
    this._brain?.addEventWithPriority(
        'shield_vent_start',
        `Auto-venting started due to ${reason}. Shield open.`,
        'low',
        { reason: reason, internalTemp: this._internalTemp }
    );

    // Broadcast warning
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(
        `WARNING: Overseer core ${reason}! Shield integrity failing - venting initiated.`,
        'FF0000' // Red color
      );
    }
  }

  /**
   * Close the shield after auto-venting is complete and start cooldown.
   */
  private _stopAutoVenting(): void {
    if (!this._isAutoVenting) return; // Not venting

    this._isAutoVenting = false;
    this.closeShield(); // Close the shield
    this._autoVentCooldownUntil = Date.now() + this.AUTO_VENT_COOLDOWN_MS; // Start cooldown
    this._logger.info(`KORO Auto-Venting complete. Internal Temp: ${this._internalTemp.toFixed(1)}°F. Shield closed. Cooldown started.`);

    // Log event
    this._brain?.addEventWithPriority(
        'shield_vent_stop',
        `Auto-venting stopped. Shield closed.`,
        'low',
        { internalTemp: this._internalTemp }
    );

    // Broadcast stabilization message
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(
        'Overseer core temperature stabilized. Shield integrity restored.',
        '00FF00' // Green color
      );
    }
  }

  /**
   * Enable or disable the BFG shield break mechanic.
   * @param enabled Whether the BFG should be able to break the shield.
   */
  public setBFGShieldBreakEnabled(enabled: boolean): void {
    this._bfgShieldBreakEnabled = enabled;
    this._logger.info(`BFG Shield Break Mechanic ${enabled ? 'Enabled' : 'Disabled'}.`);
  }

  /**
   * Check if the BFG shield break mechanic is enabled.
   * @returns True if enabled, false otherwise.
   */
  public isBFGShieldBreakEnabled(): boolean {
    return this._bfgShieldBreakEnabled;
  }

  /**
   * Force the shield open, typically due to a BFG hit.
   * @param duration Optional duration to keep the shield open (defaults to BFG_SHIELD_BREAK_DURATION_MS).
   */
  public forceOpenShield(duration: number = this.BFG_SHIELD_BREAK_DURATION_MS): void {
    // Don't force open if already open or auto-venting
    if (!this._shieldActive || this._isAutoVenting) {
        this._logger.info(`forceOpenShield ignored: Shield already open or auto-venting.`);
        return;
    }

    this._logger.warn(`Shield forced open by external force (BFG?) for ${duration / 1000}s!`);

    // Log the event FIRST
    this._brain?.addEventWithPriority(
        'shield_breach_bfg',
        `Shield breached by external force!`,
        'high', // High priority - direct player action bypassing defense
        { duration: duration }
    );

    // Use the existing openShield method with the specified duration
    this.openShield(duration);

    // Broadcast a specific message
    if (this._world) {
      this._world.chatManager.sendBroadcastMessage(
        `ALERT: Overseer shield integrity compromised! Forced venting initiated!`,
        'FFA500' // Orange color for malfunction
      );
    }
  }

  // --- AI Integration Methods ---

  /**
   * Placeholder method for generating TTS - Actual logic will be moved here.
   * Called by KOROBrain.
   */
  public async generateTTSForMessage(message: string): Promise<void> {
    this._logger.info(`(Placeholder) Received request to generate TTS for: "${message}"`);
    // TODO: Move the TTS generation logic from _generateTTS to here.
    // Ensure it uses TTS_API_URL, TTS_API_TOKEN, this._health, this._world, this._ttsAudio
    await this._generateTTS(message); // Calling old method for now
  }

  /**
   * Placeholder method for broadcasting UI messages - Actual logic will be moved here.
   * Called by KOROBrain.
   */
  public broadcastOverseerUIMessage(message: string, action: string): void {
    this._logger.info(`(Placeholder) Received request to broadcast UI message: "${message}" (Action: ${action})`);
    // TODO: Move the UI broadcast logic from _broadcastOverseerMessage to here.
    this._broadcastOverseerMessage(message, action); // Calling old method for now

    // Clear any existing message timeout if Koro is now silent
    if (!message && action === 'none') {
        if (this._messageDisplayTimeoutId) {
            clearTimeout(this._messageDisplayTimeoutId);
            this._messageDisplayTimeoutId = null;
        }
    } else if (message) {
        // If there is a message, set a timeout to clear it
        if (this._messageDisplayTimeoutId) {
            clearTimeout(this._messageDisplayTimeoutId);
        }
        this._messageDisplayTimeoutId = setTimeout(() => {
            // Clear the message after duration by calling again with empty values
            this._broadcastOverseerMessage('', 'none'); // Uses old method for now
            this._messageDisplayTimeoutId = null;
        }, this._messageDisplayDuration);
    }
  }

  // --- Getters for Status and Thresholds ---

  /**
   * Get the internal temperature threshold for high-temp auto-venting.
   * @returns Critical high temperature in Fahrenheit
   */
  public getAutoVentHighThreshold(): number {
      return this.AUTO_VENT_HIGH_THRESHOLD;
  }

  /**
   * Get the internal temperature threshold for low-temp auto-venting.
   * @returns Critical low temperature in Fahrenheit
   */
  public getAutoVentLowThreshold(): number {
      return this.AUTO_VENT_LOW_THRESHOLD;
  }

  /**
   * Get the normal biodome temperature baseline via the controller
   * @returns Normal biodome temperature in Fahrenheit
   */
   public getBiodomeNormalTemperature(): number {
       // Use the BiodomeController's constant or a default
       return this._biodome?.getNormalTemperature() ?? 74;
   }

   /**
    * Get the biodome temperature threshold for heat danger via the controller
    * @returns Heat danger temperature in Fahrenheit
    */
   public getBiodomeHeatDangerThreshold(): number {
       // Use the BiodomeController's constant or a default
       return this._biodome?.getHeatDangerThreshold() ?? 104;
   }

   /**
    * Get the biodome temperature threshold for cold danger via the controller
    * @returns Cold danger temperature in Fahrenheit
    */
   public getBiodomeColdDangerThreshold(): number {
       // Use the BiodomeController's constant or a default
       return this._biodome?.getColdDangerThreshold() ?? 32;
   }

  /**
   * Allows external systems (like GameManager) to report significant
   * game events to KORO's brain.
   * @param type A string identifying the event type (e.g., 'player_death', 'bfg_pickup')
   * @param content A descriptive string summarizing the event for the LLM context.
   * @param priority The importance level for potential immediate reaction.
   * @param data Optional structured data about the event.
   */
  public reportSignificantEvent(
      type: string,
      content: string,
      priority: 'low' | 'medium' | 'high',
      data: Record<string, any> = {}
  ): void {
      if (this._brain) {
          // Let the brain handle adding the event with the provided details.
          // The brain determines if an immediate update is needed based on priority.
          this._brain.addEventWithPriority(type, content, priority, data);
          this._logger.info(`Reported significant event to KORO Brain: [${priority}] ${type} - ${content}`);
      } else {
          this._logger.warn(`Attempted to report event "${type}" but KORO Brain is not initialized.`);
      }
  }

  // --- KORO Mode and Status Control ---

  /**
   * Sets the operational mode for KORO's brain.
   * @param mode The desired operational mode.
   */
  public setKoroMode(mode: KoroMode): void {
      if (this._brain) {
          this._brain.setMode(mode);
      } else {
          this._logger.warn('Attempted to set KORO mode, but brain is not initialized.');
      }
  }

  /**
   * Gets the current status of KORO's brain components.
   * @returns An object with the current mode and enabled status of processing, LLM, and TTS, or null if brain is not initialized.
   */
  public getKoroStatus(): { mode: KoroMode, processing: boolean, llm: boolean, tts: boolean } | null {
      if (this._brain) {
          return this._brain.getKoroStatus();
      } else {
          this._logger.warn('Attempted to get KORO status, but brain is not initialized.');
          return null;
      }
  }

  // --- New AI Action Methods ---

  /**
   * Initiates a temperature-based environmental attack via the BiodomeController.
   * Assumes KOROBrain has already verified that an attack is currently allowed.
   * @param targetTemperature The target temperature in Fahrenheit.
   * @param changeRate The rate of temperature change in degrees per second.
   * @returns True if the command was successfully passed to the BiodomeController, false otherwise.
   */
  public initiateTemperatureAttack(targetTemperature: number, changeRate: number): boolean {
      // Call the existing method, forcing autoReset to true for AI attacks
      this.setBiodomeTemperature(targetTemperature, changeRate, true);
      // Log the action (logging inside setBiodomeTemperature might be sufficient, but keeping here for clarity on AI action)
      this._logger.info(`AI initiated temperature attack via setBiodomeTemperature: Target ${targetTemperature}°F, Rate ${changeRate}°/s`);
      return true; // Indicate the command was processed
  }

  /**
   * Performs a shield taunt sequence: rapidly opening and closing the shield.
   * Prevents overlapping taunts.
   */
  public async performShieldTaunt(): Promise<void> {
      if (this._isTaunting) {
          this._logger.debug('Shield taunt requested but already in progress.');
          return;
      }
      
      this._logger.info('Starting shield taunt sequence...');
      this._isTaunting = true;
      
      // Helper function for async delay
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      try {
          // Sequence: Open -> Wait -> Close -> Wait -> Open -> Wait -> Close
          const randomDelay1 = 500 + Math.random() * 1000; // 0.5 - 1.5 seconds
          const randomDelay2 = 300 + Math.random() * 700;  // 0.3 - 1.0 seconds
          const randomDelay3 = 600 + Math.random() * 900;  // 0.6 - 1.5 seconds

          this.openShield();
          await delay(randomDelay1);
          
          // Only close if still taunting (might have been interrupted)
          if (!this._isTaunting) return;
          this.closeShield();
          await delay(randomDelay2);

          // Only open again if still taunting
          if (!this._isTaunting) return;
          this.openShield();
          await delay(randomDelay3);

          // Final close if still taunting
          if (!this._isTaunting) return;
          this.closeShield();
          
          this._logger.info('Shield taunt sequence finished.');
          
      } catch (error) {
          this._logger.error('Error during shield taunt sequence:', error);
      } finally {
          // Ensure the flag is reset even if errors occur or sequence is interrupted
          this._isTaunting = false; 
      }
  }
}