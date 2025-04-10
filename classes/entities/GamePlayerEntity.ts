import {
  PlayerEntity,
  Player,
  Audio,
  BaseEntityControllerEvent,
  PlayerEntityController,
  World,
} from 'hytopia';
import type { Vector3Like, QuaternionLike } from 'hytopia';
import { Logger } from '../../utils/logger';
import GameManager, { GameState } from '../GameManager';
import BaseItem from '../items/BaseItem';

// Constants
const MAX_HEALTH = 100;
const BASE_HEALTH = 100;
const BACKPACK_SIZE = 3; // Number of backpack inventory slots

// Simple interface for sending item data to UI
interface UIInventoryItem {
  name: string;
  // We don't have iconUri in BaseItem, let's stick to name for now
  // iconUri?: string; 
}

export default class GamePlayerEntity extends PlayerEntity {
  private _health: number = BASE_HEALTH;
  private _maxHealth: number = MAX_HEALTH;
  private _damageAudio: Audio;
  private _logger = new Logger('GamePlayerEntity');
  
  // Inventory system
  private _backpackInventory: (any | null)[] = [null, null, null]; // 3 backpack slots
  private _handItem: any | null = null; // Item held in hand
  
  // Player entities always have a PlayerController
  public get playerController(): PlayerEntityController {
    return this.controller as PlayerEntityController;
  }
  
  constructor(player: Player) {
    super({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.5,
    });
    
    // Set up audio for damage
    this._damageAudio = new Audio({
      attachedToEntity: this,
      uri: 'audio/sfx/player-hurt.mp3',
      loop: false,
      volume: 0.7,
    });
    
    // Set up player controller events
    this._setupPlayerController();
  }
  
  /**
   * Spawn the player entity in the world
   */
  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    
    // Load the main UI
    this.player.ui.load('ui/index.html');
    
    // Update player UI
    this._updatePlayerUI();
    
    // Send welcome messages
    this._sendWelcomeMessages();
    
    this._logger.info(`Player entity spawned: ${this.player.username || this.player.id}`);
  }
  
  /**
   * Send welcome messages to the player
   */
  private _sendWelcomeMessages(): void {
    if (!this.world) return;
    
    this.world.chatManager.sendPlayerMessage(this.player, 'Welcome to the game!', '00FF00');
    this.world.chatManager.sendPlayerMessage(this.player, 'Use WASD to move around.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press space to jump.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Hold shift to sprint.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press E to interact with objects or pick up items.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press F to use/consume the item in your hand.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press 1-3 to swap items between hand and backpack.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press Q to drop the item in your hand.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press \\ to enter or exit debug view.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Type /start to begin a game!', '00FFFF');
    this.world.chatManager.sendPlayerMessage(this.player, 'Admin commands:', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/rocket - Launch yourself into the air', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/oshealth [0-100] - Set overseer health', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/healthpack - Spawn a health pack in front of you', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/healthpacks - Spawn health packs around the map', 'FFA500');
  }
  
  /**
   * Take damage from sources
   */
  public takeDamage(amount: number): void {
    if (!this.isSpawned || !this.world) return;
    
    // Only take damage if the game is active
    if (GameManager.instance.gameState !== GameState.ACTIVE) return;
    
    // Play damage audio
    this._damageAudio.play(this.world, true);
    
    // Flash player model red briefly
    this.setTintColor({ r: 255, g: 0, b: 0 });
    setTimeout(() => {
      this.setTintColor({ r: 255, g: 255, b: 255 });
    }, 100);
    
    // Reduce health
    this.health -= amount;
    
    // Update health UI elements
    this._updateHealthUI();
    
    this._logger.debug(`Player took ${amount} damage, health: ${this.health}`);
  }
  
  /**
   * Heal the player
   */
  public heal(amount: number): void {
    this.health = Math.min(this.health + amount, this._maxHealth);
    this._logger.debug(`Player healed ${amount}, health: ${this.health}`);
  }
  
  /**
   * Reset player health to max
   */
  public resetHealth(): void {
    this.health = this._maxHealth;
  }
  
  /**
   * Set up player controller
   */
  private _setupPlayerController(): void {
    // Let the default PlayerEntity controller handle animations
    // Don't override animation names as they're handled automatically
    
    // Set up input event handlers
    this.playerController.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, this._onTickWithPlayerInput);
  }
  
  /**
   * Handle player input ticks
   */
  private _onTickWithPlayerInput = (payload: any): void => {
    // Handle input processing here
    const { input } = payload;
    
    // Handle healing with 'h' key
    if (input.h) {
      this.heal(10); // Heal on 'h' key press
      input.h = false; // Reset the input to avoid continuous healing
    }
    
    // Handle dropping hand item with 'q' key
    if (input.q) {
      this.dropHandItem();
      input.q = false; // Reset the input to avoid continuous dropping
    }
    
    // Handle using/consuming hand item with 'f' key
    if (input.f) {
      this.useHandItem();
      input.f = false; // Reset the input to avoid continuous use
    }
    
    // Handle interaction with 'e' key
    if (input.e) {
      this._handleInteract();
      input.e = false; // Reset the input to avoid continuous interaction
    }
    
    // Handle inventory slot swapping with number keys
    if (input.one) {
      this.swapHandWithBackpack(0);
      input.one = false;
    }
    
    if (input.two) {
      this.swapHandWithBackpack(1);
      input.two = false;
    }
    
    if (input.three) {
      this.swapHandWithBackpack(2);
      input.three = false;
    }
  };
  
  /**
   * Handle player interaction (E key)
   */
  private _handleInteract(): void {
    if (!this.world || !this.isSpawned) return;
    
    // Perform raycast from player's position in the direction they're facing
    const origin = this.position;
    const direction = this.player.camera.facingDirection;
    const distance = 2; // Maximum interaction distance
    
    // Exclude player from raycast results
    const raycastResult = this.world.simulation.raycast(
      origin,
      direction,
      distance,
      { filterExcludeRigidBody: this.rawRigidBody }
    );
    
    if (raycastResult?.hitEntity) {
      const hitEntity = raycastResult.hitEntity as BaseItem;
      
      // If the entity is an item, try to pick it up
      if (hitEntity.pickup && typeof hitEntity.pickup === 'function') {
        hitEntity.pickup(this);
        this._logger.debug(`Attempted to pick up item via interaction`);
      }
      // If the entity is another player, share an item
      else if (hitEntity instanceof GamePlayerEntity) {
        this._shareItemWithPlayer(hitEntity);
      }
    }
  }
  
  /**
   * Share the currently held item with another player
   * @param targetPlayer The player to share the item with
   */
  private _shareItemWithPlayer(targetPlayer: GamePlayerEntity): void {
    if (!this.hasItemInHand() || !targetPlayer || !targetPlayer.isSpawned) return;
    
    // Get item from hand
    const itemToShare = this.getHandItem();
    
    // Check if target player can accept it
    if (targetPlayer.pickupItem(itemToShare)) {
      // Remove from this player's hand if successfully shared
      this._handItem = null;
      this._updateInventoryUI();
      
      // Send feedback message
      if (this.world) {
        this.world.chatManager.sendPlayerMessage(
          this.player, 
          `You shared an item with ${targetPlayer.player.username || 'another player'}.`, 
          '00FF00'
        );
        
        this.world.chatManager.sendPlayerMessage(
          targetPlayer.player, 
          `${this.player.username || 'Another player'} shared an item with you.`, 
          '00FF00'
        );
      }
      
      this._logger.debug(`Shared item with player ${targetPlayer.player.username || targetPlayer.player.id}`);
    } else {
      // Send feedback message about failed sharing
      if (this.world) {
        this.world.chatManager.sendPlayerMessage(
          this.player, 
          `${targetPlayer.player.username || 'The other player'} has no space for this item.`, 
          'FF0000'
        );
      }
      
      this._logger.debug(`Failed to share item: target player inventory is full`);
    }
  }
  
  /**
   * Update health UI elements
   */
  private _updateHealthUI(): void {
    // Update player's UI with health data
    this.player.ui.sendData({
      type: 'health-update',
      health: this._health,
      maxHealth: this._maxHealth
    });
  }
  
  /**
   * Update all player UI elements
   */
  private _updatePlayerUI(): void {
    // Update health
    this._updateHealthUI();
    
    // Update inventory UI
    this._updateInventoryUI();
  }
  
  /**
   * Update inventory UI elements
   */
  private _updateInventoryUI(): void {
    // Map hand item to a simple object or null
    const handItemData: UIInventoryItem | null = this._handItem 
      ? { name: this._handItem.itemName || 'Unknown Item' } 
      : null;

    // Map backpack items to simple objects or null
    const backpackData: (UIInventoryItem | null)[] = this._backpackInventory.map(item => {
      if (!item) return null;
      return { name: item.itemName || 'Unknown Item' };
    });

    // Update player's UI with simplified inventory data
    this.player.ui.sendData({
      type: 'inventory-update',
      handItem: handItemData,    // Send simple data or null
      backpack: backpackData     // Send array of simple data or null
    });
  }
  
  /**
   * Check if player has item in hand
   */
  public hasItemInHand(): boolean {
    return this._handItem !== null;
  }
  
  /**
   * Check if player has item in specific backpack slot
   * @param index Backpack slot index (0-2)
   */
  public hasItemInBackpack(index: number): boolean {
    if (index < 0 || index >= BACKPACK_SIZE) return false;
    return this._backpackInventory[index] !== null;
  }
  
  /**
   * Check if player has space in backpack
   */
  public hasSpaceInBackpack(): boolean {
    return this._backpackInventory.some(item => item === null);
  }
  
  /**
   * Find first empty backpack slot
   * @returns Index of first empty slot, or -1 if backpack is full
   */
  public findFirstEmptyBackpackSlot(): number {
    return this._backpackInventory.findIndex(item => item === null);
  }
  
  /**
   * Get item in hand
   */
  public getHandItem(): any | null {
    return this._handItem;
  }
  
  /**
   * Get item in backpack slot
   * @param index Backpack slot index (0-2)
   */
  public getBackpackItem(index: number): any | null {
    if (index < 0 || index >= BACKPACK_SIZE) return null;
    return this._backpackInventory[index];
  }
  
  /**
   * Pick up an item
   * @param item The item to pick up
   * @returns Whether the pickup was successful
   */
  public pickupItem(item: any): boolean {
    if (!item) return false;
    
    // If hand is empty, put item in hand
    if (!this.hasItemInHand()) {
      this._handItem = item;
      this._logger.debug(`Picked up item to hand: ${item.name || 'unknown item'}`);
      this._updateInventoryUI();
      return true;
    }
    
    // If hand is full but backpack has space, put item in backpack
    const emptySlot = this.findFirstEmptyBackpackSlot();
    if (emptySlot !== -1) {
      this._backpackInventory[emptySlot] = item;
      this._logger.debug(`Picked up item to backpack slot ${emptySlot}: ${item.name || 'unknown item'}`);
      this._updateInventoryUI();
      return true;
    }
    
    // No space available
    this._logger.debug('Cannot pick up item: inventory full');
    return false;
  }
  
  /**
   * Drop the item in hand
   * @returns The dropped item, or null if hand was empty
   */
  public dropHandItem(): any | null {
    if (!this.hasItemInHand()) return null;
    
    const droppedItem = this._handItem;
    this._handItem = null;
    this._logger.debug(`Dropped hand item: ${droppedItem.name || 'unknown item'}`);
    this._updateInventoryUI();
    
    return droppedItem;
  }
  
  /**
   * Drop an item from backpack
   * @param index Backpack slot index (0-2)
   * @returns The dropped item, or null if slot was empty
   */
  public dropBackpackItem(index: number): any | null {
    if (index < 0 || index >= BACKPACK_SIZE) return null;
    if (!this.hasItemInBackpack(index)) return null;
    
    const droppedItem = this._backpackInventory[index];
    this._backpackInventory[index] = null;
    this._logger.debug(`Dropped backpack item from slot ${index}: ${droppedItem.name || 'unknown item'}`);
    this._updateInventoryUI();
    
    return droppedItem;
  }
  
  /**
   * Swap item between hand and backpack slot
   * @param backpackIndex Backpack slot index (0-2)
   * @returns Whether the swap was successful
   */
  public swapHandWithBackpack(backpackIndex: number): boolean {
    if (backpackIndex < 0 || backpackIndex >= BACKPACK_SIZE) return false;
    
    // Swap the items
    const backpackItem = this._backpackInventory[backpackIndex];
    this._backpackInventory[backpackIndex] = this._handItem;
    this._handItem = backpackItem;
    
    this._logger.debug(`Swapped hand item with backpack slot ${backpackIndex}`);
    this._updateInventoryUI();
    
    return true;
  }
  
  /**
   * Use the item currently held in the player's hand
   * @returns True if the item was used successfully
   */
  public useHandItem(): boolean {
    // Make sure we have an item in hand
    if (!this.hasItemInHand()) {
      this._logger.debug('Cannot use hand item: no item in hand');
      return false;
    }
    
    const item = this._handItem;
    
    // Only consumable items can be used
    if (!item.consumable) {
      this._logger.debug(`Item ${item.itemName || 'unknown'} is not consumable`);
      return false;
    }
    
    try {
      // Attempt to consume the item
      if (item.consume && typeof item.consume === 'function') {
        // Try to consume the item, passing this player entity as the consumer
        const consumed = item.consume(this);
        
        if (consumed) {
          // Remove the item from the hand if it was consumed
          this._handItem = null;
          this._updateInventoryUI();
          
          // Send feedback message
          if (this.world) {
            this.world.chatManager.sendPlayerMessage(
              this.player, 
              `You used a ${item.itemName || 'consumable item'}.`, 
              '00FF00'
            );
          }
          
          this._logger.debug(`Successfully consumed hand item: ${item.itemName || 'unknown'}`);
          return true;
        } else {
          this._logger.debug(`Failed to consume hand item: ${item.itemName || 'unknown'}`);
        }
      } else {
        this._logger.debug(`Hand item doesn't have a consume method: ${item.itemName || 'unknown'}`);
      }
    } catch (error) {
      this._logger.error(`Error consuming item: ${error}`);
    }
    
    return false;
  }
  
  // Getter/setter for health
  get health(): number {
    return this._health;
  }
  
  set health(value: number) {
    this._health = Math.max(0, Math.min(value, this._maxHealth));
    this._updateHealthUI();
  }
} 