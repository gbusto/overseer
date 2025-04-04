import argparse
import random
import math
import os
from pydub import AudioSegment
from pydub.effects import normalize

# --- Helper function for pitch shifting ---
# Pydub doesn't have a direct semitone pitch shift,
# this is a common workaround using ffmpeg parameters via pydub
def pitch_shift(sound, semitones):
    """ Shifts the pitch of a Pydub AudioSegment by a number of semitones. """
    if semitones == 0:
        return sound
    
    # Calculate the rate change factor based on semitones
    # Each semitone is the 12th root of 2
    rate_change = 2.0**(semitones / 12.0)
    
    # Create a new sound with the adjusted frame rate
    # This changes pitch *and* speed
    new_sound = sound._spawn(sound.raw_data, overrides={
        "frame_rate": int(sound.frame_rate * rate_change)
    })
    
    # Set the frame rate back to the original
    # This forces ffmpeg resampling, effectively changing pitch only
    # It seems redundant but is often necessary for ffmpeg filters
    return new_sound.set_frame_rate(sound.frame_rate)

# --- Helper function for speed change ---
def speed_change(sound, speed_factor):
    """ Changes the speed of an AudioSegment without changing pitch (much). """
    if speed_factor == 1.0:
        return sound
    # Speedup uses ffmpeg's atempo filter which tries to preserve pitch
    # Ensure speed_factor is positive and reasonable
    speed_factor = max(0.5, min(speed_factor, 2.0)) # Limit speed factor
    return sound.speedup(playback_speed=speed_factor)

# --- Main effect application function ---
def apply_glados_effects(input_file, output_file, brokenness):
    """
    Applies audio effects based on brokenness level.
    brokenness: Float between 0.0 (robotic) and 1.0 (max broken).
    """
    
    print(f"Loading audio file: {input_file}")
    try:
        # Load audio file
        # Explicitly specify format if needed, but pydub usually guesses well
        audio = AudioSegment.from_file(input_file)
    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file}")
        return
    except Exception as e:
        print(f"Error loading audio file: {e}")
        print("Ensure ffmpeg is installed and accessible in your system's PATH.")
        return

    print(f"Applying effects with brokenness level: {brokenness}")

    if not 0.0 <= brokenness <= 1.0:
        print("Warning: Brokenness should be between 0.0 and 1.0. Clamping value.")
        brokenness = max(0.0, min(brokenness, 1.0))

    if brokenness == 0.0:
        # --- Robotic Effect ---
        # 1. Slightly higher pitch (e.g., +1 semitone)
        processed_audio = pitch_shift(audio, semitones=1)
        
        # 2. Normalize volume (optional, can make it sound more uniform)
        processed_audio = normalize(processed_audio)

        # 3. Reverb (Difficult with pydub alone)
        # Pydub doesn't have built-in reverb. Real reverb requires complex algorithms
        # or calling ffmpeg with specific filters like 'afftfilt'.
        # A very crude "echo" simulation (not real reverb):
        # delay_ms = 150
        # volume_reduction = -6 # dB
        # echo = processed_audio._spawn(b'\0' * int(delay_ms * processed_audio.frame_rate / 1000 * processed_audio.frame_width)) + \
        #        processed_audio.apply_gain(volume_reduction)
        # processed_audio = processed_audio.overlay(echo)
        print("Note: Reverb effect is complex and not applied in this basic script.")

    else:
        # --- Broken GLaDOS Effect ---
        chunk_size_ms = 200 # Process audio in chunks (milliseconds)
        num_chunks = math.ceil(len(audio) / chunk_size_ms)
        processed_chunks = []

        max_pitch_semitones = brokenness * 6 # Max +/- 6 semitones at brokenness=1.0
        max_speed_factor_delta = brokenness * 0.5 # Speed varies between 0.5x and 1.5x at brokenness=1.0

        print(f"Processing {num_chunks} chunks...")
        for i in range(num_chunks):
            start_ms = i * chunk_size_ms
            end_ms = min((i + 1) * chunk_size_ms, len(audio))
            chunk = audio[start_ms:end_ms]

            # Apply random pitch shift
            pitch_delta = random.uniform(-max_pitch_semitones, max_pitch_semitones)
            chunk = pitch_shift(chunk, pitch_delta)

            # Apply random speed change
            # Ensure speed_factor stays within reasonable bounds (e.g., 0.5x to 1.5x)
            speed_delta = random.uniform(-max_speed_factor_delta, max_speed_factor_delta)
            speed_factor = 1.0 + speed_delta
            # Ensure factor is positive if using speedup function
            speed_factor = max(0.5, speed_factor) # clamp low end if speedup used
            
            # Note: Applying speed change *after* pitch shift can sound different
            # Pydub's speedup tries to maintain pitch, but results vary.
            # Experiment with order or use ffmpeg filters directly for more control.
            # For simplicity here, we use pydub's speedup:
            # Ensure chunk is long enough for the speedup operation
            min_length_ms = 150 # Corresponds to chunk_size in speedup
            if len(chunk) >= min_length_ms:
              chunk = chunk.speedup(playback_speed=speed_factor, chunk_size=150, crossfade=50) 
            else:
              # Optionally handle short chunks, e.g., skip speed change or use simple frame rate adjust
              # print(f"  Skipping speedup for short chunk (length: {len(chunk)}ms)")
              # Or use the frame_rate adjustment as an alternative:
              chunk = chunk._spawn(chunk.raw_data, overrides={
                  "frame_rate": int(chunk.frame_rate * speed_factor)
              })
              
            # Or manually adjust frame_rate for simpler speed effect (changes pitch too):
            # chunk = chunk._spawn(chunk.raw_data, overrides={
            #    "frame_rate": int(chunk.frame_rate * speed_factor)
            # })


            processed_chunks.append(chunk)
            if (i + 1) % 50 == 0: # Print progress occasionally
                 print(f"  Processed chunk {i+1}/{num_chunks}")


        # Combine chunks
        print("Combining processed chunks...")
        processed_audio = sum(processed_chunks, AudioSegment.empty())
        
        # Normalize the final audio volume
        processed_audio = normalize(processed_audio)

    # --- Export the result ---
    # Determine format from output filename
    output_format = os.path.splitext(output_file)[1][1:].lower()
    if not output_format:
        output_format = "wav" # Default to wav if no extension
        output_file += ".wav"
        
    print(f"Exporting audio to: {output_file} (format: {output_format})")
    try:
        processed_audio.export(output_file, format=output_format)
        print("Processing complete!")
    except Exception as e:
        print(f"Error exporting audio file: {e}")
        print("Ensure ffmpeg supports the desired output format.")


# --- Command Line Argument Parsing ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apply 'brokenness' effects to an audio file.")
    parser.add_argument("input_file", help="Path to the input audio file (.wav, .mp3, etc.)")
    parser.add_argument("output_file", help="Path to save the processed audio file.")
    parser.add_argument("-b", "--brokenness", type=float, required=True,
                        help="Level of 'brokenness' effect (float from 0.0 to 1.0). 0.0 = robotic, 1.0 = max broken.")

    args = parser.parse_args()

    apply_glados_effects(args.input_file, args.output_file, args.brokenness)