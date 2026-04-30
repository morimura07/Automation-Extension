# Message Posting Feature

## Overview

The bot now automatically posts messages in Discord channels after selecting servers and channels.

## Features

### 1. Multiple Message Support (1-5 messages)
- Create up to 5 different messages
- Bot randomly selects one message per server
- Provides variety in your posts

### 2. Smart Word Chunking (2-10 words)
- Splits your message into chunks
- Pastes chunks sequentially with delays
- Preserves message structure (line breaks, formatting)

### 3. Customizable Timing
- Chunk delay: 1-100ms (default 5ms)
- Controls speed of text insertion
- Prevents Discord rate limiting

### 4. Input Validation
- Checks if message input is disabled
- Skips posting if channel doesn't allow messages
- Moves to next server automatically

## How It Works

### Workflow:
1. Click server
2. Find and click general/off-topic/chat channel
3. **Check if message input is enabled**
4. **If enabled:**
   - Randomly select one message from your list
   - Split message into word chunks (e.g., 5 words per chunk)
   - Paste first chunk → wait 5ms
   - Paste second chunk → wait 5ms
   - Continue until complete
   - Wait 30ms
   - Press Enter to send
   - Wait 30ms
5. Move to next server

### Example:

**Your Message:**
```
Hello everyone! This is a test message.
I hope you're all having a great day!
```

**With chunk size = 5:**
```
Chunk 1: "Hello everyone! This is a"
  → Paste → Wait 5ms
Chunk 2: "test message. I hope you're"
  → Paste → Wait 5ms
Chunk 3: "all having a great day!"
  → Paste → Wait 30ms → Press Enter
```

## UI Settings

### Messages Section:
- **Number of messages (1-5)**: How many different messages to create
- **Message 1-5**: Text areas for your messages

### Settings Section:
- **Words per chunk (2-10)**: How many words to paste at once
- **Chunk delay (ms)**: Milliseconds to wait between chunks
- **Loop continuously**: Repeat through all servers

## Configuration Examples

### Fast Posting (Risky):
- Words per chunk: 10
- Chunk delay: 1ms
- **Speed**: Very fast
- **Risk**: Might trigger rate limits

### Balanced (Recommended):
- Words per chunk: 5
- Chunk delay: 5ms
- **Speed**: Fast but safe
- **Risk**: Low

### Safe Posting:
- Words per chunk: 3
- Chunk delay: 10ms
- **Speed**: Slower
- **Risk**: Very low

## Message Formatting

### Supported:
✅ Line breaks (preserved)
✅ Multiple sentences
✅ Punctuation
✅ Emojis
✅ Special characters

### Tips:
- Write natural messages
- Use proper grammar
- Vary your messages (use multiple message slots)
- Keep messages relevant to channels

## Smart Features

### 1. Random Message Selection
- If you have 3 messages, bot randomly picks one per server
- Provides variety
- Looks more natural

### 2. Disabled Input Detection
```javascript
// Bot checks:
- aria-disabled="true"
- contenteditable="false"
- Parent element disabled
```
If any are true → Skip posting, move to next server

### 3. Chunk Preservation
- Maintains word order
- Preserves line breaks
- Keeps message structure intact

## Timing Breakdown

**Per Server (with message posting):**
1. Click server: 100ms
2. Find channel: 300ms
3. Click channel: 150ms
4. Post message:
   - Focus input: 50ms
   - Paste chunks: (chunks × delay)
   - Wait: 30ms
   - Send: 30ms
   - **Total: ~110ms + (chunks × delay)**

**Example with 20-word message, 5 words/chunk, 5ms delay:**
- 4 chunks × 5ms = 20ms
- Total message time: ~130ms
- **Total per server: ~680ms**

## Error Handling

### Message Input Not Found:
- Logs: "Message input not found"
- Skips posting
- Moves to next server

### Input Disabled:
- Logs: "Message input is disabled, skipping"
- Skips posting
- Moves to next server

### No Messages Entered:
- Shows error: "Please enter at least one message"
- Prevents bot from starting

## Best Practices

### 1. Message Content:
- Be respectful
- Follow server rules
- Don't spam
- Provide value

### 2. Timing:
- Start with default settings (5 words, 5ms)
- Adjust if needed
- Don't go too fast

### 3. Multiple Messages:
- Create 2-3 variations
- Keep them relevant
- Vary the content

### 4. Testing:
- Test on one server first
- Check if messages post correctly
- Adjust settings if needed

## Technical Details

### Message Insertion Method:
```javascript
document.execCommand('insertText', false, textToInsert);
```
- Works with Discord's rich text editor
- Preserves formatting
- Triggers Discord's input events

### Enter Key Simulation:
```javascript
new KeyboardEvent('keydown', {
  key: 'Enter',
  code: 'Enter',
  keyCode: 13,
  which: 13,
  bubbles: true,
  cancelable: true
});
```
- Simulates real Enter key press
- Triggers Discord's send function

### Random Selection:
```javascript
const randomMessage = messages[Math.floor(Math.random() * messages.length)];
```
- True random selection
- Equal probability for each message

## Performance

### Speed Comparison:

**Without Messages:**
- ~550ms per server

**With Messages (20 words, 5 words/chunk, 5ms delay):**
- ~680ms per server
- **Only 130ms slower!**

**100 Servers:**
- Without messages: 55 seconds
- With messages: 68 seconds
- **Only 13 seconds difference!**

## Safety Features

✅ **Input validation** - Checks if posting is allowed
✅ **Disabled detection** - Skips if input is disabled
✅ **Rate limit friendly** - Configurable delays
✅ **Error handling** - Graceful failures
✅ **Logging** - Tracks all actions

## Example Use Cases

### 1. Community Engagement:
```
Message 1: "Hey everyone! Hope you're having a great day! 😊"
Message 2: "Hello! Just wanted to say hi to this awesome community!"
Message 3: "Good vibes to everyone here! Keep being awesome! ✨"
```

### 2. Announcements:
```
Message 1: "Quick reminder: Event starts tomorrow at 3 PM EST!"
Message 2: "Don't forget about tomorrow's event at 3 PM EST!"
```

### 3. Greetings:
```
Message 1: "Morning everyone! ☀️"
Message 2: "Good morning! Have a wonderful day!"
Message 3: "Hey all! Hope everyone's doing well!"
```

## Limitations

- Only posts in channels where input is enabled
- Requires channel to be selected first
- One message per server per cycle
- Maximum 5 different messages

## Future Enhancements (Potential)

- [ ] Custom channel targeting
- [ ] Message templates with variables
- [ ] Scheduled posting
- [ ] Reply to specific messages
- [ ] Reaction adding
- [ ] Image/file attachments
