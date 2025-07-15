import OpenAI from 'openai';

export interface RealtimeStatus {
  apiKey: 'configured' | 'missing';
  connected: boolean;
  sessionId?: string;
}

export interface OpenAIEvent {
  type: 'session.created' | 'response.text.delta' | 'response.text.done' | 
        'response.audio.delta' | 'response.audio.done' | 'error';
  data: any;
}

export class OpenAIRealtimeService {
  private client: OpenAI | null = null;
  private isConnected = false;
  private sessionId?: string;
  private readonly eventHandlers = new Map<string, ((event: OpenAIEvent) => void)[]>();

  private async initializeClient(): Promise<void> {
    try {
      // Check for API key from environment variables
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || 
                    localStorage.getItem('openai_api_key') ||
                    (globalThis as any).OPENAI_API_KEY;
      
      if (!apiKey) {
        console.warn('OpenAI API key not found');
        return;
      }

      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // Required for browser usage
      });

      console.log('✅ OpenAI client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('Already connected to OpenAI');
      return;
    }

    try {
      if (!this.client) {
        await this.initializeClient();
        if (!this.client) {
          throw new Error('OpenAI client not initialized - API key missing');
        }
      }

      // Test the connection with a simple request
      try {
        await this.client.models.list();
      } catch (error) {
        console.error('API key validation failed:', error);
        throw new Error('Invalid API key or connection failed');
      }
      
      this.isConnected = true;
      this.sessionId = `session_${Date.now()}`;

      this.emit('session.created', {
        id: this.sessionId,
        model: 'gpt-4o-mini',
        modalities: ['text'],
      });

      console.log('✅ Connected to OpenAI successfully');
    } catch (error) {
      console.error('Failed to connect to OpenAI:', error);
      this.emit('error', { 
        message: error instanceof Error ? error.message : 'Connection failed',
        type: 'connection_error'
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.sessionId = undefined;
    console.log('🔌 Disconnected from OpenAI');
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to OpenAI');
    }

    try {
      console.log('📤 Sending message to OpenAI:', content);

      const stream = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Eva, a very cute AI assistant. Respond in a friendly, helpful, and slightly playful manner. Keep your responses concise but warm.'
          },
          { 
            role: 'user', 
            content 
          }
        ],
        stream: true,
      });

      let fullResponse = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullResponse += delta;
          this.emit('response.text.delta', { delta });
        }
      }

      this.emit('response.text.done', { text: fullResponse });
      console.log('✅ Message completed');
    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', { 
        message: error instanceof Error ? error.message : 'Failed to send message',
        type: 'message_error'
      });
      throw error;
    }
  }

  getStatus(): RealtimeStatus {
    const hasApiKey = !!this.client;
    return {
      apiKey: hasApiKey ? 'configured' : 'missing',
      connected: this.isConnected,
      sessionId: this.sessionId,
    };
  }

  // Manual API key setting for testing
  setApiKey(apiKey: string): void {
    localStorage.setItem('openai_api_key', apiKey);
    this.client = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true,
    });
    console.log('✅ API key updated');
  }

  on(event: string, handler: (event: OpenAIEvent) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: (event: OpenAIEvent) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(type: OpenAIEvent['type'], data: any): void {
    const event: OpenAIEvent = { type, data };
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }
}

// Export singleton instance
export const openaiRealtimeService = new OpenAIRealtimeService();
