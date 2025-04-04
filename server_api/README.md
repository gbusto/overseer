# KORO TTS API

A simple FastAPI server that converts text to speech for the KORO overseer entity in the game using Replicate's Kokoro TTS model.

## Setup

1. Create a virtual environment and activate it:
   ```bash
   cd server_api
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file (see `.env.example` for the required variables):
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and set your API token and Replicate API token.
   - You can get a Replicate API token by signing up at [replicate.com](https://replicate.com)

## Running the server

```bash
python main.py
```

This will start the server at http://localhost:8000.

## API Endpoints

### GET /

Returns a simple status message to confirm the API is running.

### POST /tts

Converts text to speech using Replicate's Kokoro TTS model and saves the audio file to the assets directory.

#### Request body

```json
{
  "text": "Text to convert to speech",
  "health": 100
}
```

- `text`: The text to convert to speech
- `health`: An integer from 0-100 representing the health of the overseer (affects voice properties, not implemented yet)

#### Headers

```
X-API-Key: your_api_token_here
```

#### Response

```json
{
  "success": true,
  "filepath": "tts/koro-12345678-1234-5678-1234-567812345678.wav",
  "message": "TTS generated successfully"
}
```

- `filepath`: The path to the audio file, relative to the assets directory

## Voice Settings

The implementation currently uses fixed settings:
- Voice: `af_bella` (American female)
- Speed: 1.0 (normal speaking rate)

## Integration with the Game

The game should include the API token as an environment variable and pass it in the header of requests to the TTS API. The returned file path can then be used to play the audio through the Hytopia Audio API. 