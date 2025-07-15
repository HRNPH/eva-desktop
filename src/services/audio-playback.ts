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
      console.log(`🎵 Audio context created: ${this.audioContext.state}, sampleRate: ${this.audioContext.sampleRate}`);
      
      // Resume audio context on user interaction if needed
      if (this.audioContext.state === 'suspended') {
        console.warn('⚠️ Audio context is suspended, will resume on user interaction');
        document.addEventListener('click', this.resumeAudioContext, { once: true });
        document.addEventListener('keydown', this.resumeAudioContext, { once: true });
      }
      
      this.isInitialized = true;
      console.log('✅ Audio playback service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
      throw error;
    }
  }

  private readonly resumeAudioContext = async () => {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  };

  async queueAudioChunk(base64Audio: string): Promise<void> {
    console.log(`🎵 Attempting to queue audio chunk (${base64Audio.length} chars)`);
    
    // Ensure initialization
    await this.ensureInitialized();
    
    if (!this.audioContext) {
      const error = 'Audio context not initialized';
      console.error('❌ ' + error);
      throw new Error(error);
    }

    if (this.audioContext.state === 'suspended') {
      console.warn('⚠️ Audio context is suspended, attempting to resume...');
      try {
        await this.audioContext.resume();
        console.log('✅ Audio context resumed');
      } catch (error) {
        console.error('❌ Failed to resume audio context:', error);
        throw error;
      }
    }

    try {
      // Convert base64 to ArrayBuffer
      console.log('🔄 Converting base64 to ArrayBuffer...');
      const audioData = atob(base64Audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      console.log(`✅ Converted to ArrayBuffer: ${arrayBuffer.byteLength} bytes`);

      // Add to queue
      this.audioQueue.push(arrayBuffer);
      console.log(`📤 Added to queue. Queue length: ${this.audioQueue.length}`);
      
      // Start playing if not already playing
      if (!this.isPlaying) {
        console.log('🎵 Starting playback...');
        this.startPlayback();
      } else {
        console.log('🎵 Already playing, chunk added to queue');
      }
    } catch (error) {
      console.error('❌ Failed to queue audio chunk:', error);
      throw error;
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
      console.log(`🎵 Playing audio buffer: ${arrayBuffer.byteLength} bytes`);
      
      // For PCM16 audio from OpenAI, we need to convert it properly
      const audioBuffer = await this.convertPCM16ToAudioBuffer(arrayBuffer);
      console.log(`✅ Converted to AudioBuffer: ${audioBuffer.duration.toFixed(3)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      // Schedule the audio to play at the current time
      source.start(this.currentTime);
      console.log(`🔊 Audio started at ${this.currentTime.toFixed(3)}s`);
      
      // Update current time for next chunk
      this.currentTime += audioBuffer.duration;
      
      // Wait for the audio to finish
      await new Promise<void>((resolve) => {
        source.onended = () => {
          console.log('🔇 Audio chunk playback ended');
          resolve();
        };
      });
    } catch (error) {
      console.error('❌ Failed to play audio buffer:', error);
      throw error;
    }
  }

  private async convertPCM16ToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    console.log(`🔄 Converting PCM16 buffer: ${arrayBuffer.byteLength} bytes`);

    // Convert the raw PCM16 data to AudioBuffer
    const int16Array = new Int16Array(arrayBuffer);
    console.log(`📊 PCM16 samples: ${int16Array.length}, first 10 samples:`, Array.from(int16Array.slice(0, 10)));
    
    // Check if we have valid audio data
    const maxAmplitude = Math.max(...Array.from(int16Array).map(Math.abs));
    console.log(`📊 Max amplitude: ${maxAmplitude} (should be > 0 for valid audio)`);
    
    if (maxAmplitude === 0) {
      console.warn('⚠️ Audio buffer contains only silence!');
    }

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

    console.log(`✅ AudioBuffer created: ${audioBuffer.duration.toFixed(3)}s duration`);
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

  // Test audio playback with a simple tone
  async testAudio(): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    console.log('🎵 Testing audio playback...');
    
    // Generate a simple test tone (440Hz for 0.5 seconds)
    const duration = 0.5;
    const sampleRate = this.audioContext.sampleRate;
    const numSamples = Math.floor(duration * sampleRate);
    
    const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Generate 440Hz sine wave
    for (let i = 0; i < numSamples; i++) {
      channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
    
    console.log('🔊 Test tone playing...');
    
    return new Promise((resolve) => {
      source.onended = () => {
        console.log('✅ Test audio completed');
        resolve();
      };
    });
  }
}

// Export singleton instance
export const audioPlaybackService = new AudioPlaybackService();
