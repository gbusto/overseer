Okay, here's a summary capturing the essence of your game concept, designed to brief an LLM coding assistant:

**Project:** AI Overseer Arena (Working Title)

**Concept:** A cooperative (with betrayal mechanics) sci-fi shooter game where players team up inside a biodome arena to defeat a powerful, ceiling-mounted AI boss called the "Overseer."

**Core Antagonist (Overseer):**
* Controlled by an external Large Language Model (LLM).
* The LLM receives game state updates (player health/inventory/status, game events) periodically (~15 seconds) and on triggers.
* Based on the state, the LLM decides the Overseer's actions:
    * Launch attacks (e.g., lasers, energy pulses).
    * Spawn resources (health packs, energy orbs).
    * Taunt players using Text-to-Speech (TTS), potentially playing psychological games.
    * (Future) Potentially fake attacks or use more complex strategies.
    * TTS voice quality degrades as the Overseer takes damage.
* The Overseer is protected by a shield.

**Core Gameplay Loop:**
1.  Players explore the biodome arena, gathering **Energy** resources and **Health**.
2.  **Energy** is used to power all weapons. Basic weapons use low energy (e.g., 1 unit/shot).
3.  A unique, single **Shield Piercer** weapon exists in the arena. It requires a large amount of energy (e.g., 10 units) to fire once.
4.  Players must collaborate to gather enough energy, locate the Shield Piercer, and fire it at the Overseer to temporarily disable its shield.
5.  While the shield is down, players can damage the Overseer's main health pool using their weapons.
6.  Repeat the cycle of gathering energy, breaking the shield, and dealing damage until the Overseer is defeated.
7.  (Optional) A very high-cost, high-damage "BFG" type weapon requiring significant energy (e.g., 20 units) could exist as a rare/powerful option.

**Player Dynamics & Betrayal:**
* Players can choose to work together fully.
* Players can use a command (e.g., `/betray`) to signal their intent to ally with the Overseer.
* The Overseer's LLM receives this information and can choose how to react (ignore, accept overtly/covertly, manipulate the traitor).
* Traitors might hoard resources, mislead players, or actively sabotage the team effort.

**Win/Loss Conditions:**
* **Player Win:** Overseer's health reaches zero.
* **Overseer Win:** All players are eliminated.
* **Overseer/Traitor Win:** All non-traitor players are eliminated (Overseer may then choose to eliminate traitors or declare victory).

**Key Components to Build:**
* Biodome level environment.
* Ceiling-mounted Overseer entity (model, health, shield logic).
* Player entity (movement, health, inventory).
* Game Manager (handles game state, time, win/loss).
* LLM integration (API calls, parsing responses, triggering actions).
* TTS integration.
* Weapon systems (basic energy weapon, Shield Piercer, potentially BFG) using Energy resource.
* Item spawning system (Health, Energy).
* Shield visual effects and logic.
* Attack visual effects (lasers, pulses).
* `/betray` command functionality and associated state tracking.