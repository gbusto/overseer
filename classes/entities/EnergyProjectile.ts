import {
  Entity,
  RigidBodyType,
  ColliderShape,
  Vector3,
  World,
  EntityEvent,
  Quaternion
} from 'hytopia';

import type {
  EntityOptions,
  Vector3Like,
  QuaternionLike
} from 'hytopia';

import { Logger } from '../../utils/logger';

export default class EnergyProjectile extends Entity {
  private _logger: Logger;
  private _speed: number;
  private _lifespanMs: number;
  private _damage: number;
  private _direction: Vector3 = new Vector3(0, 0, 1); // Default forward
  private _despawnTimer: NodeJS.Timeout | null = null;
  private _shooter: Entity | null = null;

  constructor(options: Partial<EntityOptions & {
    speed?: number;
    lifespanMs?: number;
    damage?: number;
    shooter?: Entity;
  }> = {}) {
    super({
      name: 'EnergyProjectile',
      tag: 'projectile',
      modelUri: 'models/effects/energy_bolt.glb', // Placeholder model
      modelScale: 0.5, // Small projectile
      opacity: 1,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.2,
            isSensor: true,
          }
        ],
      },
      ...options
    });

    this._logger = new Logger('EnergyProjectile');
    this._speed = options.speed ?? 50; // Default speed
    this._lifespanMs = options.lifespanMs ?? 2000; // Default lifespan 2 seconds
    this._damage = options.damage ?? 10; // Default damage
    this._shooter = options.shooter ?? null;

    this.on(EntityEvent.SPAWN, this._onSpawned);
    this.on(EntityEvent.DESPAWN, this._onDespawned);
    this.on(EntityEvent.ENTITY_COLLISION, this._onCollisionEnter);
    this.on(EntityEvent.TICK, this._onTick);

    this._logger.info(`Created with speed: ${this._speed}, lifespan: ${this._lifespanMs}ms`);
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

  private _onSpawned = (): void => {
    this._logger.info(`Spawned at ${JSON.stringify(this.position)} moving towards ${JSON.stringify(this._direction)}`);
    this._startDespawnTimer();
  }

  private _onDespawned = (): void => {
    this._logger.info(`Despawned.`);
    this._stopDespawnTimer();
  }

  private _startDespawnTimer(): void {
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

  private _stopDespawnTimer(): void {
    if (this._despawnTimer) {
      clearTimeout(this._despawnTimer);
      this._despawnTimer = null;
    }
  }

  private _onTick = ({ tickDeltaMs }: { tickDeltaMs: number }): void => {
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

  private _onCollisionEnter = ({ otherEntity, started }: { otherEntity: Entity, started: boolean }): void => {
    if (!this.isSpawned || !otherEntity || otherEntity === this._shooter || !started) {
      return;
    }

    this._logger.info(`Collision detected with entity: ${otherEntity.name} (Tag: ${otherEntity.tag})`);

    // --- Placeholder Collision Logic ---
    // TODO: Implement specific collision handling, e.g.:
    // - Check if otherEntity is OverseerEntity or GamePlayerEntity
    // - Check if Overseer barrier is open
    // - Apply damage if appropriate (e.g., if(typeof otherEntity.takeDamage === 'function') otherEntity.takeDamage(this._damage); )
    // - Play impact effect/sound

    this.despawn();
  }
} 