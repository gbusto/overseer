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
import HealthPackItem from '../items/HealthPackItem'; // Import HealthPackItem

// Constants
const MAX_HEALTH = 100;
const BASE_HEALTH = 100;
// BACKPACK_SIZE is no longer needed

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
  
  // Removed inventory properties
  // private _backpackInventory: (any | null)[] = [null, null, null]; 
  // private _handItem: any | null = null; 
  
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
    
    // Update player UI (only health initially)
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
    this.world.chatManager.sendPlayerMessage(this.player, 'Press E to interact with Health Packs.');
    // Removed inventory-related messages
    // this.world.chatManager.sendPlayerMessage(this.player, 'Press F to use/consume the item in your hand.');
    // this.world.chatManager.sendPlayerMessage(this.player, 'Press 1-3 to swap items between hand and backpack.');
    // this.world.chatManager.sendPlayerMessage(this.player, 'Press Q to drop the item in your hand.');
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
    const oldHealth = this.health;
    this.health = Math.min(this.health + amount, this._maxHealth);
    const healedAmount = this.health - oldHealth;
    if (healedAmount > 0) {
      this._logger.debug(`Player healed ${healedAmount}, health: ${this.health}`);
      // Optionally send a confirmation message to the player UI here if needed
    }
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
    
    // Handle healing with 'h' key (for testing, can be removed later)
    if (input.h) {
      this.heal(10); // Heal on 'h' key press
      input.h = false; // Reset the input to avoid continuous healing
    }
    
    // Removed inventory key bindings (Q, F, 1, 2, 3)
    // if (input.q) { ... }
    // if (input.f) { ... }
    // if (input.one) { ... }
    // if (input.two) { ... }
    // if (input.three) { ... }
    
    // Handle interaction with 'e' key
    if (input.e) {
      this._handleInteract();
      input.e = false; // Reset the input to avoid continuous interaction
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
      const hitEntity = raycastResult.hitEntity;
      
      // Check if the hit entity is a HealthPackItem
      if (hitEntity instanceof HealthPackItem) {
        this._logger.debug(`Player interacted with Health Pack`);
        // Consume the health pack (which includes healing)
        const consumed = hitEntity.consume(this); 
        if (consumed) {
          // If successfully consumed, despawn it
          hitEntity.despawn();
        } else {
          // Maybe the player was at full health, log it
          this._logger.debug(`Health pack consumption returned false (player likely at full health)`);
        }
      } 
      // Removed interaction with other players for item sharing
      // else if (hitEntity instanceof GamePlayerEntity) { ... }
      else {
         this._logger.debug(`Player interacted with non-healthpack entity: ${hitEntity.name}`);
         // Add logic for other interactable entities here later (e.g., BFG pickup)
      }
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
    
    // Removed inventory UI update call
    // this._updateInventoryUI();
  }
  
  // Getter/setter for health
  get health(): number {
    return this._health;
  }
  
  set health(value: number) {
    const previousHealth = this._health;
    this._health = Math.max(0, Math.min(value, this._maxHealth));
    // Update UI only if health actually changed (prevent spam)
    if (this._health !== previousHealth && this.world) { // Check if health changed and world exists (UI should be loaded if world exists)
       this._updateHealthUI();
    }
  }
} 