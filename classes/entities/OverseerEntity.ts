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
import { Logger } from '../../utils/logger';
import GameManager from '../GameManager';

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
  private _floatHeight: number = 50;
  private _bobAmplitude: number = 0.5;
  private _bobSpeed: number = 0.0005;
  private _rotationSpeed: number = 0.0001;
  
  // Sound effects
  private _ttsAudio: Audio | null = null;
  
  // AI Brain
  private _brain: KOROBrain;
  
  // Next update check
  private _nextUpdateCheck: number = 0;
  private _updateCheckInterval: number = 5000; // Check every 5 seconds
  
  // Health - will affect TTS voice
  private _health: number = 100;
  
  // Logger
  private _logger: Logger;

  private _messageDisplayTimeoutId: NodeJS.Timeout | null = null;
  private _messageDisplayDuration: number = 8000; // Display messages for 8 seconds

  constructor(options: Partial<EntityOptions> = {}) {
    // Set up the entity with fixed physics to stay in place
    super({
      name: 'Overseer',
      tag: 'overseer', // Set tag for easy lookup
      modelUri: 'models/npcs/squid.gltf',
      modelScale: 3, // Make it larger and more imposing
      modelLoopedAnimations: ['idle', 'swim'], // Use the squid's animations
      // Physics options to keep it suspended in the air
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

    // Initialize the KORO brain
    this._brain = new KOROBrain();
    
    // Start with the brain disabled until game starts
    this._brain.toggle(false);
    
    this._logger.info('Overseer entity created - brain disabled until game starts');

    // Set up tick handler for animation
    this.on(EntityEvent.TICK, this._onTick);
    
    // Set up spawn handler to initialize components
    this.on(EntityEvent.SPAWN, this._onSpawned);
    
    // Set up despawn handler for cleanup
    this.on(EntityEvent.DESPAWN, this._onDespawned);
    
    // Check if TTS is configured
    if (!TTS_API_TOKEN) {
      this._logger.warn('TTS_API_TOKEN not set - speech functionality will be disabled');
    } else {
      this._logger.info('TTS configured - speech functionality enabled');
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
    
    // Set up chat event listeners after spawn
    if (world) {
      this._setupEventListeners(world);
      
      // Update player count
      const playerCount = world.entityManager.getAllPlayerEntities().length;
      this._brain.setPlayerCount(playerCount);
      
      // Send initial health to all players
      this._updateAllPlayersWithHealth();
      
      this._logger.info('Registered event listeners');
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
    this._brain.toggle(enabled);
    return this._brain.isEnabled();
  }
  
  /**
   * Get the current state of KORO's world model
   * @returns Current world state (player count and recent events)
   */
  public getKOROState(): {playerCount: number, recentEvents: any[]} {
    return this._brain.getWorldState();
  }
  
  /**
   * Force KORO to generate a response immediately
   */
  public forceKOROUpdate(): void {
    this._logger.info('Forcing immediate KORO update');
    this._generateBrainResponse();
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
    if (!this._world) return;
    
    // Update player count
    const playerCount = this._world.entityManager.getAllPlayerEntities().length;
    this._brain.setPlayerCount(playerCount);
    
    // Add player joined event with high priority
    const needsImmediateResponse = this._brain.addEventWithPriority(
      'player_join',
      `Player ${player.username || player.id} entered the facility`, 
      'high',
      { 
        playerId: player.id,
        playerName: player.username || player.id,
        position: player.position
      }
    );
    
    this._logger.info(`Player joined: ${player.username || player.id}, new count: ${playerCount}`);
    
    // Only trigger immediate response if the event is high priority
    if (needsImmediateResponse) {
      this._generateBrainResponse();
    }
  }
  
  /**
   * Called when a player leaves the world
   */
  private _onPlayerLeft = ({ player }: { player: any }): void => {
    if (!this._world) return;
    
    // Update player count - subtract 1 as the player is still counted at this point
    const playerCount = this._world.entityManager.getAllPlayerEntities().length - 1;
    this._brain.setPlayerCount(playerCount);
    
    // Priority is high if it's the last player leaving
    const priority = playerCount === 0 ? 'high' : 'medium';
    
    // Add player left event
    const needsImmediateResponse = this._brain.addEventWithPriority(
      'player_leave',
      `Player ${player.username || player.id} left the facility`, 
      priority,
      { 
        playerId: player.id,
        playerName: player.username || player.id,
        remainingPlayers: playerCount
      }
    );
    
    this._logger.info(`Player left: ${player.username || player.id}, new count: ${playerCount}`);
    
    // Only respond immediately if high priority
    if (needsImmediateResponse) {
      this._generateBrainResponse();
    }
  }

  /**
   * Called when the entity is spawned
   */
  private _onSpawned = (): void => {
    // Keep track of world
    this._world = this.world || null;
    
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
    
    this._world = null;
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
    
    // Check for AI updates periodically to avoid checking every tick
    if (time > this._nextUpdateCheck) {
      this._nextUpdateCheck = time + this._updateCheckInterval;
      this._checkForBrainUpdate();
    }
  }
  
  /**
   * Handle chat messages
   */
  private _onChatMessage = ({ player, message }: { player?: any, message: string }): void => {
    if (!player || !message) return;
    
    // Add the chat message to the brain's events with priority check
    const needsImmediateResponse = this._brain.addChatMessage(player.username || player.id, message);
    
    this._logger.debug(`Chat message from ${player.username || player.id}: ${message}`);
    
    // If it's a direct mention or high priority event, trigger an immediate response
    if (needsImmediateResponse) {
      this._logger.info(`KORO mentioned in chat by ${player.username || player.id}, triggering response`);
      this._generateBrainResponse();
    }
  }
  
  /**
   * Check if the brain should generate a new response
   */
  private _checkForBrainUpdate(): void {
    if (this._brain.shouldUpdate()) {
      this._logger.debug('Regular KORO update check triggered');
      this._generateBrainResponse();
    }
  }
  
  /**
   * Generate and handle an AI response
   */
  private async _generateBrainResponse(): Promise<void> {
    if (!this._brain.isEnabled()) {
      this._logger.info('KORO is disabled - skipping update');
      return;
    }
    
    if (!this._world) {
      this._logger.error('No world - cannot generate response');
      return;
    }
    
    try {
      const response = await this._brain.generateUpdate();
      if (!response) {
        this._logger.warn('No response generated');
        return;
      }
      
      this._logger.info(`KORO response generated: ${response.message || '(no message)'}, action: ${response.action}`);
      
      // Don't display anything if no message and action is none
      if (!response.message && response.action === 'none') {
        this._broadcastOverseerMessage('', 'none');
        return;
      }
      
      // Broadcast the message to all players' UIs
      this._broadcastOverseerMessage(response.message || '', response.action);
      
      // Only generate audio if there's a message
      if (response.message && process.env.NODE_ENV === 'production') {
        await this._generateTTS(response.message);
      }
      
      // Clear any existing timeout
      if (this._messageDisplayTimeoutId) {
        clearTimeout(this._messageDisplayTimeoutId);
        this._messageDisplayTimeoutId = null;
      }
      
      // Set a timeout to clear the message after the display duration
      this._messageDisplayTimeoutId = setTimeout(() => {
        // Clear the message
        this._broadcastOverseerMessage('', 'none');
        this._messageDisplayTimeoutId = null;
      }, this._messageDisplayDuration);
      
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
    return this._brain.isEnabled();
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
}