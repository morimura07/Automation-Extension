// Side panel script
let isRunning = false;
let currentTabId = null;

const elements = {
  status: document.getElementById('status'),
  currentServer: document.getElementById('currentServer'),
  totalServers: document.getElementById('totalServers'),
  clickedCount: document.getElementById('clickedCount'),
  progressBar: document.getElementById('progressBar'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  clearBtn: document.getElementById('clearBtn'),
  clearMessagesBtn: document.getElementById('clearMessagesBtn'),
  loopInput: document.getElementById('loop'),
  chunkSizeInput: document.getElementById('chunkSize'),
  chunkDelayInput: document.getElementById('chunkDelay'),
  messageCountInput: document.getElementById('messageCount'),
  messageInputs: document.getElementById('messageInputs'),
  log: document.getElementById('log')
};

// Handle message count change
elements.messageCountInput.addEventListener('change', () => {
  const count = parseInt(elements.messageCountInput.value);
  updateMessageInputs(count);
});

// Function to update message input fields
function updateMessageInputs(count) {
  elements.messageInputs.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-input-wrapper';
    wrapper.innerHTML = `
      <label>Message ${i}</label>
      <textarea id="message${i}" rows="3" placeholder="Enter your message..."></textarea>
    `;
    elements.messageInputs.appendChild(wrapper);
  }
}

// Get current tab
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Add log entry
function addLog(message, type = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  elements.log.appendChild(logEntry);
  elements.log.scrollTop = elements.log.scrollHeight;
}

// Update UI
function updateUI(data) {
  if (data.status) {
    elements.status.textContent = data.status;
    elements.status.className = `status ${data.statusClass || ''}`;
  }
  if (data.currentServer !== undefined) {
    elements.currentServer.textContent = data.currentServer;
  }
  if (data.totalServers !== undefined) {
    elements.totalServers.textContent = data.totalServers;
  }
  if (data.clickedCount !== undefined) {
    elements.clickedCount.textContent = data.clickedCount;
  }
  if (data.progress !== undefined) {
    elements.progressBar.style.width = `${data.progress}%`;
  }
}

// Start clicking
async function startClicking() {
  const tab = await getCurrentTab();
  
  if (!tab || !tab.url.includes('discord.com')) {
    addLog('Please navigate to Discord first!', 'error');
    updateUI({ status: 'Error: Not on Discord', statusClass: 'error' });
    return;
  }

  currentTabId = tab.id;
  isRunning = true;
  
  elements.startBtn.disabled = true;
  elements.stopBtn.disabled = false;
  
  updateUI({ 
    status: 'Starting...', 
    statusClass: 'running',
    clickedCount: 0,
    progress: 0
  });
  
  addLog('Starting Discord server clicker...', 'info');

  const loop = elements.loopInput.checked;
  const chunkSize = parseInt(elements.chunkSizeInput.value);
  const chunkDelay = parseInt(elements.chunkDelayInput.value);
  const messageCount = parseInt(elements.messageCountInput.value);
  
  // Collect all messages
  const messages = [];
  for (let i = 1; i <= messageCount; i++) {
    const textarea = document.getElementById(`message${i}`);
    if (textarea && textarea.value.trim()) {
      messages.push(textarea.value.trim());
    }
  }
  
  if (messages.length === 0) {
    addLog('Error: Please enter at least one message', 'error');
    updateUI({ status: 'Error: No messages', statusClass: 'error' });
    stopClicking();
    return;
  }

  // Inject content script first
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // Then execute the clicking function
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (loop, chunkSize, chunkDelay, messages) => {
        if (typeof window.clickServers === 'function') {
          window.clickServers(loop, chunkSize, chunkDelay, messages);
        } else {
          chrome.runtime.sendMessage({
            type: 'error',
            error: 'Failed to initialize clicker. Please refresh Discord and try again.'
          });
        }
      },
      args: [loop, chunkSize, chunkDelay, messages]
    });
  } catch (error) {
    addLog(`Error: ${error.message}`, 'error');
    updateUI({ status: 'Error', statusClass: 'error' });
    stopClicking();
  }
}

// Stop clicking
function stopClicking() {
  isRunning = false;
  elements.startBtn.disabled = false;
  elements.stopBtn.disabled = true;
  
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { action: 'stop' }).catch(() => {});
  }
  
  updateUI({ status: 'Stopped', statusClass: '' });
  addLog('Stopped clicking', 'info');
}

// Clear and reset
function clearAll() {
  // Stop if running
  if (isRunning) {
    stopClicking();
  }
  
  // Reset UI
  updateUI({ 
    status: 'Ready', 
    statusClass: '',
    currentServer: '-',
    totalServers: '-',
    clickedCount: 0,
    progress: 0
  });
  
  // Clear log
  elements.log.innerHTML = '';
  
  addLog('Cleared and reset', 'info');
}

// Clear all messages
function clearAllMessages() {
  const messageCount = parseInt(elements.messageCountInput.value);
  
  for (let i = 1; i <= messageCount; i++) {
    const textarea = document.getElementById(`message${i}`);
    if (textarea) {
      textarea.value = '';
    }
  }
  
  addLog('All messages cleared', 'info');
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'update') {
    updateUI(message.data);
    if (message.data.log) {
      addLog(message.data.log, message.data.logType || 'info');
    }
  } else if (message.type === 'complete') {
    updateUI({ status: 'Completed', statusClass: '' });
    addLog('Completed clicking all servers!', 'success');
    stopClicking();
  } else if (message.type === 'error') {
    updateUI({ status: 'Error', statusClass: 'error' });
    addLog(message.error, 'error');
    stopClicking();
  }
});

// Event listeners
elements.startBtn.addEventListener('click', startClicking);
elements.stopBtn.addEventListener('click', stopClicking);
elements.clearBtn.addEventListener('click', clearAll);
elements.clearMessagesBtn.addEventListener('click', clearAllMessages);

// Initialize
updateUI({ 
  status: 'Ready', 
  currentServer: '-', 
  totalServers: '-', 
  clickedCount: 0,
  progress: 0
});
