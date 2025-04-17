import librosa
import numpy as np
import soundfile as sf
import scipy.signal as signal
import argparse

def create_dome_reverb_impulse(sample_rate, duration=1.0, decay=1.0):
    """Create an impulse response for a large dome reverb effect."""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    impulse = np.exp(-decay * t) * np.random.randn(len(t)) * 0.05
    impulse[0] = 1.0  # Initial impulse
    return impulse / np.max(np.abs(impulse))

def apply_reverb(audio, sample_rate, reverb_intensity=0.3):
    """Apply a dome-like reverb effect with adjustable intensity."""
    impulse = create_dome_reverb_impulse(sample_rate)
    reverb_audio = signal.convolve(audio, impulse, mode='full')[:len(audio)]
    reverb_audio = reverb_audio / np.max(np.abs(reverb_audio))
    # Mix original (dry) and reverbed (wet) audio
    return (1 - reverb_intensity) * audio + reverb_intensity * reverb_audio

def apply_robotic_effect(audio, sample_rate, robotic_intensity=0.2):
    """Apply a robotic/metallic effect with adjustable intensity."""
    # Low-pass filter for metallic tone
    cutoff = 3500 - 1500 * robotic_intensity  # Adjust cutoff based on intensity
    b, a = signal.butter(4, cutoff / (sample_rate / 2), btype='low')
    filtered = signal.filtfilt(b, a, audio)
    
    # Subtle pitch modulation for robotic effect
    t = np.arange(len(audio)) / sample_rate
    modulation = (0.01 * robotic_intensity) * np.sin(2 * np.pi * 5 * t)  # 5 Hz modulation
    indices = np.arange(len(audio))
    shifted_indices = indices * (1 + modulation)
    shifted_indices = np.clip(shifted_indices, 0, len(audio) - 1)
    robotic_audio = np.interp(indices, indices, filtered)
    
    # Mix original and robotic audio
    return (1 - robotic_intensity) * audio + robotic_intensity * robotic_audio

def process_audio(input_file, output_file, reverb_intensity, robotic_intensity):
    """Process the audio file with dome reverb and robotic effects."""
    try:
        # Load audio file
        audio, sample_rate = librosa.load(input_file, sr=None, mono=True)
        
        # Apply dome reverb
        reverb_audio = apply_reverb(audio, sample_rate, reverb_intensity)
        
        # Apply robotic effect
        final_audio = apply_robotic_effect(reverb_audio, sample_rate, robotic_intensity)
        
        # Normalize and save the processed audio
        final_audio = final_audio / np.max(np.abs(final_audio)) * 0.9
        sf.write(output_file, final_audio, sample_rate)
        print(f"Processed audio saved as {output_file}")
        
    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
    except Exception as e:
        print(f"Error processing audio: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process audio files with dome reverb and robotic effects.')
    parser.add_argument('input_file', type=str, help='Path to the input audio file')
    parser.add_argument('output_file', type=str, help='Path to save the processed audio file')
    parser.add_argument('--reverb_intensity', type=float, default=0.3, 
                        help='Reverb intensity (0.0 to 1.0)')
    parser.add_argument('--robotic_intensity', type=float, default=0.2, 
                        help='Robotic effect intensity (0.0 to 1.0)')
    args = parser.parse_args()

    # Clamp intensity values to valid range
    reverb_intensity = np.clip(args.reverb_intensity, 0.0, 1.0)
    robotic_intensity = np.clip(args.robotic_intensity, 0.0, 1.0)

    process_audio(args.input_file, args.output_file, reverb_intensity, robotic_intensity)