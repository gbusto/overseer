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
    Collider,
    SceneUI
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

export default abstract class BaseWeaponEntity extends Entity {
    protected _logger: Logger;
    protected _damage: number;
    protected _fireRate: number; // Shots per second
    protected _cooldownMs: number; // Calculated from fireRate
    protected _lastFiredTime: number = 0;
    
    // Weapon item properties
    public readonly iconImageUri: string;
    private _despawnTimer: NodeJS.Timeout | undefined;
    
    // SceneUI for the label
    private _labelSceneUI: SceneUI | null = null;

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
            // Start as DYNAMIC, allowing it to be placed in the world initially
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
     * Drops the weapon from the player's hand to the world (Intentional throw)
     */
    public drop(fromPosition: Vector3Like, direction: Vector3Like): void {
        if (!this.world) return;
        
        // 1. Detach from parent AT the player's position
        this.setParent(undefined, undefined, fromPosition); 
        
        // 2. Load the label SceneUI
        this._labelSceneUI?.load(this.world);
        
        // 3. Start the despawn timer
        this.startDespawnTimer();

        // 4. Apply impulse (since it's DYNAMIC, it will fall/react)
        setTimeout(() => {
            if (this.isSpawned) { 
                this.applyImpulse({
                    x: direction.x * this.mass * 7,
                    y: direction.y * this.mass * 15,
                    z: direction.z * this.mass * 7,
                });
            }
        }, 0);
        this._logger.info(`${this.name} dropped at world position.`);
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
        // 1. Stop any existing despawn timer
        this.stopDespawnTimer();
        
        // 2. Unload the label SceneUI 
        this._labelSceneUI?.unload();
        
        // 3. Set parent ONLY (positioning happens in equip)
        this.setParent(player, 'hand_right_anchor'); 
                
        this._logger.info(`Calling player.equipWeapon()`);
        // 4. Tell the player to equip (handles relative positioning)
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
     * Called when the weapon is equipped (after pickup and setParent).
     * Sets relative position/rotation and parent animations.
     */
    public equip(): void {
        this._logger.info(`Equip called - setting relative position/rotation`);
       
        // Set position relative to the hand anchor node
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
     * Called when the weapon is unequipped (e.g., replaced by another weapon).
     * Resets owner animations and leaves the weapon on the ground where it was.
     */
    public unequip(): void {
        const owner = this.getOwner();
        
        // Get the OWNER'S current world position before detaching
        const ownerWorldPos = owner ? owner.position : this.position; // Fallback just in case
        
        if (owner && typeof (owner as any).resetAnimations === 'function') {
            (owner as any).resetAnimations();
            this._logger.info(`Reset parent (${owner.name}) animations.`);
        }
        
        // 1. Detach and place at the owner's world position
        this.setParent(undefined, undefined, ownerWorldPos); 
        
        // 2. Load the label UI because it's now on the ground
        // Check if world exists before loading UI
        if (this.world) {
            this._labelSceneUI?.load(this.world); 
        } else {
            this._logger.warn(`Cannot load label UI in unequip for ${this.name}: this.world is undefined.`);
        }
        
        // 3. Start the despawn timer because it's now in the world
        this.startDespawnTimer(); 

        this._logger.info(`${this.name} unequipped (left at owner's position).`);
    }

    /**
     * Starts a despawn timer for weapons dropped in the world
     */
    public startDespawnTimer(): void {
      this.stopDespawnTimer();
      
      // Only start despawn if the weapon is *not* attached to a player
      if (!this.parent) {
        this._logger.info(`Starting despawn timer for ${this.name}`);
        this._despawnTimer = setTimeout(() => {
            this.despawn();
        }, 30000); // Despawn after 30 seconds
      } else {
          this._logger.debug(`Skipping despawn timer for ${this.name} as it has a parent.`);
      }
    }
    
    public stopDespawnTimer(): void {
        if (this._despawnTimer) {
            this._logger.info(`Stopping despawn timer for ${this.name}`);
            clearTimeout(this._despawnTimer);
            this._despawnTimer = undefined;
        }
    }

    public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
        super.spawn(world, position, rotation);
        
        // Create and load the SceneUI for the label
        if (!this._labelSceneUI) {
            this._labelSceneUI = new SceneUI({
                attachedToEntity: this,
                templateId: 'weapon-label',
                state: { name: this.name }, // Set initial name state
                viewDistance: 8, // Adjust as needed
                offset: { x: 0, y: 0.75, z: 0 }, // Position label above the weapon
            });
        }
        
        // Only load the label if the weapon is spawned standalone (not attached to player initially)
        if (!this.parent) {
            this._labelSceneUI.load(world);
            this.startDespawnTimer();
        } else {
            this._labelSceneUI.unload(); // Ensure it's unloaded if spawned attached
        }
    }
    
    public override despawn(): void {
        this.stopDespawnTimer();
        this._labelSceneUI?.unload(); // Unload SceneUI on despawn
        super.despawn();
    }
}