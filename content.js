// Content script - runs in Discord page context
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.discordClickerInitialized) {
    return;
  }
  window.discordClickerInitialized = true;

  // This function will be injected into the page
  window.clickServers = async function(loop, serverDelay, messages) {
    let shouldStop = false;

    // Listen for stop message
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'stop') {
        shouldStop = true;
      }
    });

    // Function to detect and expand Discord server folders
    function findAndExpandFolders() {

      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (!nav) {
        return { allFolders: [], collapsedFolders: [] };
      }

      // Find all folder elements
      const folderElements = Array.from(nav.querySelectorAll('[data-list-item-id*="folder"]'));

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
        } else if (isCollapsed) {
          collapsedFolders.push(folder);
        } else {
          collapsedFolders.push(folder);
        }
      });

      return { allFolders, collapsedFolders };
    }

    // Function to expand a folder
    async function expandFolder(folder) {

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
          break;
        }
      }

      // Get the bounding rectangle for accurate click positioning
      const rect = clickTarget.getBoundingClientRect();

      // Highlight the folder being clicked (visual feedback)
      const originalOutline = clickTarget.style.outline;
      clickTarget.style.outline = '3px solid #f23f43';

      // Use simulateClick which creates real mouse events with coordinates
      await simulateClick(clickTarget);

      // Remove highlight after a short delay
      setTimeout(() => {
        clickTarget.style.outline = originalOutline;
      }, 500);

      return true;
    }

    // Function to find Discord server list items
    function findServerElements() {

      let servers = [];

      // Strategy 1: Find by data-list-item-id pattern (most reliable for current Discord)
      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (nav) {

        // Get all elements with data-list-item-id
        const allItems = Array.from(nav.querySelectorAll('[data-list-item-id]'));

        // Filter for guild items (servers)
        servers = allItems.filter(el => {
          const dataListItemId = el.getAttribute('data-list-item-id') || '';

          // Guild items have pattern: guildsnav___guild-id or similar
          if (dataListItemId.includes('guildsnav___') && !dataListItemId.includes('folder')) {
            // Make sure it's not home or special items
            if (!dataListItemId.includes('home') && 
                !dataListItemId.includes('create-join') &&
                !dataListItemId.includes('___null')) {
              return true;
            }
          }
          return false;
        });

      }

      // Strategy 2: If no servers found, try finding by visual elements
      if (servers.length === 0) {

        const selectors = [
          'nav[aria-label*="Server"] [class*="listItem"]',
          'nav[aria-label*="Server"] li',
          '[data-list-id="guildsnav"] > *'
        ];

        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector));

          if (elements.length > 0) {
            servers = elements.filter(el => {
              const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
              const hasIcon = el.querySelector('img, svg, [class*="icon"]');

              // Exclude navigation items
              const excludePatterns = ['home', 'direct message', 'add a server', 'explore', 'discover', 'folder'];
              const isExcluded = excludePatterns.some(pattern => ariaLabel.includes(pattern));

              if (!isExcluded && hasIcon) {
                return true;
              }
              return false;
            });

            if (servers.length > 0) break;
          }
        }
      }

      return servers;
    }

    // Function to post a message in the current channel
    async function postMessage(message) {

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
        return false;
      }

      // Check if input is disabled
      const isDisabled = messageInput.getAttribute('aria-disabled') === 'true' ||
                        messageInput.getAttribute('contenteditable') === 'false' ||
                        messageInput.hasAttribute('disabled');

      if (isDisabled) {
        return false;
      }

      // CRITICAL: Perform a REAL physical mouse click with coordinates
      // This is the ONLY way Discord properly initializes the input field

      // Scroll input into view first
      messageInput.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 150));

      // Get the bounding rectangle and calculate center point
      const rect = messageInput.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

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

      // Wait for Discord to fully initialize the input after click
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify input is now focused
      const isFocused = document.activeElement === messageInput;

      if (!isFocused) {
        messageInput.focus();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clear any existing content
      messageInput.textContent = '';
      messageInput.innerHTML = '';

      // Paste the entire message at once (preserves line breaks).
      // Method 1: Simulate a real clipboard paste. Discord's editor handles
      // multi-line text natively and inserts the whole message in one operation.
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', message);

        messageInput.dispatchEvent(new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        }));
      } catch (e) {
        // Paste simulation not supported - fall through to Method 2
      }

      // Give Discord a moment to process the paste
      await new Promise(resolve => setTimeout(resolve, 50));

      // Method 2: Fallback - if the paste didn't populate the input, insert the
      // whole message via execCommand in a single call.
      if (messageInput.textContent.trim() === '') {
        try {
          document.execCommand('insertText', false, message);
        } catch (e) {
        }

        messageInput.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          inputType: 'insertText',
          data: message
        }));
      }

      // Wait a moment for Discord to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send the message by pressing Enter

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

      // Fallback: Try to find and click send button
      await new Promise(resolve => setTimeout(resolve, 50));

      const sendButton = document.querySelector('button[aria-label*="Send"]') ||
                        document.querySelector('button[aria-label*="send"]');

      if (sendButton && !sendButton.disabled) {
        sendButton.click();
      }

      // Wait for message to send (60ms as requested)
      await new Promise(resolve => setTimeout(resolve, 60));

      // Check if message was sent (input should be cleared)
      const finalContent = messageInput.textContent.trim();
      if (finalContent === '') {
        return true;
      } else {
        // Force clear
        messageInput.textContent = '';
        messageInput.innerHTML = '';
        return true;
      }
    }

    // Function to find and click a general/public channel in the current server
    async function clickGeneralChannel() {

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
            return true; // Channel already active, no need to click
          }

          // Check if this channel matches our target names
          if (ariaLabel.includes(channelName) || textContent.includes(channelName)) {

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

            // Minimal wait for channel to register (reduced from 300ms to 150ms)
            await new Promise(resolve => setTimeout(resolve, 150));

            return true; // Successfully clicked a channel
          }
        }
      }

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
      } catch (e) {
      }

      // Try focus + click
      try {
        clickTarget.focus();
        clickTarget.click();
      } catch (e) {
      }

    }

    // Function to find servers inside a specific folder
    function findServersInFolder(folderElement) {

      let servers = [];

      // Get the folder's data-list-item-id to understand its structure
      const folderId = folderElement.getAttribute('data-list-item-id') || '';

      // Strategy 1: Check if folder has a parent container that holds both folder and servers
      const folderParent = folderElement.parentElement;
      if (folderParent) {
        const serversInParent = folderParent.querySelectorAll('[data-list-item-id*="guildsnav___"]');

        serversInParent.forEach(server => {
          const serverId = server.getAttribute('data-list-item-id') || '';
          if (!serverId.includes('folder') && 
              !serverId.includes('home') && 
              !serverId.includes('create-join') &&
              !serverId.includes('___null')) {
            servers.push(server);
          }
        });
      }

      // Strategy 2: Look for servers as direct children of the folder
      if (servers.length === 0) {
        const childServers = folderElement.querySelectorAll('[data-list-item-id*="guildsnav___"]');

        childServers.forEach(server => {
          const serverId = server.getAttribute('data-list-item-id') || '';
          if (!serverId.includes('folder') && 
              !serverId.includes('home') && 
              !serverId.includes('create-join') &&
              !serverId.includes('___null')) {
            servers.push(server);
          }
        });
      }

      // Strategy 3: After expanding, servers appear as next siblings
      if (servers.length === 0) {
        let currentElement = folderElement.nextElementSibling;
        let serversFound = 0;

        while (currentElement && serversFound < 50) { // Safety limit
          const dataId = (currentElement.getAttribute('data-list-item-id') || '').toLowerCase();
          const ariaLabel = (currentElement.getAttribute('aria-label') || '').toLowerCase();

          // Stop if we hit another folder
          if (dataId.includes('folder')) {
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
            break;
          }

          // Check if this is a valid server
          if (dataId.includes('guildsnav___')) {
            servers.push(currentElement);
            serversFound++;
          } else if (dataId === '') {
            // Sometimes servers don't have data-list-item-id, check by other means
            const hasServerIcon = currentElement.querySelector('img[src*="cdn.discordapp.com"], svg');
            const isDraggable = currentElement.getAttribute('draggable') === 'true';

            if (hasServerIcon || isDraggable) {
              servers.push(currentElement);
              serversFound++;
            }
          }

          currentElement = currentElement.nextElementSibling;
        }
      }

      // Strategy 4: Use a more aggressive search - find all visible servers in the nav
      if (servers.length === 0) {
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
                servers.push(server);
              }
            }
          });
        }
      }

      return servers;
    }

    // Function to find standalone servers (not in folders)
    function findStandaloneServers() {

      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (!nav) {
        return [];
      }

      const allItems = Array.from(nav.querySelectorAll('[data-list-item-id]'));

      // Get all folder elements
      const folders = Array.from(nav.querySelectorAll('[data-list-item-id*="folder"]'));

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
          return false;
        }

        // Must NOT be in a folder
        if (serversInFolders.has(dataId)) {
          return false;
        }

        return true;
      });

      return standaloneServers;
    }

    // Function to get server name
    function getServerName(element) {

      // Method 1: Try aria-label attribute (most reliable for server list items)
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) {
        // Clean up the aria-label (remove things like "(unread)" or "(1 unread)")
        let cleanName = ariaLabel.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (cleanName && cleanName.length > 0 && cleanName.length < 100) {
          return cleanName;
        }
      }

      // Method 2: Try to find server name in nested link
      const linkElement = element.querySelector('a[href*="/channels/"]');
      if (linkElement) {
        const linkAriaLabel = linkElement.getAttribute('aria-label');
        if (linkAriaLabel && linkAriaLabel.trim()) {
          let cleanName = linkAriaLabel.replace(/\s*\([^)]*\)\s*/g, '').trim();
          if (cleanName && cleanName.length > 0) {
            return cleanName;
          }
        }

        // Try data-dnd-name attribute
        const dndName = linkElement.getAttribute('data-dnd-name');
        if (dndName && dndName.trim()) {
          return dndName.trim();
        }
      }

      // Method 3: Try image alt text
      const img = element.querySelector('img');
      if (img && img.alt && img.alt.trim()) {
        return img.alt.trim();
      }

      // Method 4: Try to find any div with data-dnd-name
      const dndElement = element.querySelector('[data-dnd-name]');
      if (dndElement) {
        const dndName = dndElement.getAttribute('data-dnd-name');
        if (dndName && dndName.trim()) {
          return dndName.trim();
        }
      }

      // Method 5: Try data-list-item-id and extract guild name
      const dataListItemId = element.getAttribute('data-list-item-id');
      if (dataListItemId && dataListItemId.includes('guildsnav___')) {
        const guildId = dataListItemId.split('___')[1];
        if (guildId && guildId !== 'null') {
          return `Server (${guildId.substring(0, 8)}...)`;
        }
      }

      return 'Unknown Server';
    }

    // Helper function to find server name by guild ID
    function findServerNameByGuildId(guildId) {
      // Try to find the server name in the page title or header
      const headerElement = document.querySelector(`[data-guild-id="${guildId}"]`);
      if (headerElement) {
        const name = headerElement.getAttribute('aria-label') || headerElement.textContent;
        if (name && name.trim()) {
          return name.trim();
        }
      }

      // Try to find in the server header
      const serverHeader = document.querySelector('h1[class*="name"]');
      if (serverHeader && serverHeader.textContent) {
        const name = serverHeader.textContent.trim();
        if (name && name.length > 0) {
          return name;
        }
      }

      return null;
    }

    // Function to get all currently visible servers in the sidebar
    function getAllVisibleServers() {

      const nav = document.querySelector('nav[aria-label*="Server"]');
      if (!nav) {
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
          return false;
        }

        // IMPORTANT: Exclude folder icons/wrappers
        const hasFolderClass = item.className.includes('folder') || 
                               item.querySelector('[class*="folderIcon"]') !== null ||
                               item.querySelector('[class*="expandedFolder"]') !== null;

        if (hasFolderClass) {
          return false;
        }

        return true;
      });

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
          let serverName = getServerName(server);

          // Highlight the server being clicked
          server.style.outline = '3px solid #5865f2';

          // Simulate click (with scroll into view)
          await simulateClick(server);

          // Wait a moment for Discord to load the server
          await new Promise(resolve => setTimeout(resolve, 300));

          // Try multiple methods to get the server name from the active server
          // Method 1: Look for server name in the header (most common location)
          let headerSelectors = [
            'h1[class*="name"]',
            'div[class*="name"][class*="container"] h1',
            'header h1',
            '[class*="headerContent"] h1',
            '[class*="animatedContainer"] h1',
            '[class*="title"]',
            'div[class*="name"]:not([class*="username"])',
          ];

          for (const selector of headerSelectors) {
            try {
              const headerElement = document.querySelector(selector);
              if (headerElement && headerElement.textContent) {
                const headerName = headerElement.textContent.trim();
                // Validate it's a reasonable server name (not empty, not too long, not a channel name)
                if (headerName && 
                    headerName.length > 0 && 
                    headerName.length < 100 &&
                    !headerName.startsWith('#') &&
                    !headerName.includes('Text Channels') &&
                    !headerName.includes('Voice Channels')) {
                  serverName = headerName;
                  break;
                }
              }
            } catch (e) {
              // Continue to next selector
            }
          }

          // Method 2: Try to get from the page title
          if (serverName.includes('Server (') || serverName === 'Unknown Server') {
            const pageTitle = document.title;
            if (pageTitle && !pageTitle.includes('Discord')) {
              const titleParts = pageTitle.split('-');
              if (titleParts.length > 0) {
                const possibleName = titleParts[0].trim();
                if (possibleName && possibleName.length > 0 && possibleName.length < 100) {
                  serverName = possibleName;
                }
              }
            }
          }

          // Method 3: Look for server name in aria-labels of visible elements
          if (serverName.includes('Server (') || serverName === 'Unknown Server') {
            const allElements = document.querySelectorAll('[aria-label]');
            for (const el of allElements) {
              const label = el.getAttribute('aria-label');
              if (label && 
                  !label.includes('(') && 
                  !label.includes('channel') &&
                  !label.includes('Channel') &&
                  !label.includes('server list') &&
                  !label.includes('Server') &&
                  label.length > 2 &&
                  label.length < 50) {
                // This might be the server name
                const rect = el.getBoundingClientRect();
                // Check if element is visible and in the top area (likely header)
                if (rect.top < 200 && rect.width > 100) {
                  serverName = label;
                  break;
                }
              }
            }
          }

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

              const messagePosted = await postMessage(randomMessage);

              if (messagePosted) {
                chrome.runtime.sendMessage({
                  type: 'update',
                  data: {
                    log: `  → Posted message in ${serverName}`,
                    logType: 'success'
                  }
                });

                // Send success result
                chrome.runtime.sendMessage({
                  type: 'result',
                  data: {
                    status: 'success',
                    server: serverName,
                    channel: 'Found'
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

                // Send skipped result
                chrome.runtime.sendMessage({
                  type: 'result',
                  data: {
                    status: 'skipped',
                    server: serverName,
                    channel: 'Found',
                    reason: 'Message input disabled'
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

            // Send skipped result
            chrome.runtime.sendMessage({
              type: 'result',
              data: {
                status: 'skipped',
                server: serverName,
                channel: 'None',
                reason: 'No suitable channel found'
              }
            });
          }

          // Wait the user-configured delay before switching to the next server
          if (serverDelay > 0 && i < allVisibleServers.length - 1 && !shouldStop) {
            await new Promise(resolve => setTimeout(resolve, serverDelay));
          }
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
})();
