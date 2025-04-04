
# Layered Development Plan for AI Overseer Arena

Looking at your game concept in GAME_INFO.md, I think a layered approach makes a lot of sense, focusing on the most complex and unfamiliar components first. Here's a development plan broken down into phases, with testing commands for each component:

## Phase 1: Core Technical Infrastructure

### 1. LLM Integration Layer
This is one of the most critical and complex parts of your game, so starting here makes sense.

**Components to build:**
- LLM API integration service
- Game state formatter for LLM context
- Response parser for LLM actions
- Command scheduler to execute LLM decisions

**Test commands:**
```
/llm-test-call [prompt]         // Test basic LLM connectivity
/llm-test-state                 // Send current game state to LLM and display response
/llm-force-action [action-name] // Force a specific LLM action
/llm-toggle                     // Enable/disable LLM integration (for testing without API calls)
```

### 2. TTS Integration Layer
The voice component will be critical for the Overseer's personality.

**Components to build:**
- TTS API integration
- Audio playback system for TTS responses
- Voice degradation effects based on Overseer health

**Test commands:**
```
/tts-test [text]                // Test TTS with specific text
/tts-play [audio-file]          // Play pre-recorded TTS
/tts-damage-level [0-100]       // Test voice degradation at different damage levels
/tts-toggle                     // Enable/disable TTS
```

### 3. Entity System Foundation
Build the basic entity framework that will support the game mechanics.

**Components to build:**
- Enhanced Overseer entity (beyond current test version)
- Player entity with health, energy, and inventory
- Item entities (energy orbs, health packs)

**Test commands:**
```
/spawn-overseer                 // Spawn the Overseer entity
/spawn-item [item-type] [x] [y] [z] // Spawn specific item at coordinates
/player-health [amount]         // Set player health 
/player-energy [amount]         // Set player energy
/overseer-health [amount]       // Set Overseer health
/overseer-shield [on/off]       // Toggle Overseer shield
```

## Phase 2: Core Game Mechanics

### 4. Shield and Combat System
Implement the shield mechanics and basic combat.

**Components to build:**
- Overseer shield system (visual effects, toggle logic)
- Basic weapon system with energy consumption
- Shield Piercer special weapon
- Damage system (player-to-overseer, overseer-to-player)

**Test commands:**
```
/shield-toggle                  // Toggle the shield on/off
/give-weapon [weapon-type]      // Give specific weapon to player
/fire-weapon [weapon-type]      // Simulate weapon fire
/test-attack [attack-type]      // Trigger an Overseer attack
/test-damage [amount] [target]  // Apply damage to target
```

### 5. Game State Management
Build the game loop and state tracking system.

**Components to build:**
- Game Manager for overall state
- Win/loss condition tracking
- Match timer and event system
- Player state persistence (health, inventory, etc.)

**Test commands:**
```
/game-start                     // Start a new game
/game-end [winner]              // End current game with specified winner
/game-state                     // Display current game state
/game-timer [seconds]           // Set/adjust game timer
/trigger-event [event-name]     // Trigger a specific game event
```

### 6. Betrayal System
Implement the betrayal mechanics.

**Components to build:**
- Betrayal command and state tracking
- LLM integration for betrayal responses
- Betrayal-specific gameplay mechanics

**Test commands:**
```
/betray                         // Execute betrayal command
/list-traitors                  // List current traitors (admin only)
/test-betrayal-scenario [scenario] // Run a specific betrayal scenario
```

## Phase 3: Polish and Integration

### 7. Visual and Audio Effects
Enhance the game's feedback systems.

**Components to build:**
- Weapon effects (lasers, pulses, etc.)
- Shield visual effects
- Damage feedback effects
- Environmental audio

**Test commands:**
```
/play-effect [effect-name] [x] [y] [z] // Play effect at position
/play-sound [sound-name]        // Play specific sound
/toggle-effect [effect-name]    // Toggle a persistent effect
```

### 8. Environment and Map
Develop the biodome arena environment.

**Components to build:**
- Basic level layout
- Resource spawn points
- Visual environment elements

**Test commands:**
```
/teleport [x] [y] [z]           // Teleport to coordinates
/spawn-point-list               // Show all spawn points
/reload-map                     // Reload the current map
```

### 9. UI and Player Feedback
Build the user interface and player communication systems.

**Components to build:**
- Health/energy HUD
- Objective indicators
- Game state notifications
- Chat system

**Test commands:**
```
/show-ui [ui-element]           // Toggle specific UI element
/test-notification [message]    // Display test notification
/fake-objective [text]          // Display fake objective
```

## Integration Testing Framework

To support all these systems, I recommend building a comprehensive command and event system:

```typescript
// Core testing framework to add to your Hytopia game
world.chatManager.registerCommand('/test-mode', (player) => {
  // Toggle testing mode for admin players
  const isAdmin = checkAdmin(player);
  if (!isAdmin) {
    world.chatManager.sendPlayerMessage(player, "You don't have permission to use this command.");
    return;
  }
  
  const testMode = toggleTestMode(player);
  world.chatManager.sendPlayerMessage(player, `Test mode ${testMode ? 'enabled' : 'disabled'}`);
});

// Example of a test command that can be used in any phase
world.chatManager.registerCommand('/debug-state', (player) => {
  // Display full debugging information
  if (!isTestModeEnabled(player)) return;
  
  const gameState = GameManager.instance.getDebugState();
  world.chatManager.sendPlayerMessage(player, JSON.stringify(gameState, null, 2));
});
```

## Development Approach Recommendations

1. **Start with a Technical Prototype**:
   - Build the LLM integration first, using a placeholder for the Overseer entity
   - Create a simple test arena for validating the concept
   - Implement basic test commands for triggering various game states

2. **Focus on State Management Early**:
   - Build a robust GameManager class that tracks all relevant state
   - Ensure all state changes can be triggered manually via commands
   - Implement event recording for debugging

3. **Use Pseudo-Components for Missing Elements**:
   - For complex features like the shield visual effect, start with a simple placeholder
   - Focus on the functional aspects first, then enhance visuals later

4. **Build a Test Console UI**:
   - Create a debug UI panel that shows game state and allows easy command execution
   - Make it toggleable for admin players only

5. **LLM Integration Strategy**:
   - Start with a simplified JSON-based protocol for LLM communication
   - Define clear action types the LLM can take (attack, speak, spawn items)
   - Include fallbacks for when the LLM is unavailable or slow

## Technical Considerations

For the LLM and TTS integration, you might face challenges with the client-server architecture. Here's my recommendation:

```typescript
// On the server side
export class OverseerManager {
  private _lastStateUpdate: number = 0;
  private _stateUpdateInterval: number = 15000; // 15 seconds
  
  public async updateOverseerState() {
    const now = Date.now();
    if (now - this._lastStateUpdate < this._stateUpdateInterval) return;
    
    // Format game state for LLM
    const gameState = this._formatGameState();
    
    // Make API call to your server
    const response = await fetch('https://your-server.com/overseer-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gameState)
    });
    
    // Process response
    const aiResponse = await response.json();
    this._processOverseerActions(aiResponse.actions);
    
    // Handle TTS if included in response
    if (aiResponse.speech) {
      this._playSpeech(aiResponse.speech);
    }
    
    this._lastStateUpdate = now;
  }
  
  private _playSpeech(speechData) {
    // Create audio from the speech data
    const audio = new Audio({ 
      uri: speechData.audioUrl,
      attachedToEntity: GameManager.instance.overseerEntity,
      volume: 0.8,
      referenceDistance: 50
    });
    
    audio.play(this.world);
  }
}
```

This approach keeps the LLM and TTS integration on your server side, with Hytopia just handling the final audio playback.