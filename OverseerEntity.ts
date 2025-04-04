import {
  Entity,
  RigidBodyType,
  ColliderShape,
  Audio,
  EntityEvent,
  World,
} from 'hytopia';

import type {
  EntityOptions,
  Vector3Like,
  QuaternionLike
} from 'hytopia';

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
    
    // Call the parent spawn method
    super.spawn(world, finalPosition, rotation);
  }

  /**
   * Called when the entity is spawned
   */
  private _onSpawned = (): void => {
    this._world = this.world || null;
    console.log('The Overseer has awakened...');
    
    // Start ambient sound
    if (this._world) {
      this._ambientSound.play(this._world);
    }
  }

  /**
   * Called when the entity is despawned
   */
  private _onDespawned = (): void => {
    // Stop ambient sound
    this._ambientSound.pause();
    this._world = null;
  }

  /**
   * Handle tick updates for animation and movement
   */
  private _onTick = ({ entity, tickDeltaMs }: { entity: Entity; tickDeltaMs: number }): void => {
    if (!this.isSpawned) return;
    
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
  }
} 