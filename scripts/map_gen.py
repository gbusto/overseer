import json
import math
import noise
import random

def generate_hytopia_map(radius=125, max_height=5, roughness=0.05, dome_height=75,
                        min_panels=5, max_panels=10, min_panel_size=5, max_panel_size=15):
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
        }
    ]
    
    blocks = {}
    
    # Generate circular terrain with smoother Perlin noise
    scale = roughness  # Lower value = smoother, broader features
    octaves = 4        # Fewer octaves for less fine detail
    persistence = 0.5  # Controls amplitude of higher octaves
    lacunarity = 2.0   # Controls frequency of higher octaves
    
    # Precompute height map for smoothing
    height_map = {}
    for x in range(-radius, radius + 1):
        for z in range(-radius, radius + 1):
            distance = math.sqrt(x**2 + z**2)
            if distance <= radius:
                noise_value = noise.pnoise2(
                    x * scale,
                    z * scale,
                    octaves=octaves,
                    persistence=persistence,
                    lacunarity=lacunarity,
                    repeatx=1024,
                    repeaty=1024,
                    base=42
                )
                # Normalize noise (-1 to 1) to height (0 to max_height)
                height = int(((noise_value + 1) / 2) * max_height)
                height_map[(x, z)] = height
    
    # Smooth the height map
    smoothed_height_map = {}
    for x in range(-radius, radius + 1):
        for z in range(-radius, radius + 1):
            if (x, z) in height_map:
                # Average height with neighbors for smoother transitions
                total_height = height_map[(x, z)]
                count = 1
                for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:  # 4 adjacent neighbors
                    nx, nz = x + dx, z + dz
                    if (nx, nz) in height_map:
                        total_height += height_map[(nx, nz)]
                        count += 1
                smoothed_height = int(total_height / count)
                smoothed_height_map[(x, z)] = smoothed_height
    
    # Place blocks based on smoothed height map
    for (x, z), height in smoothed_height_map.items():
        for y in range(0, height):
            blocks[f"{x},{y},{z}"] = 1  # voidsoil
        blocks[f"{x},{height},{z}"] = 2  # voidgrass
    
    # Generate the dome with shadowrock
    base_wall_height = 4
    skip_rows = 12
    
    # Base wall: solid shadowrock for the first 3-4 rows near the edge
    for x in range(-radius, radius + 1):
        for z in range(-radius, radius + 1):
            distance = math.sqrt(x**2 + z**2)
            if distance > radius - 2:
                terrain_height = smoothed_height_map.get((x, z), 0)
                for y in range(terrain_height + 1, terrain_height + base_wall_height + 1):
                    blocks[f"{x},{y},{z}"] = 3  # shadowrock
    
    # Generate large shadowrock panels for the ceiling
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
                            blocks[f"{x},{y},{z}"] = 3  # shadowrock
    
    # Add shadowrock platform at the top center
    shadowrock_radius = 5
    for x in range(-shadowrock_radius, shadowrock_radius + 1):
        for z in range(-shadowrock_radius, shadowrock_radius + 1):
            if math.sqrt(x**2 + z**2) <= shadowrock_radius:
                blocks[f"{x},{dome_height + max_height},{z}"] = 3  # shadowrock
    
    # Construct the map
    map_data = {
        "blockTypes": block_types,
        "blocks": blocks
    }
    
    # Save to JSON file
    with open("hytopia_map.json", "w") as f:
        json.dump(map_data, f, indent=2)
    
    return map_data

# Example usage
if __name__ == "__main__":
    map_data = generate_hytopia_map(
        radius=50,
        max_height=5,
        roughness=0.05,    # Adjusted for smoother terrain
        dome_height=50,
        min_panels=20,
        max_panels=25,
        min_panel_size=8,
        max_panel_size=12
    )
    print("Map generated and saved to 'hytopia_map.json'")