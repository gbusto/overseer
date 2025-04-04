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
} from 'hytopia';

import OverseerEntity from './classes/entities/OverseerEntity';
import worldMap from './assets/overseer-terrain.json';
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

  // test loading remote audio uri
  // play it 5 seconds after the server starts
  setTimeout(() => {
    console.log("PLAYING AUDIO!!!");
    const audio = new Audio({
      uri: 'storage/fe2465184067ef97996fb41/2017/11/file_example_MP3_700KB.mp3',
      loop: true,
      volume: 0.5,
    });
    audio.play(world);
  }, 5000);
  
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
  overseer.spawn(world, { x: 0, y: 50, z: 0 });
  logger.info('Overseer entity spawned');

  // Register admin commands for controlling KORO
  world.chatManager.registerCommand('/koro-toggle', (player, args) => {
    // Simply check args length and handle each case
    if (args.length === 0 || !args[0]) {
      world.chatManager.sendPlayerMessage(player, 'Usage: /koro-toggle [on|off]', 'FF0000');
      return;
    }
    
    // Convert to lowercase with null safety
    const param = String(args[0]).toLowerCase();
    
    if (param === 'on' || param === 'true') {
      overseer.toggleKOROUpdates(true);
      world.chatManager.sendPlayerMessage(player, 'KORO automatic updates are now enabled.');
    } else if (param === 'off' || param === 'false') {
      overseer.toggleKOROUpdates(false);
      world.chatManager.sendPlayerMessage(player, 'KORO automatic updates are now disabled.');
    } else {
      world.chatManager.sendPlayerMessage(player, 'Usage: /koro-toggle [on|off]', 'FF0000');
    }
  });

  world.chatManager.registerCommand('/koro-events', (player, args) => {
    const state = overseer.getKOROState();
    let message = `KORO State:
- Players: ${state.playerCount}
- Events:`;
    
    state.recentEvents.forEach((event, i) => {
      message += `\n  ${i+1}. ${event}`;
    });
    
    world.chatManager.sendPlayerMessage(player, message);
    logger.debug('KORO events requested', state);
  });

  world.chatManager.registerCommand('/koro-force', (player, args) => {
    world.chatManager.sendPlayerMessage(player, 'Forcing KORO to generate a response...');
    overseer.forceKOROUpdate();
  });

  /**
   * Handle player joining the game. The PlayerEvent.JOINED_WORLD
   * event is emitted to the world when a new player connects to
   * the game. From here, we create a basic player
   * entity instance which automatically handles mapping
   * their inputs to control their in-game entity and
   * internally uses our player entity controller.
   * 
   * The HYTOPIA SDK is heavily driven by events, you
   * can find documentation on how the event system works,
   * here: https://dev.hytopia.com/sdk-guides/events
   */
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    const playerEntity = new PlayerEntity({
      player,
      name: 'Player',
      modelUri: 'models/players/player.gltf',
      modelLoopedAnimations: [ 'idle' ],
      modelScale: 0.5,
    });
  
    playerEntity.spawn(world, { x: 0, y: 10, z: 0 });
    logger.info(`Player joined: ${player.username || player.id}`);

    // Load our game UI for this player
    player.ui.load('ui/index.html');

    // Send a nice welcome message that only the player who joined will see ;)
    world.chatManager.sendPlayerMessage(player, 'Welcome to the game!', '00FF00');
    world.chatManager.sendPlayerMessage(player, 'Use WASD to move around.');
    world.chatManager.sendPlayerMessage(player, 'Press space to jump.');
    world.chatManager.sendPlayerMessage(player, 'Hold shift to sprint.');
    world.chatManager.sendPlayerMessage(player, 'Press \\ to enter or exit debug view.');
    world.chatManager.sendPlayerMessage(player, 'Try talking to KORO by typing a message that includes "KORO" or "overseer"!', '00FFFF');
    world.chatManager.sendPlayerMessage(player, 'Admin commands:', 'FFA500');
    world.chatManager.sendPlayerMessage(player, '/koro-toggle [on|off] - Toggle KORO automatic updates', 'FFA500');
    world.chatManager.sendPlayerMessage(player, '/koro-events - View current events in KORO\'s memory', 'FFA500');
    world.chatManager.sendPlayerMessage(player, '/koro-force - Force KORO to generate a response', 'FFA500');
    world.chatManager.sendPlayerMessage(player, '/log-level [level] - Set logging level', 'FFA500');
    world.chatManager.sendPlayerMessage(player, '/rocket - Launch yourself into the air', 'FFA500');
  });

  /**
   * Handle player leaving the game. The PlayerEvent.LEFT_WORLD
   * event is emitted to the world when a player leaves the game.
   * Because HYTOPIA is not opinionated on join and
   * leave game logic, we are responsible for cleaning
   * up the player and any entities associated with them
   * after they leave. We can easily do this by 
   * getting all the known PlayerEntity instances for
   * the player who left by using our world's EntityManager
   * instance.
   * 
   * The HYTOPIA SDK is heavily driven by events, you
   * can find documentation on how the event system works,
   * here: https://dev.hytopia.com/sdk-guides/events
   */
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
    logger.info(`Player left: ${player.username || player.id}`);
  });

  /**
   * A silly little easter egg command. When a player types
   * "/rocket" in the game, they'll get launched into the air!
   */
  world.chatManager.registerCommand('/rocket', player => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      entity.applyImpulse({ x: 0, y: 20, z: 0 });
      logger.debug(`Player ${player.username || player.id} launched into the air`);
    });
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
