import {
  Entity,
  Vector3,
  World
} from 'hytopia';

import type {
  EntityOptions,
  Vector3Like,
  QuaternionLike
} from 'hytopia';

import BaseEnergyProjectile from './BaseEnergyProjectile';

/**
 * Standard energy projectile for the EnergyRifle1 weapon
 */
export default class EnergyProjectile extends BaseEnergyProjectile {
  constructor(options: Partial<EntityOptions & {
    speed?: number;
    lifespanMs?: number;
    damage?: number;
    shooter?: Entity;
  }> = {}) {
    super({
      name: 'EnergyProjectile',
      modelUri: 'models/weapons/energy-orb.glb',
      modelScale: 0.5,
      opacity: 0.99,
      loggerName: 'EnergyProjectile',
      ...options
    });
  }

  /**
   * Optional override if we need specific spawn behavior for this projectile type
   */
  public spawn(world: World, position: Vector3Like, initialDirection?: Vector3Like, initialRotation?: QuaternionLike): void {
    super.spawn(world, position, initialDirection, initialRotation);
    // Any additional spawn behavior specific to EnergyProjectile would go here
  }

  /**
   * Standard impact behavior for energy projectile
   */
  protected override onImpact(hitEntity: Entity): void {
    // Standard energy projectile just despawns on impact
    // Future: Could add specific visual or audio effects here
    super.onImpact(hitEntity);
  }
} 