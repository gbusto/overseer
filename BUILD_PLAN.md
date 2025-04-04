# Layered Development Plan for Genesis Protocol Failure

This updated development plan incorporates the expanded lore and mechanics for the Genesis Biodome Delta and K.O.R.O. (Kinetic Operations & Resource Overseer).

## Phase 1: Core Technical Infrastructure

### 1. KORO AI Integration (LLM Layer)
The foundation of KORO's decision-making and personality.

**Components to build:**
- Gemini 2.0 Flash LLM API integration
- Game state formatter with KORO's "bureaucratic" perspective
- Response parser for LLM actions (attacks, environmental hazards, spawns)
- Context management system for KORO's "memory"
- Fallback systems for API failures

**Test commands:**
```
/koro-test-call [prompt]        // Test basic LLM connectivity
/koro-test-state                // Send current game state to LLM and display response
/koro-force-action [action-type] [params] // Force KORO to perform specific action
/koro-toggle                    // Enable/disable LLM integration (for testing without API calls)
/koro-persona [state]           // Set KORO's persona state (normal, angry, desperate)
```

### 2. Dual Communication System (Text + Delayed TTS)
Implement KORO's immediate text and delayed voice feedback systems.

**Components to build:**
- Text display system for immediate feedback
- Kokoro TTS API integration via Replicate
- Audio playback system with configurable delay (~4 seconds)
- Voice degradation effects based on KORO's health
- Audio caching for frequently used messages

**Test commands:**
```
/koro-say [text]                // Test immediate text + delayed TTS
/koro-voice-delay [seconds]     // Adjust TTS delay for testing
/koro-damage-level [0-100]      // Test voice degradation at different damage levels
/koro-instant-sfx [effect-name] // Test instant sound effects for critical events
/communication-toggle [text/voice/both] // Toggle communication channels
```

### 3. Entity System Foundation
Build the basic entity hierarchy.

**Components to build:**
- KORO entity with shield and health systems
- Player entity with health, energy, and inventory
- Resource entities (energy orbs, health packs)
- Protective item entities (Cooling Gel, Thermal Coat, Oxygen Mask)
- Basic interaction system

**Test commands:**
```
/spawn-koro                     // Spawn/respawn KORO entity
/spawn-item [item-type] [x] [y] [z] // Spawn specific item at coordinates
/player-health [amount]         // Set player health 
/player-energy [amount]         // Set player energy
/koro-health [amount]           // Set KORO health
/koro-shield [on/off]           // Toggle KORO shield
/give-item [item-id]            // Give protective item to player
```

## Phase 2: Core Game Mechanics

### 4. Environmental Hazard System
Implement KORO's environmental attacks and protective counters.

**Components to build:**
- Environmental hazard manager (Heat, Freeze, O2 Depletion, Blackout)
- Environmental effect zones and visualization
- Protective item usage system with duration tracking
- Player status effect system (overheating, freezing, suffocating)
- Visual and audio feedback for environmental states

**Test commands:**
```
/env-trigger [hazard-type]      // Trigger specific environmental hazard
/env-intensity [1-5]            // Set hazard intensity level
/env-duration [seconds]         // Set hazard duration
/env-clear                      // Clear all environmental hazards
/protect [hazard-type]          // Give player protection against specific hazard
```

### 5. Shield and Combat System
Implement the core combat mechanics.

**Components to build:**
- KORO shield system with visual effects and toggle logic
- Basic energy weapon system with varying consumption rates
- Shield Piercer special weapon implementation
- Damage system (player-to-KORO, KORO-to-player)
- Direct attack patterns for KORO (lasers, energy pulses)

**Test commands:**
```
/shield-toggle                  // Toggle the shield on/off
/give-weapon [weapon-type]      // Give specific weapon to player
/fire-weapon [weapon-type]      // Simulate weapon fire
/koro-attack [attack-type]      // Trigger a KORO attack
/test-damage [amount] [target]  // Apply damage to target
```

### 6. Game State Management
Build the overarching game loop and state tracking.

**Components to build:**
- Game Manager for tracking overall state
- Win/loss condition checking
- Match timer and event system
- Player state persistence
- Event history for KORO context

**Test commands:**
```
/game-start                     // Start a new game session
/game-end [winner]              // End current game with specified winner
/game-state                     // Display current game state
/game-timer [seconds]           // Set/adjust game timer
/trigger-event [event-name]     // Trigger a specific game event
```

### 7. Betrayal System
Implement the betrayal mechanics.

**Components to build:**
- Betrayal command and state tracking
- LLM integration for KORO's betrayal responses
- Traitor-specific game mechanics
- Resource hoarding tracking
- Betrayal consequence system

**Test commands:**
```
/betray                         // Execute betrayal command
/list-traitors                  // List current traitors (admin only)
/traitor-power [power-name]     // Test traitor-specific abilities
/test-betrayal-scenario [scenario] // Run a specific betrayal scenario
```

## Phase 3: Polish and Integration

### 8. Visual and Audio Effects
Enhance the game's feedback systems.

**Components to build:**
- KORO attack visual effects (lasers, pulses)
- Shield impact and breakdown effects
- Environmental hazard visualizations
- Damage feedback effects
- Ambient biodome sounds
- Instant SFX for critical gameplay events

**Test commands:**
```
/play-effect [effect-name] [x] [y] [z] // Play effect at position
/play-sound [sound-name]        // Play specific sound
/toggle-effect [effect-name]    // Toggle a persistent effect
/effect-intensity [1-5]         // Adjust effect intensity
```

### 9. Biodome Environment
Develop the Genesis Biodome Delta environment.

**Components to build:**
- Verdant Horizons Corporation themed environment
- Biodome structure with KORO mounted near apex
- Resource and item spawn points
- Environmental hazard zones
- Narrative elements (documents, terminals)

**Test commands:**
```
/teleport [x] [y] [z]           // Teleport to coordinates
/spawn-point-list               // Show all spawn points
/reload-map                     // Reload the current map
/toggle-area [area-name]        // Enable/disable specific area features
```

### 10. UI and Player Feedback
Build the user interface and player communication systems.

**Components to build:**
- Health/energy HUD with environmental status indicators
- Protective item status display
- KORO text communication display
- Objective indicators
- Environmental hazard warnings
- Inventory management UI

**Test commands:**
```
/show-ui [ui-element]           // Toggle specific UI element
/test-notification [message]    // Display test notification
/test-warning [hazard-type]     // Display environmental warning
/inventory-ui                   // Toggle inventory interface
```

## Implementation Example: KORO Communication System

The dual text+voice system is a key feature of the game. Here's how it might be implemented:

```typescript
export class KOROCommunicationManager {
  private _voiceDelay: number = 4000; // 4 second delay
  private _damageLevel: number = 0; // 0-100 scale of voice degradation
  private _messageQueue: Array<{text: string, type: string}> = [];
  private _isSpeaking: boolean = false;
  
  constructor(private _world: World, private _koroEntity: OverseerEntity) {}
  
  // Called by the LLM integration when KORO decides to speak
  public async speak(text: string, type: 'normal'|'alert'|'warning' = 'normal'): Promise<void> {
    // Immediately display text to all players
    this._showTextToPlayers(text, type);
    
    // Queue the voice message
    this._messageQueue.push({text, type});
    
    // Process queue if not already processing
    if (!this._isSpeaking) {
      this._processVoiceQueue();
    }
  }
  
  // Display text immediately to all players
  private _showTextToPlayers(text: string, type: string): void {
    this._world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      playerEntity.player.ui.sendData({
        type: 'koro-message',
        messageType: type,
        text: text
      });
    });
  }
  
  // Process voice messages with delay
  private async _processVoiceQueue(): Promise<void> {
    this._isSpeaking = true;
    
    while (this._messageQueue.length > 0) {
      const message = this._messageQueue.shift();
      if (!message) continue;
      
      try {
        // Generate TTS with the current damage level
        const audioUrl = await this._generateTTS(message.text);
        
        // Wait for the intentional delay
        await new Promise(resolve => setTimeout(resolve, this._voiceDelay));
        
        // Play the audio if KORO is still alive
        if (this._koroEntity.isSpawned) {
          const audio = new Audio({
            uri: audioUrl,
            attachedToEntity: this._koroEntity,
            volume: 0.8,
            referenceDistance: 50
          });
          audio.play(this._world);
        }
      } catch (error) {
        console.error('TTS generation failed:', error);
      }
    }
    
    this._isSpeaking = false;
  }
  
  // Generate TTS audio with degradation effects based on damage
  private async _generateTTS(text: string): Promise<string> {
    // Format request for your server
    const response = await fetch('https://your-api-endpoint.com/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        model: 'kokoro',
        damageLevel: this._damageLevel
      })
    });
    
    const data = await response.json();
    return data.audioUrl;
  }
  
  // Update the damage level for voice degradation
  public setDamageLevel(level: number): void {
    this._damageLevel = Math.max(0, Math.min(100, level));
  }
}
```

## Environmental Hazard System Example

The environmental hazards are a new key feature in your expanded concept:

```typescript
export enum HazardType {
  HEAT = 'heat',
  FREEZE = 'freeze',
  OXYGEN_DEPLETION = 'oxygen_depletion',
  BLACKOUT = 'blackout'
}

export class EnvironmentalHazardManager {
  private _activeHazards: Map<HazardType, {intensity: number, endTime: number}> = new Map();
  private _hazardEffects: Map<HazardType, any> = new Map();
  
  constructor(private _world: World) {
    // Set up tick handler for environmental effects
    _world.on(WorldEvent.TICK, this._updateHazards);
  }
  
  // Trigger a specific environmental hazard
  public triggerHazard(type: HazardType, intensity: number = 3, durationSeconds: number = 60): void {
    // Set hazard end time
    const endTime = Date.now() + (durationSeconds * 1000);
    this._activeHazards.set(type, {intensity, endTime});
    
    // Create visual effects
    this._createHazardEffects(type, intensity);
    
    // Notify all players
    this._notifyPlayers(type, intensity, durationSeconds);
  }
  
  // Update hazards on each tick
  private _updateHazards = ({ deltaTimeMs }: { deltaTimeMs: number }): void => {
    const now = Date.now();
    
    // Check each active hazard
    this._activeHazards.forEach((hazardData, type) => {
      // Remove expired hazards
      if (hazardData.endTime <= now) {
        this._endHazard(type);
        return;
      }
      
      // Apply hazard effects to players without protection
      this._world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
        if (playerEntity instanceof GamePlayerEntity) {
          if (!playerEntity.hasProtection(type)) {
            this._applyHazardEffect(playerEntity, type, hazardData.intensity, deltaTimeMs);
          }
        }
      });
    });
  }
  
  // Apply hazard effect to a player
  private _applyHazardEffect(player: GamePlayerEntity, type: HazardType, intensity: number, deltaTimeMs: number): void {
    switch (type) {
      case HazardType.HEAT:
        // Apply heat damage over time
        const heatDamage = (intensity * 0.05) * (deltaTimeMs / 1000);
        player.takeDamage(heatDamage);
        break;
        
      case HazardType.FREEZE:
        // Apply movement slowdown and damage
        player.moveSpeedMultiplier = Math.max(0.2, 1 - (intensity * 0.15));
        const freezeDamage = (intensity * 0.03) * (deltaTimeMs / 1000);
        player.takeDamage(freezeDamage);
        break;
        
      case HazardType.OXYGEN_DEPLETION:
        // Apply oxygen depletion effects (vision darkening, damage)
        const o2Damage = (intensity * 0.08) * (deltaTimeMs / 1000);
        player.takeDamage(o2Damage);
        player.oxygenLevel = Math.max(0, player.oxygenLevel - (intensity * 0.1) * (deltaTimeMs / 1000));
        break;
        
      case HazardType.BLACKOUT:
        // Apply visibility reduction (handled in UI)
        player.player.ui.sendData({
          type: 'visibility',
          level: Math.max(0.1, 1 - (intensity * 0.2))
        });
        break;
    }
  }
  
  // Create visual/audio effects for hazards
  private _createHazardEffects(type: HazardType, intensity: number): void {
    // Remove any existing effect
    if (this._hazardEffects.has(type)) {
      const oldEffect = this._hazardEffects.get(type);
      // Clean up old effect...
    }
    
    // Create new effect based on hazard type
    switch (type) {
      case HazardType.HEAT:
        // Heat distortion effect
        // ...
        break;
        
      case HazardType.FREEZE:
        // Frost particle effect
        // ...
        break;
        
      case HazardType.OXYGEN_DEPLETION:
        // Gas particle effect
        // ...
        break;
        
      case HazardType.BLACKOUT:
        // Darkness effect
        // ...
        break;
    }
  }
  
  // End a specific hazard
  private _endHazard(type: HazardType): void {
    this._activeHazards.delete(type);
    
    // Clean up effects
    if (this._hazardEffects.has(type)) {
      const effect = this._hazardEffects.get(type);
      // Cleanup effect code...
      this._hazardEffects.delete(type);
    }
    
    // Reset player states
    this._world.entityManager.getAllPlayerEntities().forEach(playerEntity => {
      if (playerEntity instanceof GamePlayerEntity) {
        switch (type) {
          case HazardType.FREEZE:
            playerEntity.moveSpeedMultiplier = 1.0;
            break;
          case HazardType.BLACKOUT:
            playerEntity.player.ui.sendData({
              type: 'visibility',
              level: 1.0
            });
            break;
        }
      }
    });
    
    // Notify players
    this._notifyHazardEnd(type);
  }
  
  // Notify players of hazard
  private _notifyPlayers(type: HazardType, intensity: number, durationSeconds: number): void {
    // Send UI notifications to all players
    // ...
  }
  
  // Notify hazard has ended
  private _notifyHazardEnd(type: HazardType): void {
    // Send UI notifications to all players
    // ...
  }
}
```

This updated plan now incorporates all the new elements from your expanded lore and gameplay concept while maintaining a clear, phased development approach.