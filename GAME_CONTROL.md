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

## UI Controls

The game's UI can be controlled via UI data messages:

| Method | Description | Parameters |
|--------|-------------|------------|
| `player.ui.sendData({ type: 'overseer-health-update', health, maxHealth })` | Updates KORO health UI | Health and max health values |
| `player.ui.sendData({ type: 'health-update', health, maxHealth })` | Updates player health UI | Health and max health values |
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
| `/toggleplayerhealth` | Toggles player health bar visibility |
| `/togglekorohealth` | Toggles KORO health bar visibility |
| `/koro openshield` | Opens KORO's shield |
| `/koro closeshield` | Closes KORO's shield |
| `/healthpack` | Spawns a health pack in front of the player |
| `/healthpacks` | Spawns health packs around the map |
| `/rifle` | Spawns an energy rifle in front of the player |
| `/rocket` | Launches player into the air (testing) |
| `/getpos` | Gets player's current position |

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