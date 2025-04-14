import {
    Vector3,
    Quaternion,
    Entity
} from 'hytopia';
import type {
    EntityOptions,
    Vector3Like,
    QuaternionLike
} from 'hytopia';

import BaseEnergyWeaponEntity from './BaseEnergyWeaponEntity';
import BFGProjectile from '../entities/BFGProjectile';
import BaseEnergyProjectile from '../entities/BaseEnergyProjectile';

// Define default options for this specific weapon
const DEFAULT_BFG_OPTIONS = {
    name: 'BFG',
    modelUri: 'models/weapons/bfg.glb',
    modelScale: 3.0,
    damage: 20, // Baseline damage
    fireRate: 1, // Low fire rate, doesn't really matter with energy depletion
    // Animation names using Hygrounds conventions
    idleAnimation: 'idle_gun_both',
    mlAnimation: 'shoot_gun_both',
    // Item properties
    iconImageUri: 'icons/weapons/bfg.png',
    // Energy weapon specific
    cooldownMs: 500, // Can fire quickly if energy allows (but it won't)
    maxEnergy: 100, // Maximum energy capacity
    energyPerShot: 100, // Consume all energy in one shot
    energyRechargeRate: 100 / 60, // Recharge rate: maxEnergy / 60 seconds
    fullRechargeTimeMs: 60000, // Time for a full recharge when depleted (60 seconds)
    energyBarColor: 'yellow' // Energy bar color in UI - yellow for BFG
};

export default class BFG extends BaseEnergyWeaponEntity {
    constructor(options: Partial<EntityOptions & {
        damage?: number;
        fireRate?: number;
        idleAnimation?: string;
        mlAnimation?: string;
        iconImageUri?: string;
        cooldownMs?: number;
        maxEnergy?: number;
        energyPerShot?: number;
        energyRechargeRate?: number;
        fullRechargeTimeMs?: number;
        energyBarColor?: string;
        fireSoundUri?: string;
    }> = {}) {
        // Merge default options with provided options
        super({
            ...DEFAULT_BFG_OPTIONS,
            fireSoundUri: 'audio/sfx/weapons/bfg-shot.mp3',
            ...options
        });
    }

    /**
     * Override to create a BFG-specific projectile
     */
    protected override createProjectile(shooter: Entity): BaseEnergyProjectile {
        return new BFGProjectile({
            damage: this._damage * 1.5, // BFG does extra damage
            shooter: shooter
        });
    }

    /**
     * Gets the position and rotation for muzzle flash (implement abstract method from parent)
     */
    public getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike } {
        return {
            position: { x: 0, y: 0.01, z: -1.25 },
            rotation: Quaternion.fromEuler(0, 90, 0),
        };
    }
    
    /**
     * Override the equipped position for this specific weapon
     */
    protected override getEquippedPosition(): Vector3Like {
        return { x: 1.05, y: 0.9, z: -0.4 };
    }
    
    /**
     * Override the equipped rotation for this specific weapon
     */
    protected override getEquippedRotation(): QuaternionLike {
        return Quaternion.fromEuler(-95, 5, -90);
    }

    /**
     * Override startDespawnTimer to prevent the BFG from despawning.
     */
    public override startDespawnTimer(): void {
        this._logger.info('BFG despawn timer explicitly prevented.');
        // Do nothing
    }
} 