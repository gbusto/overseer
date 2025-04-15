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
const MIN_INJURED_SOUND_INTERVAL_MS = 1000; // Minimum 1 second between injured sounds
const MAX_INJURED_SOUND_INTERVAL_MS = 2500; // Maximum 2.5 seconds between injured sounds
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
  private _logger = new Logger('GamePlayerEntity');
  
  // Track player death state
  private _dead: boolean = false;
  
  // Active weapon state
  private _activeWeapon: BaseWeaponEntity | null = null;
  
  // Player entities always have a PlayerController
  public get playerController(): PlayerEntityController {
    return this.controller as PlayerEntityController;
  }
  
  // Getter for death state
  public get isDead(): boolean { return this._dead; }
  
  // --- NEW Injured Sound Properties --- START
  private readonly _injuredSoundUris: string[] = [
    'audio/sfx/player/player-injured-1.mp3',
    'audio/sfx/player/player-injured-2.mp3',
    'audio/sfx/player/player-injured-3.mp3',
    'audio/sfx/player/player-injured-4.mp3'
  ];
  private _nextInjuredSoundTime: number = 0; // Timestamp when the next sound can play
  // --- NEW Injured Sound Properties --- END
  
  constructor(player: Player) {
    super({
      player,
      name: 'Player',
      modelUri: 'models/players/soldier-player.gltf',
      modelLoopedAnimations: ['idle'],
      modelScale: 0.5,
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
    
    // Update player UI (health and other stats)
    this._updatePlayerUI();
    
    // Also send overseer health data if it exists
    const gameManager = GameManager.instance;
    const overseer = gameManager.getOverseerEntity();
    if (overseer) {
      this.player.ui.sendData({
        type: 'overseer-health-update',
        health: overseer.getHealth(),
        maxHealth: 100
      });
    }
    
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
  }
  
  /**
   * Take damage from sources
   */
  public takeDamage(amount: number): void {
    // Prevent taking damage or showing effects if already dead
    if (!this.isSpawned || !this.world || this._dead) return;
    
    // Only take damage if the game is active or player vulnerability is enabled
    if (!GameManager.isPlayerVulnerable()) {
      this._logger.debug(`Damage ignored: Player not vulnerable (isPlayerVulnerable: ${GameManager.isPlayerVulnerable()})`);
      return;
    }
    
    // Reduce health
    const oldHealth = this.health;
    this.health -= amount;
    
    // --- NEW Periodic Injured Sound Logic --- START
    const now = Date.now();
    if (now >= this._nextInjuredSoundTime && this.health > 0) { // Only play if still alive
        // Select random sound URI
        const randomIndex = Math.floor(Math.random() * this._injuredSoundUris.length);
        const selectedUri = this._injuredSoundUris[randomIndex];
        
        if (selectedUri && this.world) { 
            // Create and play the audio instance
            const injuredAudio = new Audio({
                attachedToEntity: this,
                uri: selectedUri,
                loop: false,
                volume: 0.75, // Adjust volume as needed
                referenceDistance: 15 // Adjust falloff
            });
            injuredAudio.play(this.world);
            
            // Calculate next play time
            const delay = Math.random() * (MAX_INJURED_SOUND_INTERVAL_MS - MIN_INJURED_SOUND_INTERVAL_MS) + MIN_INJURED_SOUND_INTERVAL_MS;
            this._nextInjuredSoundTime = now + delay;
            
            this._logger.debug(`Played injured sound: ${selectedUri}, next play in ${(delay / 1000).toFixed(1)}s`);
        }
    }
    // --- NEW Periodic Injured Sound Logic --- END
    
    // Update health UI elements
    this._updateHealthUI();
    
    // Send damage indicator UI update ONLY if the player is still alive after taking damage
    if (this.health > 0) {
      // TODO: This needs hitDirection, which is not currently passed to takeDamage
      // We might need to refactor where damage is applied or how indicators are triggered.
      // For now, let's comment out the indicator logic to prevent errors.
      /* 
      const facingDir = this.player.camera.facingDirection;
      this.player.ui.sendData({
        type: 'damage-indicator', 
        direction: {
          x: -(facingDir.x * hitDirection.z - facingDir.z * hitDirection.x),
          y: 0,
          z: -(facingDir.x * hitDirection.x + facingDir.z * hitDirection.z)
        }
      });
      */
      this._logger.debug('Skipping damage indicator UI update temporarily.'); // Placeholder log
    }
    
    this._logger.debug(`Player took ${amount} damage, health: ${oldHealth} -> ${this.health}`);
    
    // Check if player died from this damage
    if (this.health <= 0) {
      this.checkDeath();
    }
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
      if (this.isSpawned) {
        this.player.camera.setAttachedToEntity(this);
      }
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
    
    // If player is dead, ignore all inputs
    if (this._dead) {
      // Clear all inputs to prevent any actions
      Object.keys(input).forEach(key => {
        input[key] = false;
      });
      return;
    }
    
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
    const distance = 3; // Increased distance for easier interaction
    
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
        // First, call pickup to handle label unload and stop despawn timer
        const pickedUp = hitEntity.pickup(this); 
        if (pickedUp) {
          // Now, attempt to consume it
          const consumed = hitEntity.consume(this); 
          if (!consumed) {
            this._logger.debug(`Health pack consumption returned false (player likely at full health), but still removing pack.`);
          }
          // Always despawn the health pack after interaction since there's no inventory
          hitEntity.despawn(); 
        } else {
          this._logger.warn(`Health pack pickup call failed unexpectedly.`);
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
          // Call unequip directly - this should handle detaching and resetting animations
          this._activeWeapon.unequip(); 
          // Do NOT call drop() here, as that starts the despawn timer and applies physics.
          // The weapon should just float where it was detached until picked up again or despawns.
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
      health: Math.round(this._health),
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

  private updateCameraToSpectate(): void {
    if (this.player.camera) {
      this.player.camera.setAttachedToPosition(
        { x: -47, y: 20, z: 10 }
      );
      this.player.camera.setMode(PlayerCameraMode.SPECTATOR);
      this.player.camera.setModelHiddenNodes([]);
    }
  }

  /**
   * Check if player has died and handle death state
   */
  public checkDeath(): void {
    if (this.health <= 0 && !this._dead) {
      this._dead = true;
      
      if (this.isSpawned && this.world) {
        // Reset player inputs to prevent any movement
        Object.keys(this.player.input).forEach(key => {
          this.player.input[key] = false;
        });
        
        // Set the player to "sleep" animation to look dead
        this.playerController.idleLoopedAnimations = ['sleep'];
        this.playerController.walkLoopedAnimations = [];
        this.playerController.runLoopedAnimations = [];
        
        // Notify the player (chat)
        this.world.chatManager.sendPlayerMessage(
          this.player, 
          'You have been eliminated! You will remain in spectator mode until the game ends.', 
          'FF0000'
        );
                
        this._logger.info(`Player died: ${this.player.username || this.player.id}`);

        // Inform the GameManager about the player's death
        GameManager.instance.handlePlayerDeath(this);
        
        // Send a message to the UI to indicate player death
        this.player.ui.sendData({ type: 'player-died' });
        
        // Update camera to spectator mode
        this.updateCameraToSpectate();
      }
    }
  }
  
  /**
   * Respawn a dead player (for testing purposes only)
   */
  public respawn(): void {
    if (!this.world) return;
    
    this._dead = false;
    this.health = this._maxHealth;
    
    // Calculate random spawn position within +/- 20 X/Z, Y=10
    const spawnX = (Math.random() * 40) - 20; // Range -20 to +20
    const spawnZ = (Math.random() * 40) - 20; // Range -20 to +20
    const spawnY = 10;
    this.setPosition({ x: spawnX, y: spawnY, z: spawnZ });
    
    // Reset animations
    this.resetAnimations();
    
    // Reset camera
    this._setupPlayerCamera();
    
    // Update UI
    this._updatePlayerUI();
    
    // Unequip any weapon (ensure _activeWeapon is null)
    if (this._activeWeapon) {
      this._activeWeapon.unequip(); // Properly handle unequip logic if it exists
      this._activeWeapon = null;
      this._logger.debug('Unequipped weapon on respawn.');
    }
    
    
    // Send a message to the UI to indicate player respawn
    this.player.ui.sendData({ type: 'player-respawned' });
  }

  /**
   * Reset the player state for a new game.
   */
  public reset(): void {
      this._logger.info(`Resetting player state for ${this.player.username || this.player.id}`);
      
      // Reset health
      this.health = this._maxHealth;
      
      // Reset death state
      this._dead = false;
      
      // Unequip weapon
      if (this._activeWeapon) {
          this._activeWeapon.unequip(); // Ensure proper cleanup
          this._activeWeapon = null;
      }
      
      // Teleport to a default spawn location (e.g., center of map)
      // Adjust coordinates as needed
      const resetPosition = { x: 0, y: 10, z: 0 };
      this.setPosition(resetPosition);
      
      // Reset animations to default
      this.resetAnimations();
      
      // Reset camera to first-person
      this._setupPlayerCamera(); 
      
      // Ensure UI is updated (including hiding game-specific UI if needed)
      this._updatePlayerUI();
      // Optionally send a specific 'reset-ui' event
      this.player.ui.sendData({ type: 'reset-ui' });
      
      this._logger.info(`Player state reset complete for ${this.player.username || this.player.id}`);
  }
} 