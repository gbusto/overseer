import {
    Entity,
    World,
    EntityEvent,
    PlayerEntity,
    RigidBodyType,
    ColliderShape,
    SimpleEntityController,
    Vector3, // Keep Vector3
    SceneUI,
    CollisionGroup // <-- Import CollisionGroup
} from 'hytopia';
import type { EntityOptions, Vector3Like } from 'hytopia';
import { Logger } from '../../utils/logger';
import GamePlayerEntity from './GamePlayerEntity';

// Function to calculate distance manually
function calculateDistance(pos1: Vector3Like, pos2: Vector3Like): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

type RipperState = 'idle' | 'chasing' | 'attacking' | 'dying';

export default class RipperBossEntity extends Entity {
    private _logger = new Logger('RipperBossEntity');
    private _maxHealth: number = 20;
    private _health: number = 20;
    private _attackDamage: number = 5; // Example damage
    private _attackRange: number = 2.5; // Example range
    private _aggroRange: number = 20; // Example range to start chasing
    private _moveSpeed: number = 3.5; // Example speed
    private _sprintSpeed: number = 5.5; // Example speed

    private _state: RipperState = 'idle';
    private _targetPlayer: GamePlayerEntity | null = null;
    private _attackCooldown: number = 0;
    private _attackDuration: number = 1500; // ms between attacks

    // --- Jump Properties --- START
    private _jumpTimer: number = 0; 
    private _jumpInterval: number = 2000; // Try jumping every 3 seconds if moving
    private _jumpForce: number = 8; // Adjust force as needed (depends on mass/gravity)
    // --- Jump Properties --- END

    // Callback property
    private _onDeathCallback: (() => void) | null = null;

    // Animation names (ensure these match the actual model)
    private readonly ANIM_IDLE = 'animation.ripper_zombie.idle';
    private readonly ANIM_WALK = 'animation.ripper_zombie.walk';
    private readonly ANIM_SPRINT = 'animation.ripper_zombie.sprint';
    private readonly ANIM_ATTACK = 'animation.ripper_zombie.attack';
    private readonly ANIM_TARGET = 'animation.ripper_zombie.target'; // For the "scream" ?
    // private readonly ANIM_DEATH = 'animation.ripper_zombie.death'; // Assuming no death animation for now

    // SceneUI for the label
    private _labelSceneUI: SceneUI | null = null; // <-- Add SceneUI property

    constructor(options: Partial<EntityOptions> = {}) {
        const defaultOptions: EntityOptions = {
            name: 'Ripper Minion',
            modelUri: 'models/overseer/ripper-boss.gltf',
            modelScale: 1, // Adjust as needed
            rigidBodyOptions: {
                type: RigidBodyType.DYNAMIC,
                enabledRotations: { x: false, y: true, z: false }, // Allow turning
                colliders: [
                    // Main Solid Collider (for physics)
                    {
                        shape: ColliderShape.CAPSULE, 
                        radius: 0.4, 
                        halfHeight: 0.8, 
                        collisionGroups: { 
                            belongsTo: [CollisionGroup.ENTITY],
                            collidesWith: [CollisionGroup.BLOCK, CollisionGroup.ENTITY, CollisionGroup.PLAYER] 
                        }
                    },
                ],
                gravityScale: 1.0,
            },
            controller: new SimpleEntityController(),
        };

        super({ ...defaultOptions, ...options });

        // Set blend time after calling super()
        // this.animationBlendTime = 0.2; // Reverted - Property doesn't exist

        this.on(EntityEvent.SPAWN, this._onSpawned.bind(this));
        this.on(EntityEvent.TICK, this._onTick.bind(this));
        this.on(EntityEvent.DESPAWN, this._onDespawn.bind(this)); // <-- Listen for despawn event
    }

    // Method for Overseer to set the callback
    public setDeathCallback(callback: () => void): void {
        this._onDeathCallback = callback;
    }

    private _onSpawned({ entity }: { entity: Entity }): void {
        const world = entity.world;
        if (!world) {
            this._logger.error('Cannot execute _onSpawned: entity.world is undefined');
            return;
        }

        this._logger.info(`Spawned at ${JSON.stringify(this.position)}`);
        this._health = this._maxHealth;
        this._state = 'idle';
        this.startModelLoopedAnimations([this.ANIM_IDLE]);
        this._jumpTimer = 0;

        // Create and load the SceneUI label
        if (!this._labelSceneUI) {
            this._labelSceneUI = new SceneUI({
                attachedToEntity: this,
                templateId: 'item-label', // Reusing item label template
                state: { name: this.name || 'Ripper Boss' }, // Use entity name
                viewDistance: 10000, // Make it visible from very far away
                offset: { x: 0, y: 1.5, z: 0 }, // Position label above the model (adjust Y if needed)
            });
        }
        // Load the label when spawned in the world
        this._labelSceneUI.load(world);

        // NEW: Broadcast initial health state to UI
        this._broadcastHealthUpdate(world, true); 
    }

    private _onTick({ entity, tickDeltaMs }: { entity: Entity, tickDeltaMs: number }): void {
        if (this._state === 'dying') return;

        // Update cooldowns
        if (this._attackCooldown > 0) {
            this._attackCooldown -= tickDeltaMs;
        }
        // Update jump timer
        if (this._jumpTimer > 0) {
            this._jumpTimer -= tickDeltaMs;
        }

        // --- AI Logic ---
        const previousState = this._state; // Track previous state for logging
        this._findTarget(); // Find nearest player

        if (this._targetPlayer) {
            const distance = calculateDistance(this.position, this._targetPlayer.position);

            if (distance <= this._attackRange && this._attackCooldown <= 0) {
                // State change handled in _performAttack
                this._performAttack();
            } else if (distance <= this._aggroRange) {
                // --- Chase State --- 
                if (this._state !== 'chasing') {
                     this._logger.info(`State Change: Idle/Attacking -> Chasing player ${this._targetPlayer.player?.username}`);
                     // Play target animation once when starting chase
                     this._logger.info(`Starting Animation: ${this.ANIM_TARGET} (oneshot)`);
                     this.startModelOneshotAnimations([this.ANIM_TARGET]);
                     // Movement animation handled in _moveTowardsTarget
                 }
                this._state = 'chasing';
                this._moveTowardsTarget(); 
            } else {
                 // --- Target Lost/Out of Range --- 
                 if (this._state !== 'idle') {
                     this._logger.info(`State Change: Chasing/Attacking -> Idle (Target out of range)`);
                     this._state = 'idle';
                     this._stopMovement(); // Stops moving and sets idle animation
                 }
                 this._targetPlayer = null; // Lose target
            }
        } else {
            // --- No Target --- 
             if (this._state !== 'idle') {
                 this._logger.info(`State Change: Chasing/Attacking -> Idle (No target found)`);
                 this._state = 'idle';
                 this._stopMovement(); // Stops moving and sets idle animation
             }
        }
        // --- End AI Logic ---
    }

    private _findTarget(): void {
        if (!this.world) return;

        let nearestPlayer: GamePlayerEntity | null = null;
        let minDistance = this._aggroRange; // Only consider players within aggro range initially

        const players = this.world.entityManager.getAllPlayerEntities(); // Assuming this gets GamePlayerEntity[]

        for (const player of players) {
            // Ensure it's a GamePlayerEntity and is alive
            if (player instanceof GamePlayerEntity && player.health > 0) {
                const distance = calculateDistance(this.position, player.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPlayer = player;
                }
            }
        }

        if (nearestPlayer && nearestPlayer !== this._targetPlayer) {
             this._logger.info(`Found target: ${nearestPlayer.player?.username}`);
        }
        this._targetPlayer = nearestPlayer;
    }

    private _moveTowardsTarget(): void {
        if (!this._targetPlayer || !this.controller || !(this.controller instanceof SimpleEntityController)) return;

        const speed = this.ANIM_SPRINT ? this._sprintSpeed : this._moveSpeed;
        const animToPlay = this.ANIM_SPRINT ? this.ANIM_SPRINT : this.ANIM_WALK;

        this.controller.move(this._targetPlayer.position, speed);
        this.controller.face(this._targetPlayer.position, speed * 2); // Face faster

        // --- Handle Jumping --- START
        if (this._jumpTimer <= 0) {
             // TODO: Add a check here to see if the entity is actually grounded
             // This requires a ground sensor collider, similar to how player controllers work.
             // For now, we jump periodically while moving.
             this._jump();
             this._jumpTimer = this._jumpInterval; // Reset timer
        }
        // --- Handle Jumping --- END

        // Play movement animation only if it's not already the active one
        if (!this.modelLoopedAnimations.has(animToPlay)) {
            this._logger.info(`Stopping looped animations: ${[...this.modelLoopedAnimations]}`);
            this.stopModelAnimations([...this.modelLoopedAnimations]); // Stop previous looped anims (like idle)
            this._logger.info(`Starting Animation: ${animToPlay} (looped)`);
            this.startModelLoopedAnimations([animToPlay]);
        }
    }

     private _stopMovement(): void {
         if (!this.controller || !(this.controller instanceof SimpleEntityController)) return;

         this.setLinearVelocity({ x: 0, y: 0, z: 0 });
         // Stop existing looped animations (walk/sprint)
         if (this.modelLoopedAnimations.size > 0) {
            this._logger.info(`Stopping looped animations: ${[...this.modelLoopedAnimations]}`);
            this.stopModelAnimations([...this.modelLoopedAnimations]);
         }
         // Ensure idle animation plays when stopped
         if (!this.modelLoopedAnimations.has(this.ANIM_IDLE)) {
            this._logger.info(`Starting Animation: ${this.ANIM_IDLE} (looped)`);
            this.startModelLoopedAnimations([this.ANIM_IDLE]);
         }
     }

    private _performAttack(): void {
         if (!this._targetPlayer || this._state === 'attacking' || this._attackCooldown > 0) return;

         this._logger.info(`State Change: Idle/Chasing -> Attacking player ${this._targetPlayer.player?.username}`);
         this._state = 'attacking';
         this._stopMovement(); // Stop moving and ensure idle anim isn't playing during attack

         // Stop any potentially running looped animations (like idle if _stopMovement didn't catch it fast enough)
         if (this.modelLoopedAnimations.size > 0) {
            this._logger.info(`Stopping looped animations before attack: ${[...this.modelLoopedAnimations]}`);
            this.stopModelAnimations([...this.modelLoopedAnimations]);
         }

         this._logger.info(`Starting Animation: ${this.ANIM_ATTACK} (oneshot)`);
         this.startModelOneshotAnimations([this.ANIM_ATTACK]);
         this._attackCooldown = this._attackDuration;

         // Deal damage after a delay
         const damageDelay = 500; 
         setTimeout(() => {
             // Check if target still valid and in range after delay
             if (this._targetPlayer && this.isSpawned && this._targetPlayer.health > 0) {
                 const distance = calculateDistance(this.position, this._targetPlayer.position);
                 if (distance <= this._attackRange) {
                     this._logger.info(`Dealing ${this._attackDamage} damage to ${this._targetPlayer.player?.username}`);
                     this._targetPlayer.takeDamage(this._attackDamage); // Assuming GamePlayerEntity has takeDamage
                 } else {
                      this._logger.info('Target moved out of range during attack windup.');
                 }
             }
             // Return to idle state after attack finishes
             setTimeout(() => {
                 if (this._state === 'attacking') { 
                    this._logger.info(`State Change: Attacking -> Idle (Attack finished)`);
                    this._state = 'idle';
                    // Next tick will evaluate if we should chase or stay idle
                    // Explicitly start idle animation here if needed, but _stopMovement should handle it
                    if (!this.modelLoopedAnimations.has(this.ANIM_IDLE)) {
                       this._logger.info(`Starting Animation post-attack: ${this.ANIM_IDLE} (looped)`);
                       this.startModelLoopedAnimations([this.ANIM_IDLE]);
                    }
                 }
             }, this._attackDuration - damageDelay);

         }, damageDelay);
     }

    // --- NEW Jump Method --- START
    private _jump(): void {
        this._logger.info('Attempting periodic jump');
        // Apply vertical impulse
        // Note: The actual required force depends heavily on the entity's mass and gravity scale.
        // We might need to adjust _jumpForce experimentally.
        this.applyImpulse({ x: 0, y: this._jumpForce, z: 0 }); 
        // TODO: Potentially play a jump animation if one exists
        // this.startModelOneshotAnimations(['jump']);
    }
    // --- NEW Jump Method --- END

    public takeDamage(amount: number): void {
        if (this._state === 'dying') return;

        const oldHealth = this._health;
        this._health = Math.max(0, this._health - amount);

        this._logger.info(`Took ${amount} damage. Health: ${oldHealth} -> ${this._health}`);

        // NEW: Broadcast health update if world exists
        if (this.world) { 
            this._broadcastHealthUpdate(this.world, true);
        }

        if (this._health <= 0) {
            this._handleDeath();
        }
        // TODO: Add hit reaction animation?
        // this.startModelOneshotAnimations(['hit']); 
    }

    private _handleDeath(): void {
        if (this._state === 'dying') return;

        this._logger.info('Starting death sequence...');
        this._state = 'dying';
        
        // Stop AI behaviors & looped animations
        if (this.modelLoopedAnimations.size > 0) { // Check if any loops are playing
            this._logger.info(`Stopping looped animations on death: ${[...this.modelLoopedAnimations]}`);
            this.stopModelAnimations([...this.modelLoopedAnimations]);
        }
        // TODO: Play death animation if exists?
        // this.startModelOneshotAnimations(['death']);

        // Make entity non-interactive (e.g., stop collisions if desired)
        // this.setCollisionGroupsForAllColliders({ belongsTo: [], collidesWith: [] });

        // Broadcast UI update to hide health bar
        if (this.world) {
            this._broadcastHealthUpdate(this.world, false);
        }

        // Trigger the callback for the Overseer
        if (this._onDeathCallback) {
            this._logger.info('Calling death callback for Overseer.');
            this._onDeathCallback();
        }

        // Despawn after a delay
        const despawnDelay = 2000; // ms
        this._logger.info(`Despawning entity in ${despawnDelay}ms.`);
        const despawnCallback = () => {
            if (this.isSpawned) {
                this.despawn();
            }
        };
        setTimeout(despawnCallback, despawnDelay);
    }

    // NEW: Handle despawn cleanup for SceneUI
    private _onDespawn(): void {
        this._logger.debug('Despawning, unloading SceneUI label.');
        this._labelSceneUI?.unload();
        // If RipperBossEntity had its own _onDespawn logic previously, call super or include it here
    }

    // Helper method to broadcast health updates to ALL players
    private _broadcastHealthUpdate(world: World, isVisible: boolean): void {
        const updateData = {
            type: 'minion-health-update',
            health: this._health,
            maxHealth: this._maxHealth,
            visible: isVisible
        };
        
        // Iterate through all player entities and send data to their UI
        const players = world.entityManager.getAllPlayerEntities();
        let count = 0;
        for (const playerEntity of players) {
            if (playerEntity instanceof PlayerEntity) { // Ensure it's a player entity
                playerEntity.player.ui.sendData(updateData);
                count++;
            }
        }
        this._logger.debug(`Broadcasted minion health update to ${count} players: ${JSON.stringify(updateData)}`);
    }

    // --- Helper Methods (Optional) ---
    // _sendHealthUpdateUI() { ... }
} 