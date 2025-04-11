import {
  PlayerEntity,
  Player,
  Audio,
  BaseEntityControllerEvent,
  PlayerEntityController,
  World,
  PlayerCameraMode
} from 'hytopia';
import type { Vector3Like, QuaternionLike } from 'hytopia';
import { Logger } from '../../utils/logger';
import GameManager, { GameState } from '../GameManager';
import BaseItem from '../items/BaseItem';
import HealthPackItem from '../items/HealthPackItem'; // Import HealthPackItem
import BaseWeaponEntity from '../weapons/BaseWeaponEntity'; // Import base weapon entity
import EnergyRifle1 from '../weapons/EnergyRifle1'; // Import specific weapon entity

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
  
  // Active weapon state
  private _activeWeapon: BaseWeaponEntity | null = null;
  
  // Player entities always have a PlayerController
  public get playerController(): PlayerEntityController {
    return this.controller as PlayerEntityController;
  }
  
  constructor(player: Player) {
    super({
      player,
      name: 'Player',
      modelUri: 'models/players/soldier-player.gltf',
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
    // Set up camera mode
    this._setupPlayerCamera();
    // Call the renamed public method
    this.resetAnimations();
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
    this.world.chatManager.sendPlayerMessage(this.player, 'Press E to interact with Health Packs and weapons.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Left-click to fire equipped weapons.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Press \\ to enter or exit debug view.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Type /start to begin a game!', '00FFFF');
    this.world.chatManager.sendPlayerMessage(this.player, 'Admin commands:', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/rocket - Launch yourself into the air', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/oshealth [0-100] - Set overseer health', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/healthpack - Spawn a health pack in front of you', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/healthpacks - Spawn health packs around the map', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/rifle - Spawn an Energy Rifle in front of you', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/riflepos - Adjust equipped rifle position (debugging)', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/setweaponpos x y z - Set weapon position', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/setweaponrot x y z - Set weapon rotation (degrees)', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/setweaponscale scale - Set weapon scale', 'FFA500');
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
    // Don't set default animations here anymore, call _setDefaultAnimations instead
    this.playerController.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, this._onTickWithPlayerInput);
  }
  
  /**
   * Set up player camera for first-person view
   */
  private _setupPlayerCamera(): void {
      if (!this.player || !this.player.camera) {
          this._logger.error('Cannot setup camera: Player or camera reference missing.');
          return;
      }
      this.player.camera.setMode(PlayerCameraMode.FIRST_PERSON);
      // Match Hygrounds exactly - only hide head, neck, torso, and legs
      // Importantly, keep arms and hands visible
      this.player.camera.setModelHiddenNodes(['head', 'neck', 'torso', 'leg_right', 'leg_left']);
      // Set camera offset relative to player origin (adjust y for eye level)
      this.player.camera.setOffset({ x: 0, y: 0.5, z: 0 }); // Match Hygrounds offset exactly
      this._logger.info('Set player camera to First Person mode.');
  }
  
  /**
   * Handle player input ticks
   */
  private _onTickWithPlayerInput = (payload: any): void => {
    const { input } = payload;
    
    // Handle healing with 'h' key (for testing)
    if (input.h) {
      this.heal(10); 
      input.h = false; 
    }
    
    // Handle interaction with 'e' key
    if (input.e) {
      this._handleInteract();
      input.e = false; 
    }

    // Handle firing with left mouse click ('ml')
    if (input.ml) {
      if (this._activeWeapon) {
        this._activeWeapon.fire();
      }
      input.ml = false; // Consume the input
    }
  };
  
  /**
   * Handle player interaction (E key)
   */
  private _handleInteract(): void {
    if (!this.world || !this.isSpawned) return;
    
    const origin = this.position;
    const direction = this.player.camera.facingDirection;
    const distance = 2; 
    
    const raycastResult = this.world.simulation.raycast(
      origin,
      direction,
      distance,
      { filterExcludeRigidBody: this.rawRigidBody }
    );
    
    if (raycastResult?.hitEntity) {
      const hitEntity = raycastResult.hitEntity;
      
      if (hitEntity instanceof HealthPackItem) {
        this._logger.debug(`Player interacted with Health Pack`);
        const consumed = hitEntity.consume(this); 
        if (consumed) {
          hitEntity.despawn();
        } else {
          this._logger.debug(`Health pack consumption returned false (player likely at full health)`);
        }
      } 
      // Now check if it's a weapon (BaseWeaponEntity)
      else if (hitEntity instanceof BaseWeaponEntity) {
        this._logger.info(`Player interacted with weapon: ${hitEntity.name}`);
        hitEntity.pickup(this); // Let the weapon handle the pickup
      }
      else if (hitEntity instanceof BaseItem) {
        this._logger.debug(`Player interacted with item: ${hitEntity.itemName}`);
        // Keep old item interaction logic for backward compatibility
        // Can be removed later when all items are migrated to new pattern
      }
      else {
         this._logger.debug(`Player interacted with unhandled entity: ${hitEntity.name}`);
      }
    }
  }

  /**
   * Helper method to set default unarmed animations.
   * Now public and renamed to match Hygrounds convention.
   */
  public resetAnimations(): void {
      const controller = this.playerController;
      if (!controller) return;
      
      controller.idleLoopedAnimations = ['idle_upper', 'idle_lower'];
      controller.walkLoopedAnimations = ['walk_upper', 'walk_lower'];
      controller.runLoopedAnimations = ['run_upper', 'run_lower'];
      // controller.interactOneshotAnimations = ['default_interact'];
      this._logger.info('Reset player animations to default (unarmed).');
  }

  /**
   * Equips a weapon
   * @param weapon The weapon entity to equip
   */
  public equipWeapon(weapon: BaseWeaponEntity): void {
      this._logger.info(`GamePlayerEntity.equipWeapon called with weapon ${weapon.name}`);
      
      // Unequip previous weapon if exists
      if (this._activeWeapon && this._activeWeapon !== weapon) {
          this._logger.info(`Unequipping previous weapon ${this._activeWeapon.name}`);
          this._activeWeapon.unequip();
      }

      // Set as active weapon
      this._activeWeapon = weapon;
      this._logger.info(`Set this._activeWeapon = ${weapon.name}`);
      
      // Tell weapon to equip (position itself and set animations)
      this._logger.info(`Calling weapon.equip()`);
      this._activeWeapon.equip();
      
      this._logger.info(`Equipped weapon: ${weapon.name}`);
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