export interface AudioCaptureConfig {
  sampleRate: number;
  channels: number;
  bufferSize: number;
}

export class AudioCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private onAudioData?: (audioData: ArrayBuffer) => void;

  private readonly config: AudioCaptureConfig = {
    sampleRate: 24000, // OpenAI Realtime API expects 24kHz
    channels: 1, // Mono
    bufferSize: 4096
  };

  async startCapture(onAudioData: (audioData: ArrayBuffer) => void): Promise<void> {
    if (this.isRecording) {
      console.warn('Audio capture is already running');
      return;
    }

    this.onAudioData = onAudioData;

    try {
      // Request microphone access with specific constraints for high quality
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: false, // Disable to preserve natural voice
          noiseSuppression: false, // Disable to preserve natural voice  
          autoGainControl: false,  // We'll handle gain manually
          googEchoCancellation: false,
          googNoiseSuppression: false,
          googAutoGainControl: false,
          googHighpassFilter: false,
        } as any // Cast to any to include Google-specific constraints
      });

      // Create AudioContext with the desired sample rate
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      // Log actual sample rate for debugging
      console.log(`🎤 AudioContext sample rate: ${this.audioContext.sampleRate}Hz`);

      // Create audio source from the media stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);

      // Use a simpler approach with AnalyserNode and periodic sampling for real audio data
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0;
      
      this.sourceNode.connect(analyser);

      // Start capturing real audio data periodically
      this.startRealAudioCapture(analyser);

      this.isRecording = true;
      console.log('🎤 Audio capture started with real audio streaming');

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  private startRealAudioCapture(analyser: AnalyserNode): void {
    const bufferLength = 2048; // Use analyser.fftSize for proper buffer size
    const audioBuffer = new Float32Array(bufferLength);
    let lastCaptureTime = 0;
    const captureInterval = 50; // Capture every 50ms for better audio quality

    const captureAudio = (currentTime: number) => {
      if (!this.isRecording) return;

      // Throttle capture rate but capture more frequently for better audio
      if (currentTime - lastCaptureTime >= captureInterval) {
        // Get actual time domain audio data (not frequency data)
        analyser.getFloatTimeDomainData(audioBuffer);
        
        // Calculate RMS (Root Mean Square) for better signal detection
        let sum = 0;
        for (const sample of audioBuffer) {
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / audioBuffer.length);
        
        // Lower threshold and always send some audio to maintain stream
        const hasSignal = rms > 0.001; // Much lower threshold
        
        if (hasSignal || Math.random() < 0.1) { // Send occasional silence to maintain stream
          // Convert to 16-bit PCM format expected by OpenAI
          const pcm16Buffer = this.convertToPCM16(audioBuffer);
          
          // Send the audio data
          this.onAudioData?.(pcm16Buffer);
          console.debug(`🎤 Captured ${audioBuffer.length} samples, RMS: ${rms.toFixed(4)}`);
        }
        
        lastCaptureTime = currentTime;
      }

      // Continue capturing
      requestAnimationFrame(captureAudio);
    };

    // Start the capture loop
    requestAnimationFrame(captureAudio);
  }

  private convertToPCM16(float32Array: Float32Array): ArrayBuffer {
    // Create 16-bit PCM buffer
    const pcm16Array = new Int16Array(float32Array.length);
    
    // Calculate RMS for auto-gain
    let sum = 0;
    for (const sample of float32Array) {
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / float32Array.length);
    
    // Apply gain to boost quiet audio (but prevent clipping)
    const targetRms = 0.1; // Target RMS level
    const gain = rms > 0 ? Math.min(targetRms / rms, 4.0) : 1.0; // Max 4x gain
    
    for (let i = 0; i < float32Array.length; i++) {
      // Apply gain and clamp the float value to [-1, 1]
      const amplified = float32Array[i] * gain;
      const sample = Math.max(-1, Math.min(1, amplified));
      pcm16Array[i] = Math.round(sample * 0x7FFF);
    }
    
    console.debug(`🎤 Audio conversion: RMS=${rms.toFixed(4)}, Gain=${gain.toFixed(2)}`);
    
    return pcm16Array.buffer;
  }

  async stopCapture(): Promise<void> {
    if (!this.isRecording) {
      console.warn('Audio capture is not running');
      return;
    }

    this.isRecording = false;

    // Clean up audio worklet node
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    // Clean up source node
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Stop all tracks in the stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Clean up media recorder if used
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    this.onAudioData = undefined;
    
    console.log('🎤 Audio capture stopped');
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }
}

export const audioCaptureService = new AudioCaptureService();
