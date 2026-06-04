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
  serverDelayInput: document.getElementById('serverDelay'),
  messageCountInput: document.getElementById('messageCount'),
  messageInputs: document.getElementById('messageInputs'),
  log: document.getElementById('log'),
  resultsCard: document.getElementById('resultsCard'),
  successCount: document.getElementById('successCount'),
  failedCount: document.getElementById('failedCount'),
  skippedCount: document.getElementById('skippedCount'),
  resultsDetails: document.getElementById('resultsDetails'),
  toggleResultsBtn: document.getElementById('toggleResultsBtn'),
  themeToggle: document.getElementById('themeToggle')
};

// Results tracking
let results = {
  success: [],
  failed: [],
  skipped: []
};

// Theme management
function initTheme() {
  // Load saved theme preference
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  const sunIcon = elements.themeToggle.querySelector('.sun-icon');
  const moonIcon = elements.themeToggle.querySelector('.moon-icon');
  
  if (theme === 'light') {
    document.body.classList.add('light-mode');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
    localStorage.setItem('theme', 'light');
  } else {
    document.body.classList.remove('light-mode');
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
    localStorage.setItem('theme', 'dark');
  }
}

function toggleTheme() {
  const isLightMode = document.body.classList.contains('light-mode');
  setTheme(isLightMode ? 'dark' : 'light');
}

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
  
  // Reset results
  results = {
    success: [],
    failed: [],
    skipped: []
  };
  elements.resultsCard.style.display = 'none';
  
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
  // Server switch delay is entered in seconds; convert to milliseconds
  const serverDelay = Math.round((parseFloat(elements.serverDelayInput.value) || 0) * 1000);
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
      func: (loop, serverDelay, messages) => {
        if (typeof window.clickServers === 'function') {
          window.clickServers(loop, serverDelay, messages);
        } else {
          chrome.runtime.sendMessage({
            type: 'error',
            error: 'Failed to initialize clicker. Please refresh Discord and try again.'
          });
        }
      },
      args: [loop, serverDelay, messages]
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
  
  // Hide results
  elements.resultsCard.style.display = 'none';
  results = {
    success: [],
    failed: [],
    skipped: []
  };
  
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

// Display results summary
function displayResults() {
  elements.resultsCard.style.display = 'block';
  
  // Update counts
  elements.successCount.textContent = results.success.length;
  elements.failedCount.textContent = results.failed.length;
  elements.skippedCount.textContent = results.skipped.length;
  
  // Build table
  const tbody = document.getElementById('resultsTableBody');
  tbody.innerHTML = '';
  
  // Combine all results and sort: failed first, then skipped, then success
  const allResults = [
    ...results.failed.map(r => ({ ...r, status: 'failed' })),
    ...results.skipped.map(r => ({ ...r, status: 'skipped' })),
    ...results.success.map(r => ({ ...r, status: 'success' }))
  ];
  
  // Create table rows
  allResults.forEach(item => {
    const row = document.createElement('tr');
    
    // Status column with icon
    const statusCell = document.createElement('td');
    const statusIcon = document.createElement('span');
    statusIcon.className = `status-icon ${item.status}`;
    
    if (item.status === 'success') {
      statusIcon.textContent = '✓';
      statusIcon.title = 'Success';
    } else if (item.status === 'failed') {
      statusIcon.textContent = '✗';
      statusIcon.title = 'Failed';
    } else {
      statusIcon.textContent = '⚠';
      statusIcon.title = 'Skipped';
    }
    
    statusCell.appendChild(statusIcon);
    row.appendChild(statusCell);
    
    // Server name column
    const serverCell = document.createElement('td');
    serverCell.className = 'server-name';
    serverCell.textContent = item.server || 'Unknown Server';
    row.appendChild(serverCell);
    
    // Channel column
    const channelCell = document.createElement('td');
    channelCell.className = 'channel-name';
    channelCell.textContent = item.channel || '-';
    row.appendChild(channelCell);
    
    // Reason column
    const reasonCell = document.createElement('td');
    reasonCell.className = 'reason-text';
    reasonCell.textContent = item.reason || 'Message posted successfully';
    row.appendChild(reasonCell);
    
    tbody.appendChild(row);
  });
  
  // Scroll results into view
  elements.resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Toggle results details
function toggleResults() {
  const details = document.querySelector('.results-table-container');
  if (details.classList.contains('collapsed')) {
    details.classList.remove('collapsed');
    elements.toggleResultsBtn.textContent = 'Hide Details';
  } else {
    details.classList.add('collapsed');
    elements.toggleResultsBtn.textContent = 'Show Details';
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'update') {
    updateUI(message.data);
    if (message.data.log) {
      addLog(message.data.log, message.data.logType || 'info');
    }
  } else if (message.type === 'result') {
    // Track individual server results
    const { status, server, channel, reason } = message.data;
    
    if (status === 'success') {
      results.success.push({ server, channel });
    } else if (status === 'failed') {
      results.failed.push({ server, channel, reason });
    } else if (status === 'skipped') {
      results.skipped.push({ server, channel, reason });
    }
  } else if (message.type === 'complete') {
    updateUI({ status: 'Completed', statusClass: '' });
    addLog('Completed clicking all servers!', 'success');
    displayResults();
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
elements.toggleResultsBtn.addEventListener('click', toggleResults);
elements.themeToggle.addEventListener('click', toggleTheme);

// Initialize
initTheme();
updateUI({ 
  status: 'Ready', 
  currentServer: '-', 
  totalServers: '-', 
  clickedCount: 0,
  progress: 0
});
