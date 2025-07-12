# UI Updates for Dynamic Wake Word Display

## Problem

The current UI hardcodes "Hi Eva" as the wake word instruction, but the actual wake word being used is now "Computer" (or other keywords based on environment variables).

## Solution

I've added a new Tauri command `get_current_wake_word()` that returns the actual wake word being used. The UI needs to be updated to use this dynamic value.

## Backend Changes Made ✅

### 1. New Tauri Command in `lib.rs`:

```rust
#[tauri::command]
async fn get_current_wake_word() -> Result<String, String> {
    // Check for custom wake word model first
    let custom_model_path = "models/Hi-Eva.ppn";

    if Path::new(custom_model_path).exists() {
        Ok("Hi Eva".to_string())
    } else {
        // Determine which built-in keyword is being used
        let keyword_name = if std::env::var("WAKE_WORD_KEYWORD").is_ok() {
            match std::env::var("WAKE_WORD_KEYWORD").unwrap().as_str() {
                "alexa" => "Alexa",
                "computer" => "Computer",
                "jarvis" => "Jarvis",
                "hey-google" => "Hey Google",
                "ok-google" => "Ok Google",
                "picovoice" => "Picovoice",
                "porcupine" => "Porcupine",
                _ => "Computer", // Default fallback
            }
        } else {
            "Computer" // Default keyword
        };

        Ok(keyword_name.to_string())
    }
}
```

### 2. Command added to invoke handler:

```rust
.invoke_handler(tauri::generate_handler![
    start_wake_word,
    stop_wake_word,
    wake_word_status,
    test_microphone,
    test_audio_levels,
    get_current_wake_word  // ← New command
])
```

## Frontend Changes Needed 🔧

### 1. Update `PorcupineTest.tsx` State:

Add a new state variable to track the current wake word:

```tsx
const [currentWakeWord, setCurrentWakeWord] = useState<string>("Computer");
```

### 2. Fetch Wake Word on Component Mount:

```tsx
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
```

### 3. Update Status Display:

Change the hardcoded "Hi Eva" to use the dynamic value:

```tsx
// OLD:
`Listening for "${lastWakeWord?.keyword || "Hi Eva"}"`// NEW:
`Listening for "${lastWakeWord?.keyword || currentWakeWord}"`;
```

### 4. Update Instructions Section:

Change the hardcoded instruction:

```tsx
// OLD:
<li>• Say "Hi Eva" clearly into your microphone</li>

// NEW:
<li>• Say "<strong>{currentWakeWord}</strong>" clearly into your microphone</li>
```

### 5. Add Refresh Wake Word Button:

```tsx
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

// Add button:
<button
  onClick={refreshWakeWord}
  className="px-4 py-3 rounded-lg font-medium transition-colors bg-gray-500 hover:bg-gray-600 text-white text-sm"
>
  🔄 Refresh Wake Word
</button>;
```

## Current Wake Word Configuration 📋

Based on the backend implementation:

### Default Wake Word: **"Computer"**

- If no environment variable is set, it uses "Computer"
- If `models/Hi-Eva.ppn` exists, it uses "Hi Eva"

### Environment Variable Override:

You can set different wake words using:

```bash
export WAKE_WORD_KEYWORD=alexa      # → "Alexa"
export WAKE_WORD_KEYWORD=jarvis     # → "Jarvis"
export WAKE_WORD_KEYWORD=hey-google # → "Hey Google"
export WAKE_WORD_KEYWORD=ok-google  # → "Ok Google"
export WAKE_WORD_KEYWORD=picovoice  # → "Picovoice"
export WAKE_WORD_KEYWORD=porcupine  # → "Porcupine"
```

## Testing Current Settings 🧪

To see what wake word is currently active:

```bash
# In the app console
invoke('get_current_wake_word').then(console.log)
```

Or use the "Test Audio Levels" button I added, which includes detailed logging.

## Quick Test Instructions 🎯

1. **Check current wake word**: Use the new `get_current_wake_word` command
2. **Try "Computer"**: The default wake word
3. **Enable debug logging**: `export EVA_DEBUG_AUDIO=1`
4. **Watch logs**: Every 320ms you'll see audio levels and processing results
5. **Use maximum sensitivity**: Already set to 1.0 for best detection

The UI should now dynamically display the correct wake word instead of hardcoding "Hi Eva"!
