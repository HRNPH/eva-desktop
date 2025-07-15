import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface OpenAIEvent {
  type: string;
  session?: {
    id: string;
    model: string;
    modalities: string[];
    voice: string;
  };
  delta?: string;
  text?: string;
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

interface Message {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const OpenAIChat: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [status, setStatus] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [logs, setLogs] = useState<Array<{ id: string; message: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentResponseRef = useRef("");

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: `${Date.now()}-${Math.random()}`,
      message: `[${timestamp}] ${message}`,
    };
    setLogs((prev) => [...prev.slice(-19), logEntry]);
  };

  const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...message,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse]);

  // Listen for OpenAI events
  useEffect(() => {
    const setupEventListener = async () => {
      const unlisten = await listen("openai-event", (event) => {
        const openaiEvent = event.payload as OpenAIEvent;
        addLog(`📨 OpenAI Event: ${openaiEvent.type}`);

        switch (openaiEvent.type) {
          case "session.created":
            addLog(`✅ Session created: ${openaiEvent.session?.id}`);
            addMessage({
              type: "system",
              content: `Session started with model: ${openaiEvent.session?.model}`,
            });
            break;

          case "response.text.delta":
            if (openaiEvent.delta) {
              currentResponseRef.current += openaiEvent.delta;
              setCurrentResponse(currentResponseRef.current);
            }
            break;

          case "response.text.done":
            if (currentResponseRef.current) {
              addMessage({
                type: "assistant",
                content: currentResponseRef.current,
              });
              currentResponseRef.current = "";
              setCurrentResponse("");
              setIsLoading(false);
            }
            break;

          case "response.audio.delta":
            // Audio playback will be implemented in future iteration
            addLog("🔊 Received audio chunk");
            break;

          case "response.audio.done":
            addLog("🔊 Audio response completed");
            break;

          case "error": {
            const errorMsg = openaiEvent.error?.message || "Unknown error";
            addLog(`❌ Error: ${errorMsg}`);
            addMessage({
              type: "system",
              content: `Error: ${errorMsg}`,
            });
            setIsLoading(false);
            break;
          }

          default:
            addLog(`📋 Other event: ${openaiEvent.type}`);
        }
      });

      return unlisten;
    };

    setupEventListener();
  }, []);

  // Update status periodically
  useEffect(() => {
    const updateStatus = async () => {
      try {
        const statusResult = await invoke<{
          api_key: string;
          connected: boolean;
          session_id?: string;
        }>("openai_status");
        setStatus({
          api_key: statusResult.api_key,
          connected: statusResult.connected.toString(),
          session_id: statusResult.session_id || "",
        });
        setIsConnected(statusResult.connected);
      } catch (error) {
        console.error("Failed to get status:", error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      addLog("🔌 Connecting to OpenAI Realtime API...");
      await invoke("openai_connect");
      addLog("✅ Connected successfully");
      addMessage({
        type: "system",
        content:
          "Connected to OpenAI Realtime API. Hi, I'm Eva! How can I help you today?",
      });
    } catch (error) {
      addLog(`❌ Connection failed: ${error}`);
      addMessage({
        type: "system",
        content: `Connection failed: ${error}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      addLog("🔌 Disconnecting from OpenAI...");
      await invoke("openai_disconnect");
      await invoke("stop_audio_capture");
      setIsRecording(false);
      addLog("✅ Disconnected successfully");
      addMessage({
        type: "system",
        content: "Disconnected from OpenAI Realtime API",
      });
    } catch (error) {
      addLog(`❌ Disconnect failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = async () => {
    if (!currentInput.trim() || !isConnected) return;

    const userMessage = currentInput.trim();
    setCurrentInput("");

    addMessage({
      type: "user",
      content: userMessage,
    });

    try {
      setIsLoading(true);
      currentResponseRef.current = "";
      addLog(`📤 Sending text: ${userMessage}`);
      await invoke("openai_send_text", { text: userMessage });
    } catch (error) {
      addLog(`❌ Failed to send text: ${error}`);
      addMessage({
        type: "system",
        content: `Failed to send message: ${error}`,
      });
      setIsLoading(false);
    }
  };

  const handleStartRecording = async () => {
    if (!isConnected) {
      addLog("❌ Must be connected to OpenAI first");
      return;
    }

    try {
      addLog("🎤 Starting audio recording...");
      await invoke("start_audio_capture");
      setIsRecording(true);
      addLog("✅ Audio recording started");
      addMessage({
        type: "system",
        content: "Started voice recording. Speak now!",
      });
    } catch (error) {
      addLog(`❌ Failed to start recording: ${error}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      addLog("🔇 Stopping audio recording...");
      await invoke("stop_audio_capture");
      setIsRecording(false);
      addLog("✅ Audio recording stopped");
      addMessage({
        type: "system",
        content: "Stopped voice recording",
      });
    } catch (error) {
      addLog(`❌ Failed to stop recording: ${error}`);
    }
  };

  const handleInterrupt = async () => {
    try {
      addLog("⏹️ Interrupting response...");
      await invoke("openai_interrupt");
      setIsLoading(false);
      currentResponseRef.current = "";
      setCurrentResponse("");
      addLog("✅ Response interrupted");
    } catch (error) {
      addLog(`❌ Failed to interrupt: ${error}`);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setCurrentResponse("");
    currentResponseRef.current = "";
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
        🤖 Eva - OpenAI Realtime Chat
      </h2>

      {/* Status Section */}
      <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
          📊 Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div
            className={`p-2 rounded ${
              isConnected
                ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            }`}
          >
            <span className="font-medium">Connection:</span>{" "}
            {isConnected ? "✅ Connected" : "❌ Disconnected"}
          </div>
          <div
            className={`p-2 rounded ${
              isRecording
                ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
            }`}
          >
            <span className="font-medium">Audio:</span>{" "}
            {isRecording ? "🎤 Recording" : "🔇 Not Recording"}
          </div>
          <div className="p-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
            <span className="font-medium">API Key:</span>{" "}
            {status.api_key || "❌ Missing"}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-3">
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={
              isLoading || !status.api_key || status.api_key.includes("❌")
            }
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "🔄 Connecting..." : "🔌 Connect to OpenAI"}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "🔄 Disconnecting..." : "🔌 Disconnect"}
          </button>
        )}

        {isConnected && (
          <>
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                🎤 Start Voice
              </button>
            ) : (
              <button
                onClick={handleStopRecording}
                disabled={isLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                🔇 Stop Voice
              </button>
            )}

            {isLoading && (
              <button
                onClick={handleInterrupt}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                ⏹️ Interrupt
              </button>
            )}

            <button
              onClick={clearMessages}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              🗑️ Clear Chat
            </button>
          </>
        )}
      </div>

      {/* Environment Variable Check */}
      {(!status.api_key || status.api_key.includes("❌")) && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3">
            ⚠️ OpenAI API Key Required
          </h3>
          <p className="text-yellow-700 dark:text-yellow-400 mb-2">
            Please set your OpenAI API key as an environment variable:
          </p>
          <div className="bg-black text-green-400 p-3 rounded font-mono text-sm">
            export OPENAI_API_KEY="your_openai_api_key_here"
          </div>
          <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
            💡 Get your API key from{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              OpenAI Platform
            </a>
          </p>
        </div>
      )}

      {/* Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            💬 Conversation
          </h3>
          <div className="h-96 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-y-auto border">
            {messages.map((message) => {
              let messageClass = "bg-gray-200 dark:bg-gray-700 mx-4 text-sm";
              if (message.type === "user") {
                messageClass = "bg-blue-100 dark:bg-blue-900/30 ml-8";
              } else if (message.type === "assistant") {
                messageClass = "bg-green-100 dark:bg-green-900/30 mr-8";
              }

              let senderLabel = "🔧 System";
              if (message.type === "user") {
                senderLabel = "👤 You";
              } else if (message.type === "assistant") {
                senderLabel = "🤖 Eva";
              }

              return (
                <div
                  key={message.id}
                  className={`mb-3 p-3 rounded-lg ${messageClass}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm text-gray-600 dark:text-gray-400">
                      {senderLabel}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              );
            })}

            {currentResponse && (
              <div className="mb-3 p-3 rounded-lg bg-green-100 dark:bg-green-900/30 mr-8">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm text-gray-600 dark:text-gray-400">
                    🤖 Eva (typing...)
                  </span>
                </div>
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {currentResponse}
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Text Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendText()}
              placeholder="Type a message to Eva..."
              disabled={!isConnected || isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-800"
            />
            <button
              onClick={handleSendText}
              disabled={!isConnected || !currentInput.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              📤 Send
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              📋 Event Logs
            </h3>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="h-96 bg-gray-900 text-green-400 rounded-lg p-4 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-gray-500">No events yet...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="mb-1">
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Usage Notes */}
      <div className="mt-6 p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
        <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300 mb-3">
          📖 Usage Notes
        </h3>
        <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
          <li>• Connect to OpenAI first before using voice or text features</li>
          <li>
            • Voice recording streams audio directly to OpenAI for real-time
            conversation
          </li>
          <li>• Text messages and voice input both trigger Eva's responses</li>
          <li>• Use the interrupt button to stop Eva mid-response</li>
          <li>• Eva is configured with a cute, friendly personality</li>
          <li>• Requires OPENAI_API_KEY environment variable to be set</li>
        </ul>
      </div>
    </div>
  );
};

export default OpenAIChat;
