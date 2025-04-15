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
import CommandManager from './CommandManager';

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
const SPAWN_Y = 30; // Base height for item spawns
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

    // Create and register commands (only in non-production)
    const commandManager = new CommandManager(world);
    commandManager.registerCommands();
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
        healthPack.spawn(this._world!, position);
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
      const baseHealth = 100; // Use this base value
      const playerCount = this._world.entityManager.getAllPlayerEntities().length;
      // Corrected calculation to use baseHealth
      const scaledHealth = baseHealth * (1 + 0.5 * (playerCount - 1)); 
      overseer.setMaxHealth(scaledHealth); // Set max health first
      overseer.setHealth(scaledHealth);    // Then set current health to the new max
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