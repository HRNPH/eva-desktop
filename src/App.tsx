import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import TailwindTest from "./TailwindTest";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8">
      <div className="mb-8 max-w-md w-full">
        <TailwindTest />
      </div>

      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">
        Welcome to Tauri + React
      </h1>

      <div className="flex justify-center items-center gap-8 mb-6">
        <a
          href="https://vitejs.dev"
          target="_blank"
          className="transition-transform hover:scale-110"
        >
          <img
            src="/vite.svg"
            className="logo vite h-24 p-6 transition-all duration-700"
            alt="Vite logo"
          />
        </a>
        <a
          href="https://tauri.app"
          target="_blank"
          className="transition-transform hover:scale-110"
        >
          <img
            src="/tauri.svg"
            className="logo tauri h-24 p-6 transition-all duration-700"
            alt="Tauri logo"
          />
        </a>
        <a
          href="https://reactjs.org"
          target="_blank"
          className="transition-transform hover:scale-110"
        >
          <img
            src={reactLogo}
            className="logo react h-24 p-6 transition-all duration-700"
            alt="React logo"
          />
        </a>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
        Click on the Tauri, Vite, and React logos to learn more.
      </p>

      <form
        className="flex items-center gap-4 mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     shadow-sm transition-colors"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                     text-white font-medium rounded-lg transition-colors duration-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     shadow-sm cursor-pointer"
        >
          Greet
        </button>
      </form>

      {greetMsg && (
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {greetMsg}
        </p>
      )}
    </main>
  );
}

export default App;
