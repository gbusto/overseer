/**
 * HYTOPIA SDK Boilerplate
 * 
 * This is a simple boilerplate to get started on your project.
 * It implements the bare minimum to be able to run and connect
 * to your game server and run around as the basic player entity.
 * 
 * From here you can begin to implement your own game logic
 * or do whatever you want!
 * 
 * You can find documentation here: https://github.com/hytopiagg/sdk/blob/main/docs/server.md
 * 
 * For more in-depth examples, check out the examples folder in the SDK, or you
 * can find it directly on GitHub: https://github.com/hytopiagg/sdk/tree/main/examples/payload-game
 * 
 * You can officially report bugs or request features here: https://github.com/hytopiagg/sdk/issues
 * 
 * To get help, have found a bug, or want to chat with
 * other HYTOPIA devs, join our Discord server:
 * https://discord.gg/DXCXJbHSJX
 * 
 * Official SDK Github repo: https://github.com/hytopiagg/sdk
 * Official SDK NPM Package: https://www.npmjs.com/package/hytopia
 */

// Load environment variables
import { env } from 'bun';
// Make sure the GOOGLE_AI_STUDIO_API_KEY environment variable is set
if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.warn('GOOGLE_AI_STUDIO_API_KEY environment variable is not set. KORO AI will not function correctly.');
}

import {
  startServer,
  Audio,
  PlayerEntity,
  PlayerEvent,
  RigidBodyType,
  ColliderShape,
  Entity,
  ModelRegistry,
} from 'hytopia';

import OverseerEntity from './classes/entities/OverseerEntity';
import GameManager from './classes/GameManager';
import worldMap from './assets/hytopia_map.json';
import { Logger, LogLevel } from './utils/logger';
import GamePlayerEntity from './classes/entities/GamePlayerEntity';
import HealthPackItem from './classes/items/HealthPackItem';

ModelRegistry.instance.optimize = false;

// Initialize logger
// If ENVIRONMENT is development, set the log level to DEBUG
if (env.ENVIRONMENT === 'production') {
  Logger.setLevel(LogLevel.INFO);
} else {
  Logger.setLevel(LogLevel.DEBUG);
}
const logger = new Logger('Main');

/**
 * startServer is always the entry point for our game.
 * It accepts a single function where we should do any
 * setup necessary for our game. The init function is
 * passed a World instance which is the default
 * world created by the game server on startup.
 * 
 * Documentation: https://github.com/hytopiagg/sdk/blob/main/docs/server.startserver.md
 */

startServer(world => {
  logger.info('Starting Overseer server');
  
  /**
   * Enable debug rendering of the physics simulation.
   * This will overlay lines in-game representing colliders,
   * rigid bodies, and raycasts. This is useful for debugging
   * physics-related issues in a development environment.
   * Enabling this can cause performance issues, which will
   * be noticed as dropped frame rates and higher RTT times.
   * It is intended for development environments only and
   * debugging physics.
   */
  
  // world.simulation.enableDebugRendering(true);

  /**
   * Load our map.
   * You can build your own map using https://build.hytopia.com
   * After building, hit export and drop the .json file in
   * the assets folder as map.json.
   */
  world.loadMap(worldMap);
  logger.info('Map loaded');

  /**
   * Create and spawn the overseer entity - an ominous squid floating in the sky
   * This will be our LLM-controlled antagonist
   */
  const overseer = new OverseerEntity();

  // Spawn the overseer at the center of the map
  overseer.spawn(world, { x: 0, y: 25, z: 0 });
  logger.info('Overseer entity spawned');

  /**
   * Initialize the GameManager which will handle:
   * - Player spawning and management
   * - Game state and loop
   * - Match timers and UI
   * - Game start/end sequences
   */
  GameManager.instance.initialize(world);
  logger.info('GameManager initialized');

  // Register commands for the overseer entity
  world.chatManager.registerCommand('/oshealth', (player, args) => {
    // if no args provided, show the current health
    if (args.length === 0 || !args[0]) {
      world.chatManager.sendPlayerMessage(player, `KORO's current health is ${overseer.getHealth()}/100`, 'FFFFFF');
      return;
    } 
    
    const health = parseInt(args[0]);
    if (isNaN(health) || health < 0 || health > 100) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /oshealth [0-100]', 'FF0000');
      return;
    } 
    
    overseer.setHealth(health);
    world.chatManager.sendPlayerMessage(player, `KORO's health set to ${health}/100`, 'FFFFFF');
  });

  // Register sethealth command for testing player health
  world.chatManager.registerCommand('/sethealth', (player, args) => {
    if (args.length < 2 || !args[0] || !args[1]) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /sethealth <player> <amount>', 'FF0000');
      return;
    }
    
    // Find the target player
    const targetPlayerName = args[0];
    const targetPlayers = world.entityManager.getAllPlayerEntities().filter(entity => 
      entity.player.username.toLowerCase() === targetPlayerName.toLowerCase()
    );
    
    if (targetPlayers.length === 0) {
      world.chatManager.sendPlayerMessage(player, `Player "${targetPlayerName}" not found`, 'FF0000');
      return;
    }
    
    // Parse health amount
    const health = parseInt(args[1]);
    if (isNaN(health) || health < 0) {
      world.chatManager.sendPlayerMessage(player, 'Health amount must be a non-negative number', 'FF0000');
      return;
    }
    
    // Set health for the target player
    const targetPlayer = targetPlayers[0] as GamePlayerEntity;
    targetPlayer.health = health;
    
    world.chatManager.sendPlayerMessage(player, `Set ${targetPlayerName}'s health to ${health}`, '00FF00');
    world.chatManager.sendPlayerMessage(targetPlayer.player, `Your health was set to ${health} by ${player.username}`, 'FFFFFF');
  });

  // Add direct index.ts command for health pack testing
  world.chatManager.registerCommand('/testhealthpack', (player) => {
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0] as GamePlayerEntity;
    if (!playerEntity) {
      world.chatManager.sendPlayerMessage(player, 'Could not find your player entity', 'FF0000');
      return;
    }
    
    // Create a health pack with simple parameters
    const healthPack = new HealthPackItem({
      healAmount: 30
    });
    
    // Spawn right in front of the player (closer than the /healthpack command)
    const position = playerEntity.position;
    const direction = player.camera.facingDirection;
    const spawnPosition = {
      x: position.x + direction.x * 1.5,
      y: position.y,
      z: position.z + direction.z * 1.5
    };
    
    healthPack.spawn(world, spawnPosition);
    
    // Provide clear instructions to the player
    world.chatManager.sendPlayerMessage(player, 'Test health pack spawned directly in front of you', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Press E to pick it up, then F to use it', '00FF00');
    
    // Set player health to 50 to ensure healing is noticeable
    playerEntity.health = 50;
    world.chatManager.sendPlayerMessage(player, 'Your health has been set to 50 for testing', '00FF00');
  });

  // Command to get player's current position
  world.chatManager.registerCommand('/getpos', (player) => {
    const playerEntity = world.entityManager.getPlayerEntitiesByPlayer(player)[0];
    if (playerEntity) {
      const pos = playerEntity.position;
      const message = `Your position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`;
      world.chatManager.sendPlayerMessage(player, message, 'FFFFFF');
    } else {
      world.chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
    }
  });

  // Register command for testing KORO's shield
  world.chatManager.registerCommand('/koro', (player, args) => {
    if (!args[0]) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /koro <openshield|closeshield|setpos>', 'FF0000');
      return;
    }

    // Find the overseer entity
    const overseer = world.entityManager.getEntitiesByTag('overseer')[0] as OverseerEntity;
    if (!overseer) {
      world.chatManager.sendPlayerMessage(player, 'Overseer not found', 'FF0000');
      return;
    }

    switch (args[0].toLowerCase()) {
      case 'openshield':
        overseer.openShield();
        world.chatManager.sendPlayerMessage(player, 'Shield opened', '00FF00');
        break;
      case 'closeshield':
        overseer.closeShield();
        world.chatManager.sendPlayerMessage(player, 'Shield closed', '00FF00');
        break;
      case 'setpos':
        if (args.length < 7) {
          world.chatManager.sendPlayerMessage(player, 'Usage: /koro setpos <topX> <topY> <topZ> <bottomX> <bottomY> <bottomZ>', 'FF0000');
          return;
        }
        
        const [, topX, topY, topZ, bottomX, bottomY, bottomZ] = args;
        
        const topPos = {
          x: parseFloat(topX || '0'),
          y: parseFloat(topY || '0'),
          z: parseFloat(topZ || '0')
        };
        
        const bottomPos = {
          x: parseFloat(bottomX || '0'),
          y: parseFloat(bottomY || '0'),
          z: parseFloat(bottomZ || '0')
        };
        
        if (Object.values(topPos).some(isNaN) || Object.values(bottomPos).some(isNaN)) {
          world.chatManager.sendPlayerMessage(player, 'Invalid position values', 'FF0000');
          return;
        }
        
        overseer.setShieldPositions(topPos, bottomPos);
        world.chatManager.sendPlayerMessage(player, 'Shield positions updated', '00FF00');
        break;
      default:
        world.chatManager.sendPlayerMessage(player, 'Unknown koro command', 'FF0000');
    }
  });

  world.chatManager.registerCommand('/orb', (player, args) => {
    const orb = new Entity({
      name: 'orb',
      modelUri: 'models/overseer/overseer-shield.glb',
      modelScale: 1,
      rigidBodyOptions: {
        type: RigidBodyType.KINEMATIC_POSITION,
        colliders: [
          {
            shape: ColliderShape.BALL,
            radius: 3, // Large enough to enclose Koro
            isSensor: true, // Won't physically block but will detect collisions
          }
        ]
      },
    });

    orb.spawn(world, { x: 0, y: 10, z: 0 });
  });

  /**
   * Play some peaceful ambient music to
   * set the mood!
   */
  
  new Audio({
    uri: 'audio/music/hytopia-main.mp3',
    loop: true,
    volume: 0.1,
  }).play(world);
  
  logger.info('Server initialization complete');
});
