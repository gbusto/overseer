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
import EnergyRifle1 from './weapons/EnergyRifle1';
import BFG from './weapons/BFG';

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

    // Get the overseer entity
    const overseer = this.getOverseerEntity();
    
    if (overseer) {
      // Enable the Overseer's brain
      overseer.toggleKOROUpdates(true);
      
      // Make the overseer vulnerable to damage
      overseer.setInvulnerable(false);
      
      this._logger.info('Overseer brain enabled and set to vulnerable');
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

    // Get the overseer entity
    const overseer = this.getOverseerEntity();
    
    if (overseer) {
      // Disable the Overseer's brain
      overseer.toggleKOROUpdates(false);
      
      // Make the overseer invulnerable to damage
      overseer.setInvulnerable(true);
      
      this._logger.info('Overseer brain disabled and set to invulnerable');
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
        const bfg = new BFG();
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
    
    this._logger.info('Registered custom chat commands.');
  }
} 