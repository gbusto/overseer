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
import OverseerEntity from './OverseerEntity';

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
    // Check if we hit a shield piece
    if (hitEntity.name === 'OverseerShieldTop' || hitEntity.name === 'OverseerShieldBottom') {
      this._logger.info('BFG Projectile hit Overseer Shield.');
      
      // Attempt to find the Overseer entity
      const overseerEntity = this.world?.entityManager.getEntitiesByTag('overseer')[0] as OverseerEntity | undefined;
      
      if (overseerEntity) {
        // Check if the shield break mechanic is enabled and the shield is closed
        if (overseerEntity.isBFGShieldBreakEnabled() && !overseerEntity.isShieldOpen()) {
          this._logger.info('BFG Shield Break enabled and shield is closed. Forcing shield open.');
          overseerEntity.forceOpenShield(); // Use the default duration
        } else {
          this._logger.info(`BFG Shield Break not triggered (Enabled: ${overseerEntity.isBFGShieldBreakEnabled()}, Shield Open: ${overseerEntity.isShieldOpen()}).`);
        }
      } else {
        this._logger.warn('Could not find Overseer entity to apply shield break logic.');
      }
    }
    
    // IMPORTANT: Call the base class implementation to ensure default behavior (like despawning) still happens.
    super.onImpact(hitEntity);
  }
} 