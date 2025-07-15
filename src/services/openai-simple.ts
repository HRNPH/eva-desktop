export interface RealtimeStatus {
  apiKey: 'configured' | 'missing';
  connected: boolean;
  sessionId?: string;
}

export interface OpenAIEvent {
  type: 'session.created' | 'response.text.delta' | 'response.text.done' | 
        'response.audio.delta' | 'response.audio.done' | 'error' | 'input_audio_buffer.speech_started' | 
        'input_audio_buffer.speech_stopped' | 'conversation.item.created' | 'response.created' |
        'response.done' | 'input_audio_buffer.committed';
  data: any;
}

export class OpenAIRealtimeService {
  private isConnected = false;
  private sessionId?: string;
  private websocket: WebSocket | null = null;
  private readonly eventHandlers = new Map<string, ((event: OpenAIEvent) => void)[]>();

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('Already connected to OpenAI');
      return;
    }

    try {
      // Check for API key
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY || 
                    localStorage.getItem('openai_api_key') ||
                    (globalThis as any).OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key not found');
      }

      // Connect to OpenAI Realtime API via WebSocket
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      
      this.websocket = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${apiKey}`,
        'openai-beta.realtime-v1'
      ]);

      await new Promise<void>((resolve, reject) => {
        if (!this.websocket) return reject(new Error('WebSocket creation failed'));

        this.websocket.onopen = () => {
          console.log('🔌 WebSocket connected to OpenAI Realtime API');
          
          // Send session configuration
          this.sendRealtimeEvent({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: 'You are Eva, a very cute AI assistant. Respond in a friendly, helpful, and slightly playful manner. Keep your responses concise but warm.',
              voice: 'alloy',
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              }
            }
          });
          
          this.isConnected = true;
          this.sessionId = `session_${Date.now()}`;
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleRealtimeEvent(data);
          } catch (error) {
            console.error('Failed to parse realtime event:', error);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { 
            message: 'WebSocket connection failed',
            type: 'connection_error'
          });
          reject(new Error('WebSocket connection failed'));
        };

        this.websocket.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.sessionId = undefined;
        };
      });

      console.log('✅ Connected to OpenAI Realtime API successfully');
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
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
    this.sessionId = undefined;
    console.log('🔌 Disconnected from OpenAI Realtime API');
  }

  private sendRealtimeEvent(event: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(event));
    } else {
      console.warn('Cannot send event: WebSocket not connected');
    }
  }

  private handleRealtimeEvent(event: any): void {
    console.log('📨 Realtime event:', event.type);

    switch (event.type) {
      case 'session.created':
        this.emit('session.created', event);
        break;
      
      case 'session.updated':
        console.log('Session updated');
        break;

      case 'input_audio_buffer.speech_started':
        this.emit('input_audio_buffer.speech_started', event);
        break;

      case 'input_audio_buffer.speech_stopped':
        this.emit('input_audio_buffer.speech_stopped', event);
        break;

      case 'input_audio_buffer.committed':
        this.emit('input_audio_buffer.committed', event);
        break;

      case 'conversation.item.created':
        this.emit('conversation.item.created', event);
        break;

      case 'response.created':
        this.emit('response.created', event);
        break;

      case 'response.text.delta':
        this.emit('response.text.delta', event);
        break;

      case 'response.text.done':
        this.emit('response.text.done', event);
        break;

      case 'response.audio.delta':
        this.emit('response.audio.delta', event);
        break;

      case 'response.audio.done':
        this.emit('response.audio.done', event);
        break;

      case 'response.done':
        this.emit('response.done', event);
        break;

      case 'error':
        this.emit('error', event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    try {
      console.log('📤 Sending message to OpenAI:', content);

      // Send text message to Realtime API
      this.sendRealtimeEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: content
            }
          ]
        }
      });

      // Trigger response
      this.sendRealtimeEvent({
        type: 'response.create'
      });

    } catch (error) {
      console.error('Failed to send message:', error);
      this.emit('error', { 
        message: error instanceof Error ? error.message : 'Failed to send message',
        type: 'message_error'
      });
      throw error;
    }
  }

  async sendAudioData(audioData: ArrayBuffer): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    try {
      // Convert ArrayBuffer to base64
      const base64Audio = this.arrayBufferToBase64(audioData);
      
      this.sendRealtimeEvent({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      });
    } catch (error) {
      console.error('Failed to send audio data:', error);
      throw error;
    }
  }

  async commitAudioBuffer(): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    this.sendRealtimeEvent({
      type: 'input_audio_buffer.commit'
    });
  }

  async createResponse(): Promise<void> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to OpenAI Realtime API');
    }

    this.sendRealtimeEvent({
      type: 'response.create'
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  getStatus(): RealtimeStatus {
    // Check if API key is available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || 
                   localStorage.getItem('openai_api_key') ||
                   (globalThis as any).OPENAI_API_KEY;
    
    return {
      apiKey: apiKey ? 'configured' : 'missing',
      connected: this.isConnected,
      sessionId: this.sessionId,
    };
  }

  // Manual API key setting for testing
  setApiKey(apiKey: string): void {
    localStorage.setItem('openai_api_key', apiKey);
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
