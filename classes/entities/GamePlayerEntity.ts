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

// Constants
const MAX_HEALTH = 100;
const BASE_HEALTH = 100;

export default class GamePlayerEntity extends PlayerEntity {
  private _health: number = BASE_HEALTH;
  private _maxHealth: number = MAX_HEALTH;
  private _damageAudio: Audio;
  private _logger = new Logger('GamePlayerEntity');
  
  // Player entities always have a PlayerController
  public get playerController(): PlayerEntityController {
    return this.controller as PlayerEntityController;
  }
  
  // Health getters and setters
  public get health(): number { return this._health; }
  public set health(value: number) {
    this._health = Math.max(0, Math.min(value, this._maxHealth));
    this._updateHealthUI();
  }
  
  public get maxHealth(): number { return this._maxHealth; }
  
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
    this.world.chatManager.sendPlayerMessage(this.player, 'Press \\ to enter or exit debug view.');
    this.world.chatManager.sendPlayerMessage(this.player, 'Type /start to begin a game!', '00FFFF');
    this.world.chatManager.sendPlayerMessage(this.player, 'Admin commands:', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/rocket - Launch yourself into the air', 'FFA500');
    this.world.chatManager.sendPlayerMessage(this.player, '/oshealth [0-100] - Set overseer health', 'FFA500');
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
    
    // Example: handling a specific key press (for future use)
    if (input.h) {
      this.heal(10); // Heal on 'h' key press
      input.h = false; // Reset the input to avoid continuous healing
    }
  };
  
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
    
    // Add other UI updates as needed
  }
} 