# Overseer Game Control Documentation

This document provides a comprehensive reference of methods and commands for controlling the Overseer game loop.

## Game State Management

The game loop is primarily controlled through `GameManager.ts`, which implements a state machine for game progression.

### Game States
- `GameState.IDLE`: Initial state, waiting for game to start
- `GameState.STARTING`: Countdown to game start
- `GameState.ACTIVE`: Game in progress
- `GameState.ENDING`: Game ending sequence

### Core Methods

| Method | Description | File Location |
|--------|-------------|---------------|
| `GameManager.instance.startGame()` | Starts a new game, transitions from IDLE to ACTIVE | GameManager.ts |
| `GameManager.instance.endGame()` | Ends the current game, transitions from ACTIVE to ENDING | GameManager.ts |
| `GameManager.instance.getOverseerEntity()` | Returns the OverseerEntity (KORO) instance | GameManager.ts |
| `GameManager.instance.spawnTestHealthPacks()` | Spawns health packs around the map | GameManager.ts |
| `GameManager.instance.isGameActive` | Returns whether game is in ACTIVE state | GameManager.ts |
| `GameManager.isPlayerVulnerable()` | Returns whether players can take damage (based on game state or override flag) | GameManager.ts |
| `GameManager.setPlayerVulnerable(vulnerable)` | Sets whether players can take damage outside of active game state | GameManager.ts |

## KORO/Overseer Control

KORO (the Overseer entity) can be controlled through the following methods:

### Shield Control

| Method | Description | Parameters |
|--------|-------------|------------|
| `overseer.openShield(duration?)` | Opens KORO's shield, making it vulnerable | Optional duration in ms |
| `overseer.closeShield()` | Closes KORO's shield, making it protected | None |
| `overseer.isShieldOpen()` | Returns whether the shield is currently open | None |

### Health & Vulnerability

| Method | Description | Parameters |
|--------|-------------|------------|
| `overseer.setHealth(value)` | Sets KORO's health | Value from 0-100 |
| `overseer.getHealth()` | Gets KORO's current health | None |
| `overseer.takeDamage(amount)` | Apply damage to KORO (only works when shield is open and not invulnerable) | Damage amount |
| `overseer.setInvulnerable(state)` | Set whether KORO can take damage | Boolean |
| `overseer.isInvulnerable()` | Returns whether KORO is currently invulnerable | None |

### Temperature Regulation

| Method | Description | Parameters |
|--------|-------------|------------|
| `overseer.getInternalTemperature()` | Gets KORO's current internal temperature | None |
| `overseer.getNormalInternalTemperature()` | Gets KORO's normal internal temperature baseline | None |
| `overseer.setInternalTemperature(temp)` | Sets KORO's internal temperature | Temperature in Fahrenheit |

The Overseer's internal temperature is affected by the biodome temperature settings:
- KORO's internal temperature rises or falls based on how extreme the biodome temperature is
- More extreme biodome temperatures cause faster changes to KORO's internal temperature
- When KORO's shield is open, its internal temperature gradually returns to normal
- Temperature changes are automatically reflected in the UI for players to see

### BFG Shield Break Mechanic

| Method | Description | Parameters |
|--------|-------------|------------|
| `overseer.setBFGShieldBreakEnabled(enabled)` | Enable/disable the BFG shield break mechanic | Boolean |
| `overseer.isBFGShieldBreakEnabled()` | Check if BFG shield break is enabled | None |
| `overseer.forceOpenShield(duration?)` | Forces the shield open, typically by BFG | Optional duration in ms (defaults to 5s) |

When enabled via `/togglebfgbreak`:
- Hitting KORO's closed shield with a BFG projectile will force the shield to open for 5 seconds.
- This provides a way for players with the BFG to create vulnerability windows.

### AI Behavior

| Method | Description | Parameters |
|--------|-------------|------------|
| `overseer.toggleKOROUpdates(enabled)` | Enable/disable KORO's AI brain | Boolean |
| `overseer.isKOROEnabled()` | Returns whether KORO's AI is enabled | None |
| `overseer.forceKOROUpdate()` | Forces an immediate response from KORO | None |
| `overseer.getKOROState()` | Gets the current state of KORO's world model | None |

## Player Control

Player entities are controlled via the `GamePlayerEntity` class:

| Method | Description | Parameters |
|--------|-------------|------------|
| `playerEntity.takeDamage(amount)` | Damages the player | Damage amount |
| `playerEntity.heal(amount)` | Heals the player | Heal amount |
| `playerEntity.resetHealth()` | Restores player to max health | None |
| `playerEntity.health` | Property to get/set player health | Value from 0-100 |
| `playerEntity.equipWeapon(weapon)` | Equips a weapon to the player | BaseWeaponEntity instance |

## Biodome Control

The biodome environment is controlled via the `BiodomeController` class:

| Method | Description | Parameters |
|--------|-------------|------------|
| `biodome.setTemperature(temperature, changeRate?, autoReset?)` | Sets target biodome temperature with configurable change rate | Temperature (°F), optional change rate (°/sec), auto-reset (boolean, default true) |
| `biodome.resetTemperature()` | Immediately resets temperature to normal (74°F) | None |
| `biodome.resetLighting()` | Immediately resets all lighting colors and intensities to default values | None |
| `biodome.setEnvironmentalDamageEnabled(enabled)` | Enable or disable environmental damage effects | Boolean |
| `biodome.isEnvironmentalDamageEnabled()` | Check if environmental damage is enabled | None |
| `biodome.getCurrentTemperature()` | Gets current temperature in Fahrenheit | None |
| `biodome.getNormalTemperature()` | Gets normal temperature baseline (74°F) | None |
| `biodome.getHeatDangerThreshold()` | Gets heat danger threshold (104°F) | None |
| `biodome.getColdDangerThreshold()` | Gets cold danger threshold (32°F) | None |
| `biodome.toggleBiodomeUI(player?)` | Toggles biodome status UI visibility | Optional specific player, otherwise affects all players |
| `biodome.onTick(tickDeltaMs)` | Update method called each frame, handles temperature changes and effects | Time delta in milliseconds |

Temperature thresholds and ranges:
- Temperature range: -50°F to 200°F (MIN_TEMP to MAX_TEMP)
- Normal temperature: 74°F (NORMAL_TEMP)
- 104°F or higher: Temperature text appears red, ambient lighting gradually shifts to red (HEAT_DANGER_THRESHOLD)
- 90°F - 103°F: Temperature text appears yellow (HEAT_WARNING_THRESHOLD)
- Below 90°F and above 50°F: Temperature text appears white (normal range)
- 50°F or lower: Temperature text appears yellow (COLD_WARNING_THRESHOLD)
- 32°F or lower: Temperature text appears red, ambient lighting gradually shifts to blue (COLD_DANGER_THRESHOLD)

Environmental effects:
- Ambient lighting gradually shifts to red as temperature rises above 104°F
- Directional lighting (sunlight) becomes more reddish as temperature rises above 104°F
- Ambient lighting gradually shifts to blue as temperature falls below 32°F
- Directional lighting (sunlight) becomes more bluish as temperature falls below 32°F
- Light intensities increase gradually from default (1) to maximum (5) as temperature approaches either extreme
- The intensity of color and brightness changes is proportional to how close the temperature is to MIN_TEMP or MAX_TEMP

Environmental damage (when enabled):
- Heat damage begins at 104°F (HEAT_DANGER_THRESHOLD) and scales up to MAX_TEMP (200°F)
- Cold damage begins at 32°F (COLD_DANGER_THRESHOLD) and scales down to MIN_TEMP (-50°F)
- Damage ranges from 0.2/second (at threshold) to 2.0/second (at extreme temperatures)
- Damage is applied once per second and scales based on how extreme the temperature is
- Visual damage indicators appear on screen when taking damage
- Disabled by default for development/testing

## UI Controls

The game's UI can be controlled via UI data messages:

| Method | Description | Parameters |
|--------|-------------|------------|
| `player.ui.sendData({ type: 'overseer-health-update', health, maxHealth })` | Updates KORO health UI | Health and max health values |
| `player.ui.sendData({ type: 'health-update', health, maxHealth })` | Updates player health UI | Health (rounded to nearest integer) and max health values |
| `player.ui.sendData({ type: 'toggle-player-health-visibility' })` | Toggles player health bar visibility | None |
| `player.ui.sendData({ type: 'toggle-overseer-health-visibility' })` | Toggles KORO health bar visibility | None |
| `player.ui.sendData({ type: 'overseer-message', message, action })` | Shows message from KORO | Message text and action type |

## Item Management

### Spawning Items

| Method | Description | Parameters |
|--------|-------------|------------|
| `const healthPack = new HealthPackItem({}); healthPack.spawn(world, position)` | Spawns a health pack | World and position |
| `const rifle = new EnergyRifle1(); rifle.spawn(world, position)` | Spawns an energy rifle | World and position |

## Chat Commands

These commands can be used in the game chat for testing and debugging:

| Command | Description |
|---------|-------------|
| `/start` | Starts a new game |
| `/oshealth [0-100]` | Sets KORO's health |
| `/osinvuln [true/false]` | Toggles KORO's invulnerability |
| `/toggledamage [true/false]` | Toggles player vulnerability to damage (allows damage even when game is not active) |
| `/toggleplayerhealth` | Toggles player health bar visibility |
| `/togglekorohealth` | Toggles KORO health bar visibility |
| `/togglebiodome` | Toggles biodome status display visibility |
| `/toggleui` | Toggles visibility of ALL UI elements (player health, KORO health, biodome status, overseer temperature, crosshair) |
| `/togglealldamage` | Toggles ALL damage systems (player vulnerability, KORO vulnerability, environmental damage) |
| `/toggleautoreg` | Toggles Auto-Regulation Systems (Biodome auto-reset temp & KORO auto-vent shield) |
| `/togglebfgbreak` | Toggles whether hitting KORO's closed shield with the BFG forces it open |
| `/koro openshield` | Opens KORO's shield |
| `/koro closeshield` | Closes KORO's shield |
| `/healthpack` | Spawns a health pack in front of the player |
| `/healthpacks` | Spawns health packs around the map |
| `/rifle` | Spawns an energy rifle in front of the player |
| `/rocket` | Launches player into the air (testing) |
| `/getpos` | Gets player's current position |
| `/biodome-temp <temperature> [rate]` | Sets biodome temperature with optional change rate |
| `/biodome-heat` | Triggers a heat attack (high temperature) |
| `/biodome-cold` | Triggers a cold attack (low temperature) |
| `/biodome-reset` | Resets biodome temperature to normal |
| `/biodome-status` | Shows current biodome temperature |
| `/biodome-damage [true/false]` | Toggles biodome environmental damage, or sets to specified value |

## Weapon System

Energy Rifle controls:

| Method | Description | Parameters |
|--------|-------------|------------|
| `weapon.fire()` | Fires the weapon | None |
| `weapon.equip()` | Equips the weapon | None |
| `weapon.unequip()` | Unequips the weapon | None |
| `weapon.getWeaponState()` | Gets weapon state (energy level, etc.) | None |

## Game Loop Implementation

A typical game loop implementation would:

1. Initialize game via `GameManager.instance.initialize(world)`
2. Start game with `GameManager.instance.startGame()`
3. Control KORO shield at appropriate intervals with `overseer.openShield()` and `overseer.closeShield()`
4. Monitor player and KORO health
5. End game when victory/loss conditions are met via `GameManager.instance.endGame()`

### Example Game Loop Code

```typescript
// Example of a simple game loop implementation
function setupGameLoop(world: World) {
  // Get game manager instance
  const gameManager = GameManager.instance;
  
  // Initialize game manager with world
  gameManager.initialize(world);
  
  // Start game when player types /start command
  // (already registered in GameManager)
  
  // Get overseer entity
  const overseer = gameManager.getOverseerEntity();
  
  if (overseer) {
    // Set up a periodic shield opening
    const openShieldInterval = setInterval(() => {
      if (gameManager.isGameActive) {
        // Open shield for 10 seconds
        overseer.openShield(10000);
        
        // Broadcast to players
        world.chatManager.sendBroadcastMessage("KORO's shield is open! Attack now!", "FF0000");
      } else {
        // Clear interval if game is not active
        clearInterval(openShieldInterval);
      }
    }, 60000); // Every minute
  }
}
```

## Technical Details

- The game uses Hytopia SDK for the core functionality
- KORO's AI is powered by Google AI Studio API
- The game's UI is built using HTML/CSS/JS and loaded via `player.ui.load()`
- Most game state is managed through the GameManager singleton

---

This documentation provides a reference for implementing and extending the game's core functionality. 