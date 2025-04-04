import {
  World,
  PlayerEntity,
  Player,
  Audio,
  SceneUI,
  PlayerEvent,
} from 'hytopia';
import type { Vector3Like } from 'hytopia';
import { Logger } from '../utils/logger';
import GamePlayerEntity from './entities/GamePlayerEntity';

// Game states enum
export enum GameState {
  IDLE = 'IDLE',
  STARTING = 'STARTING',
  ACTIVE = 'ACTIVE',
  ENDING = 'ENDING'
}

// Game constants
const GAME_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const COUNTDOWN_DURATION_MS = 5 * 1000; // 5 seconds countdown
const FADE_DURATION_MS = 1000; // 1 second fade transition

export default class GameManager {
  // Singleton pattern
  private static _instance: GameManager;
  public static get instance(): GameManager {
    if (!GameManager._instance) {
      GameManager._instance = new GameManager();
    }
    return GameManager._instance;
  }

  // Properties
  private _world?: World;
  private _gameState: GameState = GameState.IDLE;
  private _gameTimer?: NodeJS.Timeout;
  private _gameStartTime: number = 0;
  private _countdownTimer?: NodeJS.Timeout;
  private _logger = new Logger('GameManager');

  // Getters
  public get world(): World | undefined { return this._world; }
  public get gameState(): GameState { return this._gameState; }
  public get isGameActive(): boolean { return this._gameState === GameState.ACTIVE; }

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Initialize the game manager with the world
   */
  public initialize(world: World): void {
    this._world = world;
    this._gameState = GameState.IDLE;
    this._logger.info('GameManager initialized');

    // Register the /start command
    world.chatManager.registerCommand('/start', (player) => {
      if (this._gameState === GameState.IDLE) {
        world.chatManager.sendBroadcastMessage(`${player.username || player.id} started a new game!`, '00FF00');
        this.startGameCountdown();
      } else {
        world.chatManager.sendPlayerMessage(player, 'A game is already in progress.', 'FF0000');
      }
    });

    // Handle player joining
    world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      this._spawnPlayer(player);
    });

    // Handle player leaving
    world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      // Clean up player entities when they leave
      world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
    });
  }

  /**
   * Start the game countdown
   */
  public startGameCountdown(): void {
    if (!this._world || this._gameState !== GameState.IDLE) return;

    this._gameState = GameState.STARTING;
    this._logger.info('Game countdown started');
    
    // Broadcast to all players
    this._world.chatManager.sendBroadcastMessage('Game starting in 5 seconds!', '00FF00');
    
    // Send UI data to all players
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      entity.player.ui.sendData({
        type: 'game-countdown',
        countdown: 5
      });
    });

    // Start countdown
    let countdown = 5;
    this._countdownTimer = setInterval(() => {
      countdown--;
      
      if (countdown <= 0) {
        clearInterval(this._countdownTimer);
        this.startGame();
      } else {
        // Update countdown UI
        this._world?.entityManager.getAllPlayerEntities().forEach(entity => {
          entity.player.ui.sendData({
            type: 'game-countdown',
            countdown
          });
        });
      }
    }, 1000);
  }

  /**
   * Start the game
   */
  public startGame(): void {
    if (!this._world) return;

    this._gameState = GameState.ACTIVE;
    this._gameStartTime = Date.now();
    this._logger.info('Game started');

    // Enable the Overseer's brain
    const overseer = this._world.entityManager.getEntitiesByTag('overseer')[0];
    if (overseer) {
      const overseerEntity = overseer as any; // Using 'any' to access the method
      if (typeof overseerEntity.toggleKOROUpdates === 'function') {
        overseerEntity.toggleKOROUpdates(true);
        this._logger.info('Overseer brain enabled');
      }
    }

    // Broadcast to all players
    this._world.chatManager.sendBroadcastMessage('Game started! 10 minutes remaining.', '00FF00');
    
    // Update all player UIs
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      entity.player.ui.sendData({
        type: 'game-start',
        startTime: this._gameStartTime,
        duration: GAME_DURATION_MS
      });
    });

    // Set the timer to end the game
    this._gameTimer = setTimeout(() => {
      this.endGame();
    }, GAME_DURATION_MS);

    // Start sending timer updates to clients
    this._startTimerUpdates();
  }

  /**
   * End the game
   */
  public endGame(): void {
    if (!this._world || this._gameState !== GameState.ACTIVE) return;

    this._gameState = GameState.ENDING;
    this._logger.info('Game ended');

    // Disable the Overseer's brain
    const overseer = this._world.entityManager.getEntitiesByTag('overseer')[0];
    if (overseer) {
      const overseerEntity = overseer as any; // Using 'any' to access the method
      if (typeof overseerEntity.toggleKOROUpdates === 'function') {
        overseerEntity.toggleKOROUpdates(false);
        this._logger.info('Overseer brain disabled');
      }
    }

    // Clear the game timer
    if (this._gameTimer) {
      clearTimeout(this._gameTimer);
      this._gameTimer = undefined;
    }

    // Broadcast to all players
    this._world.chatManager.sendBroadcastMessage('Game over!', 'FF0000');
    
    // Send fade to white effect to all players
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      entity.player.ui.sendData({
        type: 'fade-white',
        duration: FADE_DURATION_MS
      });
    });

    // Reset game after fade transition
    setTimeout(() => {
      this._resetGame();
    }, FADE_DURATION_MS);
  }

  /**
   * Reset the game to idle state
   */
  private _resetGame(): void {
    if (!this._world) return;

    // Reset all players (restore health, position, etc.)
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      if (entity instanceof PlayerEntity) {
        // Reset player state
        entity.setPosition({ x: 0, y: 10, z: 0 });
      }
    });

    // Reset game state
    this._gameState = GameState.IDLE;
    this._logger.info('Game reset to idle state');

    // Send fade from white effect to all players
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      entity.player.ui.sendData({
        type: 'fade-from-white',
        duration: FADE_DURATION_MS
      });
    });

    // Broadcast to all players
    this._world.chatManager.sendBroadcastMessage('Ready for a new game! Type /start to begin.', '00FF00');
  }

  /**
   * Spawn a player in the world
   */
  private _spawnPlayer(player: Player): void {
    if (!this._world) return;
    
    // Create and spawn the player entity
    const playerEntity = new GamePlayerEntity(player);
    playerEntity.spawn(this._world, { x: 0, y: 10, z: 0 });
    
    // Get the overseer health to update the player UI
    const overseer = this._world.entityManager.getEntitiesByTag('overseer')[0];
    if (overseer) {
      const overseerEntity = overseer as any; // Using 'any' to access the method
      if (typeof overseerEntity.getHealth === 'function') {
        const health = overseerEntity.getHealth();
        player.ui.sendData({
          type: 'overseer-health-update',
          health: health,
          maxHealth: 100
        });
      }
    }

    // Update player with current game state
    if (this._gameState === GameState.ACTIVE) {
      player.ui.sendData({
        type: 'game-active',
        startTime: this._gameStartTime,
        duration: GAME_DURATION_MS,
        elapsed: Date.now() - this._gameStartTime
      });
    }

    this._logger.info(`Player spawned: ${player.username || player.id}`);
  }

  /**
   * Send regular timer updates to all players
   */
  private _startTimerUpdates(): void {
    if (!this._world || this._gameState !== GameState.ACTIVE) return;

    // Update timer every second
    const timerInterval = setInterval(() => {
      if (this._gameState !== GameState.ACTIVE) {
        clearInterval(timerInterval);
        return;
      }

      const elapsed = Date.now() - this._gameStartTime;
      const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
      
      this._world?.entityManager.getAllPlayerEntities().forEach(entity => {
        entity.player.ui.sendData({
          type: 'timer-update',
          remaining
        });
      });
    }, 1000);
  }
} 