# The Overseer

![The Overseer Banner](web/images/overseer.png)

**Outwit a malfunctioning AI warden in a decaying biodome. Co-op survival against a dynamic, LLM-powered threat.**

---

## Quick Start Guide

*   **Goal:** Work together (co-op!) to defeat the malfunctioning AI, K.O.R.O., before it eliminates all players.
*   **Start:** Once everyone joins, type `/start` in chat to begin the match countdown.
*   **Controls:** `WASD` (Move), `Space` (Jump), `Shift` (Run), `Left Mouse` (Shoot), `E` (Pickup Items/Weapons).
*   **Combat:**
    *   Shoot KORO's core when its shield opens (to vent temperature or taunt).
    *   Grab the **BFG**! Hitting KORO's *closed* shield forces it open. Hitting the *open* core does massive damage.
    *   Find Health Packs to heal.

---

## Survive Biodome Delta

Decades after the visionary Verdant Horizons Corporation sealed Genesis Biodome Delta, a catastrophic "Isolation Event" severed it from the outside world and corrupted its central AI, K.O.R.O. (Kinetic Operations & Resource Overseer). Now, trapped within this decaying, self-contained ecosystem, you and fellow survivors must fight against the very intelligence designed to protect it.

KORO, driven by damaged protocols and a unique LLM brain, perceives you as a "bio-contaminant." Team up to exploit its vulnerabilities, manage its environmental attacks, and neutralize the Overseer before it purges all intruders.

## Key Features

*   **LLM-Powered Antagonist:** Face K.O.R.O., an AI whose strategy and dialogue are dynamically generated by Google's Gemini model in real-time, making every encounter unique.
*   **Dynamic TTS & Voice Degradation:** Hear KORO taunt and threaten you with dynamically generated Text-To-Speech via Replicate. As you damage it, its voice glitches and degrades, reflecting its failing state.
*   **Environmental Warfare:** KORO controls the Biodome! Survive super-heating, freezing, sudden blackouts, and targeted UV light attacks.
*   **Strategic Shield Mechanics:** KORO's shield is impenetrable *most* of the time. Exploit openings during temperature auto-venting, unpredictable taunts, or by forcing a malfunction with the BFG.
*   **The BFG:** Hunt down the single, powerful BFG each round. Use it strategically to breach KORO's shield or inflict massive damage on its exposed core.
*   **Co-op Survival:** Work closely with your teammates. Coordinate attacks during shield openings and share resources like Health Packs to survive KORO's onslaught.

## Gameplay Demo

See The Overseer in action:

[Watch the Gameplay Demo on YouTube](https://youtu.be/6GpzGgxErQs)

[![Gameplay Demo Thumbnail](https://img.youtube.com/vi/6GpzGgxErQs/0.jpg)](https://youtu.be/6GpzGgxErQs)

## Play Now!

Ready to face the Overseer? Join the game directly on Hytopia:

**[>> PLAY NOW on Hytopia! <<](https://hytopia.com/play/?join=overseer.gbusto.com)**

## About & Lore

Want to dive deeper into the story of Verdant Horizons, the Isolation Event, and KORO's descent into madness? Visit the full website:

**[Learn More & Read the Lore](https://overseer.gbusto.com/about)**

---

## Running the Game

Instructions for running the Overseer game server and its components.

**Prerequisites:**

*   Node.js and npm (or Bun)
*   Python 3.x and `pip` (Needed *only* for Production TTS)
*   Git (for cloning)
*   API Keys (see Environment Variables section)

### Development Mode

Development mode uses `bun --watch` for automatic server restarts on code changes, enables debug commands, and **disables TTS voice generation** (as it typically requires a deployed setup).

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd overseer
    ```
2.  **Install Hytopia Server Dependencies:**
    ```bash
    npm install # or bun install
    ```
3.  **Configure Root Environment:**
    ```bash
    cp .env.example .env
    ```
    - Edit the root `.env` file. You primarily need `GOOGLE_GENERATIVE_AI_API_KEY`. `TTS_API_URL` and `TTS_API_TOKEN` can be left blank or commented out for development.
4.  **Run the Development Startup Script:**
    ```bash
    ./start_dev.sh
    ```
    This script handles sourcing the root `.env` file and starting the Hytopia server with watch mode. **No separate TTS server process is needed for development.**
5.  **Connect to the Game:**
    - Go to [https://hytopia.com/play/](https://hytopia.com/play/).
    - When prompted for a server URL, leave it **blank** and press Enter/click Connect.

### Production Mode

Production mode runs the server without watch mode, disables debug commands, and **requires the separate Python TTS API server for KORO's voice**.

1.  **Clone the Repository & Install Hytopia Dependencies:** (Same as steps 1 & 2 in Development Mode)
    ```bash
    git clone <repository_url>
    cd overseer
    npm install # or bun install
    ```
2.  **Set up TTS API Server:** (This step IS required for production)
    ```bash
    cd server_api
    python -m venv .venv
    source .venv/bin/activate # On Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env
    # Edit server_api/.env with your tokens (see Environment Variables)
    cd .. # Return to root directory
    ```
3.  **Configure Root Environment:** (Same as step 3 in Development Mode)
    ```bash
    cp .env.example .env
    ```
    - Edit the root `.env` file. You need `GOOGLE_GENERATIVE_AI_API_KEY`, and **valid** `TTS_API_URL` and `TTS_API_TOKEN` for production.
4.  **Start the Hytopia Game Server (Production):** In one terminal, run:
    ```bash
    ./start_prod.sh
    ```
    This script sets `NODE_ENV=production`, sources the root `.env`, and starts the Hytopia server.
5.  **Start the TTS API Server:** In *another* terminal, navigate to `server_api` and run:
    ```bash
    ./run_server.sh
    ```
    This ensures KORO's voice generation is active.
6.  **Connect to the Game:**
    - Players connect using a direct join link:
      `https://hytopia.com/play?join=<your_server_domain>`
    - Replace `<your_server_domain>` with the actual domain where the Hytopia game server (started by `start_prod.sh`) is accessible (e.g., `overseer.gbusto.com`).

---

## LLM & TTS Architecture

This game features a unique system for KORO's voice, combining a Large Language Model (LLM) for dynamic dialogue and a Text-To-Speech (TTS) service for audio generation.

**How it Works:**

1.  **LLM Text Generation (`KOROBrain.ts`):** KORO's AI brain analyzes the current game state (player health, biodome status, recent events, KORO's health, etc.) and uses Google's Gemini model (via `@ai-sdk/google`) to generate contextually relevant dialogue and decide on actions (like attacks or taunts).
2.  **TTS Request (`OverseerEntity.ts` -> `server_api/main.py`):** If the LLM generates dialogue, the `OverseerEntity` sends the text along with KORO's current health percentage to the Python TTS API server (running `server_api/main.py`). This request is sent to the URL specified by `TTS_API_URL` and authenticated using the `TTS_API_TOKEN`.
3.  **TTS Audio Generation (`server_api/main.py`):**
    *   The Python server receives the request and validates the API token (`API_TOKEN` in `server_api/.env`).
    *   It uses the Replicate API (`REPLICATE_API_TOKEN`) to generate the base speech audio.
    *   It applies a voice distortion effect based on KORO's health percentage (lower health = more distortion) using logic in `server_api/glados.py`.
    *   The final distorted audio is saved as a `.wav` file inside the Hytopia server's `assets/tts/` directory (e.g., `../assets/tts/koro-<uuid>.wav`).
4.  **Audio Path Response:** The Python server sends back a *relative path* to the generated audio file (e.g., `tts/koro-<uuid>.wav`).
5.  **Hytopia Audio Playback (`OverseerEntity.ts`):**
    *   The `OverseerEntity` receives the relative path.
    *   It creates a Hytopia `Audio` object using this path.
    *   When `audio.play(world)` is called, Hytopia clients automatically attempt to fetch the audio file from the game server's public assets directory (e.g., `https://[your_server_domain]/assets/tts/koro-<uuid>.wav`).

**Key Requirement:** For this to work, the Python TTS API server *must* have write access to the Hytopia game server's `assets/tts/` directory. Co-locating the `server_api` directory relative to the game server root is the intended setup.

---

## Environment Variables

Secure API keys and configuration are managed through `.env` files. **Do not commit `.env` files to Git.**

### Hytopia Game Server (`./.env`)

Located in the project root directory.

*   `GOOGLE_GENERATIVE_AI_API_KEY` (Required): Your API key for Google AI Studio (Gemini models). Needed for KORO's brain.
*   `TTS_API_URL` (Required for TTS): The full URL where the Python TTS API server is running (e.g., `http://localhost:8000/tts` or a deployed URL).
*   `TTS_API_TOKEN` (Required for TTS): A secret token *you create* that the Hytopia server uses to authenticate with the Python TTS API server. **Must match** the `API_TOKEN` in `server_api/.env`.
*   `LOG_LEVEL` (Optional): Sets the server log level (e.g., `INFO`, `DEBUG`). Defaults to `INFO` in production, `DEBUG` otherwise.

### Python TTS API Server (`./server_api/.env`)

Located in the `server_api/` directory.

*   `API_TOKEN` (Required): The secret token *you create* that this API server expects in the `X-API-Key` header for authentication. **Must match** the `TTS_API_TOKEN` in the root `.env` file.
*   `REPLICATE_API_TOKEN` (Required): Your API token from [replicate.com](https://replicate.com). Needed to generate the base TTS audio.
*   `PORT` (Optional): Port for the Python API server to listen on (Default: 8000).
*   `HOST` (Optional): Host address for the Python API server (Default: `0.0.0.0`).

---

## Deployment Notes (For Hytopia Team)

*   **Two Processes:** Production requires running both the Hytopia Node.js/Bun server (`start_prod.sh`) and the Python TTS API server (`server_api/run_server.sh`) concurrently.
*   **TTS API Location:** The Python TTS API server (`server_api`) needs filesystem write access to the Hytopia server's `assets/tts/` directory. The simplest way to achieve this is to keep the `server_api` directory alongside the Hytopia `index.ts` and `assets` folder as structured in the repository.
*   **Network Access:** The Hytopia server needs network access to the TTS API server via the configured `TTS_API_URL`.
*   **Asset Serving:** The Hytopia server must be configured to publicly serve files from its `assets/` directory (especially `assets/tts/`) so that game clients can download the generated audio.
*   **Environment Variables:** Please ensure all required environment variables (Google API Key, Replicate API Key, and the shared secret `TTS_API_TOKEN`/`API_TOKEN`) are configured correctly in both `.env` files on the production server. These keys will be provided securely.
*   **Assistance:** Nginx configurations or further deployment assistance can be provided if needed.

---

## Debug Commands (Available in Non-Production Environment)

When running locally (not in production), the following commands are available via chat:

*   `/getpos`: Print your current world position.
*   `/rocket`: Launch yourself into the air.
*   `/oshealth [0-100]`: Set KORO's current health.
*   `/osinvuln [true|false]`: Toggle KORO's invulnerability.
*   `/healthpack`: Spawn a health pack in front of you.
*   `/healthpacks`: Spawn multiple health packs randomly.
*   `/rifle`: Spawn an Energy Rifle in front of you.
*   `/bfg`: Spawn a BFG in front of you.
*   `/setweapon...`: Commands to adjust equipped weapon position, rotation, scale.
*   `/toggle...`: Various commands to toggle UI elements (player health, KORO health, biodome status, all UI).
*   `/biodome...`: Commands to control/check biodome temperature (temp, heat, cold, reset, status, damage).
*   `/toggledamage`: Toggle player vulnerability outside active game state.
*   `/taunt`: Force KORO to perform its shield taunt.
*   `/togglealldamage`: Toggle player, environmental, and KORO damage vulnerability.
*   `/toggleautoreg`: Toggle KORO/Biodome auto-regulation systems.
*   `/togglebfgbreak`: Toggle if BFG hits force KORO's shield open.
*   `/respawn`: Respawn your player if dead (for testing).
*   `/koromode [mode]`: Set KORO's AI mode (disabled, dev-no-llm, dev-with-llm, prod).
*   `/korostatus`: Show KORO's current AI mode and status.
*   `/blackout [duration]`: Trigger a blackout attack.
*   `/uvlight [dur] [rate] [offset]`: Trigger a UV light attack.

*(Note: The original `/koro-` commands seem deprecated based on GameManager/CommandManager structure, replaced by more specific commands like `/oshealth`, `/taunt`, etc. The `/log-level` command might need to be implemented separately if desired.)*
