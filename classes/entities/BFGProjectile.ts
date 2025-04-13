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
 * Specialized energy projectile for the BFG weapon
 * Larger, more powerful projectile than standard energy projectile
 */
export default class BFGProjectile extends BaseEnergyProjectile {
  constructor(options: Partial<EntityOptions & {
    speed?: number;
    lifespanMs?: number;
    damage?: number;
    shooter?: Entity;
  }> = {}) {
    super({
      name: 'BFGProjectile',
      modelUri: 'models/weapons/bfg-energy-orb.glb', // Using same model but scaled larger
      modelScale: 2.0, // Much larger than standard projectile
      opacity: 0.9,
      loggerName: 'BFGProjectile',
      // BFG projectile is slower but more powerful
      speed: options.speed ?? 30, // Slower than standard projectile
      damage: options.damage ?? 30, // More damage than standard projectile
      lifespanMs: options.lifespanMs ?? 3000, // Longer lifespan
      ...options
    });
  }

  /**
   * Custom impact behavior for BFG projectile
   */
  protected override onImpact(hitEntity: Entity): void {
    // In a full implementation, could add area damage or special effects
    // For now, just perform basic impact behavior
    super.onImpact(hitEntity);
  }
} 