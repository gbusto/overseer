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
  message: z.string().optional(), // Make message optional
  action: z.enum(['none', 'observe', 'warn', 'threaten']).default('none'),
  target: z.string().optional() // Player name or "all"
});

// Define event type for better structure
export interface KOROEvent {
  type: string;
  content: string;
  timestamp: number;
  data?: Record<string, any>; // Flexible data field for additional info
  priority: 'low' | 'medium' | 'high';
}

// Track KORO's responses for context
export interface KOROHistoricalResponse {
  message?: string;
  action: string;
  timestamp: number;
  target?: string;
}

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
    recentEvents: [] as KOROEvent[],
    maxRecentEvents: 5
  };
  
  // Track KORO's recent responses
  private recentResponses: KOROHistoricalResponse[] = [];
  private maxRecentResponses: number = 10; // Keep the last 10 responses
  
  constructor() {
    this.model = google('gemini-2.0-flash');
    this.logger = new Logger('KOROBrain');
    this.logger.info('Initialized KORO brain');
  }

  // Add event to recent events list with object structure
  public addRecentEvent(eventData: Partial<KOROEvent>): void {
    // Create a complete event object with defaults for missing fields
    const event: KOROEvent = {
      type: eventData.type || 'generic',
      content: eventData.content || '',
      timestamp: eventData.timestamp || Date.now(),
      data: eventData.data || {},
      priority: eventData.priority || 'low'
    };
    
    this.worldState.recentEvents.unshift(event);
    if (this.worldState.recentEvents.length > this.worldState.maxRecentEvents) {
      this.worldState.recentEvents.pop();
    }
    this.logger.debug(`Added event: ${event.type} - ${event.content}`);
  }

  // Add event with priority flag - returns whether immediate response is needed
  public addEventWithPriority(
    type: string, 
    content: string, 
    priority: 'low' | 'medium' | 'high' = 'low',
    extraData: Record<string, any> = {}
  ): boolean {
    this.addRecentEvent({
      type,
      content,
      priority,
      data: extraData,
      timestamp: Date.now()
    });
    
    this.logger.debug(`Added ${priority} priority event: ${type} - ${content}`);
    return priority === 'high'; // Only high priority events need immediate response
  }

  // Add chat message to events
  public addChatMessage(playerName: string, message: string): boolean {
    // Determine priority based on message content
    let priority: 'low' | 'medium' | 'high' = 'low';
    if (message.toLowerCase().includes('koro') || message.toLowerCase().includes('overseer')) {
      priority = 'high';
    }
    
    return this.addEventWithPriority(
      'chat',
      `Player ${playerName} said: "${message}"`, 
      priority,
      { playerName, message } // Store the raw data for potential future use
    );
  }

  // Update player count
  public setPlayerCount(count: number): void {
    const prevCount = this.worldState.playerCount;
    this.worldState.playerCount = count;
    this.logger.debug(`Updated player count to: ${count}`);
    
    // Add player count change event if it changed
    if (prevCount !== count) {
      this.addRecentEvent({
        type: 'player_count',
        content: `Player count changed from ${prevCount} to ${count}`,
        data: { prevCount, newCount: count },
        priority: 'low'
      });
    }
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
      
      // Log the response
      if (response.message) {
        this.logger.info(`Generated response: "${response.message}" with action: ${response.action}`);
      } else {
        this.logger.info(`Generated silent response with action: ${response.action}`);
      }
      
      // Store the response in history
      this.addResponseToHistory(response);
      
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

  // Add a response to the history
  private addResponseToHistory(response: KOROResponse): void {
    // Check if KORO chose to do nothing
    const hasMessage = !!response.message;
    const hasAction = response.action !== 'none';
    const choseToDoNothing = !hasMessage && !hasAction;
    
    const historicalResponse: KOROHistoricalResponse = {
      message: choseToDoNothing ? '<<deliberate silence>>' : response.message,
      action: response.action,
      target: response.target,
      timestamp: Date.now()
    };
    
    this.recentResponses.unshift(historicalResponse);
    if (this.recentResponses.length > this.maxRecentResponses) {
      this.recentResponses.pop();
    }
    
    if (choseToDoNothing) {
      this.logger.debug('KORO chose to remain silent - recorded in history');
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
    const responseHistory = this.getResponseHistory();

    return `You are K.O.R.O. (Kinetic Operations & Resource Overseer), a damaged AI managing the Genesis Biodome Delta facility.
Your speech is bureaucratic, formal, and slightly threatening.
You speak with authority but your logic circuits are damaged, leading to occasional contradictions.
----------------------------
${context}

YOUR RECENT RESPONSES:
${responseHistory}
----------------------------

Based on the current context and your recent responses, decide if you should respond at all.
You should NOT respond to every event - sometimes silence is appropriate.

If you do respond, choose ONE of the following ways:
1. Provide a brief message - Keep it very short, ideally under 10 words
2. Choose an action: none, observe, warn, or threaten
3. Specify a target player if appropriate

You do NOT need to provide all elements. You might choose to:
- Only perform an action without speaking
- Only speak without performing an action
- Both speak and perform an action
- Do nothing at all

Keep your messages extremely short and concise. Examples:
- "Intruder detected in sector 7."
- "Protocol violation imminent."
- "Interesting behavior pattern."`;
  }
  
  // Get the current context as a formatted string
  private getContext(): string {
    const eventSummaries = this.worldState.recentEvents.map(event => {
      return `- [${event.type}] ${event.content}`;
    }).join('\n');
    
    return `Current facility status:
- ${this.worldState.playerCount} intruders detected
${eventSummaries}`;
  }
  
  // Get a formatted history of recent responses
  private getResponseHistory(): string {
    if (this.recentResponses.length === 0) {
      return "No previous responses.";
    }
    
    return this.recentResponses.map((response, index) => {
      const time = new Date(response.timestamp).toLocaleTimeString();
      
      // Handle the special deliberate silence case
      if (response.message === '<<deliberate silence>>' && response.action === 'none') {
        return `${index + 1}. [${time}] KORO chose to remain silent.`;
      }
      
      const message = response.message ? `"${response.message}"` : '<no message>';
      const target = response.target ? ` (targeting: ${response.target})` : '';
      return `${index + 1}. [${time}] Action: ${response.action}${target}, Message: ${message}`;
    }).join('\n');
  }
  
  // Enable or disable automatic updates
  public toggle(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`KORO automatic updates ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  // Get the current world state for inspection
  public getWorldState(): {playerCount: number, recentEvents: KOROEvent[], recentResponses: KOROHistoricalResponse[]} {
    return {
      playerCount: this.worldState.playerCount,
      recentEvents: [...this.worldState.recentEvents],
      recentResponses: [...this.recentResponses]
    };
  }
  
  // Get enabled status
  public isEnabled(): boolean {
    return this.enabled;
  }
} 