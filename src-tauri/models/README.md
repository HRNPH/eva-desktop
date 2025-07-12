# Custom Wake Word Models

This directory is for storing your custom trained Porcupine wake word models.

## How to add your custom "Hey EVA" wake word:

1. **Train your model**:

   - Go to [Picovoice Console](https://console.picovoice.ai/)
   - Sign in with your account
   - Navigate to "Porcupine" → "Create New Model"
   - Enter "Hey EVA" as your wake phrase
   - Train the model (this may take a few minutes)

2. **Download the model**:

   - Once training is complete, download the `.ppn` file
   - The file should be named something like `hey-eva_en_mac_v3_0_0.ppn`

3. **Place the model file**:

   - Rename the downloaded file to `hi-eva.ppn`
   - Place it in this `models/` directory
   - The full path should be: `models/hi-eva.ppn`

4. **Test your custom wake word**:
   - Restart the Eva Desktop application
   - You should see a message in the logs: "Using custom wake word model: models/hi-eva.ppn"
   - Start listening and say "Hey EVA" to test

## File structure:

```
eva-desktop/
├── models/
│   └── hi-eva.ppn          # Your custom wake word model (place here)
└── src-tauri/
    └── src/
        └── porcupine_service.rs  # Code that loads the model
```

## Troubleshooting:

- **Model not found**: Make sure the file is named exactly `hi-eva.ppn` and is in this directory
- **Invalid model**: Ensure you downloaded the correct model file for your platform (macOS/Windows/Linux)
- **Permission errors**: Make sure the file has read permissions

## Notes:

- If no custom model is found, the app will fall back to the built-in "Hi Eva" wake word
- Custom models are platform-specific (macOS, Windows, Linux)
- You can create multiple wake phrases and switch between them by changing the filename in the code
