import json
import random
import os

# --- Configuration ---
INPUT_MAP_FILE = '../assets/hytopia_map.json' # Assumes it's in the same directory or provide full path
OUTPUT_COORDS_FILE = os.path.join('assets', 'ground_coords.json') # Output to assets folder
GROUND_BLOCK_IDS = [1, 2] # IDs for 'voidsoil' and 'voidgrass'
SAMPLE_SIZE = 1000 # Number of ground coordinates to sample

# Mapping from original ground block ID to its electrified texture
TEXTURE_MAPPING = {
    1: 'blocks/voidsoil-electrified',
    2: 'blocks/voidgrass-electrified'
}
# -------------------

def find_ground_blocks():
    print(f"Loading map file: {INPUT_MAP_FILE}...")
    try:
        with open(INPUT_MAP_FILE, 'r') as f:
            map_data = json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Map file not found at {INPUT_MAP_FILE}")
        return
    except json.JSONDecodeError:
        print(f"ERROR: Could not parse JSON from {INPUT_MAP_FILE}")
        return

    if 'blocks' not in map_data:
        print("ERROR: 'blocks' key not found in map data.")
        return

    print("Processing blocks to find top surfaces...")
    top_blocks = {}
    blocks_processed = 0

    for coord_str, block_id in map_data['blocks'].items():
        blocks_processed += 1
        try:
            x_str, y_str, z_str = coord_str.split(',')
            x, y, z = int(x_str), int(y_str), int(z_str)
        except ValueError:
            print(f"Warning: Skipping invalid coordinate string: {coord_str}")
            continue

        xz_key = (x, z)
        if xz_key not in top_blocks or y > top_blocks[xz_key]['y']:
            top_blocks[xz_key] = {'y': y, 'block_id': block_id}

    print(f"Processed {blocks_processed} blocks.")
    print(f"Found {len(top_blocks)} unique (X, Z) surface coordinates.")

    print("Filtering for ground blocks and mapping textures...")
    ground_coords = []
    ground_blocks_found = 0
    missing_mapping_warnings = 0

    for (x, z), data in top_blocks.items():
        block_id = data['block_id']
        if block_id in GROUND_BLOCK_IDS:
            ground_blocks_found += 1
            electrified_texture = TEXTURE_MAPPING.get(block_id)
            if electrified_texture:
                ground_coords.append({
                    'x': x,
                    'y': data['y'],
                    'z': z,
                    'textureUri': electrified_texture
                })
            else:
                missing_mapping_warnings += 1
                print(f"Warning: No electrified texture mapping found for ground block ID {block_id} at ({x}, {data['y']}, {z})")

    print(f"Found {ground_blocks_found} top-level ground blocks.")
    if missing_mapping_warnings > 0:
        print(f"WARNING: {missing_mapping_warnings} ground blocks lacked texture mapping.")

    if not ground_coords:
        print("ERROR: No suitable ground coordinates found to sample.")
        return

    actual_sample_size = min(SAMPLE_SIZE, len(ground_coords))
    if actual_sample_size < SAMPLE_SIZE:
        print(f"Warning: Found only {len(ground_coords)} ground blocks, sampling {actual_sample_size} instead of {SAMPLE_SIZE}.")

    print(f"Randomly sampling {actual_sample_size} ground coordinates...")
    sampled_coords = random.sample(ground_coords, actual_sample_size)

    # Ensure the assets directory exists
    output_dir = os.path.dirname(OUTPUT_COORDS_FILE)
    if not os.path.exists(output_dir):
        print(f"Creating output directory: {output_dir}")
        os.makedirs(output_dir)

    print(f"Saving sampled coordinates to {OUTPUT_COORDS_FILE}...")
    try:
        with open(OUTPUT_COORDS_FILE, 'w') as f:
            json.dump(sampled_coords, f, indent=2)
        print("Successfully saved ground coordinates.")
    except IOError as e:
        print(f"ERROR: Could not write output file: {e}")

if __name__ == "__main__":
    # Assume the script is run from the workspace root
    # If hytopia_map.json is not there, adjust INPUT_MAP_FILE path accordingly
    find_ground_blocks() 