import { serve } from "bun";

const OPENCODE_URL = "http://localhost:4096";

// Simple HTML with distinctive UI
const html = `<!DOCTYPE html>
<html lang="en" class="bg-gradient-to-br from-slate-800 to-slate-900">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1e293b">
  <title>OpenCode Chat - LineLeap</title>
  <!-- Just Tailwind -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Marked.js: Markdown parser -->
  <script src="https://cdn.jsdelivr.net/npm/marked@5.1.2/marked.min.js"></script>
  <!-- DOMPurify: HTML sanitizer -->
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
  <style>
    /* Custom styles on top of DaisyUI */
    .thinking-dots {
      display: inline-flex;
      gap: 0.25rem;
    }
    
    .thinking-dots span {
      width: 0.5rem;
      height: 0.5rem;
      background: currentColor;
      border-radius: 50%;
      animation: bounce 1.4s ease-in-out infinite;
    }
    
    .thinking-dots span:nth-child(1) {
      animation-delay: -0.32s;
    }
    
    .thinking-dots span:nth-child(2) {
      animation-delay: -0.16s;
    }
    
    @keyframes bounce {
      0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
      }
      40% {
        transform: scale(1.2);
        opacity: 1;
      }
    }
    
    /* Prevent code blocks from breaking layout */
    pre {
      overflow-x: auto;
      max-width: 100%;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    
    code {
      word-break: break-word;
    }
    
    /* Ensure message bubbles handle overflow */
    .message-bubble {
      overflow-wrap: break-word;
      word-wrap: break-word;
      overflow-x: auto;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-slate-800 to-slate-900 h-[100dvh] p-0 sm:p-4">
  <div class="w-full max-w-4xl h-[100dvh] sm:h-[600px] sm:mx-auto bg-white dark:bg-slate-800 sm:rounded-2xl shadow-2xl flex flex-col">
    <!-- Header -->
    <div class="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 sm:rounded-t-2xl flex justify-between items-center flex-shrink-0">
      <button onclick="showSessions()" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm">
        Sessions
      </button>
      <span class="font-semibold text-lg">OpenCode Chat</span>
      <button onclick="newChat()" class="px-3 py-1 bg-white/20 rounded hover:bg-white/30 text-sm">
        New Chat
      </button>
    </div>
    
    <!-- Messages container -->
    <div class="flex-1 overflow-y-auto p-4 min-h-0" id="messages">
      <div class="text-center text-gray-500 dark:text-gray-400 italic">
        Welcome! Type a message to start chatting with OpenCode.
      </div>
    </div>
    
    <!-- Input area -->
    <div class="p-4 border-t border-gray-200 dark:border-slate-600 flex-shrink-0">
      <div class="flex gap-2">
        <input 
          type="text" 
          id="messageInput" 
          placeholder="Type your message..."
          class="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-purple-600 dark:focus:border-purple-400"
          autofocus
        />
        <button id="sendButton" onclick="sendMessage()" class="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-shadow">
          Send
        </button>
      </div>
    </div>
    
    <!-- Status bar -->
    <div class="px-4 py-2 bg-gray-900 text-xs text-gray-400 flex justify-between items-center flex-shrink-0 sm:rounded-b-2xl">
      <span id="contextUsage" title="Token usage">--</span>
      <div class="flex gap-2">
        <select id="modelSelect" class="bg-gray-800 text-gray-400 border border-gray-700 rounded px-2 py-1">
          <!-- Will be populated dynamically -->
        </select>
        <select id="agentSelect" class="bg-gray-800 text-gray-400 border border-gray-700 rounded px-2 py-1">
          <option value="build">build mode</option>
          <option value="plan">plan mode</option>
        </select>
      </div>
      <span id="cost" title="Session cost">$0.00</span>
    </div>
  </div>
  
  <script>
    // Check if libraries loaded
    console.log('Marked available?', typeof marked);
    console.log('DOMPurify available?', typeof DOMPurify);
    
    // Load session from localStorage
    let sessionId = localStorage.getItem('opencodeSessionId');
    let sessionStartTime = null;
    let isLoading = false;
    let eventSource = null;
    const messages = new Map();  // Track all messages: messageId -> { element, role, text }
    let thinkingIndicator = null;
    
    // Fetch model names from OpenCode and populate selector
    fetch('/config/providers')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch providers: ' + res.status);
        return res.json();
      })
      .then(data => {
        console.log('Providers data:', data);
        const modelSelect = document.getElementById('modelSelect');
        const models = {};
        const modelList = [];
        
        // data.providers is an array, not an object
        for (const provider of (data.providers || [])) {
          for (const [id, model] of Object.entries(provider.models || {})) {
            models[id] = model.name;
            // Only add enabled models to the list
            if (model.enabled !== false) {
              modelList.push({ id, name: model.name, provider: provider.id });
            }
          }
        }
        
        window.modelNames = models;
        window.availableModels = modelList;
        console.log('Model names loaded:', Object.keys(models).length);
        
        // Group models by provider for better UX
        const providers = {};
        modelList.forEach(model => {
          if (!providers[model.provider]) providers[model.provider] = [];
          providers[model.provider].push(model);
        });
        
        // Populate model selector
        modelSelect.innerHTML = '';
        
        // Add a default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a model';
        modelSelect.appendChild(defaultOption);
        
        // Add models grouped by provider
        Object.entries(providers).forEach(([provider, models]) => {
          const optgroup = document.createElement('optgroup');
          optgroup.label = provider;
          models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            optgroup.appendChild(option);
          });
          modelSelect.appendChild(optgroup);
        });
        
        // Load saved model preference, or use Opus 4.1 as default
        const savedModel = localStorage.getItem('opencodePreferredModel');
        const defaultModel = 'claude-opus-4-1-20250805';
        
        if (savedModel && models[savedModel]) {
          modelSelect.value = savedModel;
        } else if (models[defaultModel]) {
          modelSelect.value = defaultModel;
        }
        
        // Save model preference on change
        modelSelect.addEventListener('change', () => {
          if (modelSelect.value) {
            localStorage.setItem('opencodePreferredModel', modelSelect.value);
          }
        });
      })
      .catch(err => console.error('Failed to load model names:', err));
    
    // Fetch available agents/modes
    fetch('/agent')
      .then(res => res.json())
      .then(agents => {
        const select = document.getElementById('agentSelect');
        select.innerHTML = ''; // Clear existing options
        
        // Add primary agents first
        const primaryAgents = agents.filter(a => a.mode === 'primary');
        primaryAgents.forEach(agent => {
          const option = document.createElement('option');
          option.value = agent.name;
          option.textContent = agent.name + ' mode';
          if (agent.name === 'build') option.selected = true;
          select.appendChild(option);
        });
        
        // Add subagents if any
        const subAgents = agents.filter(a => a.mode === 'subagent');
        if (subAgents.length > 0) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = 'Subagents';
          subAgents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.name;
            option.textContent = agent.name;
            option.title = agent.description || '';
            optgroup.appendChild(option);
          });
          select.appendChild(optgroup);
        }
      })
      .catch(err => console.error('Failed to load agents:', err));
    
    // Session management functions
    function newChat() {
      if (confirm('Start a new chat? Current session will be saved.')) {
        // Clear current session
        sessionId = null;
        localStorage.removeItem('opencodeSessionId');
        
        // Clear messages
        if (messagesEl) {
          messagesEl.innerHTML = '<div class="text-center text-gray-500 dark:text-gray-400 italic">Welcome! Type a message to start chatting with OpenCode.</div>';
        }
        messages.clear();
        
        // Session cleared
        
        // Close SSE if open
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      }
    }
    
    async function showSessions() {
      alert('Session list coming soon! For now, use New Chat to start fresh.');
    }
    
    // Move these declarations to the top so they're available to all functions
    let messagesEl = document.getElementById('messages');
    let inputEl = document.getElementById('messageInput');
    let buttonEl = document.getElementById('sendButton');
    let sessionInfoEl = document.getElementById('sessionInfo');
    
    // Load history if we have a session
    async function loadHistory() {
      if (!sessionId) return;
      
      try {
        const response = await fetch('/history?sessionId=' + sessionId);
        if (response.ok) {
          const messages = await response.json();
          
          // Clear welcome message
          messagesEl.innerHTML = '';
          
          // Sort messages by timestamp
          messages.sort((a, b) => {
            const timeA = a.info?.time?.created || 0;
            const timeB = b.info?.time?.created || 0;
            return timeA - timeB;
          });
          
          // Add all historical messages
          let latestAssistantInfo = null;
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            // OpenCode uses info.time.created as Unix timestamp in milliseconds
            const timestamp = msg.info?.time?.created;
            
            // Track latest info from assistant messages
            if (msg.info.role === 'assistant') {
              latestAssistantInfo = msg.info;
            }
            
            if (msg.info.role === 'user') {
              // User messages - append in chronological order
              const textPart = msg.parts?.find(p => p.type === 'text' && p.text);
              if (textPart) {
                const wrapperEl = document.createElement('div');
                wrapperEl.className = 'flex flex-col mb-4';
                
                const messageRow = document.createElement('div');
                messageRow.className = 'flex justify-end';
                
                const bubbleEl = document.createElement('div');
                bubbleEl.className = 'max-w-[85%] px-4 py-2 rounded-lg text-white';
                bubbleEl.style.background = 'linear-gradient(to right, #9333ea, #3b82f6)';
                bubbleEl.textContent = textPart.text.trim();
                
                messageRow.appendChild(bubbleEl);
                wrapperEl.appendChild(messageRow);
                
                const timeEl = document.createElement('div');
                timeEl.className = 'text-right text-xs text-gray-500 dark:text-gray-400 mt-1 mr-2';
                const time = timestamp ? new Date(timestamp) : new Date();
                timeEl.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                wrapperEl.appendChild(timeEl);
                
                messagesEl.appendChild(wrapperEl);
              }
            } else if (msg.info.role === 'assistant') {
              // Build full message content including tool calls
              let fullContent = '';
              let hasTextContent = false;
              
              // Process all parts in order - text first, then tools
              for (const part of msg.parts || []) {
                if (part.type === 'text' && part.text && !part.synthetic) {
                  if (fullContent && hasTextContent) fullContent += '\\n\\n';
                  fullContent += part.text;
                  hasTextContent = true;
                }
              }
              
              // Then add tool calls if any
              for (const part of msg.parts || []) {
                if (part.type === 'tool_use') {
                  fullContent += '\\n\\n🔧 **Tool: ' + part.name + '**\\n';
                  fullContent += String.fromCharCode(96,96,96) + 'json\\n';
                  fullContent += JSON.stringify(part.input, null, 2) + '\\n';
                  fullContent += String.fromCharCode(96,96,96) + '\\n';
                } else if (part.type === 'tool_result') {
                  fullContent += '\\n📤 **Result:**\\n';
                  if (part.output) {
                    const output = part.output.substring(0, 1000);
                    const truncated = part.output.length > 1000 ? '...' : '';
                    fullContent += String.fromCharCode(96,96,96) + '\\n' + output + truncated + '\\n' + String.fromCharCode(96,96,96) + '\\n';
                  } else if (part.error) {
                    fullContent += '❌ Error: ' + part.error + '\\n';
                  }
                }
              }
              
              if (fullContent) {
                // Create wrapper for message and timestamp
                const wrapperEl = document.createElement('div');
                wrapperEl.className = 'flex flex-col mb-4';
                
                // Message row
                const messageRow = document.createElement('div');
                messageRow.className = 'flex justify-start';
                
                const bubbleEl = document.createElement('div');
                bubbleEl.className = 'max-w-[85%] sm:max-w-[70%] px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100 message-bubble';
                try {
                  const rawHtml = marked.parse(fullContent);
                  const cleanHtml = DOMPurify.sanitize(rawHtml);
                  bubbleEl.innerHTML = cleanHtml;
                } catch (e) {
                  bubbleEl.textContent = fullContent;
                }
                messageRow.appendChild(bubbleEl);
                wrapperEl.appendChild(messageRow);
                
                // Add timestamp
                const timeEl = document.createElement('div');
                timeEl.className = 'text-left text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2';
                const time = timestamp ? new Date(timestamp) : new Date();
                timeEl.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                wrapperEl.appendChild(timeEl);
                
                messagesEl.appendChild(wrapperEl);
              }
            }
          }
          
          // Update status bar from latest assistant message
          if (latestAssistantInfo) {
            if (latestAssistantInfo.tokens) {
              const total = (latestAssistantInfo.tokens.input || 0) + (latestAssistantInfo.tokens.output || 0);
              const percent = Math.round((total / 200000) * 100);
              document.getElementById('contextUsage').textContent = (total/1000).toFixed(1) + 'K/' + percent + '%';
            }
            if (latestAssistantInfo.cost !== undefined) {
              document.getElementById('cost').textContent = '$' + latestAssistantInfo.cost.toFixed(2);
            }
            if (latestAssistantInfo.modelID) {
              // Update model selector to show current session's model
              const modelSelect = document.getElementById('modelSelect');
              if (modelSelect && modelSelect.querySelector('option[value="' + latestAssistantInfo.modelID + '"]')) {
                modelSelect.value = latestAssistantInfo.modelID;
              }
            }
          }
          
          // Session loaded
          // Scroll to bottom after loading history
          messagesEl.scrollTop = messagesEl.scrollHeight;
          connectSSE();
        }
      } catch (error) {
        console.error('Failed to load history:', error);
      }
    }
    
    // Load history on page load
    loadHistory();
    
    // Enter key to send
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !isLoading) {
        sendMessage();
      }
    });
    
    function addMessage(content, type = 'assistant', timestamp = null) {
      // Outer wrapper for the full-width row
      const rowEl = document.createElement('div');
      rowEl.className = 'flex flex-col mb-4';
      
      // Message container
      const messageRow = document.createElement('div');
      messageRow.className = 'flex';
      
      if (type === 'user') {
        // For user messages: flex row with justify-end to push content right
        messageRow.className += ' justify-end';
        
        // Inner container that will size to content
        const messageContainer = document.createElement('div');
        messageContainer.className = 'flex';
        messageContainer.style.maxWidth = '85%';
        
        // The actual bubble that fits its content
        const bubbleEl = document.createElement('div');
        bubbleEl.className = 'px-4 py-2 rounded-lg text-white';
        bubbleEl.style.background = 'linear-gradient(to right, #9333ea, #3b82f6)';
        bubbleEl.textContent = content.trim();
        
        messageContainer.appendChild(bubbleEl);
        messageRow.appendChild(messageContainer);
      } else {
        // For assistant messages: flex row with justify-start (default)
        messageRow.className += ' justify-start';
        
        // Inner container that will size to content
        const messageContainer = document.createElement('div');
        messageContainer.className = 'flex';
        messageContainer.style.maxWidth = '85%';
        
        // The actual bubble that fits its content
        const bubbleEl = document.createElement('div');
        bubbleEl.className = 'px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100';
        bubbleEl.textContent = content.trim();
        
        messageContainer.appendChild(bubbleEl);
        messageRow.appendChild(messageContainer);
      }
      
      rowEl.appendChild(messageRow);
      
      // Timestamp below message
      const timeEl = document.createElement('div');
      const time = timestamp ? new Date(timestamp) : new Date();
      timeEl.className = type === 'user' ? 'text-right text-xs text-gray-500 dark:text-gray-400 mt-1 mr-2' : 'text-left text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2';
      timeEl.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      rowEl.appendChild(timeEl);
      
      messagesEl.appendChild(rowEl);
      // Small delay to ensure DOM update completes
      setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 10);
      return rowEl;
    }
    
    function showThinking() {
      if (thinkingIndicator) return;
      
      const wrapperEl = document.createElement('div');
      wrapperEl.className = 'flex justify-start mb-4';
      
      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'max-w-[85%] sm:max-w-[70%] px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100';
      bubbleEl.innerHTML = '<span class="mr-2">Claude is thinking</span><span class="thinking-dots"><span></span><span></span><span></span></span>';
      
      wrapperEl.appendChild(bubbleEl);
      thinkingIndicator = wrapperEl;
      messagesEl.appendChild(thinkingIndicator);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    
    function hideThinking() {
      if (thinkingIndicator) {
        thinkingIndicator.remove();
        thinkingIndicator = null;
      }
    }
    
    function updateOrCreateMessage(messageId, content, role, append = false) {
      let messageData = messages.get(messageId);
      
      if (!messageData) {
        // Create new message entry
        messageData = { wrapper: null, container: null, bubble: null, timeEl: null, role: role, text: content || '' };
        messages.set(messageId, messageData);
      } else {
        // Update existing entry
        if (role) messageData.role = role;
        if (content) {
          if (append) {
            messageData.text = (messageData.text || '') + content;
          } else {
            messageData.text = content;
          }
        }
      }
      
      // Only create/update DOM element for assistant messages
      if (messageData.role === 'assistant') {
        // Hide thinking indicator when assistant starts responding
        hideThinking();
        
        if (!messageData.wrapper) {
          // Create wrapper for message and timestamp
          messageData.wrapper = document.createElement('div');
          messageData.wrapper.className = 'flex flex-col mb-4';
          
          // Create message row
          messageData.container = document.createElement('div');
          messageData.container.className = 'flex justify-start';
          
          messageData.bubble = document.createElement('div');
          messageData.bubble.className = 'message-bubble max-w-[85%] sm:max-w-[70%] px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100';
          
          messageData.container.appendChild(messageData.bubble);
          messageData.wrapper.appendChild(messageData.container);
          
          // Add timestamp
          messageData.timeEl = document.createElement('div');
          messageData.timeEl.className = 'text-left text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2';
          const now = new Date();
          messageData.timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          messageData.wrapper.appendChild(messageData.timeEl);
          
          messagesEl.appendChild(messageData.wrapper);
        }
        
        // Update content with markdown rendering
        if (messageData.text && messageData.bubble) {
          try {
            const rawHtml = marked.parse(messageData.text);
            const cleanHtml = DOMPurify.sanitize(rawHtml);
            messageData.bubble.innerHTML = cleanHtml;
          } catch (e) {
            console.error('Markdown parsing error:', e);
            messageData.bubble.textContent = messageData.text;
          }
        }
        
        // Ensure scrolling after update
        setTimeout(() => {
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 10);
      } else if (messageData.role === 'user' && messageData.wrapper) {
        // If we mistakenly created an element for a user message, remove it
        messageData.wrapper.remove();
        messageData.wrapper = null;
        messageData.container = null;
        messageData.bubble = null;
        messageData.timeEl = null;
      }
      
      return messageData;
    }
    
    function connectSSE() {
      // Prevent multiple connections
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        console.log('SSE already connected, skipping reconnect');
        return;
      }
      
      if (eventSource) eventSource.close();
      
      eventSource = new EventSource('/stream?sessionId=' + sessionId);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Handle different event types
        if (data.type === 'message.updated') {
          const info = data.properties.info;
          console.log('message.updated:', info.role, 'sessionID:', info.sessionID, 'our session:', sessionId);
          
          // Update context usage if available
          if (info.tokens) {
            const total = (info.tokens.input || 0) + (info.tokens.output || 0);
            const percent = Math.round((total / 200000) * 100); // Opus has 200k context
            document.getElementById('contextUsage').textContent = (total/1000).toFixed(1) + 'K/' + percent + '%';
          }
          // Update cost if available
          if (info.cost !== undefined) {
            document.getElementById('cost').textContent = '$' + info.cost.toFixed(2);
          }
          // Update model selector if model changed
          if (info.modelID) {
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect && modelSelect.querySelector('option[value="' + info.modelID + '"]')) {
              modelSelect.value = info.modelID;
            }
          }
          // Only process our session's messages
          if (info.sessionID !== sessionId) return;
          
          // Update message with role information
          const messageData = updateOrCreateMessage(info.id, null, info.role);
          
          // If assistant message is complete, remove streaming indicator
          if (info.role === 'assistant' && messageData.element) {
            messageData.element.className = 'message assistant';
          }
        } else if (data.type === 'message.part.updated') {
          const part = data.properties.part;
          
          // Only process if it's for OUR session
          if (part.sessionID !== sessionId) return;
          
          if (part.type === 'text' && part.text) {
            console.log('Text chunk:', part.text.substring(0, 50) + '...', 'Total length:', part.text.length);
            // Update or create message with text content
            // Role might not be known yet, will be updated when message.updated arrives
            updateOrCreateMessage(part.messageID, part.text, null);
          } else if (part.type === 'tool_use') {
            console.log('Tool use:', part.name, 'id:', part.id);
            // Add tool use to the message
            const toolContent = '\\n\\n🔧 **Tool: ' + part.name + '**\\n' + String.fromCharCode(96,96,96) + 'json\\n' + JSON.stringify(part.input, null, 2) + '\\n' + String.fromCharCode(96,96,96) + '\\n';
            updateOrCreateMessage(part.messageID, toolContent, null, true); // append mode
          } else if (part.type === 'tool_result') {
            console.log('Tool result for:', part.tool_use_id);
            // Add tool result to the message
            let resultContent = '\\n📤 **Result:**\\n';
            if (part.output) {
              const output = part.output.substring(0, 1000);
              const truncated = part.output.length > 1000 ? '...' : '';
              resultContent += String.fromCharCode(96,96,96) + '\\n' + output + truncated + '\\n' + String.fromCharCode(96,96,96) + '\\n';
            } else if (part.error) {
              resultContent += '❌ Error: ' + part.error + '\\n';
            }
            updateOrCreateMessage(part.messageID, resultContent, null, true); // append mode
          }
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
      };
    }
    
    function setLoading(loading) {
      isLoading = loading;
      buttonEl.disabled = loading;
      inputEl.disabled = loading;
      
      if (loading) {
        buttonEl.innerHTML = '<span class="loading"></span>';
      } else {
        buttonEl.textContent = 'Send';
      }
    }
    
    async function sendMessage() {
      const message = inputEl.value.trim();
      if (!message || isLoading) return;
      
      // Check if model is selected
      const modelSelect = document.getElementById('modelSelect');
      const selectedModel = modelSelect?.value;
      if (!selectedModel) {
        alert('Please select a model first');
        return;
      }
      
      // Add user message (already trimmed above)
      addMessage(message, 'user');
      inputEl.value = '';
      
      // Show thinking indicator
      showThinking();
      
      setLoading(true);
      
      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message,
            sessionId,
            modelId: selectedModel,
            agent: document.getElementById('agentSelect')?.value || 'build'
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to send message');
        }
        
        const data = await response.json();
        
        // Update session ID and connect SSE if new session
        if (data.sessionId && data.sessionId !== sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('opencodeSessionId', sessionId);
          // Session loaded
          connectSSE();
        }
        
        // Response will come through SSE, not from the chat endpoint
        
      } catch (error) {
        console.error('Error:', error);
        hideThinking();
        addMessage('Error: ' + error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  </script>
</body>
</html>`;

// Proxy server
serve({
  port: 3000,
  idleTimeout: 120,  // 2 minutes timeout for long responses
  
  async fetch(req) {
    const url = new URL(req.url);
    
    // Serve HTML
    if (url.pathname === "/") {
      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }
    
    // Debug endpoint
    if (url.pathname === "/debug") {
      const debugInfo = {
        providers: null,
        agents: null,
        sessions: null,
        errors: []
      };
      
      try {
        const providersRes = await fetch(`${OPENCODE_URL}/config/providers`);
        debugInfo.providers = await providersRes.json();
      } catch (e) {
        debugInfo.errors.push(`Providers: ${e.message}`);
      }
      
      try {
        const agentsRes = await fetch(`${OPENCODE_URL}/agent`);
        debugInfo.agents = await agentsRes.json();
      } catch (e) {
        debugInfo.errors.push(`Agents: ${e.message}`);
      }
      
      try {
        const sessionsRes = await fetch(`${OPENCODE_URL}/session`);
        debugInfo.sessions = await sessionsRes.json();
      } catch (e) {
        debugInfo.errors.push(`Sessions: ${e.message}`);
      }
      
      return Response.json(debugInfo);
    }
    
    // Proxy config/providers endpoint
    if (url.pathname === "/config/providers") {
      const response = await fetch(`${OPENCODE_URL}/config/providers`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Proxy agent endpoint
    if (url.pathname === "/agent") {
      const response = await fetch(`${OPENCODE_URL}/agent`);
      return new Response(await response.text(), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // History endpoint
    if (url.pathname === "/history") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response("Session ID required", { status: 400 });
      }
      
      try {
        const response = await fetch(`${OPENCODE_URL}/session/${sessionId}/message`);
        if (!response.ok) {
          return new Response("Failed to load history", { status: 500 });
        }
        
        const messages = await response.json();
        return Response.json(messages);
      } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
    
    // SSE endpoint for streaming
    if (url.pathname === "/stream") {
      const sessionId = url.searchParams.get("sessionId");
      console.log("SSE stream requested for session:", sessionId);
      if (!sessionId) {
        return new Response("Session ID required", { status: 400 });
      }
      
      // Simple SSE proxy - just forward all events for now
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          // Send keepalive every 30 seconds
          const keepalive = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(':keepalive\\n\\n'));
            } catch (e) {
              // Controller closed, stop keepalive
              clearInterval(keepalive);
            }
          }, 30000);
          
          try {
            console.log("Connecting to OpenCode SSE endpoint...");
            const res = await fetch(`${OPENCODE_URL}/event`);
            console.log("OpenCode SSE response status:", res.status);
            const reader = res.body?.getReader();
            if (!reader) {
              clearInterval(keepalive);
              throw new Error("No reader");
            }
            
            const decoder = new TextDecoder();
            let buffer = '';
            
            let eventCount = 0;
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                console.log("SSE stream ended");
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              
              // Keep last incomplete line in buffer
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  eventCount++;
                  if (eventCount <= 5) {
                    console.log("SSE event", eventCount, ":", line.substring(0, 100));
                  }
                  try {
                    const data = JSON.parse(line.slice(6));
                    // Filter for this session
                    if (data.properties?.part?.sessionID === sessionId ||
                        data.properties?.info?.sessionID === sessionId) {
                      controller.enqueue(encoder.encode(line + '\n\n'));
                    }
                  } catch (e) {
                    // Not JSON, forward as-is if it's a heartbeat
                    if (line === 'data: {"type":"server.connected","properties":{}}') {
                      controller.enqueue(encoder.encode(line + '\n\n'));
                    }
                  }
                }
              }
            }
            clearInterval(keepalive);
          } catch (error) {
            console.error("SSE stream error:", error);
            clearInterval(keepalive);
            controller.close();
          }
        }
      });
      
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }
    
    // Handle chat endpoint
    if (url.pathname === "/chat" && req.method === "POST") {
      try {
        const body = await req.json();
        const { message, sessionId, agent, modelId } = body;
        
        // Create or reuse session
        let currentSessionId = sessionId;
        
        if (!currentSessionId) {
          // Create new session
          const sessionRes = await fetch(`${OPENCODE_URL}/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          
          if (!sessionRes.ok) {
            throw new Error("Failed to create session");
          }
          
          const sessionData = await sessionRes.json();
          currentSessionId = sessionData.id;
        }
        
        // Get current agent/mode setting from request (default to build)
        const currentAgent = agent || 'build';
        
        // Use the model selected by the user, fallback to Opus 4.1
        const currentModelId = modelId || 'claude-opus-4-1-20250805';
        
        // Generate a message ID similar to OpenCode's format
        // Format: msg_<timestamp_hex><random>
        const timestamp = Date.now();
        const timestampHex = (timestamp * 0x1000).toString(16).padStart(12, '0');
        const randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let random = '';
        for (let i = 0; i < 14; i++) {
          random += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
        }
        const messageId = `msg_${timestampHex}${random}`;
        
        // Send message to OpenCode (fire and forget - response comes via SSE)
        fetch(`${OPENCODE_URL}/session/${currentSessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerID: "anthropic",
            modelID: currentModelId,
            agent: currentAgent,
            messageID: messageId,
            parts: [
              {
                type: "text",
                text: message
              }
            ]
          })
        }).then(res => {
          if (!res.ok) {
            console.error("OpenCode message send failed:", res.status, "for model:", currentModelId);
          }
        }).catch(err => {
          console.error("Failed to send message:", err);
        });
        
        // Return immediately - response will come through SSE
        return Response.json({
          sessionId: currentSessionId,
          streaming: true
        });
        
      } catch (error) {
        console.error("Chat error:", error);
        return Response.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }
    
    return new Response("Not found", { status: 404 });
  }
});

console.log("OpenCode Chat server running on http://localhost:3000");
console.log("Make sure OpenCode server is running on port 4096");