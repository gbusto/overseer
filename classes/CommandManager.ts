import { World, Player, Quaternion, PlayerEntity, PlayerEvent, SceneUI, CollisionGroup, Collider, RigidBodyType, ColliderShape, Entity } from 'hytopia';
import type { Vector3Like } from 'hytopia';
import { Logger } from '../utils/logger';
import GameManager from './GameManager'; // Import GameManager
import OverseerEntity from './entities/OverseerEntity';
import GamePlayerEntity from './entities/GamePlayerEntity';
import HealthPackItem from './items/HealthPackItem';
import EnergyRifle1 from './weapons/EnergyRifle1';
import BFG from './weapons/BFG';
import type { KoroMode } from './ai/KOROBrain';
import BiodomeController from './BiodomeController';
import BaseWeaponEntity from './weapons/BaseWeaponEntity'; // Ensure BaseWeaponEntity is imported

export default class CommandManager {
  private _world: World;
  private _logger = new Logger('CommandManager');
  private _gameManager: GameManager;

  constructor(world: World) {
    this._world = world;
    this._gameManager = GameManager.instance; // Get GameManager instance
  }

  public registerCommands(): void {
    // Only register commands if not in production environment
    if (process.env.NODE_ENV === 'production') {
      this._logger.info('Production environment detected. Skipping debug command registration.');
      return;
    }

    this._logger.info('Development environment detected. Registering debug commands...');

    // Access world components directly
    const world = this._world;
    const entityManager = world.entityManager;
    const chatManager = world.chatManager;

    // --- Moved Command registration logic --- 

    // Command: /rocket (Admin/Debug)
    chatManager.registerCommand('/rocket', (player) => {
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
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      const healthArgStr = args[0];
      if (typeof healthArgStr !== 'string') {
          chatManager.sendPlayerMessage(player, 'Usage: /oshealth [0-100]', 'FFFF00');
          return;
      }

      const healthArg = parseInt(healthArgStr, 10);

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
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

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
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity && playerEntity.isSpawned) {
        const facingDir = playerEntity.player.camera.facingDirection;
        const spawnPos = {
          x: playerEntity.position.x + facingDir.x * 2,
          y: playerEntity.position.y + 1.0,
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
          y: playerEntity.position.y + 1.0,
          z: playerEntity.position.z + facingDir.z * 2,
        };
        const rifle = new EnergyRifle1();
        rifle.spawn(world, spawnPos);
        chatManager.sendPlayerMessage(player, 'Spawned an Energy Rifle in front of you.', '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });

    // Command: /bfg (Admin/Debug)
    chatManager.registerCommand('/bfg', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity && playerEntity.isSpawned) {
        const facingDir = playerEntity.player.camera.facingDirection;
        const spawnPos = {
          x: playerEntity.position.x + facingDir.x * 2,
          y: playerEntity.position.y + 1.0,
          z: playerEntity.position.z + facingDir.z * 2,
        };
        const bfg = new BFG({
            tag: 'persistent_weapon' 
        });
        bfg.spawn(world, spawnPos);
        chatManager.sendPlayerMessage(player, 'Spawned a BFG in front of you.', '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });
    
    // Command: /setweaponpos (Admin/Debug)
    chatManager.registerCommand('/setweaponpos', (player, args: string[] = []) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as GamePlayerEntity : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      const activeWeapon = (playerEntity as any)._activeWeapon as BaseWeaponEntity | null;
      if (!activeWeapon) {
        chatManager.sendPlayerMessage(player, 'No weapon equipped.', 'FF0000');
        return;
      }
      
      let x = 0.3, y = -0.2, z = -0.4;
      
      if (args && args.length >= 3) {
        const parsedX = parseFloat(args[0] ?? '0');
        const parsedY = parseFloat(args[1] ?? '0');
        const parsedZ = parseFloat(args[2] ?? '0');
        
        x = isNaN(parsedX) ? x : parsedX;
        y = isNaN(parsedY) ? y : parsedY;
        z = isNaN(parsedZ) ? z : parsedZ;
      }
      
      const position = { x, y, z };
      activeWeapon.setPosition(position);
      
      chatManager.sendPlayerMessage(
        player, 
        `Set weapon position to: ${JSON.stringify(position)}`,
        '00FF00'
      );
    });
    
    // Command: /setweaponrot (Admin/Debug)
    chatManager.registerCommand('/setweaponrot', (player, args: string[] = []) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as GamePlayerEntity : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      const activeWeapon = (playerEntity as any)._activeWeapon as BaseWeaponEntity | null;
      if (!activeWeapon) {
        chatManager.sendPlayerMessage(player, 'No weapon equipped.', 'FF0000');
        return;
      }
      
      let x = -45, y = 0, z = 0;
      
      if (args && args.length >= 3) {
        const parsedX = parseFloat(args[0] ?? '0');
        const parsedY = parseFloat(args[1] ?? '0');
        const parsedZ = parseFloat(args[2] ?? '0');
        
        x = isNaN(parsedX) ? x : parsedX;
        y = isNaN(parsedY) ? y : parsedY;
        z = isNaN(parsedZ) ? z : parsedZ;
      }
      
      activeWeapon.setRotation(Quaternion.fromEuler(x, y, z));
      
      chatManager.sendPlayerMessage(
        player, 
        `Set weapon rotation to: ${x}° ${y}° ${z}°`,
        '00FF00'
      );
    });
    
    // Command: /healthpacks (Admin/Debug)
    chatManager.registerCommand('/healthpacks', (player) => {
      this._spawnTestHealthPacks(); // Use helper method
      chatManager.sendPlayerMessage(player, 'Spawned health packs around the map.', '00FF00');
    });
    
    // Command: /toggleplayerhealth
    chatManager.registerCommand('/toggleplayerhealth', (player) => {
      player.ui.sendData({ type: 'toggle-player-health-visibility' });
      chatManager.sendPlayerMessage(player, 'Toggled player health bar visibility.', '00FF00');
    });
    
    // Command: /togglekorohealth
    chatManager.registerCommand('/togglekorohealth', (player) => {
      player.ui.sendData({ type: 'toggle-overseer-health-visibility' });
      const overseer = this._getOverseerEntity(); // Use helper method
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
    chatManager.registerCommand('/biodome-temp', (player, args) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

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

      let changeRate;
      if (args.length > 1 && args[1] !== undefined) {
        changeRate = parseFloat(args[1]);
        if (isNaN(changeRate)) {
          chatManager.sendPlayerMessage(player, 'Rate must be a number.', 'FF0000');
          return;
        }
      }

      overseer.setBiodomeTemperature(temperature, changeRate);
      chatManager.sendPlayerMessage(
        player, 
        `Setting biodome temperature to ${temperature}°F${changeRate ? ` at rate of ${changeRate}°/sec` : ''}.`, 
        '00FF00'
      );
    });

    chatManager.registerCommand('/biodome-heat', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      const attackTemp = 140;
      const changeRate = 2.0;
      overseer.setBiodomeTemperature(attackTemp, changeRate);
      chatManager.sendBroadcastMessage(
        'WARNING: Biodome temperature critical! Cooling systems failure detected.', 
        'FF3300'
      );
      chatManager.sendPlayerMessage(
        player, 
        `Heat attack triggered. Biodome temperature rising to ${attackTemp}°F.`, 
        '00FF00'
      );
    });

    chatManager.registerCommand('/biodome-cold', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      const attackTemp = 0;
      const changeRate = 2.0;
      overseer.setBiodomeTemperature(attackTemp, changeRate);
      chatManager.sendBroadcastMessage(
        'WARNING: Biodome temperature dropping rapidly! Heating systems failure detected.', 
        '44AAFF'
      );
      chatManager.sendPlayerMessage(
        player, 
        `Cold attack triggered. Biodome temperature dropping to ${attackTemp}°F.`, 
        '00FF00'
      );
    });

    chatManager.registerCommand('/biodome-reset', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      overseer.resetBiodomeTemperature();
      chatManager.sendPlayerMessage(
        player, 
        'Biodome temperature resetting to normal levels.', 
        '00FF00'
      );
      chatManager.sendBroadcastMessage(
        'Biodome environmental systems restored to normal operation.', 
        '00FF00'
      );
    });
    
    chatManager.registerCommand('/biodome-status', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }

      const currentTemp = overseer.getBiodomeTemperature();
      const tempC = ((currentTemp - 32) * 5 / 9).toFixed(1);
      chatManager.sendPlayerMessage(
        player, 
        `Current biodome temperature: ${currentTemp.toFixed(1)}°F (${tempC}°C)`, 
        '00CCFF'
      );
    });
    
    chatManager.registerCommand('/togglebiodome', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      overseer.toggleBiodomeUI(player);
      chatManager.sendPlayerMessage(
        player, 
        'Toggled biodome status display.', 
        '00FF00'
      );
    });
    
    chatManager.registerCommand('/biodome-damage', (player, args) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      let enabled: boolean;
      if (args.length === 0) {
        enabled = !overseer.isBiodomeEnvironmentalDamageEnabled();
      } else {
        const argValue = args[0] || '';
        enabled = argValue.toLowerCase() === 'true' || argValue === '1';
      }
      
      overseer.setBiodomeEnvironmentalDamageEnabled(enabled);
      chatManager.sendPlayerMessage(
        player, 
        `Biodome environmental damage ${enabled ? 'enabled' : 'disabled'}.`, 
        '00FF00'
      );
      
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
    
    chatManager.registerCommand('/toggledamage', (player, args) => {
      let enabled: boolean;
      if (args.length === 0) {
        enabled = !GameManager.isPlayerVulnerable(); // Use static method from GameManager
      } else {
        const argValue = args[0] || '';
        enabled = argValue.toLowerCase() === 'true' || argValue === '1';
      }
      
      GameManager.setPlayerVulnerable(enabled); // Use static method from GameManager
      chatManager.sendPlayerMessage(
        player, 
        `Player vulnerability to damage ${enabled ? 'enabled' : 'disabled'}.`, 
        '00FF00'
      );
      
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
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      overseer.performShieldTaunt();
      chatManager.sendPlayerMessage(player, 'Triggered Overseer shield taunt sequence.', '00FF00');
    });
    
    chatManager.registerCommand('/toggleui', (player) => {
      player.ui.sendData({ type: 'toggle-player-health-visibility' });
      player.ui.sendData({ type: 'toggle-overseer-health-visibility' });
      player.ui.sendData({ type: 'toggle-biodome-visibility' });
      player.ui.sendData({ type: 'toggle-overseer-temp-visibility' });
      player.ui.sendData({ type: 'toggle-crosshair-visibility' });
      chatManager.sendPlayerMessage(
        player, 
        'Toggled visibility of all UI elements.',
        '00FF00'
      );
    });
    
    chatManager.registerCommand('/togglealldamage', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      const playerVulnerable = !GameManager.isPlayerVulnerable();
      GameManager.setPlayerVulnerable(playerVulnerable);
      
      const envDamageEnabled = !overseer.isBiodomeEnvironmentalDamageEnabled();
      overseer.setBiodomeEnvironmentalDamageEnabled(envDamageEnabled);
      
      const currentKoroInvulnerable = overseer.isInvulnerable();
      const newKoroInvulnerableState = !currentKoroInvulnerable;
      overseer.setInvulnerable(newKoroInvulnerableState);
      const koroIsNowVulnerable = !newKoroInvulnerableState;
      
      const allDamageEnabled = playerVulnerable && envDamageEnabled && koroIsNowVulnerable;
      chatManager.sendPlayerMessage(
        player, 
        `All damage systems status: ${allDamageEnabled ? 'Mostly Enabled' : 'Partially/Fully Disabled'}.`,
        '00FF00'
      );
      chatManager.sendPlayerMessage(
        player, 
        `Player Vulnerability: ${playerVulnerable}, Env Damage: ${envDamageEnabled}, KORO Vulnerability: ${koroIsNowVulnerable}`,
        '00CCFF'
      );
      
      if (koroIsNowVulnerable) {
        chatManager.sendBroadcastMessage('WARNING: Overseer systems vulnerable.','FF3300');
      } else {
        chatManager.sendBroadcastMessage('Overseer systems secured.','00FF00');
      }
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
    
    chatManager.registerCommand('/toggleautoreg', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      // Need to access private _biodome, use type assertion (any)
      const biodomeController = (overseer as any)?._biodome as BiodomeController | null;
      if (!overseer || !biodomeController) { 
        chatManager.sendPlayerMessage(player, 'Overseer or Biodome Controller not found.', 'FF0000');
        return;
      }
      
      const currentlyEnabled = overseer.isAutoVentEnabled();
      const newState = !currentlyEnabled;
      overseer.setAutoVentEnabled(newState);
      biodomeController.setAutoResetEnabled(newState);
      chatManager.sendPlayerMessage(
        player, 
        `Auto-Regulation Systems (Biodome Reset & KORO Venting) ${newState ? 'Enabled' : 'Disabled'}.`,
        '00FF00'
      );
      
      if (newState) {
        chatManager.sendBroadcastMessage('Overseer Auto-Regulation Systems Activated...','00CCFF');
      } else {
        chatManager.sendBroadcastMessage('Overseer Auto-Regulation Systems Deactivated...','00FF00');
      }
    });
    
    chatManager.registerCommand('/togglebfgbreak', (player) => {
      const overseer = this._getOverseerEntity(); // Use helper method
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      const currentState = overseer.isBFGShieldBreakEnabled();
      const newState = !currentState;
      overseer.setBFGShieldBreakEnabled(newState);
      chatManager.sendPlayerMessage(
        player, 
        `BFG Shield Break Mechanic ${newState ? 'Enabled' : 'Disabled'}.`,
        '00FF00'
      );
      
      if (newState) {
        chatManager.sendBroadcastMessage('ALERT: Overseer shield is vulnerable to BFG impacts!','FFA500');
      } else {
        chatManager.sendBroadcastMessage('Overseer shield has been reinforced against BFG impacts.','00FF00');
      }
    });
    
    chatManager.registerCommand('/respawn', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] as GamePlayerEntity : null;
      
      if (!playerEntity) {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
        return;
      }
      
      if (!playerEntity.isDead) {
        chatManager.sendPlayerMessage(player, 'You are not dead! This command is only for respawning dead players.', 'FFFF00');
        return;
      }
      
      playerEntity.respawn();
      chatManager.sendPlayerMessage(player, 'You have been respawned for testing purposes.', '00FF00');
    });
    
    // KORO Mode Commands
    chatManager.registerCommand('/koromode', (player, args) => {
        const overseer = this._getOverseerEntity(); // Use helper method
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
        const status = overseer.getKoroStatus();
        chatManager.sendPlayerMessage(player, `KORO mode set to: ${modeArg}`, '00FF00');
        if (status) {
             chatManager.sendPlayerMessage(player, `Status: Processing=${status.processing}, LLM=${status.llm}, TTS=${status.tts}`, '00CCFF');
        }
    });

    chatManager.registerCommand('/korostatus', (player) => {
        const overseer = this._getOverseerEntity(); // Use helper method
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
    
    // Command: /blackout [duration] - Trigger a blackout attack
    chatManager.registerCommand('/blackout', (player, args) => {
      const overseer = this._getOverseerEntity();
      const biodomeController = (overseer as any)?._biodome as BiodomeController | null;
      if (!overseer || !biodomeController) {
          chatManager.sendPlayerMessage(player, 'Overseer or Biodome Controller not found.', 'FF0000');
          return;
      }

      let duration = 15;
      if (args[0]) {
          const parsedDuration = parseInt(args[0], 10);
          if (!isNaN(parsedDuration) && parsedDuration > 0) {
              duration = parsedDuration;
          } else {
              chatManager.sendPlayerMessage(player, 'Invalid duration. Using default (15s).', 'FFFF00');
          }
      }

      biodomeController.triggerBlackoutAttack(duration);
      chatManager.sendPlayerMessage(player, `Blackout attack triggered...`, '00FF00');
      chatManager.sendBroadcastMessage('WARNING: Emergency lighting failure detected!','FFA500');
    });
    
    // Command: /uvlight [duration] [sampleRate] [delayOffset]
    chatManager.registerCommand('/uvlight', (player, args) => {
      const overseer = this._getOverseerEntity();
      if (!overseer) {
        chatManager.sendPlayerMessage(player, 'Overseer not found.', 'FF0000');
        return;
      }
      
      let duration: number | undefined = undefined;
      let sampleRate: number | undefined = undefined;
      let delayOffset: number | undefined = undefined;
      
      if (args.length > 0 && args[0]) {
        const parsedDuration = parseInt(args[0], 10);
        if (!isNaN(parsedDuration) && parsedDuration > 0) {
          duration = parsedDuration * 1000;
        } else {
          chatManager.sendPlayerMessage(player, 'Invalid duration. Using default (15s).', 'FFFF00');
        }
      }
      
      if (args.length > 1 && args[1]) {
        const parsedRate = parseInt(args[1], 10);
        if (!isNaN(parsedRate) && parsedRate > 0) {
          sampleRate = parsedRate;
        } else {
          chatManager.sendPlayerMessage(player, 'Invalid sample rate. Using default (10).', 'FFFF00');
        }
      }
      
      if (args.length > 2 && args[2]) {
        const parsedOffset = parseInt(args[2], 10);
        if (!isNaN(parsedOffset) && parsedOffset > 0) {
          delayOffset = parsedOffset;
        } else {
          chatManager.sendPlayerMessage(player, 'Invalid delay offset. Using default (5).', 'FFFF00');
        }
      }
      
      const success = overseer.initiateUVLightAttack(duration, sampleRate, delayOffset);
      
      if (success) {
        chatManager.sendPlayerMessage(player, `UV Light attack triggered...`, '00FF00');
      } else {
        chatManager.sendPlayerMessage(player, 'Failed to trigger UV Light attack...', 'FF0000');
      }
    });

    // --- NEW COMMAND: /getpos ---
    chatManager.registerCommand('/getpos', (player) => {
      const playerEntities = entityManager.getPlayerEntitiesByPlayer(player);
      const playerEntity = playerEntities.length > 0 ? playerEntities[0] : null;
      if (playerEntity) {
        const pos = playerEntity.position;
        const message = `Your position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`;
        chatManager.sendPlayerMessage(player, message, 'FFFFFF'); // White color
      } else {
        chatManager.sendPlayerMessage(player, 'Could not find your player entity.', 'FF0000');
      }
    });
    // --- END NEW COMMAND ---

    // --- End Moved Commands ---

    // --- Add Player Join Listener for Debug Commands --- 
    world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
      // Send the list of debug commands to the joining player
      chatManager.sendPlayerMessage(player, 'Admin/Debug commands available:', 'FFA500');
      chatManager.sendPlayerMessage(player, '/rocket - Launch yourself', 'FFA500');
      chatManager.sendPlayerMessage(player, '/oshealth [0-100] - Set KORO health', 'FFA500');
      chatManager.sendPlayerMessage(player, '/osinvuln [true/false] - Toggle KORO invulnerability', 'FFA500');
      chatManager.sendPlayerMessage(player, '/healthpack - Spawn health pack', 'FFA500');
      chatManager.sendPlayerMessage(player, '/healthpacks - Spawn multiple health packs', 'FFA500');
      chatManager.sendPlayerMessage(player, '/rifle - Spawn Energy Rifle', 'FFA500');
      chatManager.sendPlayerMessage(player, '/bfg - Spawn BFG', 'FFA500');
      chatManager.sendPlayerMessage(player, '/getpos - Print current position', 'FFA500');
      chatManager.sendPlayerMessage(player, '/setweaponpos x y z - Set equipped weapon position', 'FFA500');
      chatManager.sendPlayerMessage(player, '/setweaponrot x y z - Set equipped weapon rotation (degrees)', 'FFA500');
      chatManager.sendPlayerMessage(player, '/setweaponscale [scale] / [x y z] - Set equipped weapon scale', 'FFA500');
      chatManager.sendPlayerMessage(player, '/toggleplayerhealth - Toggle player health UI', 'FFA500');
      chatManager.sendPlayerMessage(player, '/togglekorohealth - Toggle KORO health UI', 'FFA500');
      chatManager.sendPlayerMessage(player, '/biodome-temp <temp> [rate] - Set biodome temp (°F)', 'FFA500');
      chatManager.sendPlayerMessage(player, '/biodome-heat - Trigger heat attack', 'FFA500');
      chatManager.sendPlayerMessage(player, '/biodome-cold - Trigger cold attack', 'FFA500');
      chatManager.sendPlayerMessage(player, '/biodome-reset - Reset biodome temp', 'FFA500');
      chatManager.sendPlayerMessage(player, '/biodome-status - Show current biodome temp', 'FFA500');
      chatManager.sendPlayerMessage(player, '/togglebiodome - Toggle biodome UI', 'FFA500');
      chatManager.sendPlayerMessage(player, '/biodome-damage [true/false] - Toggle environmental damage', 'FFA500');
      chatManager.sendPlayerMessage(player, '/toggledamage [true/false] - Toggle player vulnerability', 'FFA500');
      chatManager.sendPlayerMessage(player, '/taunt - Trigger KORO shield taunt', 'FFA500');
      chatManager.sendPlayerMessage(player, '/toggleui - Toggle all major UI elements', 'FFA500');
      chatManager.sendPlayerMessage(player, '/togglealldamage - Toggle player, env, and KORO damage', 'FFA500');
      chatManager.sendPlayerMessage(player, '/toggleautoreg - Toggle KORO/Biodome auto-regulation', 'FFA500');
      chatManager.sendPlayerMessage(player, '/togglebfgbreak - Toggle BFG shield break mechanic', 'FFA500');
      chatManager.sendPlayerMessage(player, '/respawn - Respawn if dead (testing)', 'FFA500');
      chatManager.sendPlayerMessage(player, '/koromode [mode] - Set KORO AI mode', 'FFA500');
      chatManager.sendPlayerMessage(player, '/korostatus - Show KORO AI status', 'FFA500');
      chatManager.sendPlayerMessage(player, '/blackout [duration] - Trigger blackout attack', 'FFA500');
      chatManager.sendPlayerMessage(player, '/uvlight [dur] [rate] [offset] - Trigger UV light attack', 'FFA500');
      this._logger.debug(`Sent debug command list to joining player: ${player.username || player.id}`);
    });
    // --- End Player Join Listener ---

    this._logger.info('Registered debug chat commands.'); 
  }
  
  // Helper to get Overseer (similar to GameManager)
  private _getOverseerEntity(): OverseerEntity | null {
    return this._gameManager.getOverseerEntity(); // Delegate to GameManager
  }
  
  // Helper for spawning test health packs (similar to GameManager)
  private _spawnTestHealthPacks(): void {
    this._gameManager.spawnTestHealthPacks(); // Delegate to GameManager
  }
  
} 