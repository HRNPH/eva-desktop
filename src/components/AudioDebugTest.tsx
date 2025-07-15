import React, { useState } from 'react';
import { audioCaptureService } from '../services/audio-capture';

const AudioDebugTest: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioStats, setAudioStats] = useState({
    chunksReceived: 0,
    totalBytes: 0,
    lastChunkSize: 0,
    averageChunkSize: 0,
    isActive: false
  });

  const handleStartTest = async () => {
    try {
      let chunkCount = 0;
      let totalBytes = 0;

      console.log('🧪 Starting audio debug test...');
      
      await audioCaptureService.startCapture((audioData) => {
        chunkCount++;
        totalBytes += audioData.byteLength;
        
        const avgChunkSize = Math.round(totalBytes / chunkCount);
        
        setAudioStats({
          chunksReceived: chunkCount,
          totalBytes,
          lastChunkSize: audioData.byteLength,
          averageChunkSize: avgChunkSize,
          isActive: true
        });

        // Log some audio data for verification
        if (chunkCount % 20 === 0) {
          const int16View = new Int16Array(audioData);
          const sampleValues = Array.from(int16View.slice(0, 10)).map(v => v.toString());
          console.log(`🎤 Audio chunk ${chunkCount}: ${audioData.byteLength} bytes, samples: [${sampleValues.join(', ')}...]`);
        }
      });

      setIsRecording(true);
      console.log('✅ Audio debug test started');
    } catch (error) {
      console.error('❌ Failed to start audio debug test:', error);
    }
  };

  const handleStopTest = async () => {
    try {
      await audioCaptureService.stopCapture();
      setIsRecording(false);
      setAudioStats(prev => ({ ...prev, isActive: false }));
      console.log('🛑 Audio debug test stopped');
    } catch (error) {
      console.error('❌ Failed to stop audio debug test:', error);
    }
  };

  const resetStats = () => {
    setAudioStats({
      chunksReceived: 0,
      totalBytes: 0,
      lastChunkSize: 0,
      averageChunkSize: 0,
      isActive: false
    });
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
        🧪 Audio Debug Test
      </h2>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={handleStartTest}
            disabled={isRecording}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isRecording ? 'Recording...' : 'Start Audio Test'}
          </button>
          
          <button
            onClick={handleStopTest}
            disabled={!isRecording}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Stop Test
          </button>
          
          <button
            onClick={resetStats}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset Stats
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Audio Statistics</h3>
            <div className="space-y-1 text-sm">
              <div>Status: <span className={audioStats.isActive ? 'text-green-600' : 'text-red-600'}>
                {audioStats.isActive ? 'Active' : 'Inactive'}
              </span></div>
              <div>Chunks Received: <span className="font-mono">{audioStats.chunksReceived}</span></div>
              <div>Total Bytes: <span className="font-mono">{audioStats.totalBytes.toLocaleString()}</span></div>
              <div>Last Chunk Size: <span className="font-mono">{audioStats.lastChunkSize} bytes</span></div>
              <div>Average Chunk Size: <span className="font-mono">{audioStats.averageChunkSize} bytes</span></div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Expected Values</h3>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div>Sample Rate: 24kHz</div>
              <div>Format: PCM16 (16-bit)</div>
              <div>Channels: 1 (Mono)</div>
              <div>Expected chunk: ~2KB</div>
              <div>Capture rate: ~10Hz</div>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Click "Start Audio Test" and grant microphone permission</li>
            <li>Speak into your microphone</li>
            <li>Watch the statistics update in real-time</li>
            <li>Check browser console for detailed audio data logs</li>
            <li>Stop the test when done</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AudioDebugTest;
