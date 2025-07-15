import { useState } from "react";
import PorcupineTest from "./components/PorcupineTest";
import OpenAIChat from "./components/OpenAIChatNew";
import "./App.css";

function App() {
  const [currentView, setCurrentView] = useState<
    "main" | "porcupine" | "openai"
  >("main");

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8">
      {/* Navigation */}
      <div className="fixed top-4 right-4 flex gap-2">
        <button
          onClick={() => setCurrentView("main")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === "main"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          Main
        </button>
        <button
          onClick={() => setCurrentView("openai")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === "openai"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          🤖 Eva Chat
        </button>
        <button
          onClick={() => setCurrentView("porcupine")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === "porcupine"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          🎤 Wake Word Test
        </button>
      </div>

      {(() => {
        if (currentView === "porcupine") {
          return <PorcupineTest />;
        } else if (currentView === "openai") {
          return <OpenAIChat />;
        } else {
          return (
            <div className="w-full max-w-4xl">
              <div className="text-center space-y-6">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
                  🤖 Eva Desktop
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  A very cute AI assistant to beat the shit out of Alexa, and
                  your loneliness.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                  <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">
                      🎤 Wake Word Detection
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Test the "Hi Eva" wake word detection system using
                      Porcupine.
                    </p>
                    <button
                      onClick={() => setCurrentView("porcupine")}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Test Wake Word
                    </button>
                  </div>

                  <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border">
                    <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">
                      🤖 OpenAI Chat
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Chat with Eva using OpenAI's Realtime API for natural
                      conversation.
                    </p>
                    <button
                      onClick={() => setCurrentView("openai")}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Chatting
                    </button>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300 mb-2">
                    🚀 Current Features
                  </h3>
                  <div className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                    <p>✅ Voice wake word detection ("Hi Eva")</p>
                    <p>✅ OpenAI Realtime API integration</p>
                    <p>✅ Real-time voice conversation</p>
                    <p>✅ Text and voice input support</p>
                    <p>🔄 Live2D/VRM avatar support (coming soon)</p>
                    <p>🔄 Smart home integration (coming soon)</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      })()}
    </main>
  );
}

export default App;
