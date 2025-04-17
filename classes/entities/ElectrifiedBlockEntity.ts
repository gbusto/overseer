import {
    Entity,
    RigidBodyType,
    ColliderShape,
    CollisionGroup,
    BlockType,
} from 'hytopia';
import type { EntityOptions, Vector3Like, QuaternionLike } from 'hytopia';
import { Logger } from '../../utils/logger';
import GamePlayerEntity from './GamePlayerEntity'; // Import player entity for collision check

// Constants
const ELECTRIC_DAMAGE_AMOUNT = 1;

/**
 * Represents a temporary, electrified block effect on the ground.
 * Deals damage to players on contact.
 */
export default class ElectrifiedBlockEntity extends Entity {
    private _logger: Logger;

    constructor(options: Partial<EntityOptions & { textureUri?: string }> = {}) {
        const texture = options.textureUri || 'blocks/debug'; // Fallback texture
        super({
            name: 'ElectrifiedGround',
            blockTextureUri: texture,
            blockHalfExtents: { x: 0.51, y: 0.51, z: 0.51 }, // Standard block size
            rigidBodyOptions: {
                type: RigidBodyType.FIXED, // Static, doesn't move or fall
                colliders: [
                    {
                        shape: ColliderShape.BLOCK,
                        halfExtents: { x: 0.5, y: 0.5, z: 0.5 },
                        isSensor: true, // Doesn't physically collide, just detects
                        collisionGroups: {
                            belongsTo: [CollisionGroup.GROUP_1], // Assign to a group for specific collision filtering
                            collidesWith: [CollisionGroup.PLAYER] // Only check collisions against players
                        },
                        onCollision: (otherEntity: Entity | BlockType, started: boolean) => {
                            if (started && otherEntity instanceof GamePlayerEntity) {
                                // Damage the player and specify the source
                                otherEntity.takeDamage(ELECTRIC_DAMAGE_AMOUNT, 'electricity');
                                this._logger.debug(`Applied ${ELECTRIC_DAMAGE_AMOUNT} electricity damage to player ${otherEntity.player.username || otherEntity.player.id}`);
                            }
                        }
                    }
                ]
            },
            ...options // Allow overriding defaults if needed
        });

        this._logger = new Logger(`ElectrifiedBlock:${texture}`);
        // No automatic despawn timer here; Overseer will manage its lifespan.
    }

    // Override spawn to add logging
    public override spawn(world: import("hytopia").World, position: Vector3Like, rotation?: QuaternionLike): void {
        super.spawn(world, position, rotation);
        // this._logger.debug(`Spawned at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    }

    // Override despawn to add logging
     public override despawn(): void {
        if (this.isSpawned) {
            //  this._logger.debug(`Despawning from (${this.position.x.toFixed(1)}, ${this.position.y.toFixed(1)}, ${this.position.z.toFixed(1)})`);
        }
        super.despawn();
    }

    /**
     * Schedules this entity to despawn after a specified delay.
     * @param delayMs The delay in milliseconds before despawning.
     */
    public scheduleDespawn(delayMs: number): void {
        if (delayMs <= 0) {
            this.despawn();
            return;
        }
        setTimeout(() => {
            // Ensure the entity hasn't already been despawned elsewhere
            if (this.isSpawned) {
                this.despawn();
            }
        }, delayMs);
    }
} 