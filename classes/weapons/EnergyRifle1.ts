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
import EnergyProjectile from '../entities/EnergyProjectile';
import BaseEnergyProjectile from '../entities/BaseEnergyProjectile';

// Define default options for this specific weapon
const DEFAULT_ENERGY_RIFLE_OPTIONS = {
    name: 'Energy Rifle',
    modelUri: 'models/weapons/energy_rifle_1.glb',
    modelScale: 1.3,
    damage: 15,
    fireRate: 8,
    // Animation names using Hygrounds conventions
    idleAnimation: 'idle_gun_both',
    mlAnimation: 'shoot_gun_both',
    // Item properties
    iconImageUri: 'icons/weapons/energy_rifle_1.png',
    // Energy weapon specific
    cooldownMs: 500, // 1.5 seconds between shots
    maxEnergy: 100, // Maximum energy capacity
    energyPerShot: 12, // Energy consumed per shot
    energyRechargeRate: 3, // Energy units recharged per second
    fullRechargeTimeMs: 15000, // Time for a full recharge when depleted
    energyBarColor: 'blue' // Energy bar color in UI - explicitly set to yellow
};

export default class EnergyRifle1 extends BaseEnergyWeaponEntity {
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
    }> = {}) {
        // Merge default options with provided options
        super({
            ...DEFAULT_ENERGY_RIFLE_OPTIONS,
            ...options
        });
    }

    /**
     * Override to explicitly use the standard EnergyProjectile
     */
    protected override createProjectile(shooter: Entity): BaseEnergyProjectile {
        return new EnergyProjectile({
            damage: this._damage,
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
        return { x: 0.4, y: 0.4, z: -0.4 };
    }
    
    /**
     * Override the equipped rotation for this specific weapon
     */
    protected override getEquippedRotation(): QuaternionLike {
        return Quaternion.fromEuler(-100, 5, -90);
    }
} 