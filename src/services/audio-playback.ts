export class AudioPlaybackService {
  private audioContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentTime = 0;
  private readonly sampleRate = 24000; // OpenAI Realtime API uses 24kHz
  private isInitialized = false;

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      
      // Resume audio context on user interaction if needed
      if (this.audioContext.state === 'suspended') {
        document.addEventListener('click', this.resumeAudioContext, { once: true });
        document.addEventListener('keydown', this.resumeAudioContext, { once: true });
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  private readonly resumeAudioContext = async () => {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  };

  async queueAudioChunk(base64Audio: string): Promise<void> {
    // Ensure initialization
    await this.ensureInitialized();
    
    if (!this.audioContext) {
      console.warn('Audio context not initialized');
      return;
    }

    try {
      // Convert base64 to ArrayBuffer
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      // Add to queue
      this.audioQueue.push(arrayBuffer);
      
      // Start playing if not already playing
      if (!this.isPlaying) {
        this.startPlayback();
      }
    } catch (error) {
      console.error('Failed to queue audio chunk:', error);
    }
  }

  private async startPlayback() {
    if (!this.audioContext || this.isPlaying) {
      return;
    }

    this.isPlaying = true;
    this.currentTime = this.audioContext.currentTime;

    while (this.audioQueue.length > 0) {
      const audioBuffer = this.audioQueue.shift();
      if (audioBuffer) {
        await this.playAudioBuffer(audioBuffer);
      }
    }

    this.isPlaying = false;
  }

  private async playAudioBuffer(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    try {
      // For PCM16 audio from OpenAI, we need to convert it properly
      const audioBuffer = await this.convertPCM16ToAudioBuffer(arrayBuffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      // Schedule the audio to play at the current time
      source.start(this.currentTime);
      
      // Update current time for next chunk
      this.currentTime += audioBuffer.duration;
      
      // Wait for the audio to finish
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('Failed to play audio buffer:', error);
    }
  }

  private async convertPCM16ToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    // Convert the raw PCM16 data to AudioBuffer
    const int16Array = new Int16Array(arrayBuffer);
    const audioBuffer = this.audioContext.createBuffer(
      1, // mono
      int16Array.length,
      this.sampleRate
    );

    // Convert int16 to float32 and copy to audio buffer
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < int16Array.length; i++) {
      channelData[i] = int16Array[i] / 32768.0; // Convert from int16 to float32
    }

    return audioBuffer;
  }

  // Clear the queue and stop playback
  clearQueue(): void {
    this.audioQueue = [];
    this.isPlaying = false;
  }

  // Check if audio is currently playing
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  // Get queue length
  getQueueLength(): number {
    return this.audioQueue.length;
  }
}

// Export singleton instance
export const audioPlaybackService = new AudioPlaybackService();
