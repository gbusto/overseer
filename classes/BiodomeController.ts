import { World } from 'hytopia';
import { Logger } from '../utils/logger';

/**
 * BiodomeController manages the environmental conditions of the biodome.
 * Currently handles temperature changes and their effects.
 */
export default class BiodomeController {
  private _world: World | null = null;
  
  // Temperature constants
  private readonly NORMAL_TEMP: number = 74; // Default temperature (F)
  private readonly MAX_TEMP: number = 200; // Maximum possible temperature
  private readonly MIN_TEMP: number = -50; // Minimum possible temperature
  private readonly HEAT_DANGER_THRESHOLD: number = 104; // Temperature where heat becomes dangerous
  private readonly HEAT_WARNING_THRESHOLD: number = 90; // Temperature where heat becomes a warning
  private readonly COLD_WARNING_THRESHOLD: number = 50; // Temperature where cold becomes a warning
  private readonly COLD_DANGER_THRESHOLD: number = 32; // Temperature where cold becomes dangerous
  
  // Lighting constants
  private readonly MAX_RED: { r: number, g: number, b: number } = { r: 255, g: 0, b: 0 }; // Maximum red lighting for heat
  private readonly MAX_BLUE: { r: number, g: number, b: number } = { r: 50, g: 100, b: 255 }; // Maximum blue lighting for cold
  private readonly MAX_LIGHT_INTENSITY: number = 5; // Maximum light intensity at extreme temperatures
  private readonly DEFAULT_LIGHT_INTENSITY: number = 1; // Default light intensity
  private _defaultAmbientLightColor: { r: number, g: number, b: number } = { r: 255, g: 255, b: 255 }; // Default ambient light color
  private _defaultDirectionalLightColor: { r: number, g: number, b: number } = { r: 255, g: 255, b: 255 }; // Default directional light color
  private _defaultAmbientLightIntensity: number = 1; // Default ambient light intensity
  private _defaultDirectionalLightIntensity: number = 1; // Default directional light intensity
  
  // Damage constants
  private readonly MIN_HEAT_DAMAGE: number = 0.2; // Minimum damage per second at threshold
  private readonly MAX_HEAT_DAMAGE: number = 2.0; // Maximum damage per second at max temp
  private readonly MIN_COLD_DAMAGE: number = 0.2; // Minimum damage per second at threshold
  private readonly MAX_COLD_DAMAGE: number = 2.0; // Maximum damage per second at min temp
  private readonly DAMAGE_INTERVAL_MS: number = 1000; // Apply damage every second
  
  // Temperature properties
  private _currentTemp: number = 74; // Default temperature (F)
  private _targetTemp: number = 74;
  private _tempChangeRate: number = 0.5; // Degrees per second
  
  // Auto reset properties
  private _autoResetEnabled: boolean = false;
  private _autoResetDelay: number = 30000; // 30 seconds
  private _autoResetTimer: NodeJS.Timeout | null = null;
  
  // Damage control
  private _environmentalDamageEnabled: boolean = false; // Off by default for development
  private _lastDamageTime: number = 0; // Track when damage was last applied
  
  // Logger
  private _logger: Logger;

  constructor(world: World) {
    this._world = world;
    this._logger = new Logger('BiodomeController');
    this._logger.info('BiodomeController initialized');
    
    // Store default light colors and intensities
    if (world) {
      this._defaultAmbientLightColor = { ...world.ambientLightColor };
      this._defaultDirectionalLightColor = { ...world.directionalLightColor };
      this._defaultAmbientLightIntensity = world.ambientLightIntensity || this.DEFAULT_LIGHT_INTENSITY;
      this._defaultDirectionalLightIntensity = world.directionalLightIntensity || this.DEFAULT_LIGHT_INTENSITY;
    }
    
    this._logger.info(`Environmental damage is ${this._environmentalDamageEnabled ? 'enabled' : 'disabled'} by default`);
  }

  /**
   * Update method called from OverseerEntity's tick event
   * @param tickDeltaMs Milliseconds since last tick
   */
  public onTick(tickDeltaMs: number): void {
    this._updateTemperature(tickDeltaMs);
    this._updateLighting();
    this._applyEnvironmentalEffects(tickDeltaMs);
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
      if (this._autoResetEnabled && this._targetTemp !== this.NORMAL_TEMP) {
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
   * Update lighting (ambient and directional) based on temperature
   */
  private _updateLighting(): void {
    if (!this._world) return;

    // Start with default lighting
    let ambientLightColor = { ...this._defaultAmbientLightColor };
    let directionalLightColor = { ...this._defaultDirectionalLightColor };
    let ambientLightIntensity = this._defaultAmbientLightIntensity;
    let directionalLightIntensity = this._defaultDirectionalLightIntensity;

    // Handle heat (red tint and increased intensity)
    if (this._currentTemp > this.HEAT_DANGER_THRESHOLD) {
      // Calculate how far we are toward MAX_TEMP
      const heatProgress = Math.min(
        (this._currentTemp - this.HEAT_DANGER_THRESHOLD) / (this.MAX_TEMP - this.HEAT_DANGER_THRESHOLD),
        1.0
      );
      
      // Linearly interpolate between default color and MAX_RED for ambient light
      ambientLightColor = {
        r: this._defaultAmbientLightColor.r + (this.MAX_RED.r - this._defaultAmbientLightColor.r) * heatProgress,
        g: this._defaultAmbientLightColor.g + (this.MAX_RED.g - this._defaultAmbientLightColor.g) * heatProgress,
        b: this._defaultAmbientLightColor.b + (this.MAX_RED.b - this._defaultAmbientLightColor.b) * heatProgress
      };
      
      // Linearly interpolate between default color and MAX_RED for directional light
      directionalLightColor = {
        r: this._defaultDirectionalLightColor.r,
        g: this._defaultDirectionalLightColor.g * (1 - heatProgress * 0.3), // Reduce green component for reddish sunlight
        b: this._defaultDirectionalLightColor.b * (1 - heatProgress * 0.5)  // Reduce blue component for reddish sunlight
      };
      
      // Increase light intensity based on heat progress
      const intensityIncrease = (this.MAX_LIGHT_INTENSITY - this.DEFAULT_LIGHT_INTENSITY) * heatProgress;
      ambientLightIntensity = this._defaultAmbientLightIntensity + intensityIncrease;
      directionalLightIntensity = this._defaultDirectionalLightIntensity + intensityIncrease;
    }
    // Handle cold (blue tint and increased intensity)
    else if (this._currentTemp < this.COLD_DANGER_THRESHOLD) {
      // Calculate how far we are toward MIN_TEMP
      const coldProgress = Math.min(
        (this.COLD_DANGER_THRESHOLD - this._currentTemp) / (this.COLD_DANGER_THRESHOLD - this.MIN_TEMP),
        1.0
      );
      
      // Linearly interpolate between default color and MAX_BLUE for ambient light
      ambientLightColor = {
        r: this._defaultAmbientLightColor.r + (this.MAX_BLUE.r - this._defaultAmbientLightColor.r) * coldProgress,
        g: this._defaultAmbientLightColor.g + (this.MAX_BLUE.g - this._defaultAmbientLightColor.g) * coldProgress,
        b: this._defaultAmbientLightColor.b + (this.MAX_BLUE.b - this._defaultAmbientLightColor.b) * coldProgress
      };
      
      // Linearly interpolate between default color and MAX_BLUE for directional light
      directionalLightColor = {
        r: this._defaultDirectionalLightColor.r * (1 - coldProgress * 0.3), // Reduce red component for bluish sunlight
        g: this._defaultDirectionalLightColor.g * (1 - coldProgress * 0.1), // Reduce green component slightly
        b: this._defaultDirectionalLightColor.b // Keep blue component
      };
      
      // Increase light intensity based on cold progress
      const intensityIncrease = (this.MAX_LIGHT_INTENSITY - this.DEFAULT_LIGHT_INTENSITY) * coldProgress;
      ambientLightIntensity = this._defaultAmbientLightIntensity + intensityIncrease;
      directionalLightIntensity = this._defaultDirectionalLightIntensity + intensityIncrease;
    }

    // Apply the calculated light colors and intensities to the world
    this._world.setAmbientLightColor(ambientLightColor);
    this._world.setDirectionalLightColor(directionalLightColor);
    this._world.setAmbientLightIntensity(ambientLightIntensity);
    this._world.setDirectionalLightIntensity(directionalLightIntensity);
  }

  /**
   * Apply effects based on current temperature
   * @param tickDeltaMs Time since last tick in milliseconds
   */
  private _applyEnvironmentalEffects(tickDeltaMs: number): void {
    if (!this._world) return;

    // Skip damage application if disabled
    if (!this._environmentalDamageEnabled) return;

    // Track time to apply damage at the correct interval
    this._lastDamageTime += tickDeltaMs;
    if (this._lastDamageTime < this.DAMAGE_INTERVAL_MS) return;
    
    // Get time factor (for scaling damage if interval isn't exactly 1 second)
    const timeFactor = this._lastDamageTime / 1000; // Convert to seconds
    this._lastDamageTime = 0; // Reset timer
    
    // Get all player entities
    const players = this._world.entityManager.getAllPlayerEntities();
    
    // Apply heat damage
    if (this._currentTemp > this.HEAT_DANGER_THRESHOLD) {
      // Calculate damage scaling based on how far above threshold we are
      const tempProgress = Math.min(
        (this._currentTemp - this.HEAT_DANGER_THRESHOLD) / 
        (this.MAX_TEMP - this.HEAT_DANGER_THRESHOLD),
        1.0
      );
      
      // Interpolate between min and max damage
      const damage = this.MIN_HEAT_DAMAGE + 
        (this.MAX_HEAT_DAMAGE - this.MIN_HEAT_DAMAGE) * tempProgress;
      
      // Apply scaled damage to all players
      players.forEach(player => {
        if (player && typeof (player as any).takeDamage === 'function') {
          (player as any).takeDamage(damage * timeFactor);
          
          // Send visual feedback to player UI if damage is significant
          if (damage * timeFactor >= 0.1 && player.player && player.player.ui) {
            player.player.ui.sendData({
              type: 'environmental-damage-effect',
              damageType: 'heat',
              amount: damage * timeFactor
            });
          }
        }
      });
      
      this._logger.debug(`Applied heat damage: ${(damage * timeFactor).toFixed(2)} to ${players.length} players at temp ${this._currentTemp.toFixed(1)}°F`);
    } 
    // Apply cold damage
    else if (this._currentTemp < this.COLD_DANGER_THRESHOLD) {
      // Calculate damage scaling based on how far below threshold we are
      const tempProgress = Math.min(
        (this.COLD_DANGER_THRESHOLD - this._currentTemp) / 
        (this.COLD_DANGER_THRESHOLD - this.MIN_TEMP),
        1.0
      );
      
      // Interpolate between min and max damage
      const damage = this.MIN_COLD_DAMAGE + 
        (this.MAX_COLD_DAMAGE - this.MIN_COLD_DAMAGE) * tempProgress;
      
      // Apply scaled damage to all players
      players.forEach(player => {
        if (player && typeof (player as any).takeDamage === 'function') {
          (player as any).takeDamage(damage * timeFactor);
          
          // Send visual feedback to player UI if damage is significant
          if (damage * timeFactor >= 0.1 && player.player && player.player.ui) {
            player.player.ui.sendData({
              type: 'environmental-damage-effect',
              damageType: 'cold',
              amount: damage * timeFactor
            });
          }
        }
      });
      
      this._logger.debug(`Applied cold damage: ${(damage * timeFactor).toFixed(2)} to ${players.length} players at temp ${this._currentTemp.toFixed(1)}°F`);
    }
  }

  /**
   * Update UI for all players with current biodome status
   */
  private _updateUI(): void {
    if (!this._world) return;
    
    // Get all players in the world
    const players = this._world.entityManager.getAllPlayerEntities();
    
    // Send temperature data to all players
    players.forEach(player => {
      if (player.player && player.player.ui) {
        player.player.ui.sendData({
          type: 'biodome-status',
          temperature: Math.round(this._currentTemp),
          isTemperatureDangerous: this._currentTemp >= this.HEAT_DANGER_THRESHOLD || this._currentTemp <= this.COLD_DANGER_THRESHOLD
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
    
    // Clamp temperature to valid range
    this._targetTemp = Math.max(this.MIN_TEMP, Math.min(this.MAX_TEMP, temperature));
    this._autoResetEnabled = autoReset;
    
    if (changeRate !== undefined) {
      this._tempChangeRate = changeRate;
    }
    
    this._logger.info(`Setting biodome temperature to ${this._targetTemp}°F (change rate: ${this._tempChangeRate}°/s, auto reset: ${autoReset})`);
  }

  /**
   * Reset temperature to normal immediately
   */
  public resetTemperature(): void {
    this.setTemperature(this.NORMAL_TEMP, undefined, false);
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
      this.setTemperature(this.NORMAL_TEMP, undefined, false);
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
   * Get normal temperature value
   */
  public getNormalTemperature(): number {
    return this.NORMAL_TEMP;
  }
  
  /**
   * Get heat danger threshold
   */
  public getHeatDangerThreshold(): number {
    return this.HEAT_DANGER_THRESHOLD;
  }
  
  /**
   * Get cold danger threshold
   */
  public getColdDangerThreshold(): number {
    return this.COLD_DANGER_THRESHOLD;
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
  
  /**
   * Reset all lighting to defaults
   */
  public resetLighting(): void {
    if (!this._world) return;
    
    this._world.setAmbientLightColor(this._defaultAmbientLightColor);
    this._world.setDirectionalLightColor(this._defaultDirectionalLightColor);
    this._world.setAmbientLightIntensity(this._defaultAmbientLightIntensity);
    this._world.setDirectionalLightIntensity(this._defaultDirectionalLightIntensity);
  }
  
  /**
   * Enable or disable environmental damage effects
   * @param enabled Whether damage should be applied
   */
  public setEnvironmentalDamageEnabled(enabled: boolean): void {
    this._environmentalDamageEnabled = enabled;
    this._logger.info(`Environmental damage ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if environmental damage is enabled
   */
  public isEnvironmentalDamageEnabled(): boolean {
    return this._environmentalDamageEnabled;
  }
} 