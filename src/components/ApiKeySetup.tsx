import React, { useState } from "react";
import { openaiRealtimeService } from "../services/openai-simple";

const ApiKeySetup: React.FC = () => {
  const [apiKey, setApiKey] = useState("");
  const [isSet, setIsSet] = useState(false);

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      openaiRealtimeService.setApiKey(apiKey.trim());
      setIsSet(true);
      setApiKey(""); // Clear the input for security
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSetApiKey();
    }
  };

  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
        🔑 OpenAI API Key Setup
      </h3>

      {!isSet ? (
        <div className="space-y-3">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Enter your OpenAI API key to enable Eva Chat functionality:
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSetApiKey}
              disabled={!apiKey.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              Set Key
            </button>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            🔒 Your API key is stored locally and never sent to anyone except
            OpenAI
          </p>
        </div>
      ) : (
        <div className="text-green-700 dark:text-green-400">
          ✅ API key has been set! You can now use Eva Chat.
        </div>
      )}
    </div>
  );
};

export default ApiKeySetup;
