## NEW PLAN FROM GEMINI

Okay, decision made! Let's lock in this direction, bringing back attack redirection alongside the forced maintenance override. It definitely adds unique interaction layers back into the mix.

Here is the updated summary reflecting this specific plan:

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
* **Attacks (Timed Hazards):** Uses environmental systems for timed attacks (~15s duration) that players must survive using items. Includes: Superheat, Deep Freeze, Blackout, Intense UV Light Purge, (possibly Oxygen Depletion).

**III. Core Gameplay Loop & Player Actions**

1.  **Survive Environmental Hazards:** Use appropriate **Consumable Protective Items** (Cooling Gel, Thermal Coat, Goggles/Sunscreen, O2 Mask etc.) to withstand KORO's timed environmental attacks.
2.  **Damage/Debuff via Attack Redirection (Requires Coordination during Attack):**
    * **During Superheat Attack:** Players must find and activate the designated **"Thermal Exhaust Reroute" Panel**. *Successful Activation:* Redirects intense heat onto KORO, causing direct **burn damage** over time.
    * **During Deep Freeze Attack:** Players must find and activate the designated **"Cryo-Coolant Injector" Panel**. *Successful Activation:* Overloads KORO with cold, causing it to **temporarily freeze/stun**, becoming immobile and unable to attack for a few seconds (creating a brief vulnerability window).
3.  **Damage via Forced Maintenance (Proactive & Reactive):**
    * **Proactive:** Players find consumable **"Override Cards"** spawned in the Biodome. They take a card to the **"Maintenance Override Port"** and use it. *Successful Activation:* KORO's **Metal Barrier fully retracts for a significant duration (e.g., 15 seconds)**.
    * **Reactive:** KORO *may* occasionally retract its barrier for its own self-initiated maintenance cycle.
4.  **Deal Gun Damage:** During the windows created by the **Maintenance Override (Card Use or Self-Initiated)**, or potentially during the brief **Freeze Stun**, players use their **Energy-Based Weapons** to shoot KORO's exposed core/components. This is the primary way to deplete its main health bar.
5.  **Resource Management:** Gather **Energy** (powers weapons), find **Protective Consumables**, and locate **Override Cards**.
6.  **Repeat:** Cycle through surviving KORO's attacks, executing redirection or override strategies, and dealing damage until KORO is defeated.

**IV. Key Systems & Items**

* **KORO's Defense:** Retractable Metal Barrier.
* **Player Offensive Interactions (3 Distinct Panels/Ports):**
    1.  **Thermal Exhaust Reroute Panel:** Active during Heat; redirects heat for burn damage.
    2.  **Cryo-Coolant Injector Panel:** Active during Freeze; redirects cold for freeze/stun effect.
    3.  **Maintenance Override Port:** Active anytime with card; accepts Override Card to force barrier open for gun damage.
* **Key Items:**
    * **Override Cards:** Consumables found in the world, used to trigger maintenance window.
    * **Protective Consumables:** Items (Coat, Gel, Goggles, Mask) needed to survive environmental attacks.
    * **Energy-Based Weapons:** Player's primary tool for dealing direct health damage during vulnerability windows (lore: salvaged/ravager tech).
* **Resource:** Energy (powers weapons).

**V. Other Mechanics**

* **Traitor Mechanic:** Details on hold, but hoarding Override Cards / Protective Items and sabotaging panel activations are key potential actions.
* **LLM Trickery (Chat):** Possible future addition, not core loop.

**VI. Key Technical Aspects**

* **LLM:** Gemini 2.0 Flash.
* **TTS:** Replicate API using the "kokoro" model.

This structure brings back the interactive attack redirection, providing distinct ways (Heat Damage, Freeze Stun, Override Open-Window) for players to engage offensively, requiring them to learn and utilize three different core interaction panels. It's more complex but offers richer strategic choices. Let's do it!

### Items
- Cooling gel (protects against head); spawns randomly; no more than a few at a time
- Coat (protects against cold); spawns randomly; no more than a few at a time
- Sunscreen (protects again UV); spawns randomly; no more than a few at a time
- Flashlights? (helps when dark); only 1 in the game
- Maintenance card; spawns randomly; no more than one at a time
    - Use of maintenance cards must be protected by a cooldown so the team can't horde them and use them back to back to back
        - Unless we maybe only spawn one at a time until it's used?
- Energy weapons (perhaps 3 scattered around the map; no ammo, they just need to time to regenerate energy)
- Heating panel card; spawns randomly; no more than one item at a time
- Cooling panel card; spawns randomly; no more than one item at a time

### Attacks from KORO
- Superheating
    - UI: show biodome temperature; increases rapidly; ambient lighting turns red to indicate heat
    - Audio: announcer announces super heating enabled and to stay cool; if player doesn't have cooling gel, they start to hear a burning sound; make an "ahhhh" relief sound when applying cooling gel
    - Player: starts taking damage once heat is over a certain amount unless they activated the cooling gel
        - Show cooling gel timeout for how long it lasts
- Supercooling
    - UI: show biodome temperature; decreases rapidly; ambient lighting turns icy blue to indicate cooling
    - Audio: announcer mentions supercooling enabled and to stay warm; if player doesn't have coat, they start to shiver
    - Player: starts taking damage once temperature drops below a certain amount unless they activated the coat
        - Show coat timeout for how it lasts
        - If player didn't have coat, they freeze for 20 seconds after temperature drops below a certain point
        - Notify them via UI that they're frozen
- High UV
    - UI: show biodome radiation level; ambient lighting turns bright purple to indicate UV
    - Audio: announcer announces this; make like a microwave or radiation noise while attack is ongoing if player isn't protected
    - Player: starts taking damage once UV radiation hits a certain point unless they activated sunscreen (sunscreen spray sound when consuming)
        - Show sunscreen timeout
- Total Darkness
    - UI: basically set all lighting to ZERO
    - Audio: announcer mentions darkness
    - Player: a single player can carry a flashlight; useful if they have a control card and need to navigate to find their way to expose KORO
        - Using keycard/maintenance card will restore lighting and expose KORO
        - Need to make sure players can share items (players also need inventory to hold 3-4 items each in it; plus hold one weapon in their hands)
        - We will only allow one flashlight to spawn because spotlights are unoptimized in hytopia still and too many might overwhelm the game

### KORO
- Has a shield that protects it; looks like a steel ball but is made up of 2 semispheres
- When KORO is exposed, the ball shield opens up and exposes KORO
    - When KORO is exposed, show text on screen to let players know
    - KORO may react to this as well
- When KORO returns to normal, the shield should close again
- Shield protects against all projectile attacks
    - Shield opens up when:
        - Maintenance card is used (described later)
        - Supercooling is redirected to KORO by players (described later)
        - Superheating is redirected to KORO by players (described later)
        - KORO may occasionally malfunction and expose itself unintentionally
- When damaged, its voice becomes crazier and more broken
    - I should add a script that can generate disturbing electronic audio like a machine screaming for when it gets hit or hurt
- Is controlled by AI; we'll need to eventually work out all the data it should be gathering from the game to make its decisions

### Player actions / game mechanics
- There will be 3 panels in the game:
    1. A panel that opens up heat vents that go directly to KORO (part of the lore is that these can be used by KORO to heat itself if its temp gets too low)
    2. A panel that somehow opens up cooling vents to pull the cold air out of there and redirect to KORO (similar to heating; used to help cool KORO if temps get too high; part of its regulation)
    3. A maintenance panel that forces KORO to expose itself and open its shield
- When a superheating attack is going on, users should be notified on screen that they can stop the attack and hurt KORO if they open the heat vents; which can be done by going to the heat vents panel and interacting with it
    - Users must use the heating panel card to activate this
    - This attack redirection has a chance of exposing KORO by removing its shield, at which point players can attack KORO with their energy weapons
- When a supercooling attack is going on, users should be notified on screen that they can stop the attack and hurt KORO if they open the cooling vents (or whatever makes sense; not sure if cooling vents make sense for this lol); which can be done by going to the cooling vents panel and interacting with it
    - Users myst use the cooling panel card to activate this
    - This attack redirection has a chance of exposing KORO by removing its shield, at which point players can attack KORO with their energy weapons
- When a player gets a maintenance card, they can run over the maintenance panel and use it to expose KORO for a limited amount of time, at which point they can fire their energy weapons to hurt KORO
- Whenever KORO gets exposed, we should pop up some kind of alert on screen

### Thoughts
- There are lots of alerts and text to show on screen... we need a really solid UI that makes sense and doesn't look cluttered, and that will work even on mobile
- We need an audio manager / announcer system
    - KORO's speech is different from this. The announcer system is essentially part of the biodome system overall and will have a different voice
- KORO can already talk, but this only works when testing in production because audio URIs need to be accessible from Hytopia's servers, and localhost obviously isn't reachable by an external computer
- We'll have attacks with special effects that need to trigger global audio, UI changes, and player effects
- We'll have panels and actions that players can take the also have an impact on the game
- We also need an item spawner that can follow our rules

### Loose game loop
A loose game loop might look something like this:
- KORO gets data
- KORO potentially takes action and/or speaks
- Update game for the action KORO is taking
- Items spawn
- Analyze player actions to see if they have an impact on KORO

... something like that maybe.

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