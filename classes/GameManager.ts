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

// Map boundary constants for random spawning
const MAP_MIN_X = -47;
const MAP_MAX_X = 47;
const MAP_MIN_Z = -47;
const MAP_MAX_Z = 47;
const MAP_RADIUS = 47;
const SPAWN_Y = 4; // Base height for item spawns
const NUM_HEALTH_PACKS_TO_SPAWN = 5;

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

    // Spawn initial health packs
    this.spawnTestHealthPacks(); // Renaming this later might be good

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
    
    // Despawn any remaining health packs?
    // this._despawnAllHealthPacks(); // Consider adding this

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
   * Spawns a specified number of health packs randomly within the map circle.
   */
  public spawnTestHealthPacks(): void {
    if (!this._world) return;
    
    this._logger.info(`Attempting to spawn ${NUM_HEALTH_PACKS_TO_SPAWN} health packs...`);
    let spawnedCount = 0;
    for (let i = 0; i < NUM_HEALTH_PACKS_TO_SPAWN; i++) {
      const position = this._getRandomSpawnPositionInCircle();
      if (position) {
        // Create a health pack with default settings (uses default heal amount)
        const healthPack = new HealthPackItem({}); 
        healthPack.spawn(this._world, position);
        this._logger.debug(`Spawned health pack #${i + 1} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
        spawnedCount++;
      } else {
        // This should ideally not happen often if the radius/bounds are correct
        this._logger.warn(`Could not find a valid spawn position for health pack #${i + 1} after retries.`);
      }
    }
    
    // Announce to all players
    if (spawnedCount > 0 && this._world.chatManager) {
      this._world.chatManager.sendBroadcastMessage(`${spawnedCount} Health packs have been spawned around the map!`, '00FF00');
    }
  }

  /**
   * Generates a random spawn position within the defined circular map area.
   * Retries a few times if the first attempt is outside the circle.
   * @returns A valid Vector3Like position or null if unable to find one after retries.
   */
  private _getRandomSpawnPositionInCircle(maxRetries = 10): Vector3Like | null {
    for (let i = 0; i < maxRetries; i++) {
      const randomX = Math.random() * (MAP_MAX_X - MAP_MIN_X) + MAP_MIN_X;
      const randomZ = Math.random() * (MAP_MAX_Z - MAP_MIN_Z) + MAP_MIN_Z;

      // Calculate distance from center (0,0)
      const distanceSq = randomX * randomX + randomZ * randomZ;
      const radiusSq = MAP_RADIUS * MAP_RADIUS;

      // Check if the point is within the circle
      if (distanceSq <= radiusSq) {
        return { x: randomX, y: SPAWN_Y, z: randomZ };
      }
    }
    // If we exhausted retries, return null
    return null;
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
    
    // Start game command is registered in initialize()
    
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
    
    // Set overseer health command (registered in index.ts? Check and remove duplication if needed)
    // This seems duplicated from index.ts, might need consolidation later.
    // this._world.chatManager.registerCommand('/oshealth', (player, args) => { ... });
    
    // Spawn health packs command (calls the random spawner)
    this._world.chatManager.registerCommand('/healthpacks', (player) => {
      this.spawnTestHealthPacks(); // This now spawns randomly
      // Message is now sent from within spawnTestHealthPacks
      // this._world?.chatManager.sendPlayerMessage(player, 'Spawned health packs around the map', '00FF00');
    });

    // Spawn a single health pack at player's position (Still useful for targeted testing)
    this._world.chatManager.registerCommand('/healthpack', (player) => {
      if (!this._world) return;
      
      const playerEntity = this._world.entityManager.getPlayerEntitiesByPlayer(player)[0];
      if (!playerEntity) {
        this._world.chatManager.sendPlayerMessage(player, 'Player entity not found', 'FF0000');
        return;
      }
      
      // Create a health pack with default healing
      const healthPack = new HealthPackItem({}); 
      
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