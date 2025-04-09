## NEW PLAN FROM GEMINI - SIMPLIFIED VERSION

**I. Core Concept & Lore: "Genesis Protocol Failure"**

* **Setting:** Genesis Biodome Delta, isolated experimental facility.
* **AI:** K.O.R.O., the ceiling-mounted, bureaucratic, damaged AI manager, viewing players as anomalies.
* **Player Role:** Trapped survivors/intruders fighting KORO.
* **Match Structure:** Untimed, focusing on survival and executing specific strategies to damage KORO.
* **Goal:** Survive and disable KORO.

**II. The Overseer (KORO): Functionality & Attacks**

* **AI Driver:** Gemini 2.0 Flash LLM.
* **Communication:** Instant on-screen text; delayed TTS voice (Replicate API "kokoro" model) justified by lore; degrading voice with damage; instant SFX for critical hits/events.
* **Defense:** Protected by a **Retractable Metal Barrier/Armor**.
* **Attacks (Timed Hazards):** Uses environmental systems for timed attacks (~15s duration) that players must survive. Includes: Superheat, Deep Freeze, Blackout, Intense UV Light Purge.

**III. Core Gameplay Loop & Player Actions**

1.  **Survive Environmental Hazards:** Players take damage from KORO's environmental attacks. They must find and use **Health Packs** to restore their health and survive.

2.  **Damage/Debuff via Attack Redirection (Requires Coordination during Attack):**
    * **During Superheat Attack:** Players must find and activate the designated **"Thermal Exhaust Reroute" Panel** using a **Heat Vent Control Panel Card**. *Successful Activation:* Redirects intense heat onto KORO, causing direct **burn damage** over time.
    * **During Deep Freeze Attack:** Players must find and activate the designated **"Cryo-Coolant Injector" Panel** using a **Cooling Vent Control Panel Card**. *Successful Activation:* Overloads KORO with cold, causing it to **temporarily freeze/stun**, becoming immobile and unable to attack for a few seconds (creating a brief vulnerability window).

3.  **Damage via Forced Maintenance (Proactive):**
    * Players find consumable **"Maintenance Control Panel Cards"** spawned in the Biodome. They take a card to the **"Maintenance Override Port"** and use it. *Successful Activation:* KORO's **Metal Barrier fully retracts for a significant duration (e.g., 15 seconds)**.
    * KORO *may* occasionally retract its barrier for its own self-initiated maintenance cycle.

4.  **Deal Gun Damage:** During the windows created by the **Maintenance Override (Card Use or Self-Initiated)**, or potentially during the brief **Freeze Stun**, players use their **Energy-Based Weapons** to shoot KORO's exposed core/components. This is the primary way to deplete its main health bar.

5.  **Resource Management:** Find **Health Packs** to restore health, collect control panel cards, and strategically use guns.

6.  **Repeat:** Cycle through surviving KORO's attacks, executing redirection or override strategies, and dealing damage until KORO is defeated.

**IV. Key Systems & Items**

* **KORO's Defense:** Retractable Metal Barrier.
* **Player Offensive Interactions (3 Distinct Panels/Ports):**
    1.  **Thermal Exhaust Reroute Panel:** Active during Heat; redirects heat for burn damage.
    2.  **Cryo-Coolant Injector Panel:** Active during Freeze; redirects cold for freeze/stun effect.
    3.  **Maintenance Override Port:** Active anytime with card; accepts Maintenance Card to force barrier open for gun damage.
* **Key Items (Simplified):**
    * **Heat Vent Control Panel Cards:** Used to redirect heat attacks
    * **Cooling Vent Control Panel Cards:** Used to redirect cooling attacks
    * **Maintenance Control Panel Cards:** Used to force KORO to expose itself
    * **Health Packs:** Restore player health
    * **Energy-Based Weapons:** 3 weapons that never despawn, used for dealing direct health damage
    * **Flashlight:** Single item that never despawn, helps navigate during blackout attacks
* **Inventory System:** Each player has a **3+1 inventory** (3 backpack slots plus one item held in hand), creating important strategic decisions about what to carry

**V. Other Mechanics**

* **Traitor Mechanic:** Details on hold, but hoarding control panel cards and sabotaging panel activations are key potential actions.
* **Item Sharing:** Players can directly transfer items to nearby players, enabling cooperation and coordination.
* **LLM Trickery (Chat):** Possible future addition, not core loop.

**VI. Key Technical Aspects**

* **LLM:** Gemini 2.0 Flash.
* **TTS:** Replicate API using the "kokoro" model.

### Items (Simplified)
- Health packs (restore player health); spawns randomly
- Heat vent control panel card; spawns randomly; no more than one at a time
- Cooling vent control panel card; spawns randomly; no more than one at a time
- Maintenance control panel card; spawns randomly; no more than one at a time
- 3 Energy weapons (scattered around the map; never despawn, just regenerate energy)
- 1 Flashlight (helps during darkness attacks; never despawns)

### Inventory Management
- Players have 3 backpack inventory slots plus one item they can hold in hand (4 total)
- Strategic decisions must be made about what to carry:
  - Carrying multiple control cards means being ready for different attacks
  - Carrying health packs means being able to heal when damaged
  - Carrying weapons means being ready to damage KORO when exposed
  - Carrying the flashlight helps during darkness attacks
- Players can share items with nearby teammates by transferring directly to their inventory
- Team coordination around who carries what items is critical for success

### Attacks from KORO
- Superheating
    - UI: show biodome temperature; increases rapidly; ambient lighting turns red to indicate heat
    - Audio: announcer announces super heating enabled; damage sounds if player is taking damage
    - Player: takes direct damage from the heat attack
- Supercooling
    - UI: show biodome temperature; decreases rapidly; ambient lighting turns icy blue to indicate cooling
    - Audio: announcer mentions supercooling enabled; damage sounds if player is taking damage
    - Player: takes direct damage from the cold attack
- High UV
    - UI: show biodome radiation level; ambient lighting turns bright purple to indicate UV
    - Audio: announcer announces this; radiation sounds if player is taking damage
    - Player: takes direct damage from the UV attack
- Total Darkness
    - UI: basically set all lighting to ZERO
    - Audio: announcer mentions darkness
    - Player: a single flashlight helps navigate to control panels

### KORO
- Has a shield that protects it; looks like a steel ball but is made up of 2 semispheres
- When KORO is exposed, the ball shield opens up and exposes KORO
    - When KORO is exposed, show text on screen to let players know
    - KORO may react to this as well
- When KORO returns to normal, the shield should close again
- Shield protects against all projectile attacks
    - Shield opens up when:
        - Maintenance card is used
        - Supercooling is redirected to KORO by players
        - Superheating is redirected to KORO by players
        - KORO may occasionally malfunction and expose itself unintentionally
- When damaged, its voice becomes crazier and more broken

### Player actions / game mechanics
- Players have health that decreases when taking damage from attacks
- Players can heal with health packs
- Players must manage their limited inventory (3+1 slots) to carry the right items for the situation
- Players can share items directly with teammates
- There will be 3 panels in the game:
    1. A panel that opens up heat vents that go directly to KORO (must use heat vent control panel card)
    2. A panel that opens up cooling vents to redirect to KORO (must use cooling vent control panel card)
    3. A maintenance panel that forces KORO to expose itself (must use maintenance control panel card)
- When a superheating attack is going on, users should be notified on screen that they can stop the attack and hurt KORO
- When a supercooling attack is going on, users should be notified on screen that they can redirect the cold to KORO
- Whenever KORO gets exposed, we should pop up some kind of alert on screen

### Loose game loop
A loose game loop might look something like this:
- KORO gets data
- KORO potentially takes action and/or speaks
- Update game for the action KORO is taking
- Items spawn
- Analyze player actions to see if they have an impact on KORO

## Proposed Development Plan (User-Centric Approach)

This plan focuses on building core interactive elements first and integrating supporting systems as needed for vertical feature slices.

**Phase 1: Core Entities Setup (Player & KORO)**

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/entities/KoroEntity.ts`.
*   **Tasks:**
    *   Ensure `GamePlayerEntity` spawns correctly, has health (verify damage taking works or add it). Add command `/sethealth <player> <amount>`.
    *   Implement `KoroEntity` with its shield model (e.g., two hemispheres).
    *   Add simple state methods: `openShield()`, `closeShield()`, `isShieldOpen()` that toggle shield visibility/model.
    *   Add commands: `/koro openshield`, `/koro closeshield`.
*   **Outcome:** KORO is visible, its shield can be visually opened/closed via commands. Player health is manageable for testing.

**Phase 2: Player Inventory & Basic UI**

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/managers/UIManager.ts`, `assets/ui/index.html`.
*   **Tasks:**
    *   Add an inventory array (`_inventory`) to `GamePlayerEntity`.
    *   Create basic UI elements in `index.html` for inventory slots.
    *   Implement `UIManager` functions to update the inventory display (`updateInventoryUI(player, inventoryData)`).
    *   Call the UI update from `GamePlayerEntity` whenever its inventory changes.
*   **Outcome:** Players have an inventory, and its basic representation is visible on screen.

**Phase 3: Item Spawning & Management**

*   **Focus:** `classes/managers/ItemManager.ts`, Specific `classes/items/` subclasses (e.g., `CoolingGelItem.ts`, `MaintenanceCardItem.ts`).
*   **Tasks:**
    *   Implement `ItemManager` with logic to spawn items based on your rules (max count, random location from a predefined list, cooldowns for cards).
    *   Implement despawn timers for items.
    *   Create the actual `ItemEntity` subclasses.
    *   Add command `/spawnitem <itemId>` for testing.
*   **Outcome:** Items appear in the world according to rules and disappear after a time.

**Phase 4: Core Item Interactions (Pickup, Drop, Share)**

*   **Focus:** `classes/entities/GamePlayerEntity.ts`, `classes/items/BaseItem.ts`.
*   **Tasks:**
    *   Implement `pickup(item)` logic in `GamePlayerEntity` (add to inventory, update UI, despawn world entity). Add interaction raycasting (using 'E' key).
    *   Implement `dropActiveItem()` logic (remove from inventory, update UI, spawn world entity with velocity).
    *   Implement Item Sharing:
        *   Add raycast logic triggered by interact key ('E').
        *   Check if raycast hits another `GamePlayerEntity` within close range.
        *   If hit, transfer the *currently selected* item from the activating player's inventory to the target player's inventory (checking if the target has space). Update UI for both.
*   **Outcome:** Players can pick up, drop, and give items to nearby players.

**Phase 5: Implement ONE Full Attack Slice (e.g., Superheat)**

*   **Focus:** `classes/managers/AttackManager.ts`, `classes/attacks/SuperheatAttack.ts`, `UIManager.ts`, `AudioManager.ts`, `EffectsManager.ts`, `AnnouncerManager.ts`, `GamePlayerEntity.ts`, `CoolingGelItem.ts`, `ThermalPanelEntity.ts`, `HeatingPanelCardItem.ts`.
*   **Tasks:**
    *   Create the `AttackManager` and the specific `SuperheatAttack` class. Add logic for duration.
    *   Implement `UIManager.updateTemperature(temp)` and display it.
    *   Implement `AnnouncerManager.broadcast("Superheating...")`.
    *   Implement `EffectsManager.applyHeatTint()`.
    *   Implement `AudioManager.playHeatWarningSound()`, `playBurnSound()`.
    *   In `GamePlayerEntity`, add `takeHeatDamage(amount)` method and a temporary state flag `_isHeatProtected`.
    *   In `CoolingGelItem.consume()`, set the `_isHeatProtected` flag on the player for a duration.
    *   In `AttackManager` (or the attack class), check player protection flag before applying damage.
    *   Implement `ThermalPanelEntity.interact()` logic: check for heat attack active, check player has card, consume card, call `KoroEntity.applyBurnDamage()`, maybe `KoroEntity.openShield()`.
    *   Add command `/triggerattack superheat`.
*   **Outcome:** The Superheat attack runs, affects UI/audio/visuals, damages unprotected players, can be countered by consuming Gel, and can be redirected via the panel (potentially opening KORO's shield). The supporting managers (`UI`, `Audio`, `Effects`, `Announcer`) are now functional for this slice.

**Phase 6: Implement Other Attacks**

*   **Focus:** Add `classes/attacks/SupercoolAttack.ts`, `UvAttack.ts`, `DarknessAttack.ts`, etc.
*   **Tasks:** Leverage the now-existing `UIManager`, `AudioManager`, `EffectsManager`, `AnnouncerManager`. Add specific logic, sounds, effects, UI updates, and player damage/protection states for each new attack. Implement the corresponding panel interactions (`CryoPanelEntity`, etc.).
*   **Outcome:** All of KORO's environmental attacks are functional.

**Phase 7: Implement Remaining Interactions & Core Damage**

*   **Focus:** `classes/entities/MaintenancePanelEntity.ts`, `classes/items/MaintenanceCardItem.ts`, `classes/items/WeaponItem.ts`, `classes/entities/KoroEntity.ts`.
*   **Tasks:**
    *   Implement `MaintenancePanelEntity.interact()` logic (check card, consume, call `KoroEntity.openShield()`). Add cooldown.
    *   Implement `WeaponItem` firing logic to check if target is KORO and if `KoroEntity.isShieldOpen()` is true, then call `KoroEntity.takeHealthDamage()`.
    *   Add KORO's health logic and the "malfunction" random shield opening.
    *   Ensure "KORO EXPOSED" alerts trigger correctly via `UIManager`.
*   **Outcome:** Players can now directly damage KORO's health via the maintenance override or attack redirections.

**Phase 8: AI Integration & Polish**

*   **Focus:** `classes/ai/KoroAiManager.ts`, `classes/managers/AudioManager.ts` (TTS), `classes/entities/KoroEntity.ts` (voice degradation), general polish.
*   **Tasks:** Implement the KORO AI loop, connect TTS, add voice degradation effects, refine UI/SFX/VFX.
*   **Outcome:** The game has its core loop driven by AI, includes polished effects and audio, and is ready for broader testing.

**Core Systems/Managers Overview:**

1.  **`GameManager`:** Overall game state, player join/leave.
2.  **`ItemManager`:** Spawning, despawning, and managing world items.
3.  **`AttackManager`:** Initiating and tracking KORO's environmental attacks.
4.  **`UIManager`:** Sending updates to the HTML UI.
5.  **`AudioManager`:** Handling all SFX, music, KORO TTS, and Announcer TTS.
6.  **`EffectsManager`:** Managing visual effects (particles, screen tints).
7.  **`AnnouncerManager`:** Triggering official-sounding biodome announcements.
8.  **`KoroAiManager`:** (Later Phase) AI decision-making loop.