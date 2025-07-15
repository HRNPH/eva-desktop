import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  openaiRealtimeService,
  OpenAIEvent,
  RealtimeStatus,
} from "../services/openai-simple";
import { audioCaptureService } from "../services/audio-capture";
import ApiKeySetup from "./ApiKeySetup";

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
  const [status, setStatus] = useState<RealtimeStatus>({
    apiKey: "missing",
    connected: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [logs, setLogs] = useState<Array<{ id: string; message: string }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentResponseRef = useRef("");

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      id: `${Date.now()}-${Math.random()}`,
      message: `[${timestamp}] ${message}`,
    };
    setLogs((prev) => [...prev.slice(-19), logEntry]);
  }, []);

  const addMessage = useCallback(
    (message: Omit<Message, "id" | "timestamp">) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        timestamp: new Date(),
        ...message,
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    []
  );

  // Handle OpenAI events
  const handleOpenAIEvent = useCallback(
    (event: OpenAIEvent) => {
      addLog(`📨 OpenAI Event: ${event.type}`);

      switch (event.type) {
        case "session.created":
          addLog(`✅ Session created`);
          addMessage({
            type: "system",
            content: `Session started with Eva`,
          });
          break;

        case "response.text.delta":
          if (event.data?.delta) {
            currentResponseRef.current += event.data.delta;
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
          addLog("🔊 Received audio chunk");
          break;

        case "response.audio.done":
          addLog("🔊 Audio response completed");
          setIsLoading(false);
          break;

        case "error": {
          const errorMsg = event.data?.message || "Unknown error";
          addLog(`❌ Error: ${errorMsg}`);
          addMessage({
            type: "system",
            content: `Error: ${errorMsg}`,
          });
          setIsLoading(false);
          break;
        }

        default:
          addLog(`📋 Other event: ${event.type}`);
      }
    },
    [addLog, addMessage]
  );

  // Set up event listeners and status updates
  useEffect(() => {
    // Set up OpenAI event listeners
    openaiRealtimeService.on("session.created", handleOpenAIEvent);
    openaiRealtimeService.on("response.text.delta", handleOpenAIEvent);
    openaiRealtimeService.on("response.text.done", handleOpenAIEvent);
    openaiRealtimeService.on("response.audio.delta", handleOpenAIEvent);
    openaiRealtimeService.on("response.audio.done", handleOpenAIEvent);
    openaiRealtimeService.on("error", handleOpenAIEvent);

    // Update status periodically
    const updateStatus = () => {
      const currentStatus = openaiRealtimeService.getStatus();
      setStatus(currentStatus);
      setIsConnected(currentStatus.connected);
    };

    updateStatus();
    const statusInterval = setInterval(updateStatus, 2000);

    // Cleanup
    return () => {
      clearInterval(statusInterval);
      openaiRealtimeService.off("session.created", handleOpenAIEvent);
      openaiRealtimeService.off("response.text.delta", handleOpenAIEvent);
      openaiRealtimeService.off("response.text.done", handleOpenAIEvent);
      openaiRealtimeService.off("response.audio.delta", handleOpenAIEvent);
      openaiRealtimeService.off("response.audio.done", handleOpenAIEvent);
      openaiRealtimeService.off("error", handleOpenAIEvent);
    };
  }, [handleOpenAIEvent]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      addLog("🔌 Connecting to OpenAI...");
      await openaiRealtimeService.connect();
      addLog("✅ Successfully connected to OpenAI");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Connection failed: ${errorMessage}`);
      console.error("Connection failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      addLog("🔌 Disconnecting from OpenAI...");
      await openaiRealtimeService.disconnect();
      addLog("✅ Disconnected from OpenAI");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Disconnect failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = async () => {
    if (!currentInput.trim()) return;

    const userMessage = currentInput.trim();
    setCurrentInput("");

    addMessage({
      type: "user",
      content: userMessage,
    });

    try {
      setIsLoading(true);
      addLog(`📤 Sending text: ${userMessage}`);
      await openaiRealtimeService.sendMessage(userMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Failed to send text: ${errorMessage}`);
      addMessage({
        type: "system",
        content: `Failed to send message: ${errorMessage}`,
      });
      setIsLoading(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      addLog("🎤 Voice recording not yet implemented with simple service");
      // Voice recording will be implemented after text chat is working
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Failed to start recording: ${errorMessage}`);
    }
  };

  const handleStopRecording = async () => {
    try {
      addLog("🎤 Stopping voice recording...");
      await audioCaptureService.stopCapture();

      // Audio commit not needed for simple service
      setIsRecording(false);
      addLog("✅ Voice recording stopped");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Failed to stop recording: ${errorMessage}`);
    }
  };

  const handleInterrupt = async () => {
    try {
      addLog("⏹️ Interrupting response...");
      // Interrupt not implemented in simple service
      setCurrentResponse("");
      currentResponseRef.current = "";
      setIsLoading(false);
      addLog("✅ Response interrupted");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addLog(`❌ Failed to interrupt: ${errorMessage}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-100 to-pink-100 dark:from-gray-900 dark:to-purple-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg p-4 border-b">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            💬 Chat with Eva
          </h1>

          {/* API Key Setup */}
          <ApiKeySetup />

          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                API Key
              </div>
              <div className="font-semibold text-gray-800 dark:text-white">
                {status.apiKey === "configured"
                  ? "✅ Configured"
                  : "❌ Missing"}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Connection
              </div>
              <div className="font-semibold text-gray-800 dark:text-white">
                {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Recording
              </div>
              <div className="font-semibold text-gray-800 dark:text-white">
                {isRecording ? "🎤 Active" : "⏸️ Inactive"}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isLoading || status.apiKey !== "configured"}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {isLoading ? "Connecting..." : "🔌 Connect"}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                disabled={isLoading}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {isLoading ? "Disconnecting..." : "🔌 Disconnect"}
              </button>
            )}

            {isConnected && (
              <>
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    disabled={isLoading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    🎤 Start Recording
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    disabled={isLoading}
                    className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    ⏹️ Stop & Send
                  </button>
                )}

                {(isLoading || currentResponse) && (
                  <button
                    onClick={handleInterrupt}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    ⏹️ Interrupt
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 max-w-4xl mx-auto w-full gap-4 p-4">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === "user"
                      ? "bg-blue-500 text-white"
                      : message.type === "assistant"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  }`}
                >
                  <div className="text-sm opacity-75 mb-1">
                    {message.type === "user"
                      ? "You"
                      : message.type === "assistant"
                      ? "Eva"
                      : "System"}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {/* Current Response */}
            {currentResponse && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-purple-500 text-white">
                  <div className="text-sm opacity-75 mb-1">Eva (typing...)</div>
                  <div className="whitespace-pre-wrap">{currentResponse}</div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && !currentResponse && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">
                  <div className="text-sm opacity-75 mb-1">Eva</div>
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message to Eva..."
                disabled={!isConnected || isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleSendText}
                disabled={!isConnected || !currentInput.trim() || isLoading}
                className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Logs Panel */}
        <div className="w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4">
            📋 Activity Logs
          </h3>
          <div className="h-96 overflow-y-auto space-y-1 text-xs font-mono">
            {logs.map((log) => (
              <div
                key={log.id}
                className="text-gray-600 dark:text-gray-400 break-words"
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenAIChat;
