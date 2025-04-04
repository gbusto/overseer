# Overseer

A game built with the Hytopia SDK where players are monitored by an AI overseer named KORO.

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your Gemini API key and TTS settings
3. Run `npm install` (or `bun install` if using Bun)
4. Start the game with `npm start` (or `bun run index.ts` with Bun)

## TTS Server Setup

The game uses a TTS API server with Replicate's Kokoro TTS model to generate speech for KORO:

1. Set up the TTS API server:
   ```bash
   cd server_api
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env to set your API token and Replicate API token
   ```

2. Get a Replicate API token:
   - Sign up at [replicate.com](https://replicate.com)
   - Get your API token from your account settings
   - Add it to your `server_api/.env` file as `REPLICATE_API_TOKEN`

3. Start the TTS server:
   ```bash
   python main.py
   ```

4. Configure the game to use the TTS server:
   - Make sure your `.env` file in the root directory includes:
     ```
     TTS_API_URL=http://localhost:8000/tts
     TTS_API_TOKEN=your_tts_api_token_here  # Must match the token in server_api/.env
     ```

## Commands

- `/log-level <level>`: Set the log level (NONE, ERROR, WARN, INFO, DEBUG, TRACE)
- `/koro-toggle [on|off]`: Enable or disable KORO's automatic updates
- `/koro-events`: Display KORO's current world state (events and player count)
- `/koro-force`: Force KORO to generate a response immediately
