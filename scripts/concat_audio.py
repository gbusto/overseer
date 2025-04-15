from pydub import AudioSegment
import os

def concatenate_mp3_files(output_path, *input_files):
    """
    Concatenates multiple MP3 files into a single MP3 file in the specified order.
    
    Args:
        output_path (str): Path for the output MP3 file
        *input_files: Variable number of input MP3 file paths
    """
    # Initialize an empty AudioSegment
    combined = AudioSegment.empty()
    
    # Process each input file
    for mp3_file in input_files:
        if not os.path.exists(mp3_file):
            print(f"Warning: File {mp3_file} not found, skipping...")
            continue
        # Load and append each MP3 file
        sound = AudioSegment.from_mp3(mp3_file)
        combined += sound
    
    # Export the combined audio
    if len(combined) > 0:
        combined.export(output_path, format="mp3")
        print(f"Successfully created {output_path}")
    else:
        print("No valid audio files were processed.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python concatenate_mp3.py output.mp3 input1.mp3 input2.mp3 ...")
    else:
        concatenate_mp3_files(sys.argv[1], *sys.argv[2:])