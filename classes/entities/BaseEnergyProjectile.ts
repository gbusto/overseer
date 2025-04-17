import {
  Entity,
  RigidBodyType,
  ColliderShape,
  Vector3,
  World,
  EntityEvent,
  Quaternion,
  CollisionGroup
} from 'hytopia';

import type {
  EntityOptions,
  Vector3Like,
  QuaternionLike
} from 'hytopia';

import { Logger } from '../../utils/logger';
import OverseerEntity from './OverseerEntity';
import RipperBossEntity from './RipperBossEntity';

/**
 * Base class for energy projectiles used by energy weapons
 * This contains common functionality for all energy projectiles
 */
export default abstract class BaseEnergyProjectile extends Entity {
  protected _logger: Logger;
  protected _speed: number;
  protected _lifespanMs: number;
  protected _damage: number;
  protected _direction: Vector3 = new Vector3(0, 0, 1); // Default forward
  protected _despawnTimer: NodeJS.Timeout | null = null;
  protected _shooter: Entity | null = null;

  constructor(options: Partial<EntityOptions & {
    speed?: number;
    lifespanMs?: number;
    damage?: number;
    shooter?: Entity;
    loggerName?: string;
  }> = {}) {
    super({
      name: 'BaseEnergyProjectile',
      tag: 'projectile',
      // No default model - let subclasses specify
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.2,
          }
        ],
      },
      ...options
    });

    const loggerName = options.loggerName ?? 'BaseEnergyProjectile';
    this._logger = new Logger(loggerName);
    this._speed = options.speed ?? 50; // Default speed
    this._lifespanMs = options.lifespanMs ?? 2000; // Default lifespan 2 seconds
    this._damage = options.damage ?? 10; // Default damage
    this._shooter = options.shooter ?? null;

    this.on(EntityEvent.SPAWN, this._onSpawned);
    this.on(EntityEvent.DESPAWN, this._onDespawned);
    this.on(EntityEvent.ENTITY_COLLISION, this._onCollisionEnter);
    this.on(EntityEvent.TICK, this._onTick);

    this._logger.info(`Created with speed: ${this._speed}, lifespan: ${this._lifespanMs}ms, damage: ${this._damage}`);
  }

  /**
   * Spawns the projectile and sets its initial velocity and despawn timer.
   * @param world The world to spawn in.
   * @param position Starting position.
   * @param initialDirection Optional initial direction vector (will be normalized).
   * @param initialRotation Optional initial rotation (overrides direction calculation).
   */
  public spawn(world: World, position: Vector3Like, initialDirection?: Vector3Like, initialRotation?: QuaternionLike): void {
    if (initialDirection) {
      const dirVec = new Vector3(initialDirection.x, initialDirection.y, initialDirection.z);
      const length = Math.sqrt(dirVec.x * dirVec.x + dirVec.y * dirVec.y + dirVec.z * dirVec.z);
      if (length > 0) {
          this._direction.x = dirVec.x / length;
          this._direction.y = dirVec.y / length;
          this._direction.z = dirVec.z / length;
      } else {
          this._direction.x = 0; this._direction.y = 0; this._direction.z = 1;
      }
    }
    
    let rotation: QuaternionLike | undefined = initialRotation;
    if (!rotation && initialDirection) {
        this._logger.warn('Initial rotation based on direction is disabled due to lookRotation uncertainty.');
    }

    super.spawn(world, position, rotation); 
    // Despawn timer is started in _onSpawned callback
  }

  protected _onSpawned = (): void => {
    this._logger.info(`Spawned at ${JSON.stringify(this.position)} moving towards ${JSON.stringify(this._direction)}`);
    this._startDespawnTimer();
  }

  protected _onDespawned = (): void => {
    this._logger.info(`Despawned.`);
    this._stopDespawnTimer();
  }

  protected _startDespawnTimer(): void {
    if (this._despawnTimer) {
      clearTimeout(this._despawnTimer);
    }
    this._despawnTimer = setTimeout(() => {
      if (this.isSpawned) {
        this._logger.info(`Lifespan expired, despawning.`);
        this.despawn();
      }
    }, this._lifespanMs);
  }

  protected _stopDespawnTimer(): void {
    if (this._despawnTimer) {
      clearTimeout(this._despawnTimer);
      this._despawnTimer = null;
    }
  }

  /**
   * Default tick behavior for projectile movement
   */
  protected _onTick = ({ tickDeltaMs }: { tickDeltaMs: number }): void => {
    if (!this.isSpawned) return;

    const moveDelta = tickDeltaMs / 1000; 
    const moveAmount = this._speed * moveDelta;
    const moveVector = new Vector3(
        this._direction.x * moveAmount,
        this._direction.y * moveAmount,
        this._direction.z * moveAmount
    );
    
    const currentPos = this.position;
    this.setPosition(new Vector3(currentPos.x + moveVector.x, currentPos.y + moveVector.y, currentPos.z + moveVector.z));
  }

  /**
   * Handle projectile collision with entities
   */
  protected _onCollisionEnter = ({ otherEntity, started }: { otherEntity: Entity, started: boolean }): void => {
    // --- Add verbose logging at the very start --- 
    this._logger.debug(`_onCollisionEnter called. Started: ${started}, Other Entity: ${otherEntity?.name || 'undefined'}, Shooter: ${this._shooter?.name || 'undefined'}`);

    if (!this.isSpawned || !otherEntity || otherEntity === this._shooter || !started) {
        // Add logging for why we are returning early
        if (!this.isSpawned) this._logger.debug('Projectile not spawned, returning.');
        if (!otherEntity) this._logger.debug('Collision with undefined entity, returning.');
        if (otherEntity === this._shooter) this._logger.debug('Collision with self (shooter), returning.');
        if (!started) this._logger.debug('Collision ended (started=false), returning.');
        return;
    }

    this._logger.info(`Collision detected with entity: ${otherEntity.name} (Tag: ${otherEntity.tag}, Type: ${otherEntity.constructor.name})`);

    // Check if we hit the overseer
    if (otherEntity.tag === 'overseer') {
      // Try to apply damage using type assertion to OverseerEntity
      const overseer = otherEntity as OverseerEntity;
      const damageApplied = overseer.takeDamage(this._damage);
      
      if (damageApplied) {
        this._logger.info(`Applied ${this._damage} damage to Overseer`);
      } else {
        this._logger.info(`Damage blocked by Overseer (shield or invulnerable)`);
      }
    } 
    // NEW: Check if we hit the Ripper Boss Minion
    else if (otherEntity instanceof RipperBossEntity) {
        this._logger.info(`Projectile hit RipperBossEntity.`);
        // Type assertion is safe here because of instanceof check
        const minion = otherEntity as RipperBossEntity;
        minion.takeDamage(this._damage); // Apply damage
        this._logger.info(`Applied ${this._damage} damage to RipperBossEntity`);
        // No need to check for return value like overseer, assume damage always applies for now
    }
    // Check if we hit one of the shield halves
    else if (otherEntity.name === 'OverseerShieldTop' || otherEntity.name === 'OverseerShieldBottom') {
      this._logger.info(`Hit overseer shield - no damage applied`);
      // Later we can add shield hit effects here
    }
    
    // Handle the impact - subclasses can override or extend this method
    this.onImpact(otherEntity);
  }

  /**
   * Called when the projectile hits something.
   * Subclasses can override this to customize impact behavior.
   */
  protected onImpact(hitEntity: Entity): void {
    // Default implementation just despawns the projectile
    this.despawn();
  }
} 