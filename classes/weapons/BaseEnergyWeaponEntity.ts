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

            console.log(`IS FULL RECHARGE WHEN TICKING ${this._isFullRecharging}`);

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
     * Gets the current state of the weapon for UI updates.
     * @returns An object containing energy level, max energy, recharging status, and cooldown progress.
     */
    public getWeaponState(): { 
        energyLevel: number, 
        maxEnergy: number, 
        isRecharging: boolean, 
        rechargeProgress?: number,
        cooldownProgress?: number,
        energyBarColor: string
    } {
        const now = Date.now();
        let cooldownProgress = 0;
        let rechargeProgress = 0;
        
        // Calculate cooldown progress
        if (this.isInCooldown()) {
            cooldownProgress = 1 - (now - this._lastFireTime) / this._cooldownMs;
        }
        
        // Calculate full recharge progress
        if (this._isFullRecharging) {
            rechargeProgress = (now - this._rechargeStartTime) / this._fullRechargeTimeMs;
            rechargeProgress = Math.max(0, Math.min(1, rechargeProgress)); // Clamp between 0 and 1
        }
        
        return {
            energyLevel: this._currentEnergy,
            maxEnergy: this._maxEnergy,
            isRecharging: this._isFullRecharging,
            rechargeProgress: this._isFullRecharging ? rechargeProgress : undefined,
            cooldownProgress: this.isInCooldown() ? cooldownProgress : undefined,
            energyBarColor: this._energyBarColor
        };
    }

    /**
     * Sends the current weapon energy status to the owner's UI.
     */
    protected _updateOwnerEnergyUI(): void {
        const owner = this.getOwner();
        if (owner && owner.player) {
            const state = this.getWeaponState();
            
            // Construct the message based on state
            let message = '';
            if (state.isRecharging) {
                const remainingSecs = Math.ceil((this._fullRechargeTimeMs * (1 - (state.rechargeProgress ?? 0))) / 1000);
                message = `Recharging... ${remainingSecs}s`;
            } else if (state.cooldownProgress !== undefined && state.cooldownProgress > 0) {
                // Optional: Add a cooldown message if needed
                // message = `Cooldown...`;
            }
            
            owner.player.ui.sendData({
                type: 'weapon-status',
                message: message,
                energyLevel: state.energyLevel,
                maxEnergy: state.maxEnergy,
                isRecharging: state.isRecharging,
                rechargeProgress: state.rechargeProgress,
                cooldownProgress: state.cooldownProgress,
                energyBarColor: state.energyBarColor
            });
            
            // Log the update sent
            // this._logger.debug(`Sent UI update: Energy=${state.energyLevel.toFixed(1)}, Recharging=${state.isRecharging}, Cooldown=${state.cooldownProgress?.toFixed(2)}, Message='${message}'`);
        }
    }

    /**
     * Perform the firing action if possible.
     */
    public fire(): void {
        const owner = this.getOwner();
        // Initial checks: Owner exists, not already recharging, not in standard cooldown
        if (!owner || !owner.world || this._isFullRecharging || this.isInCooldown()) {
            // Send UI update even if fire fails due to cooldown/recharge
            // if (owner) this._updateOwnerEnergyUI();
            return;
        }

        // Check if energy is less than required for a shot
        if (this._currentEnergy <= this._energyPerShot) {
            this._logger.debug(`Not enough energy to fire. Required: ${this._energyPerShot}, Has: ${this._currentEnergy.toFixed(1)}`);
            
            // Force energy to zero and trigger full recharge
            this._currentEnergy = 0; 
            this._needsToStartFullRecharge = true; 
            this._logger.info(`Energy depleted. Initiating full recharge sequence.`);
            
            // Update UI immediately to show empty state
            this._updateOwnerEnergyUI(); 
            // return; // Prevent firing
        }

        // If we have enough energy, proceed with firing:
        
        // Consume energy
        this._currentEnergy -= this._energyPerShot;
        this._lastFireTime = Date.now(); // Set cooldown start time
        this._logger.debug(`Fired weapon. Energy left: ${this._currentEnergy.toFixed(1)}/${this._maxEnergy}`);
        
        // Get camera details for aiming
        const camera = owner.player?.camera;
        if (!camera) {
            this._logger.error('Cannot fire: Owner has no camera reference.');
            // Still update UI even if camera fails
            this._updateOwnerEnergyUI(); 
            return;
        }
        
        const facingDirection = camera.facingDirection;
        const ownerPosition = owner.position;
        
        // Calculate projectile spawn position
        const eyeLevelOffset = camera.offset?.y ?? 0.6; 
        const spawnOffsetDist = 0.5; 
        const spawnPosition: Vector3Like = {
            x: ownerPosition.x + facingDirection.x * spawnOffsetDist,
            y: ownerPosition.y + eyeLevelOffset + facingDirection.y * spawnOffsetDist,
            z: ownerPosition.z + facingDirection.z * spawnOffsetDist,
        };
        
        // Create and spawn projectile
        const projectile = this.createProjectile(owner);
        projectile.spawn(owner.world, spawnPosition, facingDirection);
        this._logger.debug(`Spawned projectile ${projectile.name}`);
        
        // Play firing animation on the owner
        if (this.mlAnimation) {
            owner.startModelOneshotAnimations([this.mlAnimation]); 
        }
        
        // Play fire sound if available (using the property from BaseWeaponEntity)
        if (this._fireSoundAudio && owner.world) { // Check world exists on owner
            this._fireSoundAudio.play(owner.world, true);
        }
        
        // TODO: Implement muzzle flash effect
        
        // Update UI with new energy level and cooldown
        this._updateOwnerEnergyUI();
    }
    
    /**
     * Overrides the base equip method to send initial energy state.
     */
    public override equip(): void {
        super.equip(); // Call the base equip logic (positioning, animations)

        console.log(`IS FUL RECHARGE WHEN EQUIPPED ${this._isFullRecharging}`);
        
        // Send the initial energy state to the UI when equipped
        this._updateOwnerEnergyUI(); 
        this._logger.info(`${this.name} equipped. Sent initial UI state.`);
    }

    // Abstract method that must be implemented by subclasses
    public abstract getMuzzleFlashPositionRotation(): { position: Vector3Like, rotation: QuaternionLike };
} 