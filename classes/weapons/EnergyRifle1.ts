import {
    World,
    Vector3,
    Quaternion,
    PlayerEntity,
    EntityEvent
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
    iconImageUri: 'icons/weapons/energy_rifle_1.png',
    // Energy weapon specific
    cooldownMs: 1500, // 1.5 seconds between shots
    maxEnergy: 100, // Maximum energy capacity
    energyPerShot: 12, // Energy consumed per shot
    energyRechargeRate: 3, // Energy units recharged per second
    fullRechargeTimeMs: 15000 // Time for a full recharge when depleted
};

export default class EnergyRifle1 extends BaseWeaponEntity {
    // Energy weapon specific properties
    protected _cooldownMs: number;
    protected _maxEnergy: number;
    protected _currentEnergy: number;
    protected _energyPerShot: number;
    protected _energyRechargeRate: number;
    protected _fullRechargeTimeMs: number;
    protected _lastFireTime: number = 0;
    protected _isFullRecharging: boolean = false;
    protected _rechargeStartTime: number = 0;
    protected _lastEnergyUpdateTime: number = 0;

    constructor(options: Partial<EntityOptions & {
        damage?: number;
        fireRate?: number;
        idleAnimation?: string;
        walkAnimation?: string;
        runAnimation?: string;
        mlAnimation?: string;
        iconImageUri?: string;
        cooldownMs?: number;
        maxEnergy?: number;
        energyPerShot?: number;
        energyRechargeRate?: number;
        fullRechargeTimeMs?: number;
    }> = {}) {
        // Merge default options with provided options
        super({
            ...DEFAULT_ENERGY_RIFLE_OPTIONS,
            ...options
        });

        // Initialize energy weapon properties
        this._cooldownMs = options.cooldownMs ?? DEFAULT_ENERGY_RIFLE_OPTIONS.cooldownMs;
        this._maxEnergy = options.maxEnergy ?? DEFAULT_ENERGY_RIFLE_OPTIONS.maxEnergy;
        this._energyPerShot = options.energyPerShot ?? DEFAULT_ENERGY_RIFLE_OPTIONS.energyPerShot;
        this._energyRechargeRate = options.energyRechargeRate ?? DEFAULT_ENERGY_RIFLE_OPTIONS.energyRechargeRate;
        this._fullRechargeTimeMs = options.fullRechargeTimeMs ?? DEFAULT_ENERGY_RIFLE_OPTIONS.fullRechargeTimeMs;
        
        // Start with full energy
        this._currentEnergy = this._maxEnergy;
        this._lastEnergyUpdateTime = Date.now();
        
        // Set up tick event for continuous energy recharge
        this.on(EntityEvent.TICK, this._onTick);
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

    /**
     * Handle energy recharge on tick
     */
    protected _onTick = ({ tickDeltaMs }: { tickDeltaMs: number }): void => {
        // Don't recharge if not spawned or in full recharge mode
        if (!this.isSpawned || this._isFullRecharging) return;
        
        const now = Date.now();
        
        // Update continuous energy recharge
        if (!this._isFullRecharging && this._currentEnergy < this._maxEnergy) {
            const elapsedSec = tickDeltaMs / 1000;
            const rechargeAmount = this._energyRechargeRate * elapsedSec;
            
            this._currentEnergy = Math.min(this._maxEnergy, this._currentEnergy + rechargeAmount);
            
            // Log energy level occasionally (once per second) to avoid spamming
            if (now - this._lastEnergyUpdateTime > 1000) {
                this._logger.debug(`Energy level: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy}`);
                this._lastEnergyUpdateTime = now;
                
                // Notify owner of energy level
                this._updateOwnerEnergyUI();
            }
        }
        
        // Check if full recharge is complete
        if (this._isFullRecharging) {
            this._processFullRecharge();
        }
    }

    /**
     * Check if the weapon is currently in cooldown
     */
    protected isInCooldown(): boolean {
        const currentTime = Date.now();
        return currentTime - this._lastFireTime < this._cooldownMs;
    }

    /**
     * Process full recharge state and update accordingly
     * @returns True if recharge is complete, false if still recharging
     */
    protected _processFullRecharge(): boolean {
        if (!this._isFullRecharging) return true;
        
        const currentTime = Date.now();
        const rechargeElapsed = currentTime - this._rechargeStartTime;
        
        if (rechargeElapsed >= this._fullRechargeTimeMs) {
            // Recharge complete
            this._isFullRecharging = false;
            this._currentEnergy = this._maxEnergy;
            this._logger.info(`Energy Rifle fully recharged. Energy: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy}`);
            
            // Notify player if the weapon has an owner
            const owner = this.getOwner();
            if (owner && owner.player) {
                owner.player.ui.sendData({
                    type: 'weapon-status',
                    message: 'Energy Rifle recharged',
                    energyLevel: this._currentEnergy,
                    maxEnergy: this._maxEnergy,
                    isRecharging: false
                });
            }
            
            return true;
        }
        
        // Still recharging
        return false;
    }

    /**
     * Get the weapon's current state
     */
    public getWeaponState(): { 
        energyLevel: number, 
        maxEnergy: number, 
        isRecharging: boolean, 
        rechargeProgress?: number,
        cooldownProgress?: number
    } {
        const currentTime = Date.now();
        let rechargeProgress;
        let cooldownProgress;
        
        if (this._isFullRecharging) {
            const elapsed = currentTime - this._rechargeStartTime;
            rechargeProgress = Math.min(1, elapsed / this._fullRechargeTimeMs);
        }
        
        if (this.isInCooldown()) {
            const elapsed = currentTime - this._lastFireTime;
            cooldownProgress = Math.min(1, elapsed / this._cooldownMs);
        }
        
        return {
            energyLevel: this._currentEnergy,
            maxEnergy: this._maxEnergy,
            isRecharging: this._isFullRecharging,
            rechargeProgress,
            cooldownProgress
        };
    }

    /**
     * Update the owner's UI with current energy status
     */
    protected _updateOwnerEnergyUI(): void {
        const owner = this.getOwner();
        if (!owner || !owner.player) return;

        // Calculate shots remaining (rounded down)
        const shotsRemaining = Math.floor(this._currentEnergy / this._energyPerShot);
        
        owner.player.ui.sendData({
            type: 'weapon-status',
            energyLevel: this._currentEnergy,
            maxEnergy: this._maxEnergy,
            shotsRemaining: shotsRemaining,
            isRecharging: this._isFullRecharging
        });
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

        // Check if weapon is in full recharge mode
        if (this._isFullRecharging) {
            if (!this._processFullRecharge()) {
                const elapsed = Date.now() - this._rechargeStartTime;
                const remainingSecs = Math.ceil((this._fullRechargeTimeMs - elapsed) / 1000);
                this._logger.info(`Cannot fire: Energy Rifle is recharging. ${remainingSecs}s remaining.`);
                
                // Notify player about recharge status
                if (owner.player) {
                    owner.player.ui.sendData({
                        type: 'weapon-status',
                        message: `Recharging... ${remainingSecs}s remaining`,
                        isRecharging: true,
                        rechargeProgress: elapsed / this._fullRechargeTimeMs
                    });
                }
                return;
            }
        }

        // Check cooldown
        if (this.isInCooldown()) {
            this._logger.info(`Cannot fire: Energy Rifle is in cooldown.`);
            return;
        }

        // Check if we have enough energy for a shot
        if (this._currentEnergy < this._energyPerShot) {
            // Start full recharging
            this._isFullRecharging = true;
            this._rechargeStartTime = Date.now();
            this._logger.info(`Energy Rifle depleted. Full recharge started (${this._fullRechargeTimeMs / 1000}s).`);
            
            // Notify player
            if (owner.player) {
                owner.player.ui.sendData({
                    type: 'weapon-status',
                    message: `Energy depleted. Recharging...`,
                    isRecharging: true,
                    rechargeProgress: 0
                });
            }
            return;
        }

        // Perform basic fire processing
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

        // Update cooldown and energy tracking
        this._lastFireTime = Date.now();
        this._currentEnergy -= this._energyPerShot;
        
        const shotsRemaining = Math.floor(this._currentEnergy / this._energyPerShot);
        this._logger.info(`Energy Rifle fired. Energy: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy} (${shotsRemaining} shots remaining)`);
        
        // Notify player of remaining energy
        if (owner.player) {
            owner.player.ui.sendData({
                type: 'weapon-status',
                message: `Energy: ${Math.floor(this._currentEnergy)}/${this._maxEnergy}`,
                energyLevel: this._currentEnergy,
                maxEnergy: this._maxEnergy,
                shotsRemaining: shotsRemaining
            });
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