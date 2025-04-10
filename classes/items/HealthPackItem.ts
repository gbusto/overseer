import { Audio } from 'hytopia';
import BaseItem from './BaseItem';
import type { BaseItemOptions } from './BaseItem';
import GamePlayerEntity from '../entities/GamePlayerEntity';

// Constants
const HEALTH_PACK_HEAL_AMOUNT = 15; // Amount of health to restore

/**
 * HealthPackItem options interface
 */
export interface HealthPackItemOptions extends Partial<Omit<BaseItemOptions, 'modelUri' | 'iconUri' | 'despawns'>> {
  healAmount?: number;
}

/**
 * HealthPackItem class represents a health pack that can restore player health.
 */
export default class HealthPackItem extends BaseItem {
  // Health pack properties
  private _healAmount: number;
  
  constructor(options: HealthPackItemOptions = {}) {
    super({
      name: options.name || 'Health Pack',
      description: options.description || 'Restores health when used',
      consumable: true, // Health packs are always consumable
      despawns: false, // Health packs should not despawn by default
      // Fixed paths for health pack resources
      modelUri: 'models/items/health-pack.glb',
      modelScale: options.modelScale || 0.5,
    });
    
    // Set health pack properties
    this._healAmount = options.healAmount || HEALTH_PACK_HEAL_AMOUNT;
  }
  
  /**
   * Consume the health pack to restore player health
   * This is called by the interaction logic in GamePlayerEntity, not directly by player input.
   * @param player The player entity consuming the health pack
   * @returns True if the health pack was consumed successfully
   */
  public override consume(player?: GamePlayerEntity): boolean {
    if (!player) {
      // Use the protected logger from BaseItem
      this._logger.warn('Cannot consume health pack: no player provided');
      return false;
    }
    
    // Call base consume method first to check if consumable
    if (!super.consume()) return false; // Should always be true for health packs
    
    // Apply healing effect to player
    const currentHealth = player.health;
    const maxHealth = 100; // This is MAX_HEALTH in GamePlayerEntity
    
    // Don't heal if player is already at full health
    if (currentHealth >= maxHealth) {
      if (player.world) {
        player.world.chatManager.sendPlayerMessage(
          player.player,
          'You are already at full health.',
          'FFFF00'
        );
      }
      return false;
    }
    
    // Apply healing
    player.heal(this._healAmount);
    
    // Play healing sound
    if (player.world) {
      const healSound = new Audio({
        uri: 'audio/sfx/heal.mp3',
        attachedToEntity: player,
        volume: 0.5,
      });
      
      healSound.play(player.world);
      
      // Send feedback message
      player.world.chatManager.sendPlayerMessage(
        player.player,
        `Used a Health Pack and restored ${this._healAmount} health.`,
        '00FF00'
      );
    }
    
    this._logger.debug(`Health pack consumed by player ${player.player.username || player.player.id}, healing ${this._healAmount} HP`);
    return true;
  }
  
  /**
   * Get the amount of health this pack restores
   */
  public get healAmount(): number {
    return this._healAmount;
  }
} 