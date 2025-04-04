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
  private _ambientSound: Audio;
  
  // AI Brain
  private _brain: KOROBrain;
  
  // Next update check
  private _nextUpdateCheck: number = 0;
  private _updateCheckInterval: number = 5000; // Check every 5 seconds
  
  // Logger
  private _logger: Logger;

  constructor(options: Partial<EntityOptions> = {}) {
    // Set up the entity with fixed physics to stay in place
    super({
      name: 'Overseer',
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
    
    this._logger.info('Overseer entity created');

    // Create ambient sound for the overseer
    this._ambientSound = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/entity/squid/squid-idle.mp3',
      loop: true,
      volume: 0.3,
      referenceDistance: 30, // Can be heard from far away
    });

    // Set up tick handler for animation
    this.on(EntityEvent.TICK, this._onTick);
    
    // Set up spawn handler to initialize components
    this.on(EntityEvent.SPAWN, this._onSpawned);
    
    // Set up despawn handler for cleanup
    this.on(EntityEvent.DESPAWN, this._onDespawned);
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
    
    // Set up chat event listeners after spawn
    if (world) {
      world.chatManager.on(ChatEvent.BROADCAST_MESSAGE, this._onChatMessage);
      
      // Set up player event listeners
      world.on(PlayerEvent.JOINED_WORLD, this._onPlayerJoined);
      world.on(PlayerEvent.LEFT_WORLD, this._onPlayerLeft);
      
      // Update player count
      const playerCount = world.entityManager.getAllPlayerEntities().length;
      this._brain.setPlayerCount(playerCount);
      
      this._logger.info('Registered event listeners');
    }
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
  public getKOROState(): {playerCount: number, recentEvents: string[]} {
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
   * Called when a player joins the world
   */
  private _onPlayerJoined = ({ player }: { player: any }): void => {
    if (!this._world) return;
    
    // Update player count
    const playerCount = this._world.entityManager.getAllPlayerEntities().length;
    this._brain.setPlayerCount(playerCount);
    this._brain.addRecentEvent(`Player ${player.username || player.id} entered the facility`);
    
    this._logger.info(`Player joined: ${player.username || player.id}, new count: ${playerCount}`);
    
    // Trigger an immediate response to the new player
    this._generateBrainResponse();
  }
  
  /**
   * Called when a player leaves the world
   */
  private _onPlayerLeft = ({ player }: { player: any }): void => {
    if (!this._world) return;
    
    // Update player count - subtract 1 as the player is still counted at this point
    const playerCount = this._world.entityManager.getAllPlayerEntities().length - 1;
    this._brain.setPlayerCount(playerCount);
    this._brain.addRecentEvent(`Player ${player.username || player.id} left the facility`);
    
    this._logger.info(`Player left: ${player.username || player.id}, new count: ${playerCount}`);
  }

  /**
   * Called when the entity is spawned
   */
  private _onSpawned = (): void => {
    this._world = this.world || null;
    this._logger.info('Overseer has awakened');
    
    // Start ambient sound
    if (this._world) {
      this._ambientSound.play(this._world);
      
      // Add initial event
      this._brain.addRecentEvent("Overseer systems online");
    }
  }

  /**
   * Called when the entity is despawned
   */
  private _onDespawned = (): void => {
    // Stop ambient sound
    this._ambientSound.pause();
    
    // Remove chat event listeners
    if (this._world) {
      this._world.chatManager.off(ChatEvent.BROADCAST_MESSAGE, this._onChatMessage);
      this._world.off(PlayerEvent.JOINED_WORLD, this._onPlayerJoined);
      this._world.off(PlayerEvent.LEFT_WORLD, this._onPlayerLeft);
      
      this._logger.info('Unregistered event listeners');
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
    
    // Add the chat message to the brain's events
    this._brain.addChatMessage(player.username || player.id, message);
    
    this._logger.debug(`Chat message from ${player.username || player.id}: ${message}`);
    
    // If it's a direct mention of KORO, trigger an immediate response
    if (message.toLowerCase().includes('koro') || message.toLowerCase().includes('overseer')) {
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
    if (!this._world) return;
    
    const response = await this._brain.generateUpdate();

    // Attempt to log each part of the response here
    // Log the message
    this._logger.debug(`KORO message: ${response?.message}`);
    // Log the action
    this._logger.debug(`KORO action: ${response?.action}`);
    
    if (response) {
      // Send the message
      const messageColor = this._brain.getMessageColor(response.action);
      this._world.chatManager.sendBroadcastMessage(`KORO: ${response.message}`, messageColor);
      
      // Handle actions
      switch (response.action) {
        case 'warn':
        case 'threaten':
          // TODO: Implement action
          this._logger.debug(`Action triggered: ${response.action}`);
        break;
      }
    }
  }

  /**
   * Get whether KORO's automatic updates are enabled
   * @returns True if automatic updates are enabled, false otherwise
   */
  public isKOROEnabled(): boolean {
    return this._brain.isEnabled();
  }
} 