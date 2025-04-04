import os
import uuid
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
import replicate
from dotenv import load_dotenv
from typing import Optional

# Load environment variables
load_dotenv()

# Get API token from environment
API_TOKEN = os.getenv("API_TOKEN")
if not API_TOKEN:
    raise ValueError("API_TOKEN environment variable is not set")

# Get Replicate API token from environment
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
if not REPLICATE_API_TOKEN:
    raise ValueError("REPLICATE_API_TOKEN environment variable is not set")

# Define the audio output directory - relative to where the API is run from
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "tts"))

# Create the directory if it doesn't exist
os.makedirs(ASSETS_DIR, exist_ok=True)

app = FastAPI(title="KORO TTS API")

# API Key security
api_key_header = APIKeyHeader(name="X-API-Key")

async def get_api_key(api_key: str = Header(..., alias="X-API-Key")):
    if api_key != API_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return api_key

# Request model
class TTSRequest(BaseModel):
    text: str
    health: int  # 0-100 health value of the overseer

@app.get("/")
async def root():
    return {"message": "KORO TTS API is running"}

@app.post("/tts")
async def generate_tts(request: TTSRequest, api_key: str = Depends(get_api_key)):
    """
    Generate text-to-speech audio file and return the path to it.
    
    - text: The text to convert to speech
    - health: Health value (0-100) that affects voice properties
    
    Returns a path to the generated audio file relative to the assets directory.
    """
    try:
        # Normalize health value (0-100)
        health = max(0, min(100, request.health))
        
        # Generate a unique filename
        file_uuid = str(uuid.uuid4())
        filename = f"koro-{file_uuid}.wav"
        filepath = os.path.join(ASSETS_DIR, filename)
        relative_path = f"tts/{filename}"
        
        # Set up replicate client
        os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN
        
        # Call Replicate API - returns a file-like object
        # Always use af_bella voice and speed=1.0
        print(f"Generating TTS for text: '{request.text[:50]}...'")
        audio_file = replicate.run(
            "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
            input={
                "text": request.text,
                "speed": 1.0,
                "voice": "af_bella"
            }
        )
        
        # Save the downloaded content to the WAV file
        file_data = audio_file.read()
        with open(filepath, 'wb') as f:
            f.write(file_data)
            
        print(f"Saved WAV file to {filepath}")
        
        return {
            "success": True,
            "filepath": relative_path,
            "message": "TTS generated successfully"
        }
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating TTS: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 