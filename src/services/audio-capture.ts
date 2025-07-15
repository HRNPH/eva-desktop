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
  private analyserNode: AnalyserNode | null = null;
  private onAudioData?: (audioData: ArrayBuffer) => void;
  private intervalId?: number;

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
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up Web Audio API for processing
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = this.config.bufferSize;
      
      source.connect(this.analyserNode);

      // Use a simpler approach with periodic sampling
      this.startPeriodicSampling();

      this.isRecording = true;
      console.log('🎤 Audio capture started');

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  private startPeriodicSampling(): void {
    const bufferLength = this.analyserNode!.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);

    const sample = () => {
      if (!this.isRecording || !this.analyserNode) return;

      this.analyserNode.getFloatTimeDomainData(dataArray);
      
      // Convert Float32Array to Int16Array for OpenAI
      const int16Array = this.float32ToInt16(dataArray);
      
      // Create a proper ArrayBuffer
      const arrayBuffer = new ArrayBuffer(int16Array.byteLength);
      const view = new Int16Array(arrayBuffer);
      view.set(int16Array);
      
      this.onAudioData?.(arrayBuffer);
    };

    // Sample at ~60fps for smooth audio processing
    this.intervalId = window.setInterval(sample, 16);
  }

  async stopCapture(): Promise<void> {
    if (!this.isRecording) {
      console.warn('Audio capture is not running');
      return;
    }

    this.isRecording = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    this.analyserNode = null;
    this.onAudioData = undefined;
    
    console.log('🎤 Audio capture stopped');
  }

  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample * 0x7FFF;
    }
    return int16Array;
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }
}

export const audioCaptureService = new AudioCaptureService();
