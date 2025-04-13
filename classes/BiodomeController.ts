import { World } from 'hytopia';
import { Logger } from '../utils/logger';

/**
 * BiodomeController manages the environmental conditions of the biodome.
 * Currently handles temperature changes and their effects.
 */
export default class BiodomeController {
  private _world: World | null = null;
  
  // Temperature properties
  private _currentTemp: number = 74; // Default temperature (F)
  private _targetTemp: number = 74;
  private _tempChangeRate: number = 0.5; // Degrees per second
  private _normalTemp: number = 74; // The baseline temperature
  
  // Auto reset properties
  private _autoResetEnabled: boolean = false;
  private _autoResetDelay: number = 30000; // 30 seconds
  private _autoResetTimer: NodeJS.Timeout | null = null;
  
  // Logger
  private _logger: Logger;

  constructor(world: World) {
    this._world = world;
    this._logger = new Logger('BiodomeController');
    this._logger.info('BiodomeController initialized');
  }

  /**
   * Update method called from OverseerEntity's tick event
   * @param tickDeltaMs Milliseconds since last tick
   */
  public onTick(tickDeltaMs: number): void {
    this._updateTemperature(tickDeltaMs);
    this._applyEnvironmentalEffects();
    this._updateUI();
  }

  /**
   * Gradually update temperature based on time elapsed
   * @param tickDeltaMs Time since last tick in milliseconds
   */
  private _updateTemperature(tickDeltaMs: number): void {
    // Calculate temperature change per tick
    const changeDelta = (this._tempChangeRate * tickDeltaMs) / 1000;
    
    // Skip updates if we're already at target temperature
    if (this._currentTemp === this._targetTemp) {
      return;
    }
    
    // Gradually move current temperature toward target
    if (Math.abs(this._currentTemp - this._targetTemp) <= changeDelta) {
      // We're close enough - set to exact target
      this._currentTemp = this._targetTemp;
      
      this._logger.info(`Biodome reached target temperature: ${this._currentTemp.toFixed(1)}°F`);
      
      // If we've reached an abnormal target temperature and auto-reset is enabled,
      // schedule a reset to normal temperature
      if (this._autoResetEnabled && this._targetTemp !== this._normalTemp) {
        this._scheduleResetToNormal();
      }
    } else if (this._currentTemp < this._targetTemp) {
      // Increase temperature
      this._currentTemp += changeDelta;
    } else {
      // Decrease temperature
      this._currentTemp -= changeDelta;
    }
  }

  /**
   * Apply effects based on current temperature
   */
  private _applyEnvironmentalEffects(): void {
    if (!this._world) return;

    // Get all player entities
    const players = this._world.entityManager.getAllPlayerEntities();
    
    // Apply damage for extreme temperatures
    if (this._currentTemp >= 100) {
      // Heat damage scales with temperature
      const heatDamage = (this._currentTemp - 100) * 0.01;
      
      players.forEach(player => {
        // Check if the player entity has a takeDamage method
        if (player && typeof (player as any).takeDamage === 'function') {
          (player as any).takeDamage(heatDamage, "heat");
        }
      });
    } else if (this._currentTemp <= 32) {
      // Cold damage scales with temperature
      const coldDamage = (32 - this._currentTemp) * 0.01;
      
      players.forEach(player => {
        // Check if the player entity has a takeDamage method
        if (player && typeof (player as any).takeDamage === 'function') {
          (player as any).takeDamage(coldDamage, "cold");
        }
      });
    }
  }

  /**
   * Update UI for all players with current biodome status
   */
  private _updateUI(): void {
    if (!this._world) return;
    
    // Get all players in the world
    const players = this._world.entityManager.getAllPlayerEntities();
    
    // Convert F to C for display
    const tempC = this._fahrenheitToCelsius(this._currentTemp);
    
    // Send temperature data to all players
    players.forEach(player => {
      if (player.player && player.player.ui) {
        player.player.ui.sendData({
          type: 'biodome-status',
          temperature: {
            fahrenheit: Math.round(this._currentTemp),
            celsius: Math.round(tempC)
          },
          isTemperatureDangerous: this._currentTemp >= 100 || this._currentTemp <= 32
        });
      }
    });
  }

  /**
   * Set biodome temperature with optional change rate
   * @param temperature Target temperature in Fahrenheit
   * @param changeRate Optional: Speed of temperature change in degrees per second
   * @param autoReset Optional: Whether to automatically reset to normal temperature after a delay
   */
  public setTemperature(temperature: number, changeRate?: number, autoReset: boolean = true): void {
    // Clear any existing auto-reset timer
    if (this._autoResetTimer) {
      clearTimeout(this._autoResetTimer);
      this._autoResetTimer = null;
    }
    
    this._targetTemp = temperature;
    this._autoResetEnabled = autoReset;
    
    if (changeRate !== undefined) {
      this._tempChangeRate = changeRate;
    }
    
    this._logger.info(`Setting biodome temperature to ${temperature}°F (change rate: ${this._tempChangeRate}°/s, auto reset: ${autoReset})`);
  }

  /**
   * Reset temperature to normal immediately
   */
  public resetTemperature(): void {
    this.setTemperature(this._normalTemp, undefined, false);
  }

  /**
   * Schedule a reset to normal temperature after delay
   */
  private _scheduleResetToNormal(): void {
    // Clear any existing timer
    if (this._autoResetTimer) {
      clearTimeout(this._autoResetTimer);
    }
    
    this._logger.info(`Scheduling biodome temperature reset in ${this._autoResetDelay / 1000} seconds`);
    
    // Create new timer
    this._autoResetTimer = setTimeout(() => {
      this._logger.info('Auto-resetting biodome temperature to normal');
      this.setTemperature(this._normalTemp, undefined, false);
      this._autoResetTimer = null;
    }, this._autoResetDelay);
  }

  /**
   * Get current temperature in Fahrenheit
   */
  public getCurrentTemperature(): number {
    return this._currentTemp;
  }

  /**
   * Helper to convert Fahrenheit to Celsius
   */
  private _fahrenheitToCelsius(fahrenheit: number): number {
    return (fahrenheit - 32) * 5 / 9;
  }

  /**
   * Toggle biodome status UI visibility for a specific player or all players
   * @param player Optional specific player to toggle UI for. If not provided, toggles for all players.
   */
  public toggleBiodomeUI(player?: any): void {
    if (!this._world) return;
    
    if (player) {
      // Toggle for specific player
      if (player.ui) {
        player.ui.sendData({
          type: 'toggle-biodome-visibility'
        });
        this._logger.info(`Toggled biodome UI for player: ${player.username || player.id}`);
      }
    } else {
      // Toggle for all players
      const players = this._world.entityManager.getAllPlayerEntities();
      players.forEach(playerEntity => {
        if (playerEntity.player && playerEntity.player.ui) {
          playerEntity.player.ui.sendData({
            type: 'toggle-biodome-visibility'
          });
        }
      });
      this._logger.info('Toggled biodome UI for all players');
    }
    
    // Also send the current status to ensure data is up-to-date
    this._updateUI();
  }
} 