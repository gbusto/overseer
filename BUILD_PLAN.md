# Development Plan Checklist: Genesis Protocol Failure (Simplified)

This plan follows a user-centric approach, building core interactions first and integrating supporting systems in vertical slices.

## Phase 1: Core Entities Setup (Player & KORO)

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/entities/KoroEntity.ts`.
*   **Tasks:**
    *   [x] Verify `GamePlayerEntity` spawns correctly.
    *   [x] Verify `GamePlayerEntity` has health and `takeDamage` works.
    *   [x] Add command `/sethealth <player> <amount>` for testing player health.
    *   [x] Implement `KoroEntity` class.
    *   [x] Add shield model (e.g., two hemispheres) to `KoroEntity`.
    *   [x] Implement `KoroEntity.openShield()` method (toggles shield visibility/model).
    *   [x] Implement `KoroEntity.closeShield()` method.
    *   [x] Implement `KoroEntity.isShieldOpen()` method.
    *   [x] Add command `/koro openshield` for testing.
    *   [x] Add command `/koro closeshield` for testing.
*   **Outcome Goal:** KORO is visible, its shield can be visually opened/closed via commands. Player health is manageable for testing.

## Phase 2: Player Inventory System

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/managers/UIManager.ts`, `assets/ui/index.html`.
*   **Tasks:**
    *   [ ] Add inventory system to `GamePlayerEntity`:
        *   [ ] Implement backpack array with 3 slots (`_backpackInventory`)
        *   [ ] Implement hand item slot (`_handItem`)
        *   [ ] Add methods to manage this 3+1 inventory (add, remove, swap between backpack and hand)
    *   [ ] Create basic UI elements in `index.html` for:
        *   [ ] Health display (using existing player health)
        *   [ ] 3 backpack inventory slots
        *   [ ] 1 hand inventory slot (visually distinct)
    *   [ ] Create `UIManager` class.
    *   [ ] Implement `UIManager.updateHealthUI(player, healthValue)` to send health data to client UI.
    *   [ ] Implement `UIManager.updateInventoryUI(player, inventoryData)` to send full inventory state.
    *   [ ] Add client-side JS in `index.html` to receive and display health and inventory.
    *   [ ] Add methods to highlight active/selected inventory slot.
    *   [ ] Call update methods from `GamePlayerEntity` whenever values change.
*   **Outcome Goal:** Players have health display and 3+1 inventory system visible on their screen, with clear display of which items are in backpack vs. held in hand.

## Phase 3: Item Spawning & Management

*   **Focus:** `classes/managers/ItemManager.ts`, Specific `classes/items/` subclasses.
*   **Tasks:**
    *   [ ] Create `ItemManager` class.
    *   [ ] Define item spawn locations (can be hardcoded list initially).
    *   [ ] Implement `ItemManager` logic to spawn specific items (Health Pack, Control Panel Cards, Weapons, Flashlight) based on rules.
    *   [ ] Implement random location selection from the defined list for spawns.
    *   [ ] Implement spawn cooldown logic for control panel cards (only one of each type at a time).
    *   [ ] Implement despawn timers for items spawned in the world (except weapons and flashlight).
    *   [ ] Create `BaseItem` entity class.
    *   [ ] Create specific item subclasses:
        *   [ ] `HealthPackItem` - Restores player health
        *   [ ] `HeatPanelCardItem` - Used for heat redirection
        *   [ ] `CoolPanelCardItem` - Used for cooling redirection
        *   [ ] `MaintenanceCardItem` - Used to force shield open
        *   [ ] `WeaponItem` - Energy weapon (non-despawning)
        *   [ ] `FlashlightItem` - Light source (non-despawning)
    *   [ ] Add command `/spawnitem <itemId>` for testing specific item spawns.
*   **Outcome Goal:** Items appear in the world according to rules. Control cards and health packs despawn after time, weapons and flashlight never despawn.

## Phase 4: Core Item Interactions (Pickup, Drop, Share)

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/items/BaseItem.ts`.
*   **Tasks:**
    *   [ ] Implement interaction raycasting triggered by the 'E' key in `GamePlayerEntity`.
    *   [ ] Implement `GamePlayerEntity.pickup(item)` logic:
        *   [ ] Check if hand is empty - if yes, add item to hand
        *   [ ] If hand is full, check backpack space and add to first empty slot
        *   [ ] Update UI
        *   [ ] Despawn entity (if not weapon/flashlight)
    *   [ ] Implement item cycling/selection between inventory slots:
        *   [ ] Add method to cycle through backpack slots and hand slot
        *   [ ] Add method to directly select a specific slot
        *   [ ] Update UI to highlight currently selected slot
    *   [ ] Implement `GamePlayerEntity.dropSelectedItem()` logic:
        *   [ ] Check which slot is selected (hand or backpack)
        *   [ ] Remove item from that slot
        *   [ ] Update UI
        *   [ ] Spawn item in world with physics
    *   [ ] Implement `HealthPackItem.consume()` method: increase player's health when used.
    *   [ ] Implement Item Sharing:
        *   [ ] Extend interaction ('E' key) raycast to check if target is another `GamePlayerEntity` within range
        *   [ ] If player hit, check which item is currently selected (hand or backpack slot)
        *   [ ] Check if target player has inventory space (backpack or hand)
        *   [ ] Transfer selected item between players
        *   [ ] Update UI for both players
        *   [ ] Add visual/audio feedback for successful item transfer
    *   [ ] Add optional notification system for successful pickup, drop, and share actions.
*   **Outcome Goal:** Players can pick up items into hand or backpack, cycle/select between inventory slots, drop selected items, and share items with nearby players. The 3+1 inventory creates strategic decisions about what to carry.

## Phase 5: Implement ONE Full Attack Slice (e.g., Superheat)

*   **Focus:** Multiple Managers, Attack, Entities, Items.
*   **Tasks:**
    *   **Attack Management:**
        *   [ ] Create `AttackManager` class.
        *   [ ] Create `BaseEnvironmentalAttack` abstract class.
        *   [ ] Create `SuperheatAttack` class, including duration logic.
        *   [ ] Add command `/triggerattack superheat`.
    *   **Supporting Managers:**
        *   [ ] Create `AudioManager`, `EffectsManager`, `AnnouncerManager` classes.
        *   [ ] Add `UIManager.updateTemperature(temp)` method.
        *   [ ] Add `AnnouncerManager.broadcast("Superheating...")` method.
        *   [ ] Add `EffectsManager.applyHeatTint()` method (screen color change).
        *   [ ] Add `AudioManager.playHeatWarningSound()`, `playDamageSound()` methods.
    *   **Player Effects & Damage:**
        *   [ ] Implement direct environmental damage:
            *   [ ] Add `takeEnvironmentalDamage(amount)` method to `GamePlayerEntity`.
            *   [ ] In `SuperheatAttack`'s tick logic, call `takeEnvironmentalDamage` with fixed damage amount.
    *   **UI:**
        *   [ ] Add temperature display element to `index.html`.
        *   [ ] Add client-side JS to update temperature display.
    *   **Interaction & Redirection:**
        *   [ ] Create `ThermalPanelEntity` and place it in the world.
        *   [ ] Create `HeatPanelCardItem`.
        *   [ ] Implement `ThermalPanelEntity.interact()`:
            *   [ ] Check if `SuperheatAttack` is active (via `AttackManager`).
            *   [ ] Check if interacting player has `HeatPanelCardItem` in selected inventory slot.
            *   [ ] If checks pass: consume card, call `KoroEntity.applyBurnDamage(duration)`, call `KoroEntity.openShield(duration)`.
*   **Outcome Goal:** Superheat attack works end-to-end: triggers, affects environment/UI/audio, damages players, can be redirected to hurt KORO using a card from inventory.

## Phase 6: Implement Other Attacks

*   **Focus:** New Attack classes, related Panel entities, Items. Leverage existing Managers.
*   **Tasks:**
    *   [ ] Create `SupercoolAttack` class: Implement logic, effects (blue tint), audio, UI updates, direct damage.
    *   [ ] Create `CryoPanelEntity` and `CoolPanelCardItem`. Implement redirection logic in panel to stun KORO.
    *   [ ] Create `UvAttack` class: Implement logic, effects (purple tint), audio, UI updates, direct damage.
    *   [ ] Create `DarknessAttack` class: Implement logic (set global light to 0), audio/announcer.
    *   [ ] Implement `FlashlightItem` logic (toggle a light source component when equipped/active in hand slot).
*   **Outcome Goal:** All environmental attacks are functional with respective effects and dealing direct damage to players. Strategic inventory management becomes important for surviving different attacks.

## Phase 7: Implement Remaining Interactions & Core Damage

*   **Focus:** `MaintenancePanelEntity`, `MaintenanceCardItem`, `WeaponItem`, `KoroEntity`.
*   **Tasks:**
    *   [ ] Create `MaintenancePanelEntity` and place it in the world.
    *   [ ] Implement `MaintenancePanelEntity.interact()`:
        *   [ ] Check if player has `MaintenanceCardItem` in selected inventory slot.
        *   [ ] Implement cooldown mechanism.
        *   [ ] If checks pass & cooldown ready: consume card, call `KoroEntity.openShield(duration)`, set cooldown.
    *   [ ] Implement `KoroEntity.takeHealthDamage(amount)` method.
    *   [ ] Add health property to `KoroEntity`.
    *   [ ] Implement `WeaponItem` firing logic:
        *   [ ] Check if weapon is in hand slot (not backpack)
        *   [ ] Perform raycast.
        *   [ ] If hit target is `KoroEntity`, check `KoroEntity.isShieldOpen()`.
        *   [ ] If shield open, call `KoroEntity.takeHealthDamage()`.
    *   [ ] Implement KORO's random malfunction: Add a timer/chance in `KoroEntity`'s tick to occasionally call `openShield()` itself.
    *   [ ] Implement "KORO EXPOSED" alert: Call `UIManager.showGlobalAlert("KORO EXPOSED!")` whenever shield opens.
*   **Outcome Goal:** The primary damage loop is complete. Players can force KORO's shield open using maintenance cards from inventory and deal health damage with weapons when held in hand.

## Phase 8: AI Integration & Polish

*   **Focus:** `classes/ai/KoroAiManager.ts`, `AudioManager` (TTS), `KoroEntity` (voice degradation), general polish.
*   **Tasks:**
    *   **AI Core:**
        *   [ ] Create `KoroAiManager` class.
        *   [ ] Define data structure for game state snapshot.
        *   [ ] Implement function(s) to gather snapshot data.
        *   [ ] Set up Gemini API connection in `KoroAiManager`.
        *   [ ] Implement the main AI loop: Get snapshot -> Format prompt -> Send to LLM -> Parse response.
        *   [ ] Implement response parsing to trigger actions.
    *   **Audio Polish:**
        *   [ ] Integrate Replicate API for "kokoro" TTS via `AudioManager.speakKoro()`.
        *   [ ] Add configurable delay for TTS playback.
        *   [ ] Implement voice degradation based on `KoroEntity` health.
        *   [ ] Replace placeholder SFX with final audio assets.
    *   **Visual Polish:**
        *   [ ] Refine screen tints and add particle effects.
        *   [ ] Add specific visual effects for shield opening/closing, panel activation, KORO taking damage.
    *   **UI Polish:**
        *   [ ] Finalize UI layout for clarity and mobile compatibility.
        *   [ ] Ensure all necessary information (health, timers, cooldowns, status) is clearly displayed.
        *   [ ] Polish inventory UI with clearer slot indicators and selection highlighting.
*   **Outcome Goal:** KORO dynamically chooses attacks and speaks via LLM. TTS and voice degradation are implemented. Visuals and audio are polished. The game loop feels complete and driven by KORO's AI.