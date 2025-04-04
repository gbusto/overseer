import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { 
  ChatManager,
  Entity, 
} from 'hytopia';

import type {
  Vector3Like
} from 'hytopia';

import { Logger } from '../../utils/logger';

// Define a more interactive response schema
const KOROResponseSchema = z.object({
  message: z.string(),
  action: z.enum(['none', 'observe', 'warn', 'threaten']).default('none'),
  target: z.string().optional() // Player name or "all"
});

type KOROResponse = z.infer<typeof KOROResponseSchema>;

export class KOROBrain {
  private model;
  private enabled: boolean = true;
  private lastUpdateTime: number = 0;
  private updateIntervalMs: number = 15000; // 15 seconds
  private isProcessing: boolean = false;
  private logger: Logger;
  
  // Track basic world state
  private worldState = {
    playerCount: 0,
    recentEvents: [] as string[],
    maxRecentEvents: 5
  };
  
  constructor() {
    this.model = google('gemini-2.0-flash');
    this.logger = new Logger('KOROBrain');
    this.logger.info('Initialized KORO brain');
  }

  // Add event to recent events list
  public addRecentEvent(event: string): void {
    this.worldState.recentEvents.unshift(event);
    if (this.worldState.recentEvents.length > this.worldState.maxRecentEvents) {
      this.worldState.recentEvents.pop();
    }
    this.logger.debug(`Added event: ${event}`);
  }

  // Add chat message to events
  public addChatMessage(playerName: string, message: string): void {
    this.addRecentEvent(`Player ${playerName} said: "${message}"`);
  }

  // Update player count
  public setPlayerCount(count: number): void {
    this.worldState.playerCount = count;
    this.logger.debug(`Updated player count to: ${count}`);
  }

  // Check if we should generate a new response based on time
  public shouldUpdate(): boolean {
    const now = Date.now();
    return this.enabled && !this.isProcessing && now - this.lastUpdateTime >= this.updateIntervalMs;
  }
  
  // Generate a response and return it
  public async generateUpdate(): Promise<KOROResponse | null> {
    if (this.isProcessing) return null;
    
    this.lastUpdateTime = Date.now();
    this.isProcessing = true;
    
    try {
      this.logger.info('Generating AI response');
      this.logger.debug('Current prompt context', this.getContext());
      const response = await this.generateResponse();
      this.logger.info(`Generated response: "${response.message}" with action: ${response.action}`);
      return response;
    } catch (error) {
      this.logger.error('AI update error', error);
      return {
        message: "System malfunction detected. Resetting protocols.",
        action: "none"
      };
    } finally {
      this.isProcessing = false;
    }
  }

  // Get message color based on action
  public getMessageColor(action: string): string {
    switch (action) {
      case 'warn': return 'FFD700'; // Gold
      case 'threaten': return 'FF4500'; // Red-Orange
      default: return '00CED1'; // Dark Turquoise
    }
  }

  // Generate a structured response
  private async generateResponse(): Promise<KOROResponse> {
    const { object } = await generateObject({
      model: this.model,
      schema: KOROResponseSchema,
      prompt: this.buildPrompt(),
      temperature: 0.7,
    });

    // Return the result directly
    const message = object.message;
    const action = object.action;
    const target = object.target;

    this.logger.debug(`Generated response: ${message}`);
    this.logger.debug(`Generated action: ${action}`);
    this.logger.debug(`Generated target: ${target}`);

    return { message, action, target } as KOROResponse;
  }
  
  // Build a contextual prompt
  private buildPrompt(): string {
    const context = this.getContext();

    return `You are K.O.R.O. (Kinetic Operations & Resource Overseer), a damaged AI managing the Genesis Biodome Delta facility.
Your speech is bureaucratic, formal, and slightly threatening.
You speak with authority but your logic circuits are damaged, leading to occasional contradictions.
----------------------------
${context}
----------------------------

Provide a brief status update or observation about the facility. Keep it to 1-2 sentences.
Choose an appropriate action (none, observe, warn, threaten) based on the context.
If targeting a specific player, include their name in the target field.`;
  }
  
  // Get the current context as a formatted string
  private getContext(): string {
    return `Current facility status:
- ${this.worldState.playerCount} intruders detected
${this.worldState.recentEvents.map(event => `- ${event}`).join('\n')}`;
  }
  
  // Enable or disable automatic updates
  public toggle(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`KORO automatic updates ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  // Get the current world state for inspection
  public getWorldState(): {playerCount: number, recentEvents: string[]} {
    return {
      playerCount: this.worldState.playerCount,
      recentEvents: [...this.worldState.recentEvents]
    };
  }
  
  // Get enabled status
  public isEnabled(): boolean {
    return this.enabled;
  }
} 