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
} from 'hytopia';

import OverseerEntity from './classes/entities/OverseerEntity';
import GameManager from './classes/GameManager';
import worldMap from './assets/hytopia_map.json';
import { Logger, LogLevel } from './utils/logger';

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

  world.chatManager.registerCommand('/shield [on|off]', (player, args) => {
    overseer.toggleShield(args[0] === 'on');
    world.chatManager.sendPlayerMessage(player, 'Shield activated', '00FF00');
  });

  world.chatManager.registerCommand('/orb', (player, args) => {
    const orb = new Entity({
      name: 'orb',
      modelUri: 'models/overseers/overseer-shield.glb',
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
