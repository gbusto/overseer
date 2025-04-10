import {
  Entity,
  RigidBodyType,
  ColliderShape,
  Audio,
  EntityEvent,
  World
} from 'hytopia';
import type {
  EntityOptions,
  Vector3Like,
  QuaternionLike
} from 'hytopia';
import { Logger } from '../../utils/logger';
import GamePlayerEntity from '../entities/GamePlayerEntity';

// Constants
const ITEM_DESPAWN_TIME_MS = 60000; // 1 minute

/**
 * BaseItem options interface
 */
export interface BaseItemOptions {
  name: string;
  description?: string;
  consumable?: boolean;
  iconUri?: string;
  // Extended from EntityOptions
  modelUri?: string;
  modelScale?: number;
  opacity?: number;
}

/**
 * BaseItem class represents a pickupable item in the game.
 * All specific item types (health pack, control cards, etc.) should extend this class.
 */
export default class BaseItem extends Entity {
  // Item properties
  public readonly itemName: string;
  public readonly description: string;
  public readonly consumable: boolean;
  public readonly iconUri: string;
  
  // Despawn timer
  private _despawnTimer: NodeJS.Timeout | null = null;
  private _logger: Logger;
  
  constructor(options: BaseItemOptions) {
    // Set up the entity with default physics options
    super({
      name: options.name,
      opacity: options.opacity ?? 1,
      modelUri: options.modelUri,
      modelScale: options.modelScale ?? 1,
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 0.3,
          }
        ]
      }
    });
    
    // Set item properties
    this.itemName = options.name;
    this.description = options.description || '';
    this.consumable = options.consumable || false;
    this.iconUri = options.iconUri || 'icons/default-item.png';
    
    // Create logger
    this._logger = new Logger(`Item:${this.itemName}`);
    
    // Setup tick event for any animations
    this.on(EntityEvent.TICK, this._onTick);
    
    // Setup despawn handler
    this.on(EntityEvent.DESPAWN, this._onDespawn);
  }
  
  /**
   * Spawn the item in the world
   */
  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    this._logger.debug(`Item spawned at position (${position.x}, ${position.y}, ${position.z})`);
    
    // Start despawn timer
    this.startDespawnTimer();
  }
  
  /**
   * Pick up the item
   * @param player The player entity that's picking up the item
   * @returns True if pickup was successful
   */
  public pickup(player: GamePlayerEntity): boolean {
    if (!this.isSpawned || !this.world) return false;
    
    // Stop the despawn timer
    this.stopDespawnTimer();
    
    // Add to player inventory
    const result = player.pickupItem(this);
    
    if (result) {
      this._logger.debug(`Item picked up by player ${player.player.username || player.player.id}`);
      // Despawn from world when picked up
      this.despawn();
    }
    
    return result;
  }
  
  /**
   * Drop the item from player inventory
   * @param fromPosition The position to drop from
   * @param direction The direction to apply impulse
   */
  public drop(fromPosition: Vector3Like, direction: Vector3Like): void {
    if (!this.world) return;
    
    // Spawn at the drop position
    this.spawn(this.world, fromPosition);
    
    // Apply impulse in drop direction
    setTimeout(() => {
      if (this.isSpawned && this.world) {
        this.applyImpulse({
          x: direction.x * 5,
          y: direction.y * 5 + 2, // Add upward force
          z: direction.z * 5
        });
      }
    }, 10);
    
    this._logger.debug(`Item dropped at position (${fromPosition.x}, ${fromPosition.y}, ${fromPosition.z})`);
  }
  
  /**
   * Consume the item (for consumable items)
   * @returns True if the item was consumed
   */
  public consume(): boolean {
    if (!this.consumable) {
      this._logger.debug(`Attempted to consume non-consumable item`);
      return false;
    }
    
    // Specific consumption behavior should be implemented in subclasses
    this._logger.debug(`Item consumed`);
    return true;
  }
  
  /**
   * Start the despawn timer
   */
  public startDespawnTimer(): void {
    // Clear existing timer if any
    this.stopDespawnTimer();
    
    // Set new timer
    this._despawnTimer = setTimeout(() => {
      if (this.isSpawned) {
        this._logger.debug(`Item despawned due to timeout`);
        this.despawn();
      }
    }, ITEM_DESPAWN_TIME_MS);
  }
  
  /**
   * Stop the despawn timer
   */
  public stopDespawnTimer(): void {
    if (this._despawnTimer) {
      clearTimeout(this._despawnTimer);
      this._despawnTimer = null;
    }
  }
  
  /**
   * Handle tick updates for animation
   */
  private _onTick = ({ entity, tickDeltaMs }: { entity: Entity; tickDeltaMs: number }): void => {
    if (!this.isSpawned) return;
    
    // Add any idle animations here (like rotating or hovering)
    // For example, slow rotation
    const currentRotation = this.rotation;
    this.setRotation({
      x: currentRotation.x,
      y: currentRotation.y + 0.001 * tickDeltaMs,
      z: currentRotation.z,
      w: currentRotation.w
    });
  }
  
  /**
   * Handle despawn cleanup
   */
  private _onDespawn = (): void => {
    this.stopDespawnTimer();
  }
} 