// Content script - runs in Discord page context
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.discordClickerInitialized) {
    console.log('Discord clicker already initialized');
    return;
  }
  window.discordClickerInitialized = true;

  // This function will be injected into the page
  window.clickServers = async function(loop, chunkSize, chunkDelay, messages) {
    let shouldStop = false;
    
    console.log(`Discord Clicker: Starting with ${messages.length} messages, chunk size: ${chunkSize}, delay: ${chunkDelay}ms`);
    
    // Listen for stop message
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'stop') {
        shouldStop = true;
      }
    });

    // Function to detect and expand Discord server folders
    function findAndExpandFolders() {
      console.log('Discord Clicker: Looking for folders...');
      
      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (!nav) {
        console.log('Discord Clicker: No server navigation found');
        return { allFolders: [], collapsedFolders: [] };
      }
      
      // Find all folder elements
      const folderElements = Array.from(nav.querySelectorAll('[data-list-item-id*="folder"]'));
      console.log(`Discord Clicker: Found ${folderElements.length} total folder elements`);
      
      const allFolders = [];
      const collapsedFolders = [];
      
      folderElements.forEach((folder, index) => {
        const folderId = folder.getAttribute('data-list-item-id') || '';
        const ariaExpanded = folder.getAttribute('aria-expanded');
        
        // Check if folder has the expanded background class
        const hasExpandedBackground = folder.querySelector('[class*="expandedFolderBackground"]') !== null;
        
        // Check the visual state - collapsed folders show stacked server icons
        // Expanded folders show a vertical list with background
        const rect = folder.getBoundingClientRect();
        const isVisible = rect.height > 0 && rect.width > 0;
        
        console.log(`Discord Clicker: Folder ${index + 1}:`);
        console.log(`  - ID: ${folderId}`);
        console.log(`  - aria-expanded: ${ariaExpanded}`);
        console.log(`  - Has expanded background: ${hasExpandedBackground}`);
        console.log(`  - Visible: ${isVisible}`);
        console.log(`  - Height: ${rect.height}px`);
        
        allFolders.push(folder);
        
        // A folder is COLLAPSED if:
        // 1. aria-expanded is explicitly "false", OR
        // 2. It doesn't have the expanded background element, OR
        // 3. Its height is small (collapsed folders are ~48px, expanded are much taller)
        
        const isCollapsed = 
          ariaExpanded === 'false' || 
          (!hasExpandedBackground && ariaExpanded !== 'true') ||
          (rect.height > 0 && rect.height < 100); // Collapsed folders are small
        
        const isExpanded = 
          ariaExpanded === 'true' && 
          hasExpandedBackground &&
          rect.height > 100; // Expanded folders are tall
        
        if (isExpanded) {
          console.log(`  ✗ Folder is EXPANDED - skipping`);
        } else if (isCollapsed) {
          console.log(`  ✓ Folder is COLLAPSED - will expand`);
          collapsedFolders.push(folder);
        } else {
          console.log(`  ? Folder state unclear - assuming collapsed`);
          collapsedFolders.push(folder);
        }
      });
      
      console.log(`Discord Clicker: Total folders: ${allFolders.length}, Collapsed: ${collapsedFolders.length}, Expanded: ${allFolders.length - collapsedFolders.length}`);
      
      return { allFolders, collapsedFolders };
    }
    
    // Function to expand a folder
    async function expandFolder(folder) {
      console.log('Discord Clicker: Attempting to expand folder...');
      console.log('Discord Clicker: Folder element:', folder);
      
      // The folder element itself is usually clickable
      let clickTarget = folder;
      
      // Try to find the most specific clickable element within the folder
      const possibleTargets = [
        folder.querySelector('[role="button"]'),
        folder.querySelector('button'),
        folder.querySelector('div[class*="folder"]'),
        folder.querySelector('[class*="wrapper"]'),
        folder.querySelector('div'),
        folder
      ];
      
      for (const target of possibleTargets) {
        if (target && target.offsetParent !== null) { // Check if element is visible
          clickTarget = target;
          console.log('Discord Clicker: Selected click target:', clickTarget);
          break;
        }
      }
      
      // Get the bounding rectangle for accurate click positioning
      const rect = clickTarget.getBoundingClientRect();
      console.log(`Discord Clicker: Folder position - x: ${rect.left}, y: ${rect.top}, width: ${rect.width}, height: ${rect.height}`);
      
      // Highlight the folder being clicked (visual feedback)
      const originalOutline = clickTarget.style.outline;
      clickTarget.style.outline = '3px solid #f23f43';
      
      // Use simulateClick which creates real mouse events with coordinates
      await simulateClick(clickTarget);
      
      console.log('Discord Clicker: Folder click simulated with mouse events');
      
      // Remove highlight after a short delay
      setTimeout(() => {
        clickTarget.style.outline = originalOutline;
      }, 500);
      
      return true;
    }

    // Function to find Discord server list items
    function findServerElements() {
      console.log('Discord Clicker: Starting server detection...');
      
      let servers = [];
      
      // Strategy 1: Find by data-list-item-id pattern (most reliable for current Discord)
      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (nav) {
        console.log('Discord Clicker: Found navigation element');
        
        // Get all elements with data-list-item-id
        const allItems = Array.from(nav.querySelectorAll('[data-list-item-id]'));
        console.log(`Discord Clicker: Found ${allItems.length} items with data-list-item-id`);
        
        // Filter for guild items (servers)
        servers = allItems.filter(el => {
          const dataListItemId = el.getAttribute('data-list-item-id') || '';
          console.log(`Discord Clicker: Checking data-list-item-id: "${dataListItemId}"`);
          
          // Guild items have pattern: guildsnav___guild-id or similar
          if (dataListItemId.includes('guildsnav___') && !dataListItemId.includes('folder')) {
            // Make sure it's not home or special items
            if (!dataListItemId.includes('home') && 
                !dataListItemId.includes('create-join') &&
                !dataListItemId.includes('___null')) {
              console.log(`Discord Clicker: ✓ Valid guild item: ${dataListItemId}`);
              return true;
            }
          }
          return false;
        });
        
        console.log(`Discord Clicker: Found ${servers.length} servers via data-list-item-id`);
      }
      
      // Strategy 2: If no servers found, try finding by visual elements
      if (servers.length === 0) {
        console.log('Discord Clicker: Trying visual detection strategy...');
        
        const selectors = [
          'nav[aria-label*="Server"] [class*="listItem"]',
          'nav[aria-label*="Server"] li',
          '[data-list-id="guildsnav"] > *'
        ];
        
        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          console.log(`Discord Clicker: Selector "${selector}" found ${elements.length} elements`);
          
          if (elements.length > 0) {
            servers = elements.filter(el => {
              const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
              const hasIcon = el.querySelector('img, svg, [class*="icon"]');
              
              // Exclude navigation items
              const excludePatterns = ['home', 'direct message', 'add a server', 'explore', 'discover', 'folder'];
              const isExcluded = excludePatterns.some(pattern => ariaLabel.includes(pattern));
              
              if (!isExcluded && hasIcon) {
                console.log(`Discord Clicker: ✓ Valid server via visual detection: ${ariaLabel}`);
                return true;
              }
              return false;
            });
            
            if (servers.length > 0) break;
          }
        }
      }

      console.log(`Discord Clicker: Final server count: ${servers.length}`);
      return servers;
    }

    // Function to post a message in the current channel
    async function postMessage(message, chunkSize, chunkDelay) {
      console.log('Discord Clicker: Attempting to post message...');
      console.log('Discord Clicker: Message to post:', message);
      
      // Wait a bit for channel to fully load
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Find the message input - try multiple selectors
      let messageInput = document.querySelector('div[role="textbox"][data-slate-editor="true"]');
      
      // Alternative selectors if first one fails
      if (!messageInput) {
        messageInput = document.querySelector('div[class*="slateTextArea"]');
      }
      if (!messageInput) {
        messageInput = document.querySelector('[data-slate-editor="true"]');
      }
      if (!messageInput) {
        messageInput = document.querySelector('div[contenteditable="true"][role="textbox"]');
      }
      
      if (!messageInput) {
        console.log('Discord Clicker: Message input not found');
        return false;
      }
      
      console.log('Discord Clicker: Found message input:', messageInput);
      
      // Check if input is disabled
      const isDisabled = messageInput.getAttribute('aria-disabled') === 'true' ||
                        messageInput.getAttribute('contenteditable') === 'false' ||
                        messageInput.hasAttribute('disabled');
      
      if (isDisabled) {
        console.log('Discord Clicker: Message input is disabled, skipping');
        return false;
      }
      
      console.log('Discord Clicker: Message input is enabled');
      
      // CRITICAL: Perform a REAL physical mouse click with coordinates
      // This is the ONLY way Discord properly initializes the input field
      console.log('Discord Clicker: Performing PHYSICAL mouse click on input field...');
      
      // Scroll input into view first
      messageInput.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Get the bounding rectangle and calculate center point
      const rect = messageInput.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      console.log(`Discord Clicker: Input position - left: ${rect.left}, top: ${rect.top}, width: ${rect.width}, height: ${rect.height}`);
      console.log(`Discord Clicker: Clicking at center coordinates: (${centerX}, ${centerY})`);
      
      // Create REAL mouse events with actual screen coordinates
      const createMouseEvent = (type, options = {}) => {
        return new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          screenX: centerX + window.screenX,
          screenY: centerY + window.screenY,
          button: 0,
          buttons: type.includes('down') ? 1 : 0,
          detail: type === 'click' ? 1 : 0,
          ...options
        });
      };
      
      const createPointerEvent = (type) => {
        return new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: centerX,
          clientY: centerY,
          screenX: centerX + window.screenX,
          screenY: centerY + window.screenY,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: type.includes('down') ? 1 : 0
        });
      };
      
      // Dispatch complete mouse event sequence (simulating real user click)
      console.log('Discord Clicker: Dispatching mouse event sequence...');
      
      messageInput.dispatchEvent(createMouseEvent('mouseenter'));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      messageInput.dispatchEvent(createMouseEvent('mouseover'));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      messageInput.dispatchEvent(createMouseEvent('mousemove'));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      messageInput.dispatchEvent(createPointerEvent('pointerdown'));
      messageInput.dispatchEvent(createMouseEvent('mousedown'));
      await new Promise(resolve => setTimeout(resolve, 50));
      
      messageInput.dispatchEvent(createPointerEvent('pointerup'));
      messageInput.dispatchEvent(createMouseEvent('mouseup'));
      await new Promise(resolve => setTimeout(resolve, 10));
      
      messageInput.dispatchEvent(createMouseEvent('click'));
      messageInput.dispatchEvent(createPointerEvent('click'));
      
      // Also try native click methods
      messageInput.click();
      
      // Focus the input
      messageInput.focus();
      
      console.log('Discord Clicker: Physical click completed');
      
      // Wait for Discord to fully initialize the input after click
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify input is now focused
      const isFocused = document.activeElement === messageInput;
      console.log(`Discord Clicker: Input focused: ${isFocused}`);
      
      if (!isFocused) {
        console.log('Discord Clicker: Input not focused, trying again...');
        messageInput.focus();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Clear any existing content
      messageInput.textContent = '';
      messageInput.innerHTML = '';
      
      // IMPORTANT: Preserve line breaks in the message
      // Split by lines first, then process each line
      const lines = message.split(/\r?\n/);
      console.log(`Discord Clicker: Message has ${lines.length} lines`);
      
      let totalChunks = [];
      
      // Process each line separately to preserve line breaks
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();
        
        if (line.length === 0) {
          // Empty line - add a line break marker
          totalChunks.push({ type: 'linebreak' });
          continue;
        }
        
        // Split line into words
        const words = line.split(/\s+/).filter(word => word.length > 0);
        
        // Split words into chunks
        for (let i = 0; i < words.length; i += chunkSize) {
          const chunk = words.slice(i, i + chunkSize).join(' ');
          totalChunks.push({ type: 'text', content: chunk });
        }
        
        // Add line break after each line (except the last one)
        if (lineIndex < lines.length - 1) {
          totalChunks.push({ type: 'linebreak' });
        }
      }
      
      console.log(`Discord Clicker: Split into ${totalChunks.length} chunks (including line breaks)`);
      
      // Type each chunk with delay (simulating human typing)
      for (let i = 0; i < totalChunks.length; i++) {
        const chunk = totalChunks[i];
        const isLastChunk = i === totalChunks.length - 1;
        
        if (chunk.type === 'linebreak') {
          console.log(`Discord Clicker: Inserting line break ${i + 1}/${totalChunks.length}`);
          
          // Insert line break using Shift+Enter (Discord uses this for line breaks)
          const shiftEnterDown = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          
          const shiftEnterUp = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: true,
            bubbles: true,
            cancelable: true,
            composed: true
          });
          
          messageInput.dispatchEvent(shiftEnterDown);
          await new Promise(resolve => setTimeout(resolve, 10));
          messageInput.dispatchEvent(shiftEnterUp);
          
          // Also try inserting newline directly
          try {
            document.execCommand('insertLineBreak');
          } catch (e) {
            // Fallback: insert newline character
            const currentText = messageInput.textContent || '';
            messageInput.textContent = currentText + '\n';
          }
          
        } else {
          // Regular text chunk
          const textToInsert = isLastChunk ? chunk.content : chunk.content + ' ';
          
          console.log(`Discord Clicker: Inserting chunk ${i + 1}/${totalChunks.length}: "${textToInsert}"`);
          
          // Method 1: Try execCommand (works best when input is properly focused)
          let inserted = false;
          try {
            inserted = document.execCommand('insertText', false, textToInsert);
            console.log(`Discord Clicker: execCommand result: ${inserted}`);
          } catch (e) {
            console.log('Discord Clicker: execCommand error:', e);
          }
          
          // Method 2: If execCommand failed, use direct text manipulation
          if (!inserted) {
            console.log('Discord Clicker: Using direct text insertion');
            
            // Get current content
            const currentText = messageInput.textContent || '';
            messageInput.textContent = currentText + textToInsert;
            
            // Move cursor to end
            const range = document.createRange();
            const sel = window.getSelection();
            
            if (messageInput.childNodes.length > 0) {
              const lastNode = messageInput.childNodes[messageInput.childNodes.length - 1];
              range.setStartAfter(lastNode);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
          
          // Trigger input events to notify Discord of changes
          messageInput.dispatchEvent(new InputEvent('beforeinput', { 
            bubbles: true, 
            cancelable: true,
            inputType: 'insertText',
            data: textToInsert
          }));
          
          messageInput.dispatchEvent(new InputEvent('input', { 
            bubbles: true, 
            cancelable: false,
            inputType: 'insertText',
            data: textToInsert
          }));
          
          messageInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        console.log(`Discord Clicker: Current input content: "${messageInput.textContent}"`);
        
        // Wait before next chunk
        if (i < totalChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, chunkDelay));
        }
      }
      
      console.log('Discord Clicker: All chunks inserted');
      console.log('Discord Clicker: Final input content:', messageInput.textContent);
      console.log('Discord Clicker: Final input HTML:', messageInput.innerHTML);
      
      // Wait a moment for Discord to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send the message by pressing Enter
      console.log('Discord Clicker: Sending message with Enter key...');
      
      const enterKeyDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      
      const enterKeyUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      
      // Dispatch Enter key on the input
      messageInput.dispatchEvent(enterKeyDown);
      await new Promise(resolve => setTimeout(resolve, 20));
      messageInput.dispatchEvent(enterKeyUp);
      
      console.log('Discord Clicker: Enter key dispatched');
      
      // Fallback: Try to find and click send button
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sendButton = document.querySelector('button[aria-label*="Send"]') ||
                        document.querySelector('button[aria-label*="send"]');
      
      if (sendButton && !sendButton.disabled) {
        console.log('Discord Clicker: Clicking send button as backup');
        sendButton.click();
      }
      
      // Wait for message to send (60ms as requested)
      await new Promise(resolve => setTimeout(resolve, 60));
      
      // Check if message was sent (input should be cleared)
      const finalContent = messageInput.textContent.trim();
      if (finalContent === '') {
        console.log('Discord Clicker: ✓ Message sent successfully (input cleared)');
        return true;
      } else {
        console.log('Discord Clicker: ⚠ Message still in input:', finalContent);
        // Force clear
        messageInput.textContent = '';
        messageInput.innerHTML = '';
        return true;
      }
    }

    // Function to find and click a general/public channel in the current server
    async function clickGeneralChannel() {
      console.log('Discord Clicker: Looking for general channel...');
      
      // Wait briefly for server channels to load (reduced from 500ms to 300ms)
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Common channel names to look for (in priority order)
      // Note: "welcome" removed as it's not useful for posting
      const channelNames = [
        'general',
        'main',
        'public',
        'chat',
        'off-topic',
        'lobby',
        'discussion',
        'community',
        'lounge'
      ];
      
      // Find all channel links in the sidebar
      const channelLinks = document.querySelectorAll('a[href*="/channels/"][data-list-item-id*="channels___"]');
      console.log(`Discord Clicker: Found ${channelLinks.length} channel links`);
      
      // Try to find a matching channel
      for (const channelName of channelNames) {
        for (const link of channelLinks) {
          const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
          const textContent = (link.textContent || '').toLowerCase();
          
          // Check if this channel is already selected (active)
          const isActive = link.getAttribute('aria-current') === 'page' || 
                          link.classList.contains('selected') ||
                          link.getAttribute('data-active') === 'true';
          
          if (isActive && (ariaLabel.includes(channelName) || textContent.includes(channelName))) {
            console.log(`Discord Clicker: ✓ Channel already selected: ${ariaLabel || textContent}`);
            return true; // Channel already active, no need to click
          }
          
          // Check if this channel matches our target names
          if (ariaLabel.includes(channelName) || textContent.includes(channelName)) {
            console.log(`Discord Clicker: ✓ Found channel: ${ariaLabel || textContent}`);
            
            // Scroll channel into view (instant, no smooth animation)
            link.scrollIntoView({ behavior: 'instant', block: 'nearest' });
            
            // Click the channel immediately
            const rect = link.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            const eventOptions = {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: x,
              clientY: y,
              button: 0,
              buttons: 1
            };
            
            // Minimal event sequence
            link.dispatchEvent(new MouseEvent('mousedown', eventOptions));
            link.dispatchEvent(new MouseEvent('mouseup', eventOptions));
            link.dispatchEvent(new MouseEvent('click', eventOptions));
            link.click();
            
            console.log(`Discord Clicker: Clicked channel: ${ariaLabel || textContent}`);
            
            // Minimal wait for channel to register (reduced from 300ms to 150ms)
            await new Promise(resolve => setTimeout(resolve, 150));
            
            return true; // Successfully clicked a channel
          }
        }
      }
      
      console.log('Discord Clicker: No general channel found in this server');
      return false; // No matching channel found
    }

    // Function to simulate a real mouse click with actual coordinates
    async function simulateClick(element) {
      // Scroll element into view (instant, no animation)
      element.scrollIntoView({ behavior: 'instant', block: 'center' });
      
      // Minimal wait for scroll (reduced from 200ms to 100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      console.log(`Discord Clicker: Simulating click at coordinates (${x}, ${y}) on element:`, element);

      // Find the actual clickable server icon/button
      let clickTarget = element;
      
      // Look for the server icon wrapper or link
      const possibleTargets = [
        element.querySelector('a[href*="/channels/"]'),
        element.querySelector('[data-dnd-name]'),
        element.querySelector('[class*="wrapper"]'),
        element.querySelector('[role="button"]'),
        element.querySelector('div[draggable="true"]'),
        element
      ];
      
      for (const target of possibleTargets) {
        if (target) {
          clickTarget = target;
          console.log('Discord Clicker: Found click target:', clickTarget);
          break;
        }
      }

      // Get updated coordinates for the actual target
      const targetRect = clickTarget.getBoundingClientRect();
      const targetX = targetRect.left + targetRect.width / 2;
      const targetY = targetRect.top + targetRect.height / 2;

      // Create comprehensive mouse event sequence
      const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: targetX,
        clientY: targetY,
        screenX: targetX + window.screenX,
        screenY: targetY + window.screenY,
        button: 0,
        buttons: 1,
        detail: 1
      };

      console.log(`Discord Clicker: Dispatching events at (${targetX}, ${targetY})`);

      // Dispatch comprehensive event sequence
      const events = [
        new MouseEvent('mouseenter', eventOptions),
        new MouseEvent('mouseover', eventOptions),
        new MouseEvent('mousemove', eventOptions),
        new PointerEvent('pointerdown', eventOptions),
        new MouseEvent('mousedown', eventOptions),
        new PointerEvent('pointerup', eventOptions),
        new MouseEvent('mouseup', eventOptions),
        new MouseEvent('click', eventOptions),
        new PointerEvent('click', eventOptions)
      ];

      events.forEach(event => {
        clickTarget.dispatchEvent(event);
      });
      
      // Also dispatch on parent element
      if (clickTarget !== element) {
        events.forEach(event => {
          element.dispatchEvent(event);
        });
      }
      
      // Try multiple direct click methods
      try {
        clickTarget.click();
        console.log('Discord Clicker: Direct click() executed');
      } catch (e) {
        console.log('Discord Clicker: Direct click() failed:', e);
      }
      
      // Try focus + click
      try {
        clickTarget.focus();
        clickTarget.click();
        console.log('Discord Clicker: Focus + click() executed');
      } catch (e) {
        console.log('Discord Clicker: Focus + click() failed:', e);
      }
      
      console.log('Discord Clicker: Click sequence completed');
    }

    // Function to get server name
    function getServerName(element) {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      
      const img = element.querySelector('img');
      if (img && img.alt) return img.alt;
      
      const dataListItemId = element.getAttribute('data-list-item-id');
      if (dataListItemId) return dataListItemId.split('___')[1] || 'Unknown Server';
      
      return 'Unknown Server';
    }
    
    // Function to find servers inside a specific folder
    function findServersInFolder(folderElement) {
      console.log('Discord Clicker: Finding servers in folder...', folderElement);
      
      let servers = [];
      
      // Get the folder's data-list-item-id to understand its structure
      const folderId = folderElement.getAttribute('data-list-item-id') || '';
      console.log(`Discord Clicker: Folder ID: ${folderId}`);
      
      // Strategy 1: Check if folder has a parent container that holds both folder and servers
      const folderParent = folderElement.parentElement;
      if (folderParent) {
        console.log('Discord Clicker: Checking folder parent for servers...');
        const serversInParent = folderParent.querySelectorAll('[data-list-item-id*="guildsnav___"]');
        
        serversInParent.forEach(server => {
          const serverId = server.getAttribute('data-list-item-id') || '';
          if (!serverId.includes('folder') && 
              !serverId.includes('home') && 
              !serverId.includes('create-join') &&
              !serverId.includes('___null')) {
            console.log(`Discord Clicker: ✓ Found server in parent: ${serverId}`);
            servers.push(server);
          }
        });
      }
      
      // Strategy 2: Look for servers as direct children of the folder
      if (servers.length === 0) {
        console.log('Discord Clicker: Checking folder children...');
        const childServers = folderElement.querySelectorAll('[data-list-item-id*="guildsnav___"]');
        
        childServers.forEach(server => {
          const serverId = server.getAttribute('data-list-item-id') || '';
          if (!serverId.includes('folder') && 
              !serverId.includes('home') && 
              !serverId.includes('create-join') &&
              !serverId.includes('___null')) {
            console.log(`Discord Clicker: ✓ Found server as child: ${serverId}`);
            servers.push(server);
          }
        });
      }
      
      // Strategy 3: After expanding, servers appear as next siblings
      if (servers.length === 0) {
        console.log('Discord Clicker: Checking next siblings...');
        let currentElement = folderElement.nextElementSibling;
        let serversFound = 0;
        
        while (currentElement && serversFound < 50) { // Safety limit
          const dataId = (currentElement.getAttribute('data-list-item-id') || '').toLowerCase();
          const ariaLabel = (currentElement.getAttribute('aria-label') || '').toLowerCase();
          
          console.log(`Discord Clicker: Checking sibling - data-list-item-id: "${dataId}", aria-label: "${ariaLabel}"`);
          
          // Stop if we hit another folder
          if (dataId.includes('folder')) {
            console.log('Discord Clicker: Hit another folder, stopping');
            break;
          }
          
          // Stop if we hit special navigation items
          if (dataId.includes('home') || 
              dataId.includes('create-join') ||
              dataId.includes('___null') ||
              ariaLabel.includes('discover') ||
              ariaLabel.includes('add a server') ||
              ariaLabel.includes('explore') ||
              ariaLabel.includes('download apps')) {
            console.log('Discord Clicker: Hit navigation item, stopping');
            break;
          }
          
          // Check if this is a valid server
          if (dataId.includes('guildsnav___')) {
            console.log(`Discord Clicker: ✓ Found server as sibling: ${dataId}`);
            servers.push(currentElement);
            serversFound++;
          } else if (dataId === '') {
            // Sometimes servers don't have data-list-item-id, check by other means
            const hasServerIcon = currentElement.querySelector('img[src*="cdn.discordapp.com"], svg');
            const isDraggable = currentElement.getAttribute('draggable') === 'true';
            
            if (hasServerIcon || isDraggable) {
              console.log('Discord Clicker: ✓ Found server as sibling (by visual detection)');
              servers.push(currentElement);
              serversFound++;
            }
          }
          
          currentElement = currentElement.nextElementSibling;
        }
      }
      
      // Strategy 4: Use a more aggressive search - find all visible servers in the nav
      if (servers.length === 0) {
        console.log('Discord Clicker: Using aggressive search strategy...');
        const nav = document.querySelector('nav[aria-label*="Server"]');
        if (nav) {
          // Get all server elements
          const allServers = nav.querySelectorAll('[data-list-item-id*="guildsnav___"]');
          
          // Filter to only visible servers (expanded folders show their servers)
          allServers.forEach(server => {
            const serverId = server.getAttribute('data-list-item-id') || '';
            const rect = server.getBoundingClientRect();
            
            // Check if server is visible (has dimensions and is in viewport)
            if (rect.height > 0 && rect.width > 0 &&
                !serverId.includes('folder') && 
                !serverId.includes('home') && 
                !serverId.includes('create-join') &&
                !serverId.includes('___null')) {
              
              // Check if this server wasn't already found
              if (!servers.includes(server)) {
                console.log(`Discord Clicker: ✓ Found visible server: ${serverId}`);
                servers.push(server);
              }
            }
          });
        }
      }
      
      console.log(`Discord Clicker: Found ${servers.length} servers in folder`);
      return servers;
    }
    
    // Function to find standalone servers (not in folders)
    function findStandaloneServers() {
      console.log('Discord Clicker: Finding standalone servers...');
      
      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (!nav) {
        console.log('Discord Clicker: No navigation element found');
        return [];
      }
      
      const allItems = Array.from(nav.querySelectorAll('[data-list-item-id]'));
      console.log(`Discord Clicker: Total items in nav: ${allItems.length}`);
      
      // Get all folder elements
      const folders = Array.from(nav.querySelectorAll('[data-list-item-id*="folder"]'));
      console.log(`Discord Clicker: Total folders: ${folders.length}`);
      
      // Build a set of server IDs that are in folders
      const serversInFolders = new Set();
      folders.forEach(folder => {
        let sibling = folder.nextElementSibling;
        while (sibling) {
          const siblingId = sibling.getAttribute('data-list-item-id') || '';
          
          // Stop if we hit another folder
          if (siblingId.includes('folder')) {
            break;
          }
          
          // Stop if we hit navigation items
          if (siblingId.includes('home') || 
              siblingId.includes('create-join') ||
              siblingId.includes('___null')) {
            break;
          }
          
          // Add server to the set
          if (siblingId.includes('guildsnav___')) {
            serversInFolders.add(siblingId);
          }
          
          sibling = sibling.nextElementSibling;
        }
      });
      
      console.log(`Discord Clicker: Servers in folders: ${serversInFolders.size}`);
      
      // Find servers that are NOT in the set
      const standaloneServers = allItems.filter(item => {
        const dataId = (item.getAttribute('data-list-item-id') || '').toLowerCase();
        const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase();
        
        // Must be a server
        if (!dataId.includes('guildsnav___')) {
          return false;
        }
        
        // Exclude special items
        if (dataId.includes('folder') || 
            dataId.includes('home') || 
            dataId.includes('create-join') ||
            dataId.includes('___null')) {
          return false;
        }
        
        // Exclude navigation buttons by aria-label
        if (ariaLabel.includes('discover') ||
            ariaLabel.includes('apps') ||
            ariaLabel.includes('servers') ||
            ariaLabel.includes('add a server') ||
            ariaLabel.includes('explore') ||
            ariaLabel.includes('download')) {
          console.log(`Discord Clicker: Excluding navigation button: ${ariaLabel}`);
          return false;
        }
        
        // Must NOT be in a folder
        if (serversInFolders.has(dataId)) {
          return false;
        }
        
        console.log(`Discord Clicker: ✓ Found standalone server: ${dataId}`);
        return true;
      });
      
      console.log(`Discord Clicker: Found ${standaloneServers.length} standalone servers`);
      return standaloneServers;
    }

    // Function to get server name
    function getServerName(element) {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;
      
      const img = element.querySelector('img');
      if (img && img.alt) return img.alt;
      
      return 'Unknown Server';
    }

    // Function to get all currently visible servers in the sidebar
    function getAllVisibleServers() {
      console.log('Discord Clicker: Getting all visible servers...');
      
      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (!nav) {
        console.log('Discord Clicker: No navigation element found');
        return [];
      }
      
      const allItems = Array.from(nav.querySelectorAll('[data-list-item-id]'));
      
      const servers = allItems.filter(item => {
        const dataId = (item.getAttribute('data-list-item-id') || '').toLowerCase();
        const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase();
        const rect = item.getBoundingClientRect();
        
        // Must have valid dimensions (visible)
        if (rect.height === 0 || rect.width === 0) {
          return false;
        }
        
        // Must be a server
        if (!dataId.includes('guildsnav___')) {
          return false;
        }
        
        // Exclude special items
        if (dataId.includes('folder') || 
            dataId.includes('home') || 
            dataId.includes('create-join') ||
            dataId.includes('___null')) {
          console.log(`Discord Clicker: Excluding special item: ${dataId}`);
          return false;
        }
        
        // Exclude navigation buttons
        if (ariaLabel.includes('discover') ||
            ariaLabel.includes('apps') ||
            ariaLabel.includes('servers') ||
            ariaLabel.includes('quests') ||
            ariaLabel.includes('add a server') ||
            ariaLabel.includes('explore') ||
            ariaLabel.includes('download')) {
          console.log(`Discord Clicker: Excluding navigation button: ${ariaLabel}`);
          return false;
        }
        
        // IMPORTANT: Exclude folder icons/wrappers
        const hasFolderClass = item.className.includes('folder') || 
                               item.querySelector('[class*="folderIcon"]') !== null ||
                               item.querySelector('[class*="expandedFolder"]') !== null;
        
        if (hasFolderClass) {
          console.log(`Discord Clicker: Excluding folder element: ${item.className}`);
          return false;
        }
        
        console.log(`Discord Clicker: ✓ Valid server: ${dataId}`);
        return true;
      });
      
      console.log(`Discord Clicker: Found ${servers.length} visible servers`);
      return servers;
    }

    // Main clicking loop - SIMPLIFIED: Just click all visible servers
    async function clickLoop() {
      do {
        // Get ALL visible servers (user must expand folders manually first)
        const allVisibleServers = getAllVisibleServers();
        
        if (allVisibleServers.length === 0) {
          chrome.runtime.sendMessage({
            type: 'error',
            error: 'No Discord servers found. Please make sure: 1) You are on Discord, 2) The server list is visible on the left, 3) All folders are expanded manually.'
          });
          return;
        }

        chrome.runtime.sendMessage({
          type: 'update',
          data: {
            totalServers: allVisibleServers.length,
            status: 'Clicking servers...',
            statusClass: 'running',
            log: `Found ${allVisibleServers.length} visible servers. Starting to click from top to bottom...`,
            logType: 'success'
          }
        });

        // Click each server sequentially from top to bottom
        for (let i = 0; i < allVisibleServers.length; i++) {
          if (shouldStop) {
            chrome.runtime.sendMessage({
              type: 'update',
              data: {
                status: 'Stopped by user',
                log: 'Stopped by user',
                logType: 'info'
              }
            });
            return;
          }

          const server = allVisibleServers[i];
          const serverName = getServerName(server);
          
          console.log(`Discord Clicker: Clicking server ${i + 1}/${allVisibleServers.length}: ${serverName}`);
          
          // Highlight the server being clicked
          server.style.outline = '3px solid #5865f2';
          
          // Simulate click (with scroll into view)
          await simulateClick(server);
          
          // Update UI
          chrome.runtime.sendMessage({
            type: 'update',
            data: {
              currentServer: serverName,
              clickedCount: i + 1,
              progress: ((i + 1) / allVisibleServers.length) * 100,
              log: `Clicked server: ${serverName} (${i + 1}/${allVisibleServers.length})`,
              logType: 'success'
            }
          });

          // Remove server highlight immediately
          server.style.outline = '';
          
          // Now try to click a general channel in this server
          const channelClicked = await clickGeneralChannel();
          
          if (channelClicked) {
            chrome.runtime.sendMessage({
              type: 'update',
              data: {
                log: `  → Found channel in ${serverName}`,
                logType: 'info'
              }
            });
            
            // Post message if channel was found/selected
            if (messages.length > 0) {
              // Randomly select one message from the array
              const randomMessage = messages[Math.floor(Math.random() * messages.length)];
              
              const messagePosted = await postMessage(randomMessage, chunkSize, chunkDelay);
              
              if (messagePosted) {
                chrome.runtime.sendMessage({
                  type: 'update',
                  data: {
                    log: `  → Posted message in ${serverName}`,
                    logType: 'success'
                  }
                });
              } else {
                chrome.runtime.sendMessage({
                  type: 'update',
                  data: {
                    log: `  → Could not post message (input disabled)`,
                    logType: 'info'
                  }
                });
              }
            }
          } else {
            chrome.runtime.sendMessage({
              type: 'update',
              data: {
                log: `  → No channel found, moving on`,
                logType: 'info'
              }
            });
          }

          // Move to next server immediately - no delay needed
          // The channel function already includes necessary waits for Discord
        }

        if (!loop) {
          break;
        } else {
          chrome.runtime.sendMessage({
            type: 'update',
            data: {
              log: 'Completed one cycle. Restarting loop...',
              logType: 'info'
            }
          });
          // Small delay before restarting the entire loop
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } while (loop && !shouldStop);

      chrome.runtime.sendMessage({ type: 'complete' });
    }

    // Start the clicking process
    clickLoop();
  };

  // Log that the script is ready
  console.log('Discord Server Clicker: Content script loaded and ready');
})();
