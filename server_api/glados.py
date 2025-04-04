from pydub import AudioSegment
from pydub.effects import normalize
import random
import os

def apply_glados_effect(input_file, output_file="output.wav", brokenness=0.0, max_attempts=3):
    """
    Apply subtle GLaDOS-like effects to an audio file:
    - Consistent light robotic echo/reverb
    - Occasional pitch shifts decoupled from speed
    - Rare voice breaks proportional to brokenness
    
    Args:
        input_file (str): Path to input audio file
        output_file (str): Path to save output audio file
        brokenness (float): 0.0 (smooth) to 1.0 (very broken) - glitch intensity
        max_attempts (int): Max retries if truncated
    """
    for attempt in range(max_attempts):
        try:
            # Load and standardize audio
            audio = AudioSegment.from_file(input_file).set_frame_rate(44100).set_channels(1)
            original_length = len(audio)
            print(f"Attempt {attempt + 1} - Original length: {original_length/1000:.2f}s")
            
            # --- Apply baseline pitch shift --- 
            try:
                baseline_pitch_shift = 1.5 # Shift up by 1.5 semitones
                print(f"Applying baseline pitch shift: +{baseline_pitch_shift} semitones")
                # Use the simple pitch shift method (affects speed slightly)
                audio = audio._spawn(
                    audio.raw_data,
                    overrides={"frame_rate": int(audio.frame_rate * (2 ** (baseline_pitch_shift / 12.0)))}
                )
                audio = audio.set_frame_rate(44100) # Correct frame rate after pitch shift
            except Exception as e:
                print(f"Error applying baseline pitch shift: {e}")
            # ----------------------------------
            
            # Create segments for applying effects
            working_audio = audio # Use the pitch-shifted audio
            
            # Apply consistent baseline robotic echo (regardless of brokenness)
            try:
                # Very light echo for subtle robotic quality
                echo_delay = 60
                # Make echo slightly less subtle
                echo = working_audio - 16  # Reduced attenuation from -18dB
                echo = echo.fade_in(25).fade_out(25)
                audio_with_echo = working_audio.overlay(echo, position=echo_delay)
                
                # Ensure we don't lose audio length
                if len(audio_with_echo) < len(working_audio):
                    audio_with_echo += AudioSegment.silent(duration=len(working_audio) - len(audio_with_echo))
                
                print(f"Added robotic echo: {len(audio_with_echo)/1000:.2f}s")
            except Exception as e:
                print(f"Error in echo effect: {e}")
                audio_with_echo = working_audio
            
            # Split audio into segments for varied effects
            # Increase segment count for more aggressive changes
            segment_count = 5 + int(brokenness * 15)  # Increased from 3 + brokenness * 7
            processed_audio = AudioSegment.empty()
            
            # Get segment boundaries
            total_duration = len(audio_with_echo)
            avg_segment_size = total_duration // segment_count if segment_count > 0 else total_duration
            
            # Create minimum segment size to avoid tiny segments
            min_segment_size = max(150, min(500, avg_segment_size // 3)) # Adjusted min/max and fraction
            
            segment_boundaries = [0]  # Start with beginning
            current_pos = 0
            
            # Create random segment boundaries
            while current_pos < total_duration - min_segment_size:
                # Add some randomness to segment size, ensure it's at least min_segment_size
                segment_length = random.randint(
                    min_segment_size, 
                    max(min_segment_size + 1, min(total_duration - current_pos, avg_segment_size * 2))
                )
                next_boundary = current_pos + segment_length
                segment_boundaries.append(next_boundary)
                current_pos = next_boundary
            
            # Ensure the last boundary is the total duration if it wasn't reached
            if segment_boundaries[-1] < total_duration:
                 segment_boundaries.append(total_duration)
            
            print(f"Processing {len(segment_boundaries) - 1} segments...")
            # Process each segment with varied effects
            for i in range(len(segment_boundaries) - 1):
                start = segment_boundaries[i]
                end = segment_boundaries[i+1]
                segment = audio_with_echo[start:end]
                
                # Increased chance of breaks
                apply_break = random.random() < (brokenness * 0.35)  # Increased from 0.15
                
                if apply_break and len(segment) > 150:
                    # Make breaks potentially longer
                    break_length = random.randint(25, min(80, len(segment) // 6))  # Increased from (15, 60, //8)
                    break_pos = random.randint(0, len(segment) - break_length)
                    
                    # Apply the break by splitting and inserting silence
                    before_break = segment[:break_pos]
                    after_break = segment[break_pos + break_length:]
                    segment = before_break + AudioSegment.silent(duration=break_length) + after_break
                
                # Increased chance of pitch/speed effects
                apply_effect = random.random() < (0.25 + brokenness * 0.6)  # Increased from 0.15 + 0.3
                
                if apply_effect and len(segment) > 50:
                    # More aggressive pitch shifts
                    pitch_shift = random.choice([
                        random.uniform(-4.5, -1.5),  # Lower pitch (more range)
                        random.uniform(1.5, 4.5)     # Higher pitch (more range)
                    ])
                    
                    # More extreme shifts with brokenness
                    pitch_shift *= (1 + brokenness * 0.6)  # Increased from 0.3
                    
                    # Apply pitch shift
                    try:
                        segment = segment._spawn(
                            segment.raw_data,
                            overrides={"frame_rate": int(segment.frame_rate * (2 ** (pitch_shift / 12.0)))}
                        )
                        segment = segment.set_frame_rate(44100)  # Reset frame rate
                    except Exception as e:
                        print(f"Error in pitch shift: {e}")
                    
                    # Independently decide on speed change - slightly more frequent
                    if random.random() < 0.6:  # Increased from 0.5
                        # More aggressive speed changes
                        speed_factor = random.choice([
                            random.uniform(0.75, 0.95),  # Slower (more range)
                            random.uniform(1.05, 1.30)   # Faster (more range)
                        ])
                        
                        # Make speed change more sensitive to brokenness
                        # If speeding up, increase more; if slowing down, decrease more.
                        speed_factor = 1.0 + (speed_factor - 1.0) * (1 + brokenness * 0.75)
                        speed_factor = max(0.5, speed_factor) # Clamp lower bound
                        
                        try:
                            # Ensure segment is long enough for speedup
                            if len(segment) > 50: # Adjust threshold if needed
                                segment = segment.speedup(playback_speed=speed_factor, chunk_size=50, crossfade=25)
                            else:
                                # Fallback for very short segments
                                segment = segment._spawn(segment.raw_data, overrides={
                                    "frame_rate": int(segment.frame_rate * speed_factor)
                                })
                        except Exception as e:
                            print(f"Error in speed adjustment: {e}")
                
                # Add the processed segment to our output
                processed_audio += segment
            
            # Apply high-pass filter for a more synthesized/speaker feel
            try:
                print("Applying high-pass filter...")
                processed_audio = processed_audio.high_pass_filter(cutoff_freq=150)
            except Exception as e:
                print(f"Error applying high-pass filter: {e}")
                # Continue without filter if it fails

            # Normalize and check length
            final_audio = normalize(processed_audio)
            
            # Ensure we maintain original length
            if len(final_audio) < original_length:
                final_audio += AudioSegment.silent(duration=original_length - len(final_audio))
            elif len(final_audio) > original_length * 1.15:  # Allow 15% longer
                final_audio = final_audio[:int(original_length * 1.1)] # Trim if excessively long
                
            final_length = len(final_audio)
            print(f"Final length: {final_length/1000:.2f}s")
            
            # Check for truncation
            truncation_threshold = original_length * 0.8
            if final_length >= truncation_threshold:
                # Success - export and exit
                final_audio.export(output_file, format="wav")
                print(f"Processed: {output_file} (Brokenness: {brokenness})")
                return
            else:
                print(f"Truncation detected ({final_length/1000:.2f}s < {truncation_threshold/1000:.2f}s), retrying...")
                
        except Exception as e:
            print(f"Critical error in attempt {attempt+1}: {e}")
    
    # If all attempts fail, create a safe version with minimal effects
    try:
        print(f"Failed after {max_attempts} attempts, creating safe version")
        audio = AudioSegment.from_file(input_file).set_frame_rate(44100).set_channels(1)
        
        # Apply just basic echo effect and very subtle pitch shift
        pitch_shift = random.uniform(-1, 1)  # Reduced from (-2, 2)
        pitched_audio = audio._spawn(
            audio.raw_data,
            overrides={"frame_rate": int(audio.frame_rate * (2 ** (pitch_shift / 12.0)))}
        )
        pitched_audio = pitched_audio.set_frame_rate(44100)
        
        # Add very light echo
        echo = pitched_audio - 18  # Reduced from -15
        echo = echo.fade_out(100)
        final_audio = pitched_audio.overlay(echo, position=60)
        
        # Ensure original length
        if len(final_audio) < len(audio):
            final_audio += AudioSegment.silent(duration=len(audio) - len(final_audio))
        
        final_audio.export(output_file, format="wav")
        print(f"Saved safe version: {output_file}")
    except Exception as e:
        print(f"Could not create safe version: {e}")
        # Last resort: copy original file
        try:
            audio = AudioSegment.from_file(input_file)
            audio.export(output_file, format="wav")
            print(f"Copied original as fallback: {output_file}")
        except:
            print(f"Complete failure processing {input_file}")

# Example usage
if __name__ == "__main__":
    # Assuming you have TTS files ready (e.g., from ElevenLabs or gTTS)
    input_file = "./speech-file.wav"
    # Using much lower brokenness values
    apply_glados_effect(input_file, "overseer1_modified_normal.wav", brokenness=0.01)  # Reduced from 0.01
    apply_glados_effect(input_file, "overseer1_modified_mid.wav", brokenness=0.5)      # Reduced from 0.5
    apply_glados_effect(input_file, "overseer1_modified_broken.wav", brokenness=0.99)    # Reduced from 0.99
