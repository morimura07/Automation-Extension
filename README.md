# Discord Auto Messenger

A Chrome extension (Manifest V3) that automates Discord navigation and message posting. It walks through every server in your sidebar, opens a public channel in each, and posts one of your messages — all driven from a clean side panel UI with a live activity log and a results summary.

> **Disclaimer:** This project is for **educational purposes only**. Automating message posting (self-botting / mass posting) violates [Discord's Terms of Service](https://discord.com/terms) and can get your account banned. Use responsibly and at your own risk.

---

## Features

- **Automated server navigation** — clicks through every visible server in your sidebar, top to bottom
- **Smart channel selection** — finds and opens the first matching public channel by priority
- **Message posting** — pastes your entire message into the channel at once and sends it
- **Line-break aware** — multi-line messages keep their formatting
- **Multiple messages (1–5)** — define several variants; one is chosen at random per server
- **Configurable server-switch delay** — set how long to wait before moving to the next server
- **Disabled-input detection** — skips channels where you can't post and moves on
- **Loop mode** — continuously cycle through all servers
- **Live results** — real-time activity log plus a success / failed / skipped summary table
- **Light & dark themes** — toggle in the header (preference is saved)

---

## Installation

The extension is unpacked and loaded directly into Chrome.

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this project folder (the one containing `manifest.json`)
5. The extension appears in your list. Pin it from the puzzle-piece menu if you like.

> Icons (`icon16.png`, `icon48.png`, `icon128.png`) are already included. If you ever need to regenerate them, open `generate-icons.html` in a browser and it will download fresh copies.

---

## Usage

1. **Open Discord** in the same browser (`https://discord.com/channels/...`) and log in.
2. **Manually expand all server folders.** The bot only acts on servers that are currently visible in the sidebar — it does not expand folders for you.
3. **Open the side panel** by clicking the extension icon.
4. **Enter your message(s):**
   - Set **Count** (1–5) and fill in each message text area.
   - With more than one message, a random one is picked per server.
5. **Adjust settings** (see below).
6. Click **Start Automation**. Watch progress in the status card and activity log.
7. Click **Stop** at any time to halt.

When a run finishes, a **Results Summary** card shows how many posts succeeded, failed, or were skipped, with a per-server breakdown.

---

## Settings

| Setting | Range | Default | Description |
|---|---|---|---|
| **Count** | 1–5 | 1 | Number of message variants to define |
| **Server switch delay (sec)** | 0–60 | 1 | How long to wait before moving to the next server |
| **Loop continuously** | on/off | off | Restart from the top after the last server |

**Tuning guidance:** a larger server-switch delay is slower but gentler — it gives Discord time to settle between servers and reduces the chance of being flagged for rapid activity. A delay of `0` switches as fast as possible (riskier).

---

## How It Works

For each visible server, the content script:

1. **Clicks the server** using a full synthetic mouse-event sequence (pointer + mouse events with real coordinates), which is what Discord's UI needs to register the click.
2. **Resolves the server name** from the sidebar item, then refines it from the loaded server header / page title / aria-labels.
3. **Opens a public channel** — searches channel links and clicks the first match by priority:

   `general → main → public → chat → off-topic → lobby → discussion → community → lounge`

   If the target channel is already active, it's reused.
4. **Posts the message** — clicks and focuses the message box, clears it, then pastes the entire message in one operation (preserving line breaks), and sends with Enter (with a Send-button fallback).
5. **Records the outcome** — success, failed, or skipped (e.g. no channel found, or input disabled) — then waits the configured server-switch delay and moves to the next server.

If **Loop** is enabled, the whole pass repeats until you press Stop.

---

## Project Structure

```
AutoPoster/
├── manifest.json          # Extension configuration (MV3)
├── background.js          # Service worker — opens the side panel, injects content.js
├── content.js             # Injected into Discord — all navigation & posting logic
├── sidepanel.html         # Side panel UI structure
├── sidepanel.css          # Side panel styling (light/dark themes)
├── sidepanel.js           # Side panel logic — settings, messaging, results
├── generate-icons.html    # Optional icon generator utility
├── icon16/48/128.png      # Extension icons
└── README.md              # This file
```

---

## Permissions

| Permission | Why it's needed |
|---|---|
| `activeTab` | Interact with the current Discord tab |
| `scripting` | Inject `content.js` into the page |
| `sidePanel` | Display the control panel |
| `host_permissions: discord.com` | Restrict the extension to Discord only |

The extension runs entirely in your browser. No data is collected or sent anywhere.

---

## Troubleshooting

**"No Discord servers found"**
- Confirm you're on a `discord.com` page and logged in.
- Make sure the server list is visible and **all folders are expanded manually**.
- Refresh Discord and try again.

**Messages aren't posting**
- The target channel may not allow you to post (input disabled) — these are reported as *skipped*.
- Discord may need more time to load: increase the server switch delay.
- Refresh Discord so the content script re-initializes.

**Server names show as "Unknown Server" or "Server (id...)"**
- The sidebar item exposed no readable label; the run still works, only the display name is generic.

**Nothing happens after clicking Start**
- Reload the extension in `chrome://extensions/`, then refresh the Discord tab.

---

## License

MIT License — feel free to modify and distribute.
