import json
import math
import noise
import random

def generate_hytopia_map(radius=125, min_height=1, max_height=5, roughness=0.05, 
                        # New parameters for large-scale features
                        macro_scale=0.01, macro_influence=1.0, 
                        water_threshold=2,
                        dome_height=75, min_panels=5, max_panels=10, min_panel_size=5,
                        max_panel_size=15, patch_scale=0.05,
                        # --- New parameters for environment models ---
                        environment_models=[], # List of dicts: [{'uri': '...', 'name': '...', 'min_scale': 0.8, 'max_scale': 1.2}]
                        model_density=0.02, # Chance (0 to 1) to place a model per eligible block
                        model_placement_scale=0.1 # Noise scale for model clustering
                        ):
    # Define custom block types for the map
    block_types = [
        {
            "id": 1,
            "name": "voidsoil",
            "textureUri": "blocks/voidsoil.png"
        },
        {
            "id": 2,
            "name": "voidgrass",
            "textureUri": "blocks/voidgrass"
        },
        {
            "id": 3,
            "name": "shadowrock",
            "textureUri": "blocks/shadowrock.png"
        },
        {
            "id": 4,
            "name": "water",
            "textureUri": "blocks/water-still.png",
            "isLiquid": True
        }
    ]
    
    blocks = {}
    entities = {} # Initialize entities dictionary
    
    # Generate circular terrain with Perlin noise
    micro_scale = roughness # Rename original scale for clarity
    octaves = 6
    persistence = 0.5
    lacunarity = 2.0
    
    # Precompute height map
    height_map = {}
    raw_noise_values = [] # To track noise range for normalization
    for x in range(-radius, radius + 1):
        for z in range(-radius, radius + 1):
            distance = math.sqrt(x**2 + z**2)
            if distance <= radius:
                # Micro noise (original roughness)
                micro_noise_value = noise.pnoise2(
                    x * micro_scale,
                    z * micro_scale,
                    octaves=octaves,
                    persistence=persistence,
                    lacunarity=lacunarity,
                    repeatx=1024,
                    repeaty=1024,
                    base=42
                )
                # Macro noise (large features)
                macro_noise_value = noise.pnoise2(
                    x * macro_scale, 
                    z * macro_scale,
                    octaves=4, # Fewer octaves for smoother large features
                    persistence=0.6,
                    lacunarity=2.0,
                    repeatx=1024,
                    repeaty=1024,
                    base=84 # Different base seed
                )
                
                # Combine noise: Add macro noise scaled by influence
                combined_noise = micro_noise_value + (macro_noise_value * macro_influence)
                raw_noise_values.append(combined_noise)
                height_map[(x, z)] = combined_noise # Store raw noise first

    # Determine the actual range of combined noise
    min_noise = min(raw_noise_values) if raw_noise_values else -1
    max_noise = max(raw_noise_values) if raw_noise_values else 1
    noise_range = max_noise - min_noise
    if noise_range == 0: noise_range = 1 # Avoid division by zero
    
    # Normalize combined noise to height (min_height to max_height)
    normalized_height_map = {}
    for pos, combined_noise in height_map.items():
        # Normalize noise (0 to 1)
        normalized = (combined_noise - min_noise) / noise_range
        # Scale to height range
        height = int(normalized * (max_height - min_height)) + min_height
        normalized_height_map[pos] = height

    # Debug: Raw height range (after normalization)
    raw_heights = [h for h in normalized_height_map.values()]
    print(f"Raw height range: min={min(raw_heights)}, max={max(raw_heights)}, avg={sum(raw_heights)/len(raw_heights):.1f}")
    
    # Enforce single-step height changes (use normalized_height_map now)
    smoothed_height_map = normalized_height_map.copy()
    for _ in range(2):
        for x in range(-radius, radius + 1):
            for z in range(-radius, radius + 1):
                if (x, z) in smoothed_height_map:
                    neighbors = []
                    for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nx, nz = x + dx, z + dz
                        if (nx, nz) in smoothed_height_map:
                            neighbors.append(smoothed_height_map[(nx, nz)])
                    if neighbors:
                        min_neighbor = min(neighbors)
                        max_neighbor = max(neighbors)
                        current = smoothed_height_map[(x, z)]
                        # Clamp height change to 1 step up/down from neighbours
                        new_height = max(min_neighbor - 1, min(max_neighbor + 1, current))
                        # Ensure height doesn't go below min_height during smoothing
                        new_height = max(min_height, new_height) 
                        smoothed_height_map[(x, z)] = new_height
    
    # Debug: Final height range (using smoothed map now)
    smoothed_heights = [h for h in smoothed_height_map.values()]
    print(f"Smoothed height range: min={min(smoothed_heights)}, max={max(smoothed_heights)}, avg={sum(smoothed_heights)/len(smoothed_heights):.1f}")
    
    # Generate noise for voidsoil patches
    patch_map = {}
    for x in range(-radius, radius + 1):
        for z in range(-radius, radius + 1):
            distance = math.sqrt(x**2 + z**2)
            if distance <= radius:
                patch_value = noise.pnoise2(
                    x * patch_scale,
                    z * patch_scale,
                    octaves=4,
                    persistence=0.5,
                    lacunarity=2.0,
                    repeatx=1024,
                    repeaty=1024,
                    base=99
                )
                patch_map[(x, z)] = patch_value
    
    # --- Revised Block Placement --- 
    water_count = 0
    water_coords = []
    for (x, z), terrain_height in smoothed_height_map.items(): # Use smoothed map directly
        # Place terrain blocks up to the natural height
        # Voidsoil below the top layer
        for y in range(0, terrain_height):
            blocks[f"{x},{y},{z}"] = 1 # voidsoil
        
        # Top terrain layer (grass or soil)
        patch_value = patch_map.get((x, z), 0) # Get patch value
        top_block_id = 2 if patch_value > -0.1 else 1 # 2=voidgrass, 1=voidsoil
        blocks[f"{x},{terrain_height},{z}"] = top_block_id
        
        # Fill with water if below water threshold
        if terrain_height < water_threshold:
            for y_water in range(terrain_height + 1, water_threshold + 1):
                blocks[f"{x},{y_water},{z}"] = 4 # water
                water_count += 1
                if water_count <= 10:
                    water_coords.append((x, y_water, z))

    # Debug: Report water blocks
    print(f"Water blocks placed: {water_count}")
    if water_count > 0:
        print(f"Sample water coordinates (up to 10): {water_coords}")

    # --- Place Environment Models --- 
    if environment_models:
        print(f"Attempting to place environment models with density {model_density:.2f}...")
        model_placement_noise = {}
        # Generate noise map for model placement clustering
        for x in range(-radius, radius + 1):
            for z in range(-radius, radius + 1):
                 distance = math.sqrt(x**2 + z**2)
                 if distance <= radius:
                    model_placement_noise[(x,z)] = noise.pnoise2(
                        x * model_placement_scale, 
                        z * model_placement_scale,
                        octaves=3, persistence=0.5, lacunarity=2.0,
                        repeatx=1024, repeaty=1024, base=123 # Different base seed
                    )
        
        placed_model_count = 0
        for (x, z), terrain_height in smoothed_height_map.items():
            # Check if it's land (not water) and not too close to the edge
            if terrain_height > water_threshold and math.sqrt(x**2 + z**2) < radius - 5:
                # Use noise value and density to determine placement
                noise_val = model_placement_noise.get((x, z), -1) # Get noise value for clustering
                # Adjust density based on noise (more likely to place in higher noise areas)
                placement_chance = model_density * ((noise_val + 1) / 2) # Map noise [-1, 1] to [0, 1]
                
                if random.random() < placement_chance:
                    # Choose a random model from the list
                    model_info = random.choice(environment_models)
                    
                    # Randomize scale
                    min_s = model_info.get('min_scale', 0.9)
                    max_s = model_info.get('max_scale', 1.1)
                    scale = random.uniform(min_s, max_s)
                                        
                    # --- Apply model-specific Y offset if provided ---                    
                    # model_y_offset = model_info.get('y_offset', 0.0) # Get offset, default to 0 -- REMOVED as models are now fixed
                    # --- Calculate offset based on scale (assuming origin was centered before fixing, and height=1) ---
                    scale_offset = scale / 2.0 
                    placement_y = float(terrain_height + 1) + scale_offset
                    
                    # --- Center the model on the block ---                    
                    placement_x = float(x) + 0.5
                    placement_z = float(z) + 0.5
                    
                    # Randomize rotation (around Y axis)
                    angle_rad = random.uniform(0, 2 * math.pi)
                    # Convert angle to quaternion (simple Y rotation)
                    # w = cos(angle/2), y = sin(angle/2)
                    quat_w = math.cos(angle_rad / 2)
                    quat_y = math.sin(angle_rad / 2)
                    rotation = {"x": 0, "y": quat_y, "z": 0, "w": quat_w}
                    
                    # Format coordinate key using centered X/Z
                    coord_key = f"{placement_x:.4f},{placement_y:.4f},{placement_z:.4f}" # Format Y with precision
                    
                    # Create entity dictionary
                    entities[coord_key] = {
                        "modelUri": model_info['uri'],
                        "name": model_info.get('name', model_info['uri'].split('/')[-1].split('.')[0]), # Default name from URI
                        "modelScale": scale,
                        "opacity": 0.99,
                        "modelLoopedAnimations": ["idle"], # Assuming idle animation exists
                        "rigidBodyOptions": {
                            "type": "kinematic_velocity", # FIX: Use string enum value from SDK definition
                            "rotation": rotation
                        }
                    }
                    placed_model_count += 1
                    
        print(f"Placed {placed_model_count} models.")

    # Generate the dome with shadowrock
    base_wall_height = 4
    skip_rows = 12
    
    # Base wall: solid shadowrock near the edge
    for x in range(-radius, radius + 1):
        for z in range(-radius, radius + 1):
            distance = math.sqrt(x**2 + z**2)
            if distance > radius - 2:
                terrain_height = smoothed_height_map.get((x, z), 0)
                for y in range(terrain_height + 1, terrain_height + base_wall_height + 1):
                    blocks[f"{x},{y},{z}"] = 3
    
    # Generate shadowrock panels for the ceiling
    panel_count = random.randint(min_panels, max_panels)
    for _ in range(panel_count):
        angle = random.uniform(0, 2 * math.pi)
        dist = random.uniform(radius * 0.3, radius * 0.9)
        center_x = int(dist * math.cos(angle))
        center_z = int(dist * math.sin(angle))
        dome_y_center = int(dome_height * math.sqrt(1 - (dist / radius)**2)) + max_height
        
        panel_radius = random.randint(min_panel_size, max_panel_size)
        
        for dx in range(-panel_radius, panel_radius + 1):
            for dz in range(-panel_radius, panel_radius + 1):
                x = center_x + dx
                z = center_z + dz
                distance = math.sqrt(x**2 + z**2)
                if distance <= radius and math.sqrt(dx**2 + dz**2) <= panel_radius:
                    dome_y = int(dome_height * math.sqrt(1 - (distance / radius)**2)) + max_height
                    for y in range(dome_y - 2, dome_y + 1):
                        if y >= max_height + base_wall_height + skip_rows:
                            blocks[f"{x},{y},{z}"] = 3
    
    # Add shadowrock platform at the top center
    shadowrock_radius = 5
    for x in range(-shadowrock_radius, shadowrock_radius + 1):
        for z in range(-shadowrock_radius, shadowrock_radius + 1):
            if math.sqrt(x**2 + z**2) <= shadowrock_radius:
                blocks[f"{x},{dome_height + max_height},{z}"] = 3
    
    # Construct the map
    map_data = {
        "blockTypes": block_types,
        "blocks": blocks,
        "entities": entities
    }
    
    # Save to JSON file
    with open("hytopia_map.json", "w") as f:
        json.dump(map_data, f, indent=2)
    
    return map_data

# Example usage
if __name__ == "__main__":
    # Define the models you want to place
    models_to_place = [
        {
            "uri": "models/environment/overseer-mushroom-1.glb",
            "name": "mushroom-1",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-mushroom-2.glb",
            "name": "mushroom-2",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-mushroom-3.glb",
            "name": "mushroom-3",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-mushroom-4.glb",
            "name": "mushroom-4",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-mushroom-5.glb",
            "name": "mushroom-5",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-plant-1.glb",
            "name": "plant-1",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-plant-2.glb",
            "name": "plant-2",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-plant-3.glb",
            "name": "plant-3",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-plant-4.glb",
            "name": "plant-4",
            "min_scale": 1.0,
            "max_scale": 1.5
        },
        {
            "uri": "models/flora/overseer-tree-1.glb",
            "name": "tree-1",
            "min_scale": 2.0,
            "max_scale": 4.0
        },
        {
            "uri": "models/flora/overseer-tree-2.glb",
            "name": "tree-2",
            "min_scale": 2.0,
            "max_scale": 4.0
        },
        {
            "uri": "models/flora/overseer-tree-3.glb",
            "name": "tree-3",
            "min_scale": 2.0,
            "max_scale": 4.0
        },
    ]
    
    map_data = generate_hytopia_map(
        radius=50,
        min_height=1,
        max_height=15,
        roughness=0.05,
        macro_scale=0.015, # Slightly smaller large features
        macro_influence=1.2, # Slightly stronger large features
        water_threshold=6,
        dome_height=50,
        min_panels=20,
        max_panels=25,
        min_panel_size=8,
        max_panel_size=12,
        patch_scale=0.03,
        # Pass the models and density settings
        environment_models=models_to_place,
        model_density=0.24, # Increase density slightly
        model_placement_scale=0.08 # Adjust clustering noise scale
    )
    print("Map generated and saved to 'hytopia_map.json'")