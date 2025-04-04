import os
import uuid
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
import replicate
from dotenv import load_dotenv
from typing import Optional

# Import the distortion function
from glados import apply_glados_effect

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
    Generate text-to-speech audio file, apply distortion based on health,
    and return the path to the final distorted audio file.
    
    - text: The text to convert to speech
    - health: Health value (0-100) that affects voice distortion (0=max broken, 100=normal)
    
    Returns a path to the generated audio file relative to the assets directory.
    """
    try:
        # Normalize health value (0-100)
        health = max(0, min(100, request.health))
        
        # Map health to brokenness (inverse relationship: 100 health = 0 brokenness)
        brokenness = (100.0 - health) / 100.0
        
        # Generate a unique filename for the final output
        file_uuid = str(uuid.uuid4())
        filename = f"koro-{file_uuid}.wav"
        final_filepath = os.path.join(ASSETS_DIR, filename)
        relative_path = f"tts/{filename}"
        
        # Set up replicate client
        os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN
        
        # 1. Generate initial TTS using Replicate
        print(f"Generating initial TTS for text: '{request.text[:50]}...'")
        audio_file = replicate.run(
            "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
            input={
                "text": request.text,
                "speed": 1.0,
                "voice": "af_bella" # Always use af_bella voice
            }
        )
        
        # Save the initial downloaded content
        # We save it directly to the final path, it will be overwritten by the distortion function
        file_data = audio_file.read()
        with open(final_filepath, 'wb') as f:
            f.write(file_data)
        print(f"Saved initial WAV file to {final_filepath}")
        
        # 2. Apply distortion using glados.py function
        print(f"Applying distortion with brokenness={brokenness:.2f} (Health={health})")
        apply_glados_effect(
            input_file=final_filepath, 
            output_file=final_filepath, # Overwrite the original file
            brokenness=brokenness
        )
        print(f"Distortion applied. Final file at: {final_filepath}")
        
        # 3. Return the path to the final (distorted) file
        return {
            "success": True,
            "filepath": relative_path,
            "message": "TTS generated and distorted successfully"
        }
    except Exception as e:
        print(f"Error generating TTS: {str(e)}")
        # Clean up potentially incomplete file if error occurred
        if 'final_filepath' in locals() and os.path.exists(final_filepath):
            try:
                os.remove(final_filepath)
                print(f"Cleaned up incomplete file: {final_filepath}")
            except OSError as rm_err:
                print(f"Error cleaning up file {final_filepath}: {rm_err}")
        raise HTTPException(status_code=500, detail=f"Error generating TTS: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT")), reload=True) 