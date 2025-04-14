# Development Plan Checklist: Genesis Protocol Failure (Simplified - v2)

This plan follows a user-centric approach, building core interactions first and integrating supporting systems in vertical slices. Focuses on survival, direct damage, instant health pickups, and vulnerability windows.

*General Note: Utilize Hytopia MCP helper tools for SDK guidance, especially for entity creation, physics, and event handling.*

## Phase 1: Core Entities Setup (Player & KORO)

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/entities/OverseerEntity.ts`.
*   **Tasks:**
    *   [x] Verify `GamePlayerEntity` spawns correctly.
    *   [x] Verify `GamePlayerEntity` has health and `takeDamage` works.
    *   [x] Add command `/sethealth <player> <amount>` for testing player health.
    *   [x] Implement `OverseerEntity` class (formerly KORO).
    *   [x] Add retractable barrier/casing model/logic to `OverseerEntity`.
    *   [x] Implement `OverseerEntity.openBarrier()` method (adjusts model/state).
    *   [x] Implement `OverseerEntity.closeBarrier()` method.
    *   [x] Implement `OverseerEntity.isBarrierOpen()` method.
    *   [x] Add command `/koro openbarrier` for testing (adjust existing `/koro openshield`).
    *   [x] Add command `/koro closebarrier` for testing (adjust existing `/koro closeshield`).
*   **Outcome Goal:** KORO is visible, its barrier can be visually opened/closed via commands. Player health is manageable for testing.

## Phase 2: Core UI & Player Setup

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `assets/ui/index.html`, `classes/weapons/`.
*   **Tasks:**
    *   **UI:**
        *   [x] Implement Health display in `index.html`.
        *   [x] Implement Overseer Health display in `index.html`.
        *   [x] Implement Weapon display/status (Active Weapon, Ammo/Cooldown) in `index.html`.
        *   [x] Ensure client-side JS receives and displays player health updates.
        *   [x] Ensure client-side JS receives and displays Overseer health updates.
        *   [x] Ensure client-side JS receives and displays weapon status updates.
    *   **Weapon Foundation:** (Use Hytopia MCP `entities` helper)
        *   [x] Create `EnergyProjectile.ts` entity class (basic movement, placeholder model, configurable speed).
        *   [x] Create `BaseWeapon.ts` class (data structure; configurable: fire rate, ammo/energy count, energy recharge cooldown, shot interval).
        *   [x] Create `EnergyGun.ts` class inheriting from `BaseWeapon`.
        *   [x] Add `_currentWeapon` property to `GamePlayerEntity`.
        *   [x] Implement player spawning *and assign* an instance of the standard `EnergyGun` to `_currentWeapon`.
        *   [x] Add basic firing logic to `GamePlayerEntity._onTickWithPlayerInput` (e.g., left mouse) that calls `this._currentWeapon.shoot()` (which initially just logs/placeholders).
*   **Outcome Goal:** Players spawn with a basic Energy Gun instance. Core UI shows player and Overseer health. Placeholder UI exists for weapon status. Basic weapon classes and projectile entity exist.

## Phase 3: Health Pack Spawning & Instant Use

*   **Focus:** `classes/GameManager.ts`, `classes/items/HealthPackItem.ts`, `classes/entities/GamePlayerEntity.ts`, `assets/ui/index.html`.
*   **Tasks:**
    *   [x] Define safe zone boundaries for random Health Pack spawning. (Done via constants)
    *   [x] Implement logic in `GameManager` to spawn Health Packs (initial test commands done, needs update for random spawning). (Random spawning logic added, testable via `/healthpacks`. Integration into game loop/events deferred).
    *   [x] Remove despawn timer logic from Health Packs (or `BaseItem` if applicable). Consider event-based spawning (e.g., post-attack, based on player count). (Done: Made despawn configurable, HP default to false)
    *   [x] Update `HealthPackItem`:
        *   [x] Healing amount should be configurable.
        *   [x] Ensure it *doesn't* require an inventory slot.
    *   [x] Adapt `GamePlayerEntity._handleInteract` logic:
        *   [x] Raycast for interaction.
        *   [x] If hit target is `HealthPackItem`:
            *   [x] Call `player.heal(healthPack.healAmount)`. **Instantly consume.**
            *   [x] Despawn the `HealthPackItem` entity.
            *   [x] Provide feedback (sound/message).
        *   [x] Verify removal of logic related to adding items to hand/backpack slots within `_handleInteract`. (Verified)
    *   [x] Remove obsolete player inventory code from `GamePlayerEntity`:
        *   [x] Properties: `_backpackInventory`, `_handItem`.
        *   [x] Methods: `dropHandItem`, `dropBackpackItem`, `swapHandWithBackpack`, `useHandItem` (and associated 'F' key binding), `getHandItem`, `getBackpackItem`, `hasItemInHand`, `hasItemInBackpack`, `hasSpaceInBackpack`, `findFirstEmptyBackpackSlot`, `_updateInventoryUI`.
        *   [x] Associated key bindings (Q for drop, F for use, 1-3 for swap in `_onTickWithPlayerInput`).
    *   [x] Remove inventory UI elements & related JS from `index.html`.
    *   [x] Remove `/testhealthpack` command (pickup logic changed).
    *   [ ] Update `/healthpack` and `/healthpacks` commands for new spawning logic. (Partially done: `/healthpacks` uses random logic, `/healthpack` still spawns directly)
*   **Outcome Goal:** Health Packs spawn randomly in the world (potentially based on game events) and instantly heal the player upon interaction ('E' key), then disappear. Player inventory system and related UI/methods/bindings are fully removed.

## Phase 4: Environmental Attacks & Direct Damage

*   **Focus:** `AttackManager` (or similar logic in `GameManager` initially), `GamePlayerEntity`, Attack classes, UI/Audio feedback.
*   **Tasks:**
    *   [ ] Create `AttackManager` class (or handle logic in `GameManager`).
    *   [ ] Create `BaseEnvironmentalAttack` structure/class.
    *   [ ] Implement `SuperheatAttack`:
        *   [ ] Logic for timed cycle (~20s cycle, ~15s intense phase).
        *   [ ] Trigger visual effects (red tint via `EffectsManager` or direct UI call).
        *   [ ] Trigger audio cues (`AudioManager` or direct calls).
        *   [ ] During intense phase, call `player.takeEnvironmentalDamage(amount)` periodically. Damage amount configurable.
        *   [ ] Add command `/triggerattack superheat`.
    *   [ ] Implement `DeepFreezeAttack` (similar structure to Superheat, blue tint, different damage).
    *   [ ] Implement `BlackoutAttack` (sets world light to dark).
    *   [ ] Implement `UVAttack` (purple tint, maybe damage).
    *   [ ] Implement `GamePlayerEntity.takeEnvironmentalDamage(amount)`: Directly reduce health, play sound, update UI.
    *   [ ] Basic UI feedback for active attack type (e.g., text alert).
    *   [ ] Ensure attack durations/damage are configurable.
*   **Outcome Goal:** KORO can trigger timed environmental attacks (Superheat, Freeze initially) that directly damage players and have distinct visual/audio cues.

## Phase 5: Vulnerability Windows & Core Damage Loop

*   **Focus:** `OverseerEntity`, `GamePlayerEntity`, Weapon classes (`EnergyGun`, `BFG`, `EnergyProjectile`).
*   **Tasks:** (Use Hytopia MCP `physics`, `entities`, `events` helpers)
    *   **Vulnerability Windows:**
        *   [x] Implement KORO briefly opening barrier post-attack (`OverseerEntity.openBarrier(shortDuration)` called by Attack logic).
        *   [x] Implement hitting KORO's *closed barrier* with BFG forcing it open (`OverseerEntity.openBarrier(longDuration)`).
        *   [ ] Implement "KORO EXPOSED!" alert (`UIManager` or `GameManager` broadcasts message).
    *   **Weapon Implementation:**
        *   [ ] Finalize **Energy Projectile Gun** logic (`EnergyGun.ts`, `EnergyProjectile.ts`):
            *   [x] Implement `EnergyGun.shoot()` to spawn `EnergyProjectile` if cooldowns/ammo allow.
            *   [x] Implement `EnergyProjectile` movement and lifespan.
            *   [x] Implement `EnergyProjectile` collision logic (hit Overseer? Barrier open? Hit other?).
            *   [x] Call `OverseerEntity.takeDamage(amount)` from projectile on valid hit. Damage configurable.
            *   [x] Implement ammo (e.g., 30 shots) and cooldowns (shot interval, recharge) in `EnergyGun`. Configurable.
            *   [x] Update weapon status UI (deferred).
        *   [ ] Implement **BFG**:
            *   [x] Create `BFG.ts` weapon class.
            *   [ ] Spawn one BFG randomly on the map at match start.
            *   [x] Implement pickup logic (replaces Energy Gun? Or specific action? Simplest: replaces Energy Gun).
            *   [x] Implement `BFG.shoot()` to spawn a different projectile (or maybe use raycast for simplicity?).
            *   [x] Implement BFG collision/hit logic:
                *   [x] If hit `OverseerEntity` barrier closed -> `OverseerEntity.openBarrier(longDuration)`. (Utility)
                *   [x] If hit `OverseerEntity` core open -> `OverseerEntity.takeDamage(highAmount)`. Damage configurable.
            *   [ ] Implement long reload (e.g., 90s). Configurable. Update UI.
    *   **KORO Damage & Defense:**
        *   [x] Implement `OverseerEntity.takeDamage(amount)` method.
        *   [x] Add health property to `OverseerEntity`.
        *   [x] Ensure `OverseerEntity` barrier has appropriate colliders to block projectiles.
        *   [x] Update Overseer health UI.
    *   **Player Death Mechanics:**
        *   [x] Implement player death handling in `GamePlayerEntity.checkDeath()`.
        *   [x] Add sleep animation for dead players using `playerController.idleLoopedAnimations = ['sleep']`.
        *   [x] Disable all player input when dead by checking `this._dead` flag in `_onTickWithPlayerInput`.
        *   [x] Add `/respawn` command for testing purposes.
*   **Outcome Goal:** The core gameplay loop is functional. Players survive attacks, heal with pickups, wait for/force vulnerability windows, and shoot KORO's core with weapons (Energy Gun implemented, BFG basic logic) to deal damage.

## Phase 6: AI Integration & Polish

*   **Focus:** `classes/ai/KOROBrain.ts`, `AudioManager`, `OverseerEntity`, `GamePlayerEntity`, `GameManager`, general polish.
*   **Tasks:**
    *   **AI Core - Simplified Implementation:**
        *   [x] Create AI Manager class (`KOROBrain.ts`).
        *   [x] Implement configurable update interval (default 8s) in `KOROBrain`.
        *   [x] Implement separate enable flags for Brain Processing, LLM Interaction, TTS Generation in `KOROBrain`.
        *   [x] Implement `can_initiate_environmental_attack` flag and cooldown logic in `KOROBrain`.
        *   [x] Finalize LLM context snapshot structure (`GameStateSnapshotSchema` in `KOROBrain`):
            *   Includes: KORO status (health, shield, temps + thresholds), Game context (biodome temps + thresholds, health packs, BFG held, attack readiness), Player info (count, healths), Interaction history (KORO responses, game events, attacks triggered).
        *   [x] Implement function (`_gatherGameStateSnapshot` in `KOROBrain`) to gather snapshot data (using Overseer/GameManager refs).
            *   [ ] TODO: Implement actual tracking for `is_bfg_held_by_player`.
            *   [ ] TODO: Implement actual tracking for `available_health_packs` (if not already done via tag search).
        *   [x] Set up Gemini API connection (`generateObject` call in `KOROBrain`).
        *   [x] Implement the main AI loop (`generateUpdate` in `KOROBrain`) using fixed interval, snapshot, and LLM call (if enabled).
        *   [x] Update LLM Prompt (`_buildPrompt` in `KOROBrain`): Explain core mechanics, temperature relationship, BFG, attack readiness flag, and strongly guide AI on verbal response frequency (discourage messages every update).
        *   [ ] Implement Event Logging (Calls to `_brain.addEventWithPriority(...)`):
            *   [x] Log `koro_damage` (medium priority) in `OverseerEntity.takeDamage`.
            *   [ ] Log `player_damage` (low priority) in `GamePlayerEntity.takeDamage`.
            *   [x] Log `player_death` (medium priority) from `GameManager.handlePlayerDeath`.
            *   [ ] Log `bfg_pickup` (high priority) from `GameManager` / pickup logic.
            *   [ ] Log `healthpack_pickup` (low priority) in `GamePlayerEntity._handleInteract`.
            *   [ ] Log `attack_end` / `attack_cooldown_start` (low priority) - Ensure `recordEnvironmentalAttackEnd` is called correctly (e.g., from `BiodomeController` or `OverseerEntity` when temp normalizes). (NOTE: I don't think we'll actually want or need this one)
            *   [x] Log `shield_vent_start` / `shield_vent_stop` (low priority) in `OverseerEntity._startAutoVenting` / `_stopAutoVenting`.
            *   [x] Log `shield_breach_bfg` (high priority) in `OverseerEntity.forceOpenShield`.
            *   [x] Chat messages logged via `_onChatMessage` / `addChatMessage`.
            *   [x] KORO attacks logged via `addTriggeredAttack`.
        *   [ ] Implement Action Parsing: Parse `response.action` from LLM in `KOROBrain.generateUpdate` and trigger corresponding actions (e.g., call `OverseerEntity.startEnvironmentalAttack("Superheat")` or target a player). Define available actions clearly.
        *   [ ] Refactor TTS/UI Broadcast: Move logic from old private methods (`_generateTTS`, `_broadcastOverseerMessage`) in `OverseerEntity` into the new public methods (`generateTTSForMessage`, `broadcastOverseerUIMessage`).
    *   **Audio Polish:**
        *   [x] Integrate Replicate API for "kokoro" TTS via `AudioManager.speakKoro()` (assuming this refers to the TTS call setup).
        *   [x] Implement voice degradation based on `OverseerEntity` health (should be part of `generateTTSForMessage` logic).
        *   [ ] Implement non-verbal SFX for shield hits and KORO core damage in `OverseerEntity.takeDamage`.
        *   [ ] Finalize SFX for environmental attacks, barrier movement, weapon fire/reload.
    *   **Visual Polish:**
        *   [x] Refine screen tints and add particle effects for attacks.
        *   [x] Add specific visual effects for barrier opening/closing, KORO taking damage, BFG impact.
    *   **UI Polish:**
        *   [ ] Finalize UI layout.
        *   [ ] Ensure Overseer health, weapon status/cooldowns are clear.
    *   **Misc**
        *   [x] Handle player death; should stop *all* input via keyboard and mouse; player does *not* respawn until after the match ends. This is not a deathmatch style game
        *   **Game Loop Implementation:**
            *   [x] Define `GameState` enum (`IDLE`, `COUNTDOWN`, `ACTIVE`, `GAMEOVER`) in `GameManager`.
            *   [x] Implement transition methods (`_transitionTo...`) in `GameManager`.
            *   [x] Implement `/start` command to trigger `_transitionToCountdown`.
            *   [x] Implement `COUNTDOWN` state (timer, UI updates).
            *   [x] Implement simplified `ACTIVE` state (call helpers to enable systems, set KORO mode, equip players, spawn BFG).
            *   [x] Implement `GAMEOVER` state (stop timers, UI message, timer to Idle).
            *   [x] Implement `IDLE` state (call helpers to disable systems, despawn items, call entity resets).
            *   [x] Add `reset()` methods to `GamePlayerEntity` and `OverseerEntity`.
            *   [x] Implement game over triggers (`handlePlayerDeath`, `handleOverseerDeath`).
        *   [ ] Handle KORO death; need some kind of final goodbye from KORO or minor celebration if the players win
        *   [ ] Handle all players die / lose; need some kind of event to happen
            *   [ ] Players winning or KORO dying are immediate events it should stop and respond to NOW
            *   [ ] On game end, reset all lighting and attacks; or just reset the environment
        *   [ ] Implement smooth transition after players win or lose before transitioning back to IDLE state
        *   [x] Program out the actual main game loop in GameManager.ts
        *   [x] Tweak attack damage, KORO damage, BFG damage, Rifle damage, and weapon cooldown / recharge speeds so the game is challeging but fun
        *   [x] Fix the voice location for KORO on the map; it fades away when you're far away
        *   [x] New targeted UV attack. Can attack up to 3 players at a time
        *   [x] Warn UV attack target to keep moving!
        *   [x] Blackout attack should just adjust light intensity; not actual light coloring
        *   [ ] Try and figure out how to use Grok instead of Gemini
        *   [ ] Try to make the personality even more quirky
        *   [ ] New skybox
        *   [ ] More sound effects
            *   [x] When KORO shields open (venting noise)
            *   [x] When KORO shields close (heavy metal bang like a steel door closing)
            *   [ ] When KORO shields fall from the sky, metal bang like a heav, hollow metal ball falling on the ground
            *   [ ] A thud sound when KORO entity hits the ground
            *   [x] An alarm when a new attack is being launched (also show warning on screen); alarm remains active during attack
            *   [x] When player shoots energy rifle
            *   [x] When player shoots BFG
            *   [x] When player rifle hits shield
            *   [x] When BFG hits and disrupts shield (maybe electrecution sound or something?)
            *   [x] When KORO gets a direct hit
            *   [x] When players take damage from attacks
            *   [ ] When a heat attack is ongoing and in the critical temp, have a fire burning sound effect
            *   [ ] When a freeze attack is ongoing and in the critical temp, have some kind of cold (?) sound effect
            *   [ ] When a player is being hit by a UV attack, have another burning sound
            *   [ ] When a UV attack is active, have some kind of high pitched noise like some bright lights make
        *   [x] Have KORO light up red briefly when hit for visual cue that it was injured
        *   [ ] On shield malfunction, warn all users to start shooting at KORO *now*
        *   [x] Better music when match is active
        *   [ ] Better end state transition
        *   [ ] Add mobile support
        *   [ ] When KORO is defeated, its shields fall to the floor with a loud bang (if possible) and it also falls to the floor
        *   [ ] Add anti gravity attack
        *   [ ] Update KORO's prompt to give it strategic move pairings; e.g. darkness followed by UV attack (or vice versa), temp change followed by UV attack so that players can't just stand around and wait for you to auto-vent, etc.
        *   [ ] Perhaps as it gets more erratic at the end, let it specify 2 attacks simultaneously (obviously not 2 temp attacks though)
        *   [ ] Improved map; a little more dynamic, longer weapon ranges, have more layers like water at the lowest point, then void soil, and sometimes topped with void grass
*   **Outcome Goal:** KORO dynamically chooses actions based on game state via LLM, speaking occasionally with degraded voice. Core loop feels responsive with simplified AI updates and planned event logging. Visuals and audio are polished.
