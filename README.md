# Discord Auto Messenger

An intelligent Chrome Extension that automates Discord server navigation, channel selection, and message posting with advanced chunking and timing controls.

## Features

- ✅ **Automated Server Navigation**: Sequentially clicks through all visible Discord servers
- ✅ **Smart Channel Selection**: Automatically finds and selects common channels (general, off-topic, chat, etc.)
- ✅ **Intelligent Message Posting**: Posts messages with word chunking and configurable delays
- ✅ **Multiple Message Support**: Create up to 5 different messages with random selection
- ✅ **Customizable Chunking**: Split messages into 2-10 word chunks
- ✅ **Input Validation**: Automatically detects and skips disabled message inputs
- ✅ **Real-time Progress**: Live status updates and activity logging
- ✅ **Loop Mode**: Continuously cycle through servers
- ✅ **Clean UI**: Modern bright blue interface with intuitive controls

## Installation

### Step 1: Generate Icons

1. Open `generate-icons.html` in your browser
2. It will automatically download three icon files: `icon16.png`, `icon48.png`, and `icon128.png`
3. Move these icon files to the extension folder (same folder as `manifest.json`)

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the folder containing this extension
5. The extension should now appear in your extensions list

### Step 3: Pin the Extension (Optional)

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Discord Server Clicker" and click the pin icon
3. The extension icon will now appear in your toolbar

## Usage

1. **Navigate to Discord**: Open Discord in your browser (https://discord.com/channels/...)
2. **CRITICAL: Manually expand all server folders** - Click on any collapsed folders to expand them yourself
3. **Make sure the server list is visible** on the left side
4. **Open Side Panel**: Click the extension icon in your toolbar
5. **Configure Settings**:
   - Set the delay between clicks (in seconds, default 1.5)
   - Enable "Loop continuously" if you want it to repeat
6. **Start Clicking**: Click the "Start Clicking" button
7. **Watch**: The bot will click each visible server from top to bottom
8. **Stop Anytime**: Click "Stop" to halt the clicking process

## Important Requirements

- ✅ **You MUST manually expand all folders before starting the bot**
- ✅ The server list must be visible on the left sidebar
- ✅ Don't be on the Friends page or Discover page
- ✅ Each server will scroll into view and be clicked with a blue outline
- ✅ You will see the actual clicks happening on screen

## How It Works

The extension uses multiple strategies to accurately interact with Discord:

1. **Server Detection**: Searches for Discord's server list using multiple selectors and filters out non-server elements
2. **Server Clicking**: Simulates actual mouse events for reliable clicking with visual highlighting
3. **Channel Detection**: After clicking each server, searches for common public channels:
   - Priority order: general → off-topic → chat → main → lobby → welcome → discussion → community → lounge
4. **Channel Clicking**: Automatically clicks the first matching channel found
5. **Progress Tracking**: Updates the UI in real-time with current progress and activity logs

### Workflow:
1. User manually expands all server folders
2. Bot finds all visible servers
3. For each server:
   - Click the server (blue highlight)
   - Wait for server to load (1 second)
   - Search for general/public channels
   - Click the channel if found
   - Wait for configured delay
   - Move to next server

## Settings

- **Delay**: Time to wait after clicking each server (0.5 - 10 seconds)
- **Loop continuously**: When enabled, the bot will restart from the first server after reaching the last one

## Technical Details

### Files Structure

```
discord-server-clicker/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for extension lifecycle
├── content.js            # Script injected into Discord page
├── sidepanel.html        # Side panel UI structure
├── sidepanel.css         # Side panel styling
├── sidepanel.js          # Side panel logic
├── generate-icons.html   # Icon generator utility
├── icon16.png           # 16x16 icon
├── icon48.png           # 48x48 icon
├── icon128.png          # 128x128 icon
└── README.md            # This file
```

### Discord Server Detection

The extension uses multiple CSS selectors to find Discord servers:

```javascript
'nav[aria-label="Servers"] ul[role="tree"] > div[role="treeitem"]'
'nav[aria-label="Servers"] li[role="treeitem"]'
'[data-list-id="guildsnav"] [role="treeitem"]'
'[class*="guilds"] [class*="listItem"]'
'[class*="guilds"] [class*="wrapper"][draggable="true"]'
```

This multi-selector approach ensures compatibility even if Discord updates their DOM structure.

## Troubleshooting

### "No Discord servers found" Error

- Make sure you're on a Discord page (URL contains `discord.com`)
- Ensure the server list is visible on the left side
- Try refreshing the Discord page
- Check that you're logged into Discord

### Extension Not Working

- Verify the extension is enabled in `chrome://extensions/`
- Check that you've granted the necessary permissions
- Try reloading the extension
- Make sure you're using the latest version of Chrome

### Servers Not Being Clicked

- Increase the delay setting (Discord might need more time to load)
- Check the activity log for error messages
- Try clicking manually first to ensure Discord is responsive

## Permissions

This extension requires the following permissions:

- **activeTab**: To interact with the current Discord tab
- **scripting**: To inject the clicking script into Discord
- **sidePanel**: To display the control panel
- **host_permissions (discord.com)**: To run only on Discord pages

## Privacy

- This extension runs entirely locally in your browser
- No data is collected or sent to external servers
- The extension only works on Discord pages
- All clicking happens in your browser session

## Future Features (Planned)

- [ ] Custom server selection (click only specific servers)
- [ ] Click patterns (random order, reverse order, etc.)
- [ ] Keyboard shortcuts
- [ ] Export/import settings
- [ ] Statistics tracking

## License

MIT License - Feel free to modify and distribute

## Support

If you encounter any issues or have suggestions, please create an issue in the repository.

---

**Note**: This extension is for educational purposes. Use responsibly and in accordance with Discord's Terms of Service.
