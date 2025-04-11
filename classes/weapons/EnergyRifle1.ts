import {
    World,
    Vector3,
    Quaternion,
    PlayerEntity
} from 'hytopia';
import type {
    EntityOptions,
    Vector3Like,
    QuaternionLike
} from 'hytopia';

import BaseWeaponEntity from './BaseWeaponEntity';
import EnergyProjectile from '../entities/EnergyProjectile';

// Define default options for this specific weapon (similar to AK47Entity)
const DEFAULT_ENERGY_RIFLE_OPTIONS = {
    name: 'Energy Rifle',
    modelUri: 'models/weapons/energy_rifle_1.glb',
    modelScale: 1.3,
    damage: 15,
    fireRate: 8,
    // Animation names using Hygrounds conventions
    idleAnimation: 'idle_gun_both',
    walkAnimation: 'walk_gun_both',
    runAnimation: 'run_gun_both',
    mlAnimation: 'shoot_gun_both',
    // Item properties
};

export default class EnergyRifle1 extends BaseWeaponEntity {
    constructor(options: Partial<EntityOptions & {
        damage?: number;
        fireRate?: number;
        idleAnimation?: string;
        walkAnimation?: string;
        runAnimation?: string;
        mlAnimation?: string;
        iconImageUri?: string;
    }> = {}) {
        // Merge default options with provided options
        super({
            ...DEFAULT_ENERGY_RIFLE_OPTIONS,
            ...options
        });
    }

    /**
     * Gets the position and rotation for muzzle flash (similar to AK47Entity)
     */
    public getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
        return {
            position: { x: 0, y: 0.01, z: -1.25 },
            rotation: Quaternion.fromEuler(0, 90, 0),
        };
    }

    /**
     * Fires the energy rifle.
     */
    public fire(): void {
        const owner = this.getOwner();

        // Ensure the weapon is owned, the owner is spawned, and cooldown is ready
        if (!owner || !owner.isSpawned || !owner.world) {
            return;
        }
        if (!this.processFire()) {
            return;
        }

        const world = owner.world;

        // Get camera details for aiming
        const camera = owner.player?.camera;
        if (!camera) {
            this._logger.error('Cannot fire: Owner has no camera reference.');
            return;
        }

        // Play firing animation on the owner (player)
        owner.startModelOneshotAnimations([this.mlAnimation]); 
        // TODO: Could add muzzle flash here using getMuzzleFlashPositionRotation
        
        const facingDirection = camera.facingDirection;
        const ownerPosition = owner.position;

        // Calculate a starting position slightly in front of the player's camera
        const eyeLevelOffset = camera.offset.y || 0.6; 
        const spawnOffsetDist = 0.5;
        const spawnPosition: Vector3Like = {
            x: ownerPosition.x + facingDirection.x * spawnOffsetDist,
            y: ownerPosition.y + eyeLevelOffset + facingDirection.y * spawnOffsetDist,
            z: ownerPosition.z + facingDirection.z * spawnOffsetDist,
        };

        // Create and spawn the projectile
        const projectile = new EnergyProjectile({
            damage: this._damage,
            shooter: owner
        });

        projectile.spawn(world, spawnPosition, facingDirection);
    }
} 