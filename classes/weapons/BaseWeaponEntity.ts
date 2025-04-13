import {
    Entity,
    RigidBodyType,
    ColliderShape,
    World,
    Vector3,
    Quaternion,
    EntityEvent,
    PlayerEntity,
    PlayerEntityController,
    CollisionGroup,
    Collider
} from 'hytopia';

import type {
    EntityOptions,
    Vector3Like,
    QuaternionLike,
    ModelEntityOptions
} from 'hytopia';
// Use type import to break circular dependency
import type GamePlayerEntity from '../entities/GamePlayerEntity'; 

import { Logger } from '../../utils/logger';

// Constants from Hygrounds
const INVENTORIED_POSITION = { x: 0, y: -300, z: 0 };

export default abstract class BaseWeaponEntity extends Entity {
    protected _logger: Logger;
    protected _damage: number;
    protected _fireRate: number; // Shots per second
    protected _cooldownMs: number; // Calculated from fireRate
    protected _lastFiredTime: number = 0;
    
    // Weapon item properties
    public readonly iconImageUri: string;
    private _despawnTimer: NodeJS.Timeout | undefined;

    // Animation Names (using Hygrounds conventions)
    public idleAnimation: string = 'idle_gun_both'; 
    public mlAnimation: string = 'shoot_gun_both'; 

    // Updated constructor options to include parent details
    constructor(options: Partial<EntityOptions & {
        damage?: number;
        fireRate?: number;
        iconImageUri?: string;
        // Animation options using Hygrounds names
        idleAnimation?: string;
        mlAnimation?: string;
    }> = {}) {
        // Create physics setup similar to Hygrounds
        // We'll use a simple physics setup that keeps weapons from falling through the ground
        const rigidBodyOptions = {
            type: RigidBodyType.DYNAMIC,
            enabledRotations: { x: false, y: true, z: false },
            colliders: [{
                shape: ColliderShape.BLOCK,
                halfExtents: { x: 0.15, y: 0.5, z: 0.5 }, // Larger to prevent falling through
                mass: 1,
                friction: 0.9, // Higher friction to prevent sliding
                restitution: 0.1, // Low bounciness
                collisionGroups: {
                    belongsTo: [CollisionGroup.ENTITY],
                    collidesWith: [CollisionGroup.BLOCK]
                }
            }]
        };

        super({
            name: 'BaseWeapon',
            rigidBodyOptions: rigidBodyOptions,
            // Pass parent and parentNodeName if provided in options
            parent: options.parent,
            parentNodeName: options.parentNodeName || 'hand_right_anchor',
            opacity: 0.99,
            ...options 
        });

        this._logger = new Logger(this.constructor.name);
        this._damage = options.damage ?? 10;
        this._fireRate = options.fireRate ?? 5; 
        this._cooldownMs = 1000 / this._fireRate;
        this.iconImageUri = options.iconImageUri ?? 'icons/weapons/default_weapon.png';

        // Store animation names from options, falling back to defaults
        this.idleAnimation = options.idleAnimation ?? this.idleAnimation;
        this.mlAnimation = options.mlAnimation ?? this.mlAnimation;

        if (this.parent && this.parentNodeName) {
             this._logger.info(`Created and attached to parent ${this.parent.name} at node ${this.parentNodeName}`);
        } else {
             this._logger.info(`Created standalone weapon.`);
        }
    }

    /**
     * Gets the owner of the weapon, if attached.
     * @returns The PlayerEntity owner or null.
     */
    protected getOwner(): PlayerEntity | null {
        // Ensure parent exists and is the correct type
        if (this.parent instanceof PlayerEntity) {
            return this.parent;
        }
        return null;
    }

    /**
     * Checks if the weapon can currently be fired (based on cooldown).
     * @returns True if the weapon can fire, false otherwise.
     */
    protected canFire(): boolean {
        const now = Date.now();
        if (now >= this._lastFiredTime + this._cooldownMs) {
            return true;
        }
        return false;
    }

    /**
     * Processes a fire attempt. Updates the last fired time if successful.
     * @returns True if the fire attempt is successful (cooldown passed), false otherwise.
     */
    protected processFire(): boolean {
        if (this.canFire()) {
            this._lastFiredTime = Date.now();
            return true;
        }
        return false;
    }

    /**
     * Abstract method to be implemented by subclasses to perform the actual firing action.
     */
    public abstract fire(): void;

    /**
     * Drops the weapon from the player's hand to the world
     */
    public drop(fromPosition: Vector3Like, direction: Vector3Like): void {
        if (!this.world) return;

        this.startDespawnTimer();
        this.setParent(undefined, undefined, fromPosition);

        // Apply impulse in next tick to avoid physics issues
        setTimeout(() => {
            this.applyImpulse({
                x: direction.x * this.mass * 7,
                y: direction.y * this.mass * 15,
                z: direction.z * this.mass * 7,
            });
        }, 0);
    }

    /**
     * Called when the weapon is picked up by a player
     */
    public pickup(player: PlayerEntity): void {
        if (!player.world || typeof (player as any).equipWeapon !== 'function') {
            this._logger.error(`Pickup failed: player.world=${!!player.world}, has equipWeapon=${typeof (player as any).equipWeapon === 'function'}`);
            return;
        }

        this._logger.info(`Pickup starting - stopping despawn timer`);
        this.stopDespawnTimer();
        
        // Set parent to player but keep at current position temporarily
        // We'll set final position in equip() which is called immediately after
        this._logger.info(`Setting parent to player at current relative position`);
        this.setParent(player, 'hand_right_anchor');
        
        this._logger.info(`Calling player.equipWeapon()`);
        // Call the equipWeapon method using type assertion
        // This is safe since we've already checked the method exists
        (player as any).equipWeapon(this);
    }

    /**
     * Sets the owner's animations to match this weapon.
     */
    public setParentAnimations(): void {
        const owner = this.getOwner();
        if (!owner || typeof (owner as any).playerController !== 'object') return;

        const controller = (owner as any).playerController;
        if (!controller) return;

        // Updated to match Hygrounds ItemEntity.setParentAnimations()
        controller.idleLoopedAnimations = [this.idleAnimation, 'idle_lower'];
        controller.walkLoopedAnimations = [this.idleAnimation, 'walk_lower'];
        controller.runLoopedAnimations = [this.idleAnimation, 'run_lower'];

        this._logger.info(`Set parent (${owner.name}) animations for ${this.name}`);
    }

    /**
     * Called when the weapon is equipped.
     */
    public equip(): void {
        this._logger.info(`Equip called - positioning weapon and rotating`);
        
        // Debug: Check if still attached to parent
        if (!this.parent) {
            this._logger.error(`ERROR: No parent in equip() - weapon detached!`);
        } else {
            this._logger.info(`Parent in equip(): ${this.parent.name}, parentNodeName: ${this.parentNodeName}`);
        }
        
        // Set position and rotation - uses virtual methods that subclasses can override
        this.setPosition(this.getEquippedPosition());
        this.setRotation(this.getEquippedRotation());
        
        this._logger.info(`Setting parent animations`);
        this.setParentAnimations();
    }

    /**
     * Gets the position for this weapon when equipped.
     * Override in child classes for weapon-specific positioning.
     */
    protected getEquippedPosition(): Vector3Like {
        // Default position - child classes should override with their own values
        return { x: 0.3, y: -0.2, z: -0.4 };
    }
    
    /**
     * Gets the rotation for this weapon when equipped.
     * Override in child classes for weapon-specific rotation.
     */
    protected getEquippedRotation(): QuaternionLike {
        // Default rotation - child classes should override with their own values
        return Quaternion.fromEuler(-45, 0, 0);
    }

    /**
     * Called when the weapon is unequipped.
     */
    public unequip(): void {
        const owner = this.getOwner();
        if (owner && typeof (owner as any).resetAnimations === 'function') {
            // Call resetAnimations using type assertion
            (owner as any).resetAnimations();
        }
        this.setPosition(INVENTORIED_POSITION);
    }

    /**
     * Starts a despawn timer for weapons dropped in the world
     */
    public startDespawnTimer(): void {
        if (this._despawnTimer) return;

        this._despawnTimer = setTimeout(() => {
            if (this.isSpawned) {
                this.despawn();
            }
        }, 30000); // 30 seconds before despawn
    }

    /**
     * Stops the despawn timer when weapon is picked up
     */
    public stopDespawnTimer(): void {
        if (!this._despawnTimer) return;

        clearTimeout(this._despawnTimer);
        this._despawnTimer = undefined;
    }

    // Spawn method remains simple
    public spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
        super.spawn(world, position, rotation);
        if (!this.parent) {
             this._logger.info(`Spawned standalone at ${JSON.stringify(position)}`);
        } else {
             this._logger.info(`Spawned attached to ${this.parent.name} with relative pos ${JSON.stringify(position)}`);
        }
    }
}