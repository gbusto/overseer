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
import HealthPackItem from './items/HealthPackItem';
import OverseerEntity from './entities/OverseerEntity';

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
  private _gameStartTime: number = 0;
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
        this.startGame();
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

    // Register custom chat commands
    this._registerCommands();
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
    this._world.chatManager.sendBroadcastMessage('Game started!', '00FF00');
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

    // Broadcast to all players
    this._world.chatManager.sendBroadcastMessage('Game over!', 'FF0000');
    
    // Reset game
    this._resetGame();
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
    
    this._logger.info(`Player spawned: ${player.username || player.id}`);
  }

  /**
   * Spawn some test health packs for players to use
   */
  public spawnTestHealthPacks(): void {
    if (!this._world) return;
    
    // Create and spawn 5 health packs around the map
    const spawnPositions = [
      { x: 10, y: 4, z: 10 },
      { x: -10, y: 4, z: -10 },
      { x: 15, y: 4, z: -15 },
      { x: -15, y: 4, z: 15 },
      { x: 0, y: 4, z: 20 }
    ];
    
    spawnPositions.forEach((position, index) => {
      // Create a health pack with default settings
      const healthPack = new HealthPackItem({
        healAmount: 25
      });
      
      healthPack.spawn(this._world!, position);
      this._logger.info(`Spawned test health pack at (${position.x}, ${position.y}, ${position.z})`);
    });
    
    // Announce to all players
    if (this._world.chatManager) {
      this._world.chatManager.sendBroadcastMessage('Health packs have been spawned around the map!', '00FF00');
    }
  }

  /**
   * Gets the overseer entity from the world
   * @returns The overseer entity or null if not found
   */
  public getOverseerEntity(): OverseerEntity | null {
    if (!this._world) return null;
    
    // Find the entity with tag 'overseer'
    const overseerEntities = this._world.entityManager.getEntitiesByTag('overseer');
    
    if (overseerEntities.length > 0) {
      return overseerEntities[0] as OverseerEntity;
    }
    
    return null;
  }

  /**
   * Register custom chat commands
   */
  private _registerCommands(): void {
    if (!this._world) return;
    
    // Start game command
    this._world.chatManager.registerCommand('/start', (player) => {
      if (this._gameState !== GameState.IDLE) {
        this._world?.chatManager.sendPlayerMessage(player, 'Game already in progress!', 'FF0000');
        return;
      }
      
      this.startGame();
      this._world?.chatManager.sendBroadcastMessage('Game started!', '00FF00');
    });
    
    // Stop game command
    this._world.chatManager.registerCommand('/stop', (player) => {
      if (this._gameState !== GameState.ACTIVE) {
        this._world?.chatManager.sendPlayerMessage(player, 'No game in progress!', 'FF0000');
        return;
      }
      
      this.endGame();
      this._world?.chatManager.sendBroadcastMessage('Game stopped!', 'FF0000');
    });
    
    // Rocket command - launches player into the air
    this._world.chatManager.registerCommand('/rocket', (player) => {
      const playerEntity = this._world?.entityManager.getPlayerEntitiesByPlayer(player)[0];
      
      if (playerEntity) {
        playerEntity.applyImpulse({ x: 0, y: playerEntity.mass * 50, z: 0 });
        this._world?.chatManager.sendPlayerMessage(player, 'Whoosh!', '00FFFF');
      }
    });
    
    // Set overseer health command
    this._world.chatManager.registerCommand('/oshealth', (player, args) => {
      if (!args || args.length < 1) {
        this._world?.chatManager.sendPlayerMessage(player, 'Usage: /oshealth [0-100]', 'FF0000');
        return;
      }
      
      const health = parseInt(args[0] || '0');
      if (isNaN(health) || health < 0 || health > 100) {
        this._world?.chatManager.sendPlayerMessage(player, 'Health must be between 0 and 100', 'FF0000');
        return;
      }
      
      const overseerEntity = this.getOverseerEntity();
      if (overseerEntity) {
        overseerEntity.setHealth(health);
        this._world?.chatManager.sendPlayerMessage(player, `Set overseer health to ${health}`, '00FF00');
      } else {
        this._world?.chatManager.sendPlayerMessage(player, 'Overseer not found', 'FF0000');
      }
    });
    
    // Spawn health packs command
    this._world.chatManager.registerCommand('/healthpacks', (player) => {
      this.spawnTestHealthPacks();
      this._world?.chatManager.sendPlayerMessage(player, 'Spawned health packs around the map', '00FF00');
    });
    
    // Spawn a single health pack at player's position
    this._world.chatManager.registerCommand('/healthpack', (player) => {
      if (!this._world) return;
      
      const playerEntity = this._world.entityManager.getPlayerEntitiesByPlayer(player)[0];
      if (!playerEntity) {
        this._world.chatManager.sendPlayerMessage(player, 'Player entity not found', 'FF0000');
        return;
      }
      
      // Create a health pack with increased healing
      const healthPack = new HealthPackItem({
        healAmount: 50
      });
      
      // Spawn slightly in front of the player
      const position = playerEntity.position;
      const direction = player.camera.facingDirection;
      const spawnPosition = {
        x: position.x + direction.x * 2,
        y: position.y + 0.5,
        z: position.z + direction.z * 2
      };
      
      healthPack.spawn(this._world, spawnPosition);
      this._world.chatManager.sendPlayerMessage(player, 'Health pack spawned in front of you', '00FF00');
    });
  }
} 