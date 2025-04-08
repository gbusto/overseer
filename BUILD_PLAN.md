# Development Plan Checklist: Genesis Protocol Failure

This plan follows a user-centric approach, building core interactions first and integrating supporting systems in vertical slices.

## Phase 1: Core Entities Setup (Player & KORO)

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/entities/KoroEntity.ts`.
*   **Tasks:**
    *   [ ] Verify `GamePlayerEntity` spawns correctly.
    *   [ ] Verify `GamePlayerEntity` has health and `takeDamage` works.
    *   [ ] Add command `/sethealth <player> <amount>` for testing player health.
    *   [ ] Implement `KoroEntity` class.
    *   [ ] Add shield model (e.g., two hemispheres) to `KoroEntity`.
    *   [ ] Implement `KoroEntity.openShield()` method (toggles shield visibility/model).
    *   [ ] Implement `KoroEntity.closeShield()` method.
    *   [ ] Implement `KoroEntity.isShieldOpen()` method.
    *   [ ] Add command `/koro openshield` for testing.
    *   [ ] Add command `/koro closeshield` for testing.
*   **Outcome Goal:** KORO is visible, its shield can be visually opened/closed via commands. Player health is manageable for testing.

## Phase 2: Player Inventory & Basic UI

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/managers/UIManager.ts`, `assets/ui/index.html`.
*   **Tasks:**
    *   [ ] Add an inventory array (`_inventory`) to `GamePlayerEntity` (define max size).
    *   [ ] Create basic UI elements in `index.html` for inventory slots (placeholders).
    *   [ ] Create `UIManager` class.
    *   [ ] Implement `UIManager.updateInventoryUI(player, inventoryData)` to send data to the client UI.
    *   [ ] Add client-side JS in `index.html` to receive inventory data and update slot display.
    *   [ ] Call `updateInventoryUI` from `GamePlayerEntity` whenever its inventory changes.
*   **Outcome Goal:** Players have an inventory array, and its basic state (items/empty slots) is visible on their screen.

## Phase 3: Item Spawning & Management

*   **Focus:** `classes/managers/ItemManager.ts`, Specific `classes/items/` subclasses.
*   **Tasks:**
    *   [ ] Create `ItemManager` class.
    *   [ ] Define item spawn locations (can be hardcoded list initially).
    *   [ ] Implement `ItemManager` logic to spawn specific items (Gel, Coat, Cards, etc.) based on rules (max count, e.g., only 1 maintenance card).
    *   [ ] Implement random location selection from the defined list for spawns.
    *   [ ] Implement spawn cooldown logic for specific items (e.g., maintenance card).
    *   [ ] Implement despawn timers for items spawned in the world.
    *   [ ] Create `BaseItem` entity class.
    *   [ ] Create specific item subclasses inheriting from `BaseItem` (e.g., `CoolingGelItem`, `MaintenanceCardItem`, `WeaponItem`, `FlashlightItem`).
    *   [ ] Add command `/spawnitem <itemId>` for testing specific item spawns.
*   **Outcome Goal:** Items (Gel, Coat, Cards, Weapon, Flashlight) appear in the world according to basic rules and disappear after a set time.

## Phase 4: Core Item Interactions (Pickup, Drop, Share)

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/items/BaseItem.ts`.
*   **Tasks:**
    *   [ ] Implement interaction raycasting triggered by the 'E' key in `GamePlayerEntity`.
    *   [ ] Implement `GamePlayerEntity.pickup(item)` logic: check inventory space, add `ItemEntity` reference to inventory array, update UI, despawn world entity.
    *   [ ] Implement `GamePlayerEntity.dropActiveItem()` logic: get selected item from inventory, remove reference, update UI, spawn corresponding `ItemEntity` in the world with physics velocity.
    *   [ ] Implement Item Sharing:
        *   [ ] Extend interaction ('E' key) raycast to check if target is another `GamePlayerEntity` within range.
        *   [ ] If player hit, get activating player's *currently selected* item.
        *   [ ] Check if target player has inventory space.
        *   [ ] If space exists, remove item from activator's inventory, add to target's inventory.
        *   [ ] Update UI for both players.
*   **Outcome Goal:** Players can pick up items into their inventory, drop their selected item, and give their selected item to another player nearby.

## Phase 5: Implement ONE Full Attack Slice (e.g., Superheat)

*   **Focus:** Multiple Managers (`AttackManager`, `UIManager`, `AudioManager`, `EffectsManager`, `AnnouncerManager`), Attack (`SuperheatAttack`), Entities (`GamePlayerEntity`, `KoroEntity`, `ThermalPanelEntity`), Items (`CoolingGelItem`, `HeatingPanelCardItem`).
*   **Tasks:**
    *   **Attack Management:**
        *   [ ] Create `AttackManager` class.
        *   [ ] Create `BaseEnvironmentalAttack` abstract class.
        *   [ ] Create `SuperheatAttack` class inheriting from `BaseEnvironmentalAttack`, including duration logic.
        *   [ ] Add command `/triggerattack superheat`.
    *   **Supporting Managers:**
        *   [ ] Create `AudioManager` class.
        *   [ ] Create `EffectsManager` class.
        *   [ ] Create `AnnouncerManager` class.
        *   [ ] Add `UIManager.updateTemperature(temp)` method.
        *   [ ] Add `AnnouncerManager.broadcast("Superheating...")` method (sends chat message initially).
        *   [ ] Add `EffectsManager.applyHeatTint()` method (basic screen color change).
        *   [ ] Add `AudioManager.playHeatWarningSound()`, `playBurnSound()` methods (placeholder sounds ok).
    *   **Player Effects & Protection:**
        *   [ ] Add `_isHeatProtected` boolean flag to `GamePlayerEntity`.
        *   [ ] Add `takeEnvironmentalDamage(amount)` method to `GamePlayerEntity`.
        *   [ ] Implement `CoolingGelItem.consume()`: Set `_isHeatProtected = true` on player, set timeout to revert flag.
        *   [ ] In `AttackManager` or `SuperheatAttack`'s tick logic, check `_isHeatProtected` before calling `takeEnvironmentalDamage`.
    *   **UI:**
        *   [ ] Add temperature display element to `index.html`.
        *   [ ] Add client-side JS to update temperature display via `UIManager`.
    *   **Interaction & Redirection:**
        *   [ ] Create `ThermalPanelEntity` and place it in the world.
        *   [ ] Create `HeatingPanelCardItem`.
        *   [ ] Implement `ThermalPanelEntity.interact()`:
            *   [ ] Check if `SuperheatAttack` is active (via `AttackManager`).
            *   [ ] Check if interacting player has `HeatingPanelCardItem` in inventory.
            *   [ ] If checks pass: consume card, call `KoroEntity.applyBurnDamage(duration)` (add this method to Koro), potentially call `KoroEntity.openShield(duration)`.
*   **Outcome Goal:** The Superheat attack sequence works end-to-end: triggers, affects environment/UI/audio, damages unprotected players, Gel protects, Panel + Card redirects (applies burn to KORO, might open shield). Supporting managers are established.

## Phase 6: Implement Other Attacks

*   **Focus:** New Attack classes (`SupercoolAttack`, `UvAttack`, `DarknessAttack`), related Panel entities (`CryoPanelEntity`), Items (`CoatItem`, `SunscreenItem`, `CoolingPanelCardItem`, `FlashlightItem`). Leverage existing Managers.
*   **Tasks:**
    *   [ ] Create `SupercoolAttack` class: Implement logic, effects (blue tint via `EffectsManager`), audio (`AudioManager`), UI (`UIManager.updateTemperature`), damage (`GamePlayerEntity.takeEnvironmentalDamage`), protection (`CoatItem` consumption sets `_isColdProtected` flag).
    *   [ ] Create `CryoPanelEntity` and `CoolingPanelCardItem`. Implement redirection logic in panel (`check attack active`, `check card`, `consume`, `KoroEntity.applyFreezeStun(duration)` (add method), `KoroEntity.openShield(duration)`).
    *   [ ] Create `UvAttack` class: Implement logic, effects (purple tint?), audio, UI (`UIManager.updateRadiationLevel`), damage, protection (`SunscreenItem` consumption sets `_isUvProtected` flag). (No panel redirection for this one based on plan).
    *   [ ] Create `DarknessAttack` class: Implement logic (`EffectsManager.setGlobalLight(0)`), audio/announcer.
    *   [ ] Implement `FlashlightItem` logic (toggle a light source component when equipped/active).
    *   [ ] (Optional/Clarify): Implement interaction for using a card during Darkness to restore light (maybe via Maintenance Panel?).
*   **Outcome Goal:** All environmental attacks (Heat, Cold, UV, Darkness) are functional with their respective effects, damage, player protections, and panel interactions (for Heat/Cold).

## Phase 7: Implement Remaining Interactions & Core Damage

*   **Focus:** `MaintenancePanelEntity`, `MaintenanceCardItem`, `WeaponItem`, `KoroEntity`.
*   **Tasks:**
    *   [ ] Create `MaintenancePanelEntity` and place it in the world.
    *   [ ] Implement `MaintenancePanelEntity.interact()`:
        *   [ ] Check if player has `MaintenanceCardItem`.
        *   [ ] Implement cooldown mechanism (e.g., timestamp on panel, or limit card spawns).
        *   [ ] If checks pass & cooldown ready: consume card, call `KoroEntity.openShield(duration)`, set cooldown.
    *   [ ] Implement `KoroEntity.takeHealthDamage(amount)` method.
    *   [ ] Add health property to `KoroEntity`.
    *   [ ] Implement `WeaponItem` firing logic:
        *   [ ] Perform raycast.
        *   [ ] If hit target is `KoroEntity`, check `KoroEntity.isShieldOpen()`.
        *   [ ] If shield open, call `KoroEntity.takeHealthDamage()`.
    *   [ ] Implement KORO's random malfunction: Add a timer/chance in `KoroEntity`'s tick to occasionally call `openShield()` itself.
    *   [ ] Implement "KORO EXPOSED" alert: Call `UIManager.showGlobalAlert("KORO EXPOSED!")` whenever `KoroEntity.openShield()` is successfully called. Add necessary UI element and client-side JS.
*   **Outcome Goal:** The primary damage loop is complete. Players can force KORO's shield open via the Maintenance Panel & Card, or benefit from redirects/malfunctions, and then deal health damage with weapons.

## Phase 8: AI Integration & Polish

*   **Focus:** `classes/ai/KoroAiManager.ts`, `AudioManager` (TTS), `KoroEntity` (voice degradation), general polish.
*   **Tasks:**
    *   **AI Core:**
        *   [ ] Create `KoroAiManager` class.
        *   [ ] Define data structure for game state snapshot (player info, KORO state, item locations, panel states, active attack).
        *   [ ] Implement function(s) to gather this snapshot data.
        *   [ ] Set up Gemini API connection in `KoroAiManager`.
        *   [ ] Implement the main AI loop: Get snapshot -> Format prompt -> Send to LLM -> Parse response.
        *   [ ] Implement response parsing to trigger actions:
            *   `AttackManager.startAttack(attackId)`
            *   `AudioManager.speakKoro(text)` (placeholder for TTS initially)
            *   `KoroEntity.openShield()` (for self-maintenance/malfunction decisions)
    *   **Audio Polish:**
        *   [ ] Integrate Replicate API for "kokoro" TTS via `AudioManager.speakKoro()`.
        *   [ ] Add configurable delay for TTS playback.
        *   [ ] Implement voice degradation based on `KoroEntity` health (modify TTS parameters or apply post-processing).
        *   [ ] Replace placeholder SFX with final audio assets.
    *   **Visual Polish:**
        *   [ ] Refine screen tints and add particle effects via `EffectsManager`.
        *   [ ] Add specific visual effects for shield opening/closing, panel activation, KORO taking damage.
    *   **UI Polish:**
        *   [ ] Finalize UI layout for clarity and mobile compatibility.
        *   [ ] Ensure all necessary information (timers, cooldowns, health, status) is clearly displayed.
*   **Outcome Goal:** KORO dynamically chooses attacks and speaks via LLM. TTS and voice degradation are implemented. Visuals and audio are polished. The game loop feels complete and driven by KORO's AI.