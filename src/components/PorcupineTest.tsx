import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface WakeWordEvent {
  keyword: string;
  confidence: number;
  timestamp: number;
}

const PorcupineTest: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [lastWakeWord, setLastWakeWord] = useState<WakeWordEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentWakeWord, setCurrentWakeWord] = useState<string>("Hi Eva");

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs((prev) => [...prev.slice(-9), logEntry]);
  };

  // Fetch the current wake word on component mount
  useEffect(() => {
    const fetchCurrentWakeWord = async () => {
      try {
        const wakeWord = await invoke<string>("get_current_wake_word");
        setCurrentWakeWord(wakeWord);
        addLog(`Current wake word: "${wakeWord}"`);
      } catch (err) {
        console.error("Failed to fetch current wake word:", err);
        addLog("Failed to fetch current wake word, using default");
      }
    };

    fetchCurrentWakeWord();
  }, []);

  useEffect(() => {
    // Listen for wake word events
    const unlistenWakeWord = listen<WakeWordEvent>(
      "wake-word-detected",
      (event) => {
        console.log("Wake word detected:", event.payload);
        setLastWakeWord(event.payload);
        addLog(
          `Wake word detected: "${event.payload.keyword}" with confidence ${event.payload.confidence}`
        );
      }
    );

    return () => {
      unlistenWakeWord.then((fn) => fn());
    };
  }, []);

  const startListening = async () => {
    try {
      setError(null);
      addLog("Starting wake word detection...");
      const result = await invoke<string>("start_wake_word");
      setIsListening(true);
      addLog(`Success: ${result}`);
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
    }
  };

  const stopListening = async () => {
    try {
      setError(null);
      addLog("Stopping wake word detection...");
      const result = await invoke<string>("stop_wake_word");
      setIsListening(false);
      addLog(`Success: ${result}`);
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
    }
  };

  const checkStatus = async () => {
    try {
      const status = await invoke<string>("wake_word_status");
      addLog(`Current status: ${status}`);
      setIsListening(status.includes("Listening"));
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      addLog(`Error checking status: ${errorMessage}`);
    }
  };

  const testMicrophone = async () => {
    try {
      setError(null);
      addLog("Testing microphone access...");
      const result = await invoke<string>("test_microphone");
      addLog(`Microphone test result: ${result}`);
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      addLog(`Microphone test failed: ${errorMessage}`);
    }
  };

  const testAudioLevels = async () => {
    try {
      setError(null);
      addLog("Testing audio levels for 10 seconds...");
      const result = await invoke<string>("test_audio_levels");
      addLog(`Audio levels test: ${result}`);
    } catch (err) {
      const errorMessage = err as string;
      setError(errorMessage);
      addLog(`Audio levels test failed: ${errorMessage}`);
    }
  };

  const refreshWakeWord = async () => {
    try {
      const wakeWord = await invoke<string>("get_current_wake_word");
      setCurrentWakeWord(wakeWord);
      addLog(`Current wake word updated: "${wakeWord}"`);
    } catch (err) {
      const errorMessage = err as string;
      addLog(`Failed to refresh wake word: ${errorMessage}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        🎤 Porcupine Wake Word Detection Test
      </h2>

      {/* Environment Variable Setup Instructions */}
      <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
          � Setup Instructions
        </h3>
        <div className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
          <p>
            <strong>
              Before using Porcupine, you need to set your access key:
            </strong>
          </p>
          <div className="bg-black text-green-400 p-3 rounded font-mono text-sm">
            export PV_ACCESS_KEY="your_picovoice_access_key_here"
          </div>
          <p>
            Get your free access key at{" "}
            <a
              href="https://console.picovoice.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              console.picovoice.ai
            </a>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500">
            💡 Tip: Add this to your shell profile (~/.zshrc, ~/.bashrc) to make
            it permanent
          </p>
          <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
            <p className="text-purple-700 dark:text-purple-300 font-medium">
              🎯 <strong>Custom Wake Word:</strong>
            </p>
            <p className="text-purple-600 dark:text-purple-400 text-xs mt-1">
              Place your trained "Hey EVA" model as{" "}
              <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">
                models/hi-eva.ppn
              </code>{" "}
              to use your custom wake word instead of the default "Hi Eva"
            </p>
          </div>
        </div>
      </div>

      {/* Status Display */}
      <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isListening ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Status:{" "}
              {isListening
                ? `Listening for "${lastWakeWord?.keyword || currentWakeWord}"`
                : "Not listening"}
            </span>
          </div>
          <button
            onClick={checkStatus}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded transition-colors"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <button
          onClick={testMicrophone}
          className="px-4 py-3 rounded-lg font-medium transition-colors bg-blue-500 hover:bg-blue-600 text-white text-sm"
        >
          🎤 Test Microphone
        </button>
        <button
          onClick={testAudioLevels}
          className="px-4 py-3 rounded-lg font-medium transition-colors bg-purple-500 hover:bg-purple-600 text-white text-sm"
        >
          🔊 Test Audio Levels
        </button>
        <button
          onClick={refreshWakeWord}
          className="px-4 py-3 rounded-lg font-medium transition-colors bg-gray-500 hover:bg-gray-600 text-white text-sm"
        >
          🔄 Refresh Wake Word
        </button>
        <button
          onClick={startListening}
          disabled={isListening}
          className={`px-4 py-3 rounded-lg font-medium transition-colors col-span-1 ${
            isListening
              ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600 text-white"
          }`}
        >
          ▶️ Start Listening
        </button>
        <button
          onClick={stopListening}
          disabled={!isListening}
          className={`px-4 py-3 rounded-lg font-medium transition-colors col-span-1 ${
            !isListening
              ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
        >
          ⏹️ Stop Listening
        </button>
        <button
          onClick={clearLogs}
          className="px-4 py-3 rounded-lg font-medium transition-colors bg-orange-500 hover:bg-orange-600 text-white text-sm"
        >
          🗑️ Clear Logs
        </button>
      </div>

      {/* Last Wake Word Event */}
      {lastWakeWord && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">
            🎯 Last Wake Word Detected
          </h3>
          <div className="space-y-1 text-sm text-green-700 dark:text-green-400">
            <div>
              <strong>Keyword:</strong> {lastWakeWord.keyword}
            </div>
            <div>
              <strong>Confidence:</strong> {lastWakeWord.confidence}
            </div>
            <div>
              <strong>Timestamp:</strong>{" "}
              {new Date(lastWakeWord.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
            ❌ Error
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
          📋 How to Use
        </h3>
        <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
          <li>
            • <strong>First:</strong> Make sure you've set the PV_ACCESS_KEY
            environment variable above
          </li>
          <li>• Click "Start Listening" to begin wake word detection</li>
          <li>
            • Say "<strong>{currentWakeWord}</strong>" clearly into your
            microphone
          </li>
          <li>• Watch for the wake word event to appear above</li>
          <li>• Check the logs below for detailed information</li>
        </ul>
      </div>

      {/* Logs */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            📝 Logs
          </h3>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded transition-colors"
          >
            Clear Logs
          </button>
        </div>
        <div className="bg-black text-green-400 p-3 rounded font-mono text-sm h-48 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={log + index} className="mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Technical Notes */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
          ⚠️ Technical Notes
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• This demo uses the built-in "Hi Eva" wake word for testing</li>
          <li>
            • For a custom "Hey EVA" wake word, you'd need to train a custom
            model using Picovoice Console
          </li>
          <li>• Microphone permissions are required for audio input</li>
          <li>• Audio processing runs locally for privacy</li>
          <li>
            • Detection accuracy depends on microphone quality and background
            noise
          </li>
        </ul>
      </div>
    </div>
  );
};

export default PorcupineTest;
