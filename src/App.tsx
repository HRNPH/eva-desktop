import { useState } from "react";
import PorcupineTest from "./components/PorcupineTest";
import "./App.css";

function App() {
  const [currentView, setCurrentView] = useState<"main" | "porcupine">("main");

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
          onClick={() => setCurrentView("porcupine")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentView === "porcupine"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          Porcupine Test
        </button>
      </div>

      {currentView === "porcupine" ? (
        <PorcupineTest />
      ) : (
        <div className="w-full max-w-4xl"></div>
      )}
    </main>
  );
}

export default App;
