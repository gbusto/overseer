import {
    World,
    Vector3,
    Quaternion,
    PlayerEntity,
    EntityEvent,
    Entity
} from 'hytopia';
import type {
    EntityOptions,
    Vector3Like,
    QuaternionLike
} from 'hytopia';

import BaseWeaponEntity from './BaseWeaponEntity';
import EnergyProjectile from '../entities/EnergyProjectile';
import BaseEnergyProjectile from '../entities/BaseEnergyProjectile';

export default abstract class BaseEnergyWeaponEntity extends BaseWeaponEntity {
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
    protected _lastRechargeUpdateSent: number = 0; // Track last recharge status message time
    protected _needsToStartFullRecharge: boolean = false; // Flag to defer recharge start
    protected _energyBarColor: string; // Color of the energy bar in UI

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
        super(options);

        // Initialize energy weapon properties
        this._cooldownMs = options.cooldownMs ?? 500;
        this._maxEnergy = options.maxEnergy ?? 100;
        this._energyPerShot = options.energyPerShot ?? 12;
        this._energyRechargeRate = options.energyRechargeRate ?? 3;
        this._fullRechargeTimeMs = options.fullRechargeTimeMs ?? 15000;
        this._energyBarColor = options.energyBarColor ?? 'yellow';
        
        // Start with full energy
        this._currentEnergy = this._maxEnergy;
        this._lastEnergyUpdateTime = Date.now();
        
        // Set up tick event for continuous energy recharge
        this.on(EntityEvent.TICK, this._onTick);
    }

    /**
     * Creates a projectile for this weapon
     * Override this in subclasses to create different projectile types
     * @param shooter The entity that fired the weapon
     * @returns A new projectile instance
     */
    protected createProjectile(shooter: Entity): BaseEnergyProjectile {
        return new EnergyProjectile({
            damage: this._damage,
            shooter: shooter
        });
    }

    /**
     * Handle energy recharge on tick
     */
    protected _onTick = ({ tickDeltaMs }: { tickDeltaMs: number }): void => {
        const owner = this.getOwner(); // Get owner once for potential use
        const now = Date.now();

        // --- Handle starting a full recharge deferred from fire() ---
        if (this._needsToStartFullRecharge) {
            this._isFullRecharging = true;
            this._rechargeStartTime = now; // Start timer now
            this._needsToStartFullRecharge = false; // Reset flag
            this._logger.info(`Deferred start of full recharge initiated on tick.`);

            // Send the initial depletion message from here now
            if (owner && owner.player) {
                owner.player.ui.sendData({
                    type: 'weapon-status',
                    message: `Energy depleted. Recharging...`,
                    energyLevel: 0,
                    maxEnergy: this._maxEnergy,
                    isRecharging: true,
                    rechargeProgress: 0,
                    energyBarColor: this._energyBarColor
                });
            }
            // We can now safely return or let the tick continue to process the first recharge step
            // Let's let it continue to potentially call _processFullRecharge immediately.
        }

        // --- Main Tick Logic ---

        // Don't do regular recharge or process full recharge if not spawned
        if (!this.isSpawned) return;

        // Handle processing the full recharge state (if active)
        if (this._isFullRecharging) {
            this._processFullRecharge();
            // Don't do regular recharge while full recharge is happening
            return; 
        }
        
        // --- Regular Continuous Energy Recharge ---
        if (this._currentEnergy < this._maxEnergy) {
            const elapsedSec = tickDeltaMs / 1000;
            const rechargeAmount = this._energyRechargeRate * elapsedSec;
            
            this._currentEnergy = Math.min(this._maxEnergy, this._currentEnergy + rechargeAmount);
            
            // Check if fully recharged during tick
            if (this._currentEnergy === this._maxEnergy) {
                // Ensure UI is updated when reaching max energy
                this._updateOwnerEnergyUI(); 
            }

            // Log energy level occasionally (once per second) to avoid spamming
            if (now - this._lastEnergyUpdateTime > 1000) {
                this._logger.debug(`Energy level: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy}`);
                this._lastEnergyUpdateTime = now;
                
                // Notify owner of energy level
                this._updateOwnerEnergyUI();
            }
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
        const owner = this.getOwner(); // Get owner once

        if (rechargeElapsed >= this._fullRechargeTimeMs) {
            // Recharge complete
            this._isFullRecharging = false;
            this._currentEnergy = this._maxEnergy;
            this._logger.info(`Energy weapon fully recharged. Energy: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy}`);

            // Send final completion message
            if (owner && owner.player) {
                owner.player.ui.sendData({
                    type: 'weapon-status',
                    message: 'Energy weapon recharged',
                    energyLevel: this._currentEnergy, // Should be maxEnergy here
                    maxEnergy: this._maxEnergy,
                    isRecharging: false,
                    energyBarColor: this._energyBarColor
                });
            }

            return true;
        } else {
            // Still recharging - send periodic updates (e.g., every second)
            if (currentTime - (this._lastRechargeUpdateSent || 0) > 1000) {
                 const remainingSecs = Math.ceil((this._fullRechargeTimeMs - rechargeElapsed) / 1000);
                 const rechargeProgress = rechargeElapsed / this._fullRechargeTimeMs;
                 this._logger.debug(`Recharging... ${remainingSecs}s remaining.`);

                 // Calculate the visual energy level based on progress
                 const visualEnergyLevel = this._maxEnergy * rechargeProgress;

                 if (owner && owner.player) {
                     owner.player.ui.sendData({
                         type: 'weapon-status',
                         message: `Recharging... ${remainingSecs}s`, // Use updated remaining time
                         energyLevel: visualEnergyLevel, // Send calculated level for visual feedback
                         maxEnergy: this._maxEnergy,
                         isRecharging: true,
                         rechargeProgress: rechargeProgress,
                         energyBarColor: this._energyBarColor
                     });
                 }
                 this._lastRechargeUpdateSent = currentTime; // Update timestamp
            }
            return false;
        }
    }

    /**
     * Get the weapon's current state
     */
    public getWeaponState(): { 
        energyLevel: number, 
        maxEnergy: number, 
        isRecharging: boolean, 
        rechargeProgress?: number,
        cooldownProgress?: number,
        energyBarColor: string
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
            cooldownProgress,
            energyBarColor: this._energyBarColor
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

        // Determine the message based on state
        let statusMessage = ''; // Default empty message
        if (this._isFullRecharging) {
            // Message will be handled separately when recharge starts/ends
        } else if (this.isInCooldown()) {
            // Could add cooldown message here if needed
        } else {
            // Default message shows shots remaining if not recharging or cooling down
            // statusMessage = `${shotsRemaining} shots remaining`; 
            // Let's avoid sending a constant message for now unless specifically needed
        }

        owner.player.ui.sendData({
            type: 'weapon-status',
            energyLevel: this._currentEnergy,
            maxEnergy: this._maxEnergy,
            shotsRemaining: shotsRemaining,
            isRecharging: this._isFullRecharging,
            message: statusMessage, // Send the determined message or empty string
            energyBarColor: this._energyBarColor
        });
    }

    /**
     * Fires the energy weapon.
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
                // Log that fire attempt failed, but periodic updates handle the UI message
                this._logger.info(`Cannot fire: Energy weapon is recharging.`);
                return;
            }
        }

        // Check cooldown
        if (this.isInCooldown()) {
            this._logger.info(`Cannot fire: Energy weapon is in cooldown.`);
            return;
        }

        // Check if we have enough energy for a shot
        if (this._currentEnergy < this._energyPerShot) {
            // DEFER starting the recharge to the next tick
            this._needsToStartFullRecharge = true; 
            this._logger.info(`Energy weapon depleted. Full recharge started (${this._fullRechargeTimeMs / 1000}s).`);
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
        this._logger.info(`Energy weapon fired. Energy: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy} (${shotsRemaining} shots remaining)`);
        
        // Notify player of remaining energy - use _updateOwnerEnergyUI for consistency
        this._updateOwnerEnergyUI(); 

        // Play firing animation on the owner (player)
        owner.startModelOneshotAnimations([this.mlAnimation]); 
        
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

        // Create and spawn the projectile using the createProjectile method
        const projectile = this.createProjectile(owner);
        projectile.spawn(world, spawnPosition, facingDirection);
    }

    public override equip(): void {
        // Call the parent equip method first
        super.equip();
        
        // Update the UI immediately to show the energy bar when equipped
        this._updateOwnerEnergyUI();
    }

    /**
     * Gets the position and rotation for muzzle flash 
     * Implement in child classes.
     */
    public abstract getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike };
} 