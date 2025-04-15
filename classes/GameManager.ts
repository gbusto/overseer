import {
  World,
  PlayerEntity,
  Player,
  Audio,
  SceneUI,
  PlayerEvent,
  Quaternion
} from 'hytopia';
import type { Vector3Like } from 'hytopia';
import { Logger } from '../utils/logger';
import GamePlayerEntity from './entities/GamePlayerEntity';
import HealthPackItem from './items/HealthPackItem';
import OverseerEntity from './entities/OverseerEntity';
import type { KoroMode } from './ai/KOROBrain';
import EnergyRifle1 from './weapons/EnergyRifle1';
import BFG from './weapons/BFG';
import BiodomeController from './BiodomeController';
import BaseWeaponEntity from './weapons/BaseWeaponEntity';

// Game states enum
export enum GameState {
  IDLE = 'IDLE',
  COUNTDOWN = 'COUNTDOWN',
  ACTIVE = 'ACTIVE',
  GAMEOVER = 'GAMEOVER',
}

// Game constants
const GAME_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const COUNTDOWN_DURATION_S = 10; // Countdown duration in seconds
const GAMEOVER_DURATION_S = 30; // Duration of game over screen in seconds - Increased to 30
const HEALTH_PACK_SPAWN_INTERVAL_S = 60; // Interval for spawning health packs (in seconds)

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

  // Static flag to control whether players can take damage outside of active game
  private static _playerVulnerable: boolean = false;
  
  // Properties
  private _world?: World;
  private _gameState: GameState = GameState.IDLE;
  private _gameStartTime: number = 0;
  private _logger = new Logger('GameManager');

  // Timers
  private _countdownTimer: NodeJS.Timeout | null = null;
  private _healthPackSpawnTimer: NodeJS.Timeout | null = null;
  private _gameOverTimer: NodeJS.Timeout | null = null;

  // Music Audio instances
  private _calmMusic: Audio | null = null;
  private _rockMusic: Audio | null = null;

  // Getters
  public get world(): World | undefined { return this._world; }
  public get gameState(): GameState { return this._gameState; }
  public get isGameActive(): boolean { return this._gameState === GameState.ACTIVE; }

  // Check if players are vulnerable to damage
  public static isPlayerVulnerable(): boolean {
    return GameManager._playerVulnerable || GameManager.instance.gameState === GameState.ACTIVE;
  }

  // Toggle player vulnerability
  public static setPlayerVulnerable(vulnerable: boolean): void {
    GameManager._playerVulnerable = vulnerable;
    GameManager.instance._logger.info(`Player vulnerability set to ${vulnerable}`);
  }

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

    // Initialize music
    this._calmMusic = new Audio({
      uri: 'audio/music/ambient-music.mp3',
      loop: true,
      volume: 0.1,
    });
    this._rockMusic = new Audio({
      uri: 'audio/music/tense-music.mp3',
      loop: true,
      volume: 0.1, // Adjust volume as needed
    });

    // Start playing calm music initially
    this._calmMusic.play(world);
    this._logger.info('Started playing calm background music.');

    // Register the /start command
    world.chatManager.registerCommand('/start', (player) => {
      if (this._gameState === GameState.IDLE) {
        world.chatManager.sendBroadcastMessage(`${player.username || player.id} started a new game!`, '00FF00');
        this._transitionToCountdown();
      } else {
        world.chatManager.sendPlayerMessage(player, 'A game is already in progress.', 'FF0000');
      }
    });

    // Handle player joining
    world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      // Ensure world exists before proceeding
      if (!this._world) return;

      // Create the player entity regardless of game state
      const playerEntity = new GamePlayerEntity(player);
      
      if (this._gameState === GameState.ACTIVE) {
        // Game is active, spawn player as dead spectator at specific location
        const spectatorSpawnPos = { x: -47, y: 6, z: 47 };
        playerEntity.spawn(this._world, spectatorSpawnPos);
        this._logger.info(`Player ${player.username || player.id} joined during ACTIVE game. Spawning as spectator.`);
        
        // Immediately set health to 0 and trigger death state
        playerEntity.health = 0;
        playerEntity.checkDeath(); // This handles camera update and UI message
        
        // Send a specific chat message explaining they joined late
        this._world.chatManager.sendPlayerMessage(player, 'You joined mid-game and will start as a spectator.', 'FFFF00');
        
        // Send message to UI to show the centered notification
        player.ui.sendData({ type: 'show-mid-game-join-message' });
        
      } else {
        // Game is IDLE or COUNTDOWN, spawn normally
        this._spawnPlayer(player); 
        // _spawnPlayer already logs and sends welcome messages etc.
      }
    });

    // Handle player leaving
    world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
      // Clean up player entities when they leave
      this._logger.info(`Player ${player.username || player.id} left the world.`);
      const playerEntities = world.entityManager.getPlayerEntitiesByPlayer(player);
      playerEntities.forEach(entity => entity.despawn());
      
      // Check if game should reset because the last player left during an active game
      if (this._gameState === GameState.ACTIVE && this._world) {
        // Use setTimeout to check player count after entity manager updates
        setTimeout(() => {
          // Double-check world still exists in the async callback
          if (!this._world) return;
          
          const remainingPlayers = this._world.entityManager.getAllPlayerEntities();
          if (remainingPlayers.length === 0) {
            this._logger.info('Last player left during active game. Resetting to IDLE state.');
            this._transitionToIdle();
          }
        }, 0); // Delay of 0 ensures it runs after current stack completes
      }
    });

    // Register custom chat commands
    this._registerCommands();
  }

  /**
   * Start the game
   */
  public startGame(): void {
    // DEPRECATED: Use _transitionToCountdown instead
    this._logger.warn('startGame() is deprecated. Use the /start command which triggers the countdown.');
    // Optionally, we could make this call _transitionToCountdown directly
    // if (this._gameState === GameState.IDLE) {
    //   this._transitionToCountdown();
    // }
  }

  /**
   * End the game
   */
  public endGame(): void {
    // DEPRECATED: Use _transitionToGameOver instead
    this._logger.warn('endGame() is deprecated. Game ends automatically based on win/loss conditions.');
  }

  /**
   * Reset the game to idle state
   */
  private _resetGame(): void {
    if (!this._world) return;

    this._logger.info('Resetting game...');

    // Stop active music and start idle music
    this._rockMusic?.pause();
    this._calmMusic?.play(this._world);
    this._logger.info('Switched back to calm background music.');

    // Reset all players (restore health, position, etc.)
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      if (entity instanceof GamePlayerEntity) {
        entity.reset(); // Call the new reset method
      }
    });

    // Reset KORO
    const overseer = this.getOverseerEntity();
    if (overseer) {
        overseer.reset(); // Call the new reset method
    }

    // Despawn remaining items (health packs, BFG)
    this._despawnTaggedEntities('healthpack');
    this._despawnTaggedEntities('persistent_weapon');

    // Also despawn any dropped non-persistent weapons (like Energy Rifles)
    this._world.entityManager.getAllEntities()
        .filter(e => e instanceof BaseWeaponEntity && e.tag !== 'persistent_weapon')
        .forEach(weapon => weapon.despawn());
    this._logger.info('Despawned any remaining non-persistent weapons.');

    // Disable game systems
    this._disableGameSystems();
    this._disableKoroMechanics();

    // Reset game state variable
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
   * Handles logic when a player entity dies.
   *
   * @param playerEntity The GamePlayerEntity instance that died.
   */
  public handlePlayerDeath(playerEntity: GamePlayerEntity): void {
    if (!this._world) return;
    
    this._logger.info(`Handling death for player: ${playerEntity.player.username || playerEntity.player.id}`);

    // Check if this was the last player alive
    const alivePlayers = this._world.entityManager.getAllPlayerEntities()
    .filter(entity => entity instanceof GamePlayerEntity && !entity.isDead); // Check isDead flag

    // Report the event to the Overseer (KORO)
    const overseer = this.getOverseerEntity();
    if (overseer) {
      if (alivePlayers.length === 0) {
        overseer.reportSignificantEvent(
          'game_over',
          'All players have been eliminated! KORO wins!',
          'high',
          {
            winner: 'koro'
          }
        );
      }
      else {
        overseer.reportSignificantEvent(
          'player_death', // Event type
          `Detected cessation of intruder biosign: ${playerEntity.player.username || playerEntity.player.id}`,
          'medium',
          {
            playerId: playerEntity.player.id,
            playerName: playerEntity.player.username || playerEntity.player.id
          }
        );  
      }
    } else {
      this._logger.warn('Could not report player death to Overseer: Overseer entity not found.');
    }
    
    
    if (alivePlayers.length === 0 && this._gameState === GameState.ACTIVE) {
        this._logger.info('Last player died. Triggering game over (KORO wins).');
        this._transitionToGameOver('koro');
    }
  }

  /**
   * Handles logic when the Overseer entity dies.
   */
  public handleOverseerDeath(): void {
      if (!this._world || this._gameState !== GameState.ACTIVE) return;
      this._logger.info('Overseer has been defeated!');
      this._transitionToGameOver('players');
  }

  /**
   * Register custom chat commands
   */
  private _registerCommands(): void {
    // Ensure world and entity manager exist before registering commands
    if (!this._world || !this._world.entityManager) {
      this._logger.error('Cannot register commands: World or EntityManager not available.');
      return;
    }

    // Assign to local variables for convenience and potentially clearer type inference
    const world = this._world;
    const entityManager = world.entityManager; // Already checked world exists
    const chatManager = world.chatManager; // Already checked world exists

    // Command: /rocket (Admin/Debug)
    chatManager.registerCommand('/rocket', (player) => {
      // Corrected method name and handling potential empty array
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity) {
        playerEntity.applyImpulse({ x: 0, y: 1500, z: 0 });
        chatManager.sendPlayerMessage(player, 'Launched!', '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });

    // Command: /oshealth [0-100] (Admin/Debug)
    chatManager.registerCommand('/oshealth', (player, args) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // Validate argument presence and type first
      const healthArgStr = args[0];
      if (typeof healthArgStr !== 'string') {
          chatManager.sendPlayerMessage(player, 'Usage: /oshealth [0-100]', 'FFFF00');
          return;
      }

      // Now parse the argument, knowing it's a string
      const healthArg = parseInt(healthArgStr, 10);

      // Validate parsing result and range
      if (isNaN(healthArg) || healthArg < 0 || healthArg > 100) {
        chatManager.sendPlayerMessage(player, 'Usage: /oshealth [0-100]', 'FFFF00');
        return;
      }

      overseer.setHealth(healthArg);
      const invulnStatus = overseer.isInvulnerable() ? 'invulnerable' : 'vulnerable';
      chatManager.sendPlayerMessage(
        player, 
        `Overseer health set to ${healthArg}. Current status: ${invulnStatus}`, 
        '00FF00'
      );
    });

    // Command: /osinvuln [true/false] (Admin/Debug)
    chatManager.registerCommand('/osinvuln', (player, args) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // If no argument is provided, toggle the current state
      if (args.length === 0) {
        const currentState = overseer.isInvulnerable();
        overseer.setInvulnerable(!currentState);
        chatManager.sendPlayerMessage(
          player, 
          `Overseer invulnerability toggled to: ${!currentState}`, 
          '00FF00'
        );
        return;
      }

      // Otherwise, set to specified state
      const argValue = args[0] || '';
      const invulnState = argValue.toLowerCase() === 'true';
      overseer.setInvulnerable(invulnState);
      chatManager.sendPlayerMessage(
        player, 
        `Overseer invulnerability set to: ${invulnState}`, 
        '00FF00'
      );
    });

    // Command: /healthpack (Admin/Debug)
    chatManager.registerCommand('/healthpack', (player) => {
      // Corrected method name and handling potential empty array
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity && playerEntity.isSpawned) {
        const facingDir = playerEntity.player.camera.facingDirection;
        const spawnPos = {
          x: playerEntity.position.x + facingDir.x * 2,
          y: playerEntity.position.y + 1.0, // Higher position to prevent sinking into ground
          z: playerEntity.position.z + facingDir.z * 2,
        };
        const healthPack = new HealthPackItem({});
        healthPack.spawn(world, spawnPos);
        chatManager.sendPlayerMessage(player, 'Spawned a health pack in front of you.', '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });

    // Command: /rifle (Admin/Debug)
    chatManager.registerCommand('/rifle', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity && playerEntity.isSpawned) {
        const facingDir = playerEntity.player.camera.facingDirection;
        const spawnPos = {
          x: playerEntity.position.x + facingDir.x * 2,
          y: playerEntity.position.y + 1.0, // Higher position to prevent sinking into ground
          z: playerEntity.position.z + facingDir.z * 2,
        };
        const rifle = new EnergyRifle1();
        rifle.spawn(world, spawnPos);
        chatManager.sendPlayerMessage(player, 'Spawned an Energy Rifle in front of you.', '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });

    chatManager.registerCommand('/bfg', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity && playerEntity.isSpawned) {
        const facingDir = playerEntity.player.camera.facingDirection;
        const spawnPos = {
          x: playerEntity.position.x + facingDir.x * 2,
          y: playerEntity.position.y + 1.0, // Higher position to prevent sinking into ground
          z: playerEntity.position.z + facingDir.z * 2,
        };
        const bfg = new BFG({
            tag: 'persistent_weapon' // Add tag via constructor options
        });
        bfg.spawn(world, spawnPos);
        chatManager.sendPlayerMessage(player, 'Spawned a BFG in front of you.', '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });

    // Command: /riflepos (Admin/Debug) - Adjust equipped rifle position
    chatManager.registerCommand('/riflepos', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as any : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      // Check if player has an equipped weapon
      if (!playerEntity._activeWeapon) {
        chatManager.sendPlayerMessage(player, 'No weapon equipped.', 'FF0000');
        return;
      }
      
      // Change position to try different placements
      const positions = [
        { x: 0.2, y: -0.2, z: -0.4 },
        { x: 0.3, y: -0.3, z: -0.3 },
        { x: 0.25, y: -0.25, z: -0.5 },
        { x: 0.4, y: -0.1, z: -0.3 },
      ];
      
      const randomPos = positions[Math.floor(Math.random() * positions.length)];
      playerEntity._activeWeapon.setPosition(randomPos);
      
      chatManager.sendPlayerMessage(
        player, 
        `Adjusted rifle position to: ${JSON.stringify(randomPos)}`,
        '00FF00'
      );
    });
    
    // Command: /setweaponpos (Admin/Debug) - Set weapon position with specific values
    chatManager.registerCommand('/setweaponpos', (player, args: string[] = []) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as any : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      // Check if player has an equipped weapon
      if (!playerEntity._activeWeapon) {
        chatManager.sendPlayerMessage(player, 'No weapon equipped.', 'FF0000');
        return;
      }
      
      // Parse arguments: /setweaponpos x y z
      let x = 0.3, y = -0.2, z = -0.4; // Default values
      
      if (args && args.length >= 3) {
        // Fix: Properly handle zero values by not using || fallback
        const parsedX = parseFloat(args[0] ?? '0');
        const parsedY = parseFloat(args[1] ?? '0');
        const parsedZ = parseFloat(args[2] ?? '0');
        
        // Only use default if parsing failed (NaN) - allow zero values
        x = isNaN(parsedX) ? x : parsedX;
        y = isNaN(parsedY) ? y : parsedY;
        z = isNaN(parsedZ) ? z : parsedZ;
      }
      
      const position = { x, y, z };
      playerEntity._activeWeapon.setPosition(position);
      
      chatManager.sendPlayerMessage(
        player, 
        `Set weapon position to: ${JSON.stringify(position)}`,
        '00FF00'
      );
    });
    
    // Command: /setweaponrot (Admin/Debug) - Set weapon rotation with specific values
    chatManager.registerCommand('/setweaponrot', (player, args: string[] = []) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as any : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      // Check if player has an equipped weapon
      if (!playerEntity._activeWeapon) {
        chatManager.sendPlayerMessage(player, 'No weapon equipped.', 'FF0000');
        return;
      }
      
      // Parse arguments: /setweaponrot x y z (in degrees)
      let x = -45, y = 0, z = 0; // Default values
      
      if (args && args.length >= 3) {
        // Fix: Properly handle zero values by not using || fallback
        const parsedX = parseFloat(args[0] ?? '0');
        const parsedY = parseFloat(args[1] ?? '0');
        const parsedZ = parseFloat(args[2] ?? '0');
        
        // Only use default if parsing failed (NaN) - allow zero values
        x = isNaN(parsedX) ? x : parsedX;
        y = isNaN(parsedY) ? y : parsedY;
        z = isNaN(parsedZ) ? z : parsedZ;
      }
      
      // Convert degrees to radians for Quaternion.fromEuler
      playerEntity._activeWeapon.setRotation(Quaternion.fromEuler(x, y, z));
      
      chatManager.sendPlayerMessage(
        player, 
        `Set weapon rotation to: ${x}° ${y}° ${z}°`,
        '00FF00'
      );
    });
    
    // Command: /setweaponscale (Admin/Debug) - Set weapon scale
    chatManager.registerCommand('/setweaponscale', (player, args: string[] = []) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as any : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      // Check if player has an equipped weapon
      if (!playerEntity._activeWeapon) {
        chatManager.sendPlayerMessage(player, 'No weapon equipped.', 'FF0000');
        return;
      }
      
      // Parse arguments: /setweaponscale scale or /setweaponscale x y z
      let scale = 1.0;
      let scaleVec = null;
      
      if (args && args.length === 1) {
        // Uniform scale - fix to handle zero properly
        const parsedScale = parseFloat(args[0] ?? '1');
        scale = isNaN(parsedScale) ? scale : parsedScale;
        playerEntity._activeWeapon.setScale(scale);
        chatManager.sendPlayerMessage(
          player, 
          `Set weapon scale to: ${scale}`,
          '00FF00'
        );
      } 
      else if (args && args.length >= 3) {
        // Non-uniform scale - fix to handle zero properly
        const parsedX = parseFloat(args[0] ?? '1');
        const parsedY = parseFloat(args[1] ?? '1');
        const parsedZ = parseFloat(args[2] ?? '1');
        
        const x = isNaN(parsedX) ? scale : parsedX;
        const y = isNaN(parsedY) ? scale : parsedY;
        const z = isNaN(parsedZ) ? scale : parsedZ;
        
        scaleVec = { x, y, z };
        playerEntity._activeWeapon.setScale(scaleVec);
        chatManager.sendPlayerMessage(
          player, 
          `Set weapon scale to: ${JSON.stringify(scaleVec)}`,
          '00FF00'
        );
      }
      else {
        // No args, use default
        playerEntity._activeWeapon.setScale(scale);
        chatManager.sendPlayerMessage(
          player, 
          `Set weapon scale to default: ${scale}`,
          '00FF00'
        );
      }
    });
    
    // Command: /healthpacks (Admin/Debug)
    chatManager.registerCommand('/healthpacks', (player) => {
      this.spawnTestHealthPacks(); // Use the existing random spawn logic
      chatManager.sendPlayerMessage(player, 'Spawned health packs around the map.', '00FF00');
    });
    
    // Command: /toggleplayerhealth - Toggle player health bar visibility
    chatManager.registerCommand('/toggleplayerhealth', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      // Send a toggle command to the UI
      player.ui.sendData({
        type: 'toggle-player-health-visibility'
      });
      
      chatManager.sendPlayerMessage(player, 'Toggled player health bar visibility.', '00FF00');
    });
    
    // Command: /togglekorohealth - Toggle KORO/Overseer health bar visibility
    chatManager.registerCommand('/togglekorohealth', (player) => {
      // Send a toggle command to the UI
      player.ui.sendData({
        type: 'toggle-overseer-health-visibility'
      });
      
      // Also ensure the overseer health data is sent to the UI
      const overseer = this.getOverseerEntity();
      if (overseer) {
        player.ui.sendData({
          type: 'overseer-health-update',
          health: overseer.getHealth(),
          maxHealth: 100
        });
      }
      
      chatManager.sendPlayerMessage(player, 'Toggled KORO/Overseer health bar visibility.', '00FF00');
    });
    
    // Biodome temperature commands
    
    // Command: /biodome-temp <temperature> [rate] - Set biodome temperature
    chatManager.registerCommand('/biodome-temp', (player, args) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // Validate and parse temperature argument
      const tempArg = args[0];
      if (!tempArg) {
        chatManager.sendPlayerMessage(player, 'Usage: /biodome-temp <temperature> [rate]', 'FFFF00');
        return;
      }

      const temperature = parseFloat(tempArg as string);
      if (isNaN(temperature)) {
        chatManager.sendPlayerMessage(player, 'Temperature must be a number.', 'FF0000');
        return;
      }

      // Parse optional change rate argument
      let changeRate;
      if (args.length > 1 && args[1] !== undefined) {
        changeRate = parseFloat(args[1]);
        if (isNaN(changeRate)) {
          chatManager.sendPlayerMessage(player, 'Rate must be a number.', 'FF0000');
          return;
        }
      }

      // Set the temperature
      overseer.setBiodomeTemperature(temperature, changeRate);
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `Setting biodome temperature to ${temperature}°F${changeRate ? ` at rate of ${changeRate}°/sec` : ''}.`, 
        '00FF00'
      );
    });

    // Command: /biodome-heat - Trigger a heat attack
    chatManager.registerCommand('/biodome-heat', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // Set a high temperature (140°F) with moderate change rate
      const attackTemp = 140;
      const changeRate = 2.0; // Faster change for dramatic effect
      
      overseer.setBiodomeTemperature(attackTemp, changeRate);
      
      // Broadcast to all players
      chatManager.sendBroadcastMessage(
        'WARNING: Biodome temperature critical! Cooling systems failure detected.', 
        'FF3300'
      );
      
      // Notify the admin player
      chatManager.sendPlayerMessage(
        player, 
        `Heat attack triggered. Biodome temperature rising to ${attackTemp}°F.`, 
        '00FF00'
      );
    });

    // Command: /biodome-cold - Trigger a cold attack
    chatManager.registerCommand('/biodome-cold', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // Set a low temperature (0°F) with moderate change rate
      const attackTemp = 0;
      const changeRate = 2.0; // Faster change for dramatic effect
      
      overseer.setBiodomeTemperature(attackTemp, changeRate);
      
      // Broadcast to all players
      chatManager.sendBroadcastMessage(
        'WARNING: Biodome temperature dropping rapidly! Heating systems failure detected.', 
        '44AAFF'
      );
      
      // Notify the admin player
      chatManager.sendPlayerMessage(
        player, 
        `Cold attack triggered. Biodome temperature dropping to ${attackTemp}°F.`, 
        '00FF00'
      );
    });

    // Command: /biodome-reset - Reset temperature to normal
    chatManager.registerCommand('/biodome-reset', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // Reset the temperature
      overseer.resetBiodomeTemperature();
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        'Biodome temperature resetting to normal levels.', 
        '00FF00'
      );
      
      // Broadcast to all players
      chatManager.sendBroadcastMessage(
        'Biodome environmental systems restored to normal operation.', 
        '00FF00'
      );
    });
    
    // Command: /biodome-status - Get current biodome temperature
    chatManager.registerCommand('/biodome-status', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      // Get current temperature
      const currentTemp = overseer.getBiodomeTemperature();
      
      // Convert to Celsius for display
      const tempC = ((currentTemp - 32) * 5 / 9).toFixed(1);
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `Current biodome temperature: ${currentTemp.toFixed(1)}°F (${tempC}°C)`, 
        '00CCFF'
      );
    });
    
    // Command: /togglebiodome - Toggle biodome status UI visibility
    chatManager.registerCommand('/togglebiodome', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      // Toggle the biodome UI for this player
      overseer.toggleBiodomeUI(player);
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        'Toggled biodome status display.', 
        '00FF00'
      );
    });
    
    // Command: /biodome-damage - Toggle biodome environmental damage
    chatManager.registerCommand('/biodome-damage', (player, args) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      // If no argument is provided, toggle the current state
      let enabled: boolean;
      if (args.length === 0) {
        enabled = !overseer.isBiodomeEnvironmentalDamageEnabled();
      } else {
        // Otherwise, set to specified state
        const argValue = args[0] || '';
        enabled = argValue.toLowerCase() === 'true' || argValue === '1';
      }
      
      // Toggle the damage
      overseer.setBiodomeEnvironmentalDamageEnabled(enabled);
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `Biodome environmental damage ${enabled ? 'enabled' : 'disabled'}.`, 
        '00FF00'
      );
      
      // If enabling damage, warn all players
      if (enabled) {
        chatManager.sendBroadcastMessage(
          'WARNING: Biodome life support systems failing - environmental effects now hazardous.',
          'FF3300'
        );
      } else {
        chatManager.sendBroadcastMessage(
          'Biodome life support systems recalibrated - environmental effects neutralized.',
          '00FF00'
        );
      }
    });
    
    // Command: /toggledamage - Toggle player vulnerability to damage
    chatManager.registerCommand('/toggledamage', (player, args) => {
      // If no argument is provided, toggle the current state
      let enabled: boolean;
      if (args.length === 0) {
        enabled = !GameManager._playerVulnerable;
      } else {
        // Otherwise, set to specified state
        const argValue = args[0] || '';
        enabled = argValue.toLowerCase() === 'true' || argValue === '1';
      }
      
      // Toggle the vulnerability
      GameManager.setPlayerVulnerable(enabled);
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `Player vulnerability to damage ${enabled ? 'enabled' : 'disabled'}.`, 
        '00FF00'
      );
      
      // If enabling damage, warn all players
      if (enabled) {
        chatManager.sendBroadcastMessage(
          'WARNING: Player damage protection disabled. Players can now take damage at any time.',
          'FF3300'
        );
      } else {
        chatManager.sendBroadcastMessage(
          'Player damage protection enabled. Players cannot take damage unless a game is active.',
          '00FF00'
        );
      }
    });

    chatManager.registerCommand('/taunt', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      overseer.performShieldTaunt();
      chatManager.sendPlayerMessage(player, 'Triggered Overseer shield taunt sequence.', '00FF00');
    });
    
    // Command: /toggleui - Toggle all UI elements visibility 
    chatManager.registerCommand('/toggleui', (player) => {
      // Toggle all UI elements at once
      // 1. Player health
      player.ui.sendData({
        type: 'toggle-player-health-visibility'
      });
      
      // 2. KORO health
      player.ui.sendData({
        type: 'toggle-overseer-health-visibility'
      });
      
      // 3. Biodome status
      player.ui.sendData({
        type: 'toggle-biodome-visibility'
      });
      
      // 4. KORO temperature UI
      player.ui.sendData({
        type: 'toggle-overseer-temp-visibility'
      });
      
      // 5. Crosshair
      player.ui.sendData({
        type: 'toggle-crosshair-visibility'
      });
      
      chatManager.sendPlayerMessage(
        player, 
        'Toggled visibility of all UI elements.',
        '00FF00'
      );
    });
    
    // Command: /togglealldamage - Toggle all damage systems (player and environment)
    chatManager.registerCommand('/togglealldamage', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      // 1. Toggle player vulnerability
      const playerVulnerable = !GameManager.isPlayerVulnerable();
      GameManager.setPlayerVulnerable(playerVulnerable);
      
      // 2. Toggle environmental damage
      const envDamageEnabled = !overseer.isBiodomeEnvironmentalDamageEnabled();
      overseer.setBiodomeEnvironmentalDamageEnabled(envDamageEnabled);
      
      // 3. Toggle KORO vulnerability
      const currentKoroInvulnerable = overseer.isInvulnerable();
      const newKoroInvulnerableState = !currentKoroInvulnerable;
      overseer.setInvulnerable(newKoroInvulnerableState);
      const koroIsNowVulnerable = !newKoroInvulnerableState;
      
      // Determine overall status message
      const allDamageEnabled = playerVulnerable && envDamageEnabled && koroIsNowVulnerable;
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `All damage systems status: ${allDamageEnabled ? 'Mostly Enabled' : 'Partially/Fully Disabled'}.`,
        '00FF00'
      );
      
      // Additional details
      chatManager.sendPlayerMessage(
        player, 
        `Player Vulnerability: ${playerVulnerable}, Env Damage: ${envDamageEnabled}, KORO Vulnerability: ${koroIsNowVulnerable}`,
        '00CCFF'
      );
      
      // Broadcast to all players
      if (koroIsNowVulnerable) {
        chatManager.sendBroadcastMessage(
          'WARNING: Overseer systems vulnerable.',
          'FF3300'
        );
      } else {
        chatManager.sendBroadcastMessage(
          'Overseer systems secured.',
          '00FF00'
        );
      }
      
      // Add specific messages for player/env damage toggles
      if (playerVulnerable) {
          chatManager.sendBroadcastMessage('Player damage protection disabled.','FF3300');
      } else {
          chatManager.sendBroadcastMessage('Player damage protection enabled.','00FF00');
      }
      if (envDamageEnabled) {
          chatManager.sendBroadcastMessage('Biodome environmental hazards active.','FF3300');
      } else {
          chatManager.sendBroadcastMessage('Biodome environmental hazards neutralized.','00FF00');
      }
    });
    
    // Command: /toggleautoreg - Toggle Auto-Regulation (Biodome Temp Reset & KORO Temp Venting)
    chatManager.registerCommand('/toggleautoreg', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer || !overseer['_biodome']) { // Ensure biodome controller exists too
        chatManager.sendPlayerMessage(player, 'Overseer or Biodome Controller not found.', 'FF0000');
        return;
      }
      
      // Get current state (use KORO auto-vent as the primary toggle)
      const currentlyEnabled = overseer.isAutoVentEnabled();
      const newState = !currentlyEnabled;
      
      // Toggle KORO auto-vent
      overseer.setAutoVentEnabled(newState);
      
      // Toggle Biodome auto-reset
      const biodome = overseer['_biodome'] as BiodomeController;
      biodome.setAutoResetEnabled(newState);
            
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `Auto-Regulation Systems (Biodome Reset & KORO Venting) ${newState ? 'Enabled' : 'Disabled'}.`,
        '00FF00'
      );
      
      // Broadcast to all players
      if (newState) {
        chatManager.sendBroadcastMessage(
          'Overseer Auto-Regulation Systems Activated. Expect automatic temperature resets and potential core venting.',
          '00CCFF'
        );
      } else {
        chatManager.sendBroadcastMessage(
          'Overseer Auto-Regulation Systems Deactivated. Manual control required.',
          '00FF00'
        );
      }
    });
    
    // Command: /togglebfgbreak - Toggle BFG shield break mechanic
    chatManager.registerCommand('/togglebfgbreak', (player) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      // Get current state and toggle it
      const currentState = overseer.isBFGShieldBreakEnabled();
      const newState = !currentState;
      overseer.setBFGShieldBreakEnabled(newState);
      
      // Notify the player
      chatManager.sendPlayerMessage(
        player, 
        `BFG Shield Break Mechanic ${newState ? 'Enabled' : 'Disabled'}.`,
        '00FF00'
      );
      
      // Broadcast to all players
      if (newState) {
        chatManager.sendBroadcastMessage(
          'ALERT: Overseer shield is vulnerable to BFG impacts!',
          'FFA500' // Orange
        );
      } else {
        chatManager.sendBroadcastMessage(
          'Overseer shield has been reinforced against BFG impacts.',
          '00FF00' // Green
        );
      }
    });
    
    // Command: /respawn - Respawn a dead player (Testing only)
    chatManager.registerCommand('/respawn', (player) => {
      // Get all player entities controlled by this player
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as GamePlayerEntity : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      // Check if player is dead
      if (!playerEntity.isDead) {
        chatManager.sendPlayerMessage(player, 'You are not dead! This command is only for respawning dead players.', 'FFFF00');
        return;
      }
      
      // Respawn the player
      playerEntity.respawn();
      chatManager.sendPlayerMessage(player, 'You have been respawned for testing purposes.', '00FF00');
    });
    
    // --- KORO Mode Commands ---

    // Command: /koromode [mode] - Set KORO operational mode
    chatManager.registerCommand('/koromode', (player, args) => {
        const overseer = this.getOverseerEntity();
        if (!overseer) {
            chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
            return;
        }

        const validModes: KoroMode[] = ['disabled', 'dev-no-llm', 'dev-with-llm', 'prod'];
        const modeArg = args[0] as KoroMode;

        if (!modeArg || !validModes.includes(modeArg)) {
            chatManager.sendPlayerMessage(player, `Usage: /koromode [${validModes.join('|')}]`, 'FFFF00');
            const currentStatus = overseer.getKoroStatus();
            if (currentStatus) {
                 chatManager.sendPlayerMessage(player, `Current mode: ${currentStatus.mode}`, '00CCFF');
            }
            return;
        }

        overseer.setKoroMode(modeArg);
        const status = overseer.getKoroStatus(); // Get status after setting
        chatManager.sendPlayerMessage(player, `KORO mode set to: ${modeArg}`, '00FF00');
        if (status) {
             chatManager.sendPlayerMessage(player, `Status: Processing=${status.processing}, LLM=${status.llm}, TTS=${status.tts}`, '00CCFF');
        }
    });

    // Command: /korostatus - Get current KORO mode and status
    chatManager.registerCommand('/korostatus', (player) => {
        const overseer = this.getOverseerEntity();
        if (!overseer) {
            chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
            return;
        }

        const status = overseer.getKoroStatus();
        if (status) {
            chatManager.sendPlayerMessage(player, `KORO Status:`, '00CCFF');
            chatManager.sendPlayerMessage(player, `  Mode: ${status.mode}`, '00CCFF');
            chatManager.sendPlayerMessage(player, `  Processing: ${status.processing}`, '00CCFF');
            chatManager.sendPlayerMessage(player, `  LLM Interaction: ${status.llm}`, '00CCFF');
            chatManager.sendPlayerMessage(player, `  TTS Generation: ${status.tts}`, '00CCFF');
        } else {
             chatManager.sendPlayerMessage(player, 'Could not retrieve KORO status (brain might not be initialized).', 'FF0000');
        }
    });

    // --- End KORO Mode Commands ---
    
    // Command: /blackout [duration] - Trigger a blackout attack
    chatManager.registerCommand('/blackout', (player, args) => {
      const overseer = this.getOverseerEntity();
      if (!overseer || !overseer['_biodome']) {
          chatManager.sendPlayerMessage(player, 'Overseer or Biodome Controller not found.', 'FF0000');
          return;
      }

      const biodome = overseer['_biodome'] as BiodomeController;
      let duration = 15; // Default duration

      if (args[0]) {
          const parsedDuration = parseInt(args[0], 10);
          if (!isNaN(parsedDuration) && parsedDuration > 0) {
              duration = parsedDuration;
          } else {
              chatManager.sendPlayerMessage(player, 'Invalid duration. Using default (15s).', 'FFFF00');
          }
      }

      // Trigger the blackout - no need to await here
      biodome.triggerBlackoutAttack(duration);

      // Notify the player
      chatManager.sendPlayerMessage(
          player,
          `Blackout attack triggered (Sustained darkness duration: ${duration}s).`,
          '00FF00'
      );
      // Broadcast a warning
       chatManager.sendBroadcastMessage(
           'WARNING: Emergency lighting failure detected!',
           'FFA500' // Orange
       );
    });
    
    // Command: /uvlight [duration] [sampleRate] [delayOffset] - Trigger a UV light attack
    chatManager.registerCommand('/uvlight', (player, args) => {
      const overseer = this.getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      // Parse optional parameters
      let duration: number | undefined = undefined;
      let sampleRate: number | undefined = undefined;
      let delayOffset: number | undefined = undefined;
      
      // Parse duration (first argument)
      if (args.length > 0 && args[0]) {
        const parsedDuration = parseInt(args[0], 10);
        if (!isNaN(parsedDuration) && parsedDuration > 0) {
          duration = parsedDuration * 1000; // Convert to milliseconds
        } else {
          chatManager.sendPlayerMessage(player, 'Invalid duration. Using default (15s).', 'FFFF00');
        }
      }
      
      // Parse sample rate (second argument)
      if (args.length > 1 && args[1]) {
        const parsedRate = parseInt(args[1], 10);
        if (!isNaN(parsedRate) && parsedRate > 0) {
          sampleRate = parsedRate;
        } else {
          chatManager.sendPlayerMessage(player, 'Invalid sample rate. Using default (10).', 'FFFF00');
        }
      }
      
      // Parse delay offset (third argument)
      if (args.length > 2 && args[2]) {
        const parsedOffset = parseInt(args[2], 10);
        if (!isNaN(parsedOffset) && parsedOffset > 0) {
          delayOffset = parsedOffset;
        } else {
          chatManager.sendPlayerMessage(player, 'Invalid delay offset. Using default (5).', 'FFFF00');
        }
      }
      
      // Trigger the UV light attack
      const success = overseer.initiateUVLightAttack(duration, sampleRate, delayOffset);
      
      if (success) {
        // Notify the player
        chatManager.sendPlayerMessage(
          player,
          `UV Light attack triggered successfully. Duration: ${duration ? duration/1000 : 15}s`,
          '00FF00'
        );
      } else {
        chatManager.sendPlayerMessage(
          player,
          'Failed to trigger UV Light attack. Check logs for details.',
          'FF0000'
        );
      }
    });
    
    this._logger.info('Registered custom chat commands.');
  }

  // --- Game State Transition Methods ---

  private _transitionToCountdown(): void {
    if (this._gameState !== GameState.IDLE || !this._world) return;

    this._logger.info('Transitioning to COUNTDOWN state...');
    this._gameState = GameState.COUNTDOWN;

    // Switch music
    this._calmMusic?.pause();
    this._rockMusic?.play(this._world);
    this._logger.info('Switched to rock background music.');

    let countdownValue = COUNTDOWN_DURATION_S;

    // Function to update countdown UI
    const updateCountdown = () => {
      // Remove chat broadcast
      // this._world?.chatManager.sendBroadcastMessage(`Game starting in ${countdownValue}...`, 'FFFF00');
      
      // Send UI data as well
      this._world?.entityManager.getAllPlayerEntities().forEach(entity => {
          if (entity instanceof GamePlayerEntity) {
              // Send 'game-countdown' event type
              entity.player.ui.sendData({ type: 'game-countdown', countdown: countdownValue }); 
          }
      });
    };

    // Initial countdown message
    updateCountdown();

    // Start interval timer
    this._countdownTimer = setInterval(() => {
      countdownValue--;
      if (countdownValue > 0) {
        updateCountdown();
      } else {
        if (this._countdownTimer) clearInterval(this._countdownTimer);
        this._countdownTimer = null;
        this._transitionToActive();
      }
    }, 1000); // Update every second
  }

  private _transitionToActive(): void {
    if (this._gameState !== GameState.COUNTDOWN || !this._world) return;

    this._logger.info('Transitioning to ACTIVE state...');
    this._gameState = GameState.ACTIVE;
    this._gameStartTime = Date.now();

    // Enable Core Game Systems & KORO Mechanics
    this._enableGameSystems();
    this._enableKoroMechanics();

    // Set KORO mode
    const overseer = this.getOverseerEntity();
    if (overseer) {
      const defaultMode: KoroMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev-with-llm';
      overseer.setKoroMode(defaultMode);
      this._logger.info(`Set KORO mode to default: ${defaultMode}`);
      
      // Calculate and set scaled KORO health
      const baseHealth = 100;
      const playerCount = this._world.entityManager.getAllPlayerEntities().length;
      const scaledHealth = baseHealth * (1 + 0.5 * (playerCount - 1));
      overseer.setMaxHealth(scaledHealth);
      overseer.setHealth(scaledHealth);
      this._logger.info(`Set KORO health based on ${playerCount} players: ${scaledHealth}`);
    }

    // Equip players with Energy Rifle
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      if (entity instanceof GamePlayerEntity) {
        const rifle = new EnergyRifle1();
        // Spawn the rifle near the player first (required before equipping)
        // We might need a better way to handle weapon creation/assignment
        rifle.spawn(this._world!, entity.position); // Spawn then equip
        // Call pickup instead of equipWeapon directly
        rifle.pickup(entity);
        this._logger.info(`Called pickup() for ${entity.player.username}'s Energy Rifle`);
      }
    });

    // Spawn one BFG
    const bfg = new BFG({
        tag: 'persistent_weapon' // Add tag via constructor options
    });
    const bfgSpawnPos = this._getRandomSpawnPositionInCircle() || { x: 0, y: SPAWN_Y, z: 0 }; // Fallback position
    bfg.spawn(this._world, bfgSpawnPos);
    this._logger.info(`Spawned persistent BFG at ${JSON.stringify(bfgSpawnPos)}`);

    // Start health pack spawning
    this._startHealthPackSpawning();

    // Broadcast game start message
    this._world.chatManager.sendBroadcastMessage('GAME STARTED! Protect yourselves!', '00FF00');
    // Clear countdown UI by sending count 0
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      if (entity instanceof GamePlayerEntity) {
          entity.player.ui.sendData({ type: 'game-countdown', countdown: 0 }); // Signal countdown end
      }
    });
  }

  private _transitionToGameOver(winner: 'players' | 'koro'): void {
    if (this._gameState !== GameState.ACTIVE || !this._world) return;

    this._logger.info(`Transitioning to GAMEOVER state... Winner: ${winner}`);
    this._gameState = GameState.GAMEOVER;

    // Stop health pack spawning (if it was running)
    if (this._healthPackSpawnTimer) {
      clearInterval(this._healthPackSpawnTimer);
      this._healthPackSpawnTimer = null;
      this._logger.info('Stopped health pack spawning.');
    }

    // --- Immediately Disable Damage Sources ---
    const overseer = this.getOverseerEntity();
    if (overseer) {
        overseer.setInvulnerable(true);
        overseer.setBiodomeEnvironmentalDamageEnabled(false);
        this._logger.info('Set Overseer invulnerable and disabled environmental damage.');
    } else {
      this._logger.warn('Could not find Overseer to disable damage or report game over.');
    }
    GameManager.setPlayerVulnerable(false); // Disable player damage
    this._logger.info('Disabled player vulnerability.');
    // --- End Damage Disable ---

    // Broadcast winner message
    const message = winner === 'players' ? 'YOU HAVE DEFEATED THE OVERSEER!' : 'THE OVERSEER HAS ELIMINATED ALL INTRUDERS!';
    const color = winner === 'players' ? '00FF00' : 'FF0000';
    this._world.chatManager.sendBroadcastMessage(message, color);

    // Send game over UI update - duration already uses GAMEOVER_DURATION_S
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
      if (entity instanceof GamePlayerEntity) {
          // Send specific event for display
          entity.player.ui.sendData({ 
              type: 'game-over-display', 
              winner: winner, 
              duration: GAMEOVER_DURATION_S 
          });
      }
    });

    // Start timer to transition back to IDLE - uses updated GAMEOVER_DURATION_S
    this._gameOverTimer = setTimeout(() => {
      // Trigger fade-to-white before resetting
      this._world?.entityManager.getAllPlayerEntities().forEach(entity => {
          if (entity instanceof GamePlayerEntity) {
              entity.player.ui.sendData({ type: 'fade-white', duration: 1000 }); // 1 second fade
          }
      });
      
      // Add a short delay for the fade to start before resetting
      setTimeout(() => {
        this._transitionToIdle();
        this._gameOverTimer = null;
      }, 1000); // Wait 1 second (matching fade duration) before resetting
    }, (GAMEOVER_DURATION_S - 1) * 1000); // Start fade 1 second before the total duration ends
  }

  private _transitionToIdle(): void {
    // State check is implicit as this is only called from GAMEOVER timeout
    this._logger.info('Transitioning to IDLE state...');
    this._resetGame(); // _resetGame now handles setting state to IDLE and other resets

    // Trigger fade-from-white after reset is complete
    this._world?.entityManager.getAllPlayerEntities().forEach(entity => {
        if (entity instanceof GamePlayerEntity) {
             entity.player.ui.sendData({ type: 'fade-from-white', duration: 1000 }); // 1 second fade
        }
    });
  }

  // --- Helper Methods for Enabling/Disabling Systems ---

  private _enableGameSystems(): void {
    if (!this._world) return;
    this._logger.info('Enabling core game systems...');
    // 1. Player Vulnerability
    GameManager.setPlayerVulnerable(true);

    // 2. UI Elements (Send toggle commands to each player)
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
        if (entity instanceof GamePlayerEntity) {
             // TODO: Send a single 'show-game-ui' event instead of individual toggles?
             entity.player.ui.sendData({ type: 'show-game-ui' }); // Assumes UI handles this
        }
    });
  }

  private _disableGameSystems(): void {
    if (!this._world) return;
    this._logger.info('Disabling core game systems...');
    // 1. Player Vulnerability
    GameManager.setPlayerVulnerable(false);

    // 2. UI Elements (Hide all)
    this._world.entityManager.getAllPlayerEntities().forEach(entity => {
        if (entity instanceof GamePlayerEntity) {
             entity.player.ui.sendData({ type: 'hide-all-ui' }); // Assumes UI handles this
        }
    });
  }

  private _enableKoroMechanics(): void {
    const overseer = this.getOverseerEntity();
    if (!overseer) return;
    this._logger.info('Enabling KORO mechanics...');
    // 1. KORO Vulnerability
    overseer.setInvulnerable(false);
    // 2. Auto-Regulation
    overseer.setAutoVentEnabled(true);
    overseer.setBiodomeEnvironmentalDamageEnabled(true); // Enable env damage
    if (overseer['_biodome']) {
        (overseer['_biodome'] as BiodomeController).setAutoResetEnabled(true);
    }
    // 3. BFG Shield Break
    overseer.setBFGShieldBreakEnabled(true);
  }

  private _disableKoroMechanics(): void {
    const overseer = this.getOverseerEntity();
    if (!overseer) return;
    this._logger.info('Disabling KORO mechanics...');
    // 1. KORO Vulnerability
    overseer.setInvulnerable(true);
    // 2. Auto-Regulation
    overseer.setAutoVentEnabled(false);
    overseer.setBiodomeEnvironmentalDamageEnabled(false); // Disable env damage
    if (overseer['_biodome']) {
        (overseer['_biodome'] as BiodomeController).setAutoResetEnabled(false);
    }
    // 3. BFG Shield Break
    overseer.setBFGShieldBreakEnabled(false);
  }

  // --- Utility Methods ---

  /**
   * Despawns all entities with a specific tag.
   * @param tag The tag to search for.
   */
  private _despawnTaggedEntities(tag: string): void {
    if (!this._world) return;
    const entities = this._world.entityManager.getEntitiesByTag(tag);
    entities.forEach(entity => entity.despawn());
    this._logger.info(`Despawned ${entities.length} entities with tag '${tag}'.`);
  }

  // --- Health Pack Spawning ---

  private _startHealthPackSpawning(): void {
    if (this._healthPackSpawnTimer || !this._world) return; // Prevent multiple timers

    this._logger.info(`Starting periodic health pack spawning (Interval: ${HEALTH_PACK_SPAWN_INTERVAL_S}s)`);

    this._healthPackSpawnTimer = setInterval(() => {
        if (this._gameState !== GameState.ACTIVE || !this._world) {
            // Stop spawning if game is no longer active or world is gone
            if (this._healthPackSpawnTimer) clearInterval(this._healthPackSpawnTimer);
            this._healthPackSpawnTimer = null;
            this._logger.info('Stopped health pack spawning due to game state change or missing world.');
            return;
        }

        const alivePlayers = this._world.entityManager.getAllPlayerEntities()
            .filter(entity => entity instanceof GamePlayerEntity && !entity.isDead);
        const playerCount = alivePlayers.length;
        
        // Calculate number of packs based on 75% of alive players, rounded down, minimum 1
        const numToSpawn = Math.max(1, Math.floor(playerCount * 0.75));

        this._logger.info(`Spawning ${numToSpawn} health packs for ${playerCount} alive players.`);
        let spawnedCount = 0;
        for (let i = 0; i < numToSpawn; i++) {
            const position = this._getRandomSpawnPositionInCircle();
            if (position) {
                const healthPack = new HealthPackItem({}); 
                healthPack.spawn(this._world!, position);
                spawnedCount++;
            } else {
                this._logger.warn(`Could not find valid spawn position for health pack #${i + 1}.`);
            }
        }
        
        if (spawnedCount > 0) {
            this._world?.chatManager.sendBroadcastMessage(`${spawnedCount} Health Packs appeared!`, '00FF00');
            // Log event for KORO?
            const overseer = this.getOverseerEntity();
            overseer?.reportSignificantEvent(
                'healthpack_spawn',
                `${spawnedCount} health packs detected.`, 
                'low',
                { count: spawnedCount, playerCount: playerCount }
            );
        }

    }, HEALTH_PACK_SPAWN_INTERVAL_S * 1000);
  }

  // TODO: Add _startHealthPackSpawning method later

} // End of GameManager class