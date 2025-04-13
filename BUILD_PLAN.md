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
        *   [] Implement **BFG**:
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
*   **Outcome Goal:** The core gameplay loop is functional. Players survive attacks, heal with pickups, wait for/force vulnerability windows, and shoot KORO's core with weapons (Energy Gun implemented, BFG basic logic) to deal damage.

## Phase 6: AI Integration & Polish

*   **Focus:** `classes/ai/KoroAiManager.ts` (or similar), `AudioManager` (TTS), `OverseerEntity` (voice degradation), general polish.
*   **Tasks:**
    *   **AI Core:**
        *   [ ] Create AI Manager class.
        *   [ ] Define data structure for game state snapshot (simpler now: player healths, KORO health, BFG status/location, current attack state).
        *   [ ] Implement function(s) to gather snapshot data.
        *   [ ] Set up Gemini API connection.
        *   [ ] Implement the main AI loop: Get snapshot -> Format prompt -> Send to LLM -> Parse response.
        *   [ ] Implement response parsing to trigger KORO actions (choose next attack, maybe trigger malfunction/taunt).
    *   **Audio Polish:**
        *   [ ] Integrate Replicate API for "kokoro" TTS via `AudioManager.speakKoro()`.
        *   [ ] Implement voice degradation based on `OverseerEntity` health.
        *   [ ] Finalize SFX for attacks, damage, barrier movement, weapon fire/reload.
    *   **Visual Polish:**
        *   [ ] Refine screen tints and add particle effects for attacks.
        *   [ ] Add specific visual effects for barrier opening/closing, KORO taking damage, BFG impact.
    *   **UI Polish:**
        *   [ ] Finalize UI layout.
        *   [ ] Ensure Overseer health, weapon status/cooldowns are clear.
        *   [ ] Add visual indicator for BFG availability/location?
*   **Outcome Goal:** KORO dynamically chooses attacks and speaks via LLM. TTS and voice degradation enhance immersion. Visuals and audio are polished. The game loop feels complete and driven by KORO's AI.