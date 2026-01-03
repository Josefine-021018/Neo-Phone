// 全局变量和配置
let currentScreen = 'home-screen';
let currentChatId = null;
let currentMessageSelection = [];
let isSelectionMode = false;
let apiConfig = {
  proxyUrl: '', // 注意：此字段现在被用作 Minimax Group ID
  apiKey: '',
  model: 'abab5.5-chat', // 默认模型
  temperature: 0.8,
  enableBackgroundActivity: false,
  backgroundInterval: 60,
  enableAIDrawing: true
};

let userSettings = {
  language: 'zh-CN',
  theme: 'light',
  wallpaper: '',
  globalBackground: '',
  notificationSound: '',
  fontUrl: ''
};

let worldBooks = [];
let categories = ['默认', '小说', '设定', '知识', '备忘'];
let stickers = {};
let stickerCategories = ['默认', '可爱', '搞笑', '动物', '表情'];
let contacts = [];
let chats = [];
let currentGroupMembers = [];
let currentReplyTo = null;

// 数据库初始化
const db = new Dexie('MyPhoneDB');
db.version(1).stores({
  chats: '++id, name, avatar, lastMessage, timestamp, isGroup, members',
  messages: '++id, chatId, sender, content, timestamp, type, isRead',
  worldBooks: '++id, name, category, content, createdAt, updatedAt',
  stickers: '++id, category, url, name, addedAt',
  contacts: '++id, name, avatar, persona, createdAt',
  settings: 'key, value',
  files: '++id, name, type, size, data, addedAt'
});

// DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // iOS全屏适配初始化
  initIOSFullscreen();
  
  initApp();
  updateTime();
  setInterval(updateTime, 60000); // 每分钟更新一次时间
});

// iOS全屏适配初始化 (已修改：修复滑动问题)
function initIOSFullscreen() {
  // 检测iOS设备
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
    document.documentElement.classList.add('ios-device');
    
    // 设置viewport meta标签
    let viewport = document.querySelector('meta[name=viewport]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    
    // 防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    // 处理键盘弹出时的布局问题
    let originalHeight = window.innerHeight;
    
    window.addEventListener('resize', function() {
      const currentHeight = window.innerHeight;
      const isKeyboardVisible = currentHeight < originalHeight;
      
      if (isKeyboardVisible) {
        // 键盘弹出时，调整聊天输入区域
        const chatInputArea = document.getElementById('chat-input-area');
        if (chatInputArea && currentScreen === 'chat-interface-screen') {
          chatInputArea.style.paddingBottom = 'env(safe-area-inset-bottom, 20px)';
        }
      } else {
        // 键盘隐藏时，恢复原状
        const chatInputArea = document.getElementById('chat-input-area');
        if (chatInputArea) {
          chatInputArea.style.paddingBottom = '';
        }
      }
    });
    
    // ============================================================
    // 【关键修复】处理iOS橡皮筋效果（弹性滚动）
    // 修改逻辑：检查元素本身或其父级是否有 data-scrollable="true"
    // ============================================================
    document.addEventListener('touchmove', function(event) {
      const target = event.target;
      // 检查当前触摸目标是否在“允许滚动”的容器内
      const scrollable = target.closest('[data-scrollable="true"]');
      
      if (!scrollable && target === document.body) {
        // 如果不在可滚动区域内，阻止默认拖动（防止整个网页被拖动）
        event.preventDefault();
      } else {
        // 如果在可滚动区域内，允许由于冒泡产生的滚动，但要防止 body 滚动
        event.stopPropagation(); 
      }
    }, { passive: false });
    
    // 设置安全区域变量
    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
    document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
    document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
    
    // 调整状态栏高度
    document.documentElement.style.setProperty('--status-bar-height', 'calc(30px + env(safe-area-inset-top, 0px))');
    
    // 调整底部Dock位置
    document.documentElement.style.setProperty('--dock-height', 'calc(80px + env(safe-area-inset-bottom, 0px))');
    
    // 强制重绘以应用CSS变量
    document.body.style.visibility = 'hidden';
    setTimeout(() => {
      document.body.style.visibility = 'visible';
    }, 10);
    
    console.log('iOS全屏适配已启用');
  }
  
  // 所有设备通用的全屏优化
  // 防止页面滚动
  document.addEventListener('touchmove', function(e) {
    if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT' && e.target.contentEditable !== 'true') {
      const scrollable = e.target.closest('[data-scrollable]');
      if (!scrollable) {
        e.preventDefault();
      }
    }
  }, { passive: false });
  
  // 改善点击响应
  document.addEventListener('touchstart', function() {}, { passive: true });
  
  // 防止长按菜单
  document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  });
}

// 应用初始化
async function initApp() {
  try {
    // 从数据库加载数据
    await loadSettings();
    await loadWorldBooks();
    await loadStickers();
    await loadContacts();
    await loadChats();
    
    // 初始化UI
    initHomeScreen();
    initChatList();
    initWorldBookScreen();
    initSettingsScreen();
    initChatInterface();
    
    // 应用主题
    applyTheme();
    
    // 设置事件监听器
    setupEventListeners();
    
    console.log('应用初始化完成');
  } catch (error) {
    console.error('初始化失败:', error);
    showAlert('初始化失败', '请刷新页面重试');
  }
}

// 时间更新
function updateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  });
  
  // 更新所有时间显示
  const timeElements = document.querySelectorAll('#status-bar-time, #char-main-time');
  timeElements.forEach(el => {
    if (el) el.textContent = timeStr;
  });
  
  const dateElement = document.getElementById('char-main-date');
  if (dateElement) dateElement.textContent = dateStr;
  
  // 更新电池状态
  updateBatteryStatus();
}

// 电池状态
function updateBatteryStatus() {
  if (navigator.getBattery) {
    navigator.getBattery().then(battery => {
      const level = Math.round(battery.level * 100);
      const isCharging = battery.charging;
      
      const batteryText = document.querySelector('.battery-text');
      const batteryLevel = document.querySelector('.battery-level');
      
      if (batteryText) batteryText.textContent = `${level}%`;
      if (batteryLevel) {
        batteryLevel.style.width = `${level}%`;
        batteryLevel.style.backgroundColor = isCharging ? '#4cd964' : 
          level > 20 ? '#4cd964' : '#ff3b30';
      }
    });
  } else {
    // 模拟电池状态
    const level = 85;
    const batteryText = document.querySelector('.battery-text');
    const batteryLevel = document.querySelector('.battery-level');
    
    if (batteryText) batteryText.textContent = `${level}%`;
    if (batteryLevel) {
      batteryLevel.style.width = `${level}%`;
      batteryLevel.style.backgroundColor = '#4cd964';
    }
  }
}

// 屏幕切换
function showScreen(screenId, params = {}) {
  if (screenId === currentScreen) return;
  
  const currentScreenEl = document.getElementById(currentScreen);
  const targetScreenEl = document.getElementById(screenId);
  
  if (!targetScreenEl) {
    console.error('找不到屏幕:', screenId);
    return;
  }
  
  // 离开当前屏幕
  if (currentScreenEl) {
    currentScreenEl.classList.remove('active');
    currentScreenEl.classList.add('exit');
    
    // 触发离开事件
    if (window[`on${currentScreen.replace('-screen', '').replace(/-/g, '')}Leave`]) {
      window[`on${currentScreen.replace('-screen', '').replace(/-/g, '')}Leave`]();
    }
  }
  
  // 进入新屏幕
  targetScreenEl.classList.remove('exit');
  targetScreenEl.classList.add('active');
  
  // 触发进入事件
  if (window[`on${screenId.replace('-screen', '').replace(/-/g, '')}Enter`]) {
    window[`on${screenId.replace('--screen', '').replace(/-/g, '')}Enter`](params);
  }
  
  currentScreen = screenId;
  
  // 更新URL hash（可选）
  window.location.hash = screenId;
  
  // iOS特定处理：确保屏幕正确显示
  if (document.documentElement.classList.contains('ios-device')) {
    // 强制重绘
    setTimeout(() => {
      targetScreenEl.style.transform = 'translateZ(0)';
    }, 10);
  }
}

// 返回上一屏幕
function goBack() {
  const history = ['home-screen', 'chat-list-screen', 'chat-interface-screen'];
  const currentIndex = history.indexOf(currentScreen);
  
  if (currentIndex > 0) {
    showScreen(history[currentIndex - 1]);
  } else {
    showScreen('home-screen');
  }
}

// 初始化主屏幕
function initHomeScreen() {
  // iOS特定：调整主页布局
  if (document.documentElement.classList.contains('ios-device')) {
    const homeScreen = document.getElementById('home-screen');
    if (homeScreen) {
      homeScreen.style.paddingTop = 'calc(var(--status-bar-height) + env(safe-area-inset-top, 0px))';
      homeScreen.style.paddingBottom = 'calc(var(--dock-height) + env(safe-area-inset-bottom, 0px))';
    }
  }
  
  // 设置可编辑文本的点击事件
  document.querySelectorAll('.editable-text').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.detail === 3) { // 三击编辑
        const currentText = this.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.cssText = `
          width: 100%;
          padding: 5px;
          border: 2px solid var(--accent-color);
          border-radius: 4px;
          font-size: inherit;
          font-family: inherit;
        `;
        
        this.textContent = '';
        this.appendChild(input);
        input.focus();
        input.select();
        
        input.addEventListener('blur', function() {
          const parent = this.parentElement;
          parent.textContent = this.value || currentText;
          saveEditableText(parent.id, parent.textContent);
        });
        
        input.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
            this.blur();
          }
        });
      }
    });
  });
  
  // 设置可编辑图片的点击事件
  document.querySelectorAll('.editable-image').forEach(el => {
    el.addEventListener('click', function(e) {
      if (e.detail === 3) { // 三击编辑
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
              const img = document.getElementById(el.id);
              img.src = e.target.result;
              saveEditableImage(el.id, e.target.result);
            };
            reader.readAsDataURL(file);
          }
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
      }
    });
  });
}

// 保存可编辑文本
function saveEditableText(elementId, text) {
  // 这里可以保存到数据库或localStorage
  localStorage.setItem(`home_${elementId}`, text);
}

// 保存可编辑图片
function saveEditableImage(elementId, dataUrl) {
  // 这里可以保存到数据库
  localStorage.setItem(`home_${elementId}`, dataUrl);
}

// 加载设置
async function loadSettings() {
  try {
    const savedSettings = await db.settings.get('userSettings');
    if (savedSettings) {
      userSettings = { ...userSettings, ...savedSettings.value };
    }
    
    const savedApiConfig = await db.settings.get('apiConfig');
    if (savedApiConfig) {
      apiConfig = { ...apiConfig, ...savedApiConfig.value };
    }
    
    // 应用到UI
    applySettings();
  } catch (error) {
    console.error('加载设置失败:', error);
  }
}

// 保存设置
async function saveSettings() {
  try {
    await db.settings.put({ key: 'userSettings', value: userSettings });
    await db.settings.put({ key: 'apiConfig', value: apiConfig });
    console.log('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

// 应用设置
function applySettings() {
  // 应用主题
  document.documentElement.setAttribute('data-theme', userSettings.theme);
  
  // 应用壁纸
  if (userSettings.wallpaper) {
    document.getElementById('home-screen').style.backgroundImage = `url(${userSettings.wallpaper})`;
    document.getElementById('home-screen').style.backgroundSize = 'cover';
    document.getElementById('home-screen').style.backgroundPosition = 'center';
  }
  
  // 应用字体
  if (userSettings.fontUrl) {
    const fontFace = new FontFace('CustomFont', `url(${userSettings.fontUrl})`);
    fontFace.load().then(function(loadedFace) {
      document.fonts.add(loadedFace);
      document.body.style.fontFamily = 'CustomFont, sans-serif';
    }).catch(function(error) {
      console.error('字体加载失败:', error);
    });
  }
  
  // 应用语言
  applyLanguage(userSettings.language);
}

// 应用语言
function applyLanguage(lang) {
  // 这里可以实现多语言切换
  // 目前只设置一个占位符
  const elements = document.querySelectorAll('[data-lang-key]');
  elements.forEach(el => {
    const key = el.getAttribute('data-lang-key');
    // 实际项目中这里会有翻译字典
    el.textContent = key;
  });
}

// 应用主题
function applyTheme() {
  if (userSettings.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// 初始化聊天列表
async function initChatList() {
  await loadChatList();
  setupChatListEvents();
}

// 加载聊天列表
async function loadChatList() {
  try {
    chats = await db.chats.orderBy('timestamp').reverse().toArray();
    renderChatList();
  } catch (error) {
    console.error('加载聊天列表失败:', error);
  }
}

// 渲染聊天列表
function renderChatList() {
  const chatList = document.getElementById('chat-list');
  if (!chatList) return;
  
  chatList.innerHTML = '';
  
  if (chats.length === 0) {
    chatList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-text">还没有聊天记录<br>点击右上角 + 号开始聊天</div>
      </div>
    `;
    return;
  }
  
  chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.chatId = chat.id;
    
    const lastMessage = chat.lastMessage || '开始聊天吧！';
    const time = formatTime(chat.timestamp || Date.now());
    
    chatItem.innerHTML = `
      <img class="chat-avatar" src="${chat.avatar || 'https://i.postimg.cc/y8xWzCqj/anime-boy.jpg'}" alt="${chat.name}">
      <div class="chat-info">
        <div class="chat-name">${chat.name}</div>
        <div class="chat-preview">${lastMessage}</div>
      </div>
      <div class="chat-time">${time}</div>
    `;
    
    chatItem.addEventListener('click', () => openChat(chat.id));
    chatList.appendChild(chatItem);
  });
}

// 初始化聊天界面
function initChatInterface() {
  setupChatEvents();
}

// 打开聊天
async function openChat(chatId) {
  currentChatId = chatId;
  const chat = chats.find(c => c.id === chatId);
  
  if (!chat) {
    console.error('找不到聊天:', chatId);
    return;
  }
  
  // 设置聊天标题
  const titleElement = document.getElementById('chat-header-title');
  if (titleElement) {
    titleElement.textContent = chat.name;
  }
  
  // 加载聊天消息
  await loadChatMessages(chatId);
  
  // 切换到聊天界面
  showScreen('chat-interface-screen', { chatId });
}

// 加载聊天消息
async function loadChatMessages(chatId) {
  try {
    const messages = await db.messages
      .where('chatId')
      .equals(chatId)
      .sortBy('timestamp');
    
    renderMessages(messages);
  } catch (error) {
    console.error('加载消息失败:', error);
  }
}

// 渲染消息
function renderMessages(messages) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  chatMessages.innerHTML = '';
  
  if (messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-state" style="height: 100%; justify-content: center;">
        <div class="empty-state-text">还没有消息<br>发送第一条消息开始聊天吧！</div>
      </div>
    `;
    return;
  }
  
  messages.forEach(msg => {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${msg.sender === 'user' ? 'user' : 'ai'}`;
    
    const time = formatTime(msg.timestamp, 'HH:mm');
    
    messageContainer.innerHTML = `
      <div class="message-bubble">
        <div class="content">${escapeHtml(msg.content)}</div>
      </div>
      <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageContainer);
  });
  
  // 滚动到底部
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
}

// 发送消息
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message || !currentChatId) return;
  
  // 清空输入框
  input.value = '';
  input.style.height = 'auto';
  
  // 保存用户消息
  const userMessage = {
    chatId: currentChatId,
    sender: 'user',
    content: message,
    timestamp: Date.now(),
    type: 'text',
    isRead: true
  };
  
  await db.messages.add(userMessage);
  
  // 更新聊天最后消息
  await db.chats.update(currentChatId, {
    lastMessage: message,
    timestamp: Date.now()
  });
  
  // 重新加载消息
  await loadChatMessages(currentChatId);
  
  // 显示AI回复指示器
  showTypingIndicator();
  
  // 发送到AI
  await generateAIResponse(message);
}

// 显示打字指示器
function showTypingIndicator() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.style.display = 'block';
  }
  
  // 滚动到底部
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 隐藏打字指示器
function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.style.display = 'none';
  }
}

// ============================================================
// 【关键修改】真实 API 调用函数 (替换了原有的假回复逻辑)
// ============================================================
async function generateAIResponse(userMessage) {
  hideTypingIndicator();

  // 1. 检查 API Key 是否存在
  if (!apiConfig.apiKey) {
    const errorMsg = "⚠️ 请先点击主页[设置]图标，填写 Minimax API Key 和 Group ID 后再使用。";
    await db.messages.add({
      chatId: currentChatId,
      sender: 'ai',
      content: errorMsg,
      timestamp: Date.now(),
      type: 'text',
      isRead: false
    });
    await loadChatMessages(currentChatId);
    return;
  }

  // 2. 准备参数
  // 约定：apiConfig.proxyUrl 字段存储的是 Minimax 的 Group ID
  const groupId = apiConfig.proxyUrl; 
  if (!groupId) {
    const errorMsg = "⚠️ Group ID 为空，请在设置中的[Group ID]栏填写。";
    await db.messages.add({
      chatId: currentChatId,
      sender: 'ai',
      content: errorMsg,
      timestamp: Date.now(),
      type: 'text',
      isRead: false
    });
    await loadChatMessages(currentChatId);
    return;
  }

  // Minimax API 地址
  const url = `https://api.minimax.chat/v1/text/chatcompletion_pro?GroupId=${groupId}`;

  try {
    // 3. 发送 Fetch 请求
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: apiConfig.model || "abab5.5-chat",
        messages: [
          { sender_type: "USER", sender_name: "用户", text: userMessage }
        ],
        bot_setting: [
          {
            bot_name: "智能助手",
            content: "你是一个智能手机助手，回复请简短自然，像朋友一样聊天。"
          }
        ],
        reply_constraints: { sender_type: "BOT", sender_name: "智能助手" }
      })
    });

    const data = await response.json();
    
    // 4. 解析回复
    let aiText = "AI 无回复";
    if (data.reply) {
        aiText = data.reply;
    } else if (data.choices && data.choices.length > 0) {
        aiText = data.choices[0].messages[0].text;
    } else if (data.base_resp && data.base_resp.status_code !== 0) {
        aiText = `API Error: ${data.base_resp.status_msg}`;
    }

    // 5. 保存 AI 回复到数据库
    const aiMessage = {
      chatId: currentChatId,
      sender: 'ai',
      content: aiText,
      timestamp: Date.now(),
      type: 'text',
      isRead: false
    };

    await db.messages.add(aiMessage);
    await db.chats.update(currentChatId, {
      lastMessage: aiText,
      timestamp: Date.now()
    });
    await loadChatMessages(currentChatId);
    
    // 播放提示音
    if (userSettings.notificationSound) playNotificationSound();

    // 6. 触发语音朗读 (TTS)
    playTTS(aiText, groupId, apiConfig.apiKey);

  } catch (error) {
    console.error("API请求失败", error);
    await db.messages.add({
      chatId: currentChatId,
      sender: 'ai',
      content: `网络请求失败: ${error.message} (请检查跨域设置或网络连接)`,
      timestamp: Date.now(),
      type: 'text',
      isRead: true
    });
    await loadChatMessages(currentChatId);
  }
}

// ============================================================
// 【新增】TTS 语音播放函数
// ============================================================
async function playTTS(text, groupId, apiKey) {
    try {
        const res = await fetch(`https://api.minimax.chat/v1/text_to_speech?GroupId=${groupId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                voice_id: "male-qn-qingse", // 默认音色，可改为其他ID
                text: text,
                model: "speech-01"
            })
        });
        
        if (!res.ok) throw new Error("TTS请求失败");

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = document.getElementById('tts-audio-player');
        if (audio) {
            audio.src = audioUrl;
            audio.play().catch(e => console.log("播放失败(需用户交互):", e));
        }
    } catch (e) {
        console.error("TTS失败", e);
    }
}

// 播放通知声音
function playNotificationSound() {
  const audio = document.getElementById('notification-sound-player');
  if (audio && userSettings.notificationSound) {
    audio.src = userSettings.notificationSound;
    audio.play().catch(e => console.error('播放声音失败:', e));
  }
}

// 初始化世界书屏幕
function initWorldBookScreen() {
  renderWorldBookTabs();
  renderWorldBookList();
  setupWorldBookEvents();
}

// 渲染世界书标签
function renderWorldBookTabs() {
  const tabsContainer = document.getElementById('world-book-tabs');
  if (!tabsContainer) return;
  
  tabsContainer.innerHTML = '';
  
  // 添加"全部"标签
  const allTab = document.createElement('div');
  allTab.className = 'world-book-tab active';
  allTab.textContent = '全部';
  allTab.dataset.category = 'all';
  allTab.addEventListener('click', () => filterWorldBooks('all'));
  tabsContainer.appendChild(allTab);
  
  // 添加分类标签
  categories.forEach(category => {
    const tab = document.createElement('div');
    tab.className = 'world-book-tab';
    tab.textContent = category;
    tab.dataset.category = category;
    tab.addEventListener('click', () => filterWorldBooks(category));
    tabsContainer.appendChild(tab);
  });
}

// 加载世界书
async function loadWorldBooks() {
  try {
    worldBooks = await db.worldBooks.orderBy('updatedAt').reverse().toArray();
  } catch (error) {
    console.error('加载世界书失败:', error);
    worldBooks = [];
  }
}

// 渲染世界书列表
function renderWorldBookList(category = 'all') {
  const container = document.getElementById('world-book-content-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  const filteredBooks = category === 'all' 
    ? worldBooks 
    : worldBooks.filter(book => book.category === category);
  
  if (filteredBooks.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-text">还没有世界书<br>点击右上角 + 号创建</div>
      </div>
    `;
    return;
  }
  
  filteredBooks.forEach(book => {
    const card = document.createElement('div');
    card.className = 'world-book-card';
    card.dataset.bookId = book.id;
    
    const preview = book.content ? 
      (typeof book.content === 'string' ? book.content.substring(0, 100) + '...' : '') 
      : '暂无内容';
    
    card.innerHTML = `
      <h3>${escapeHtml(book.name)}</h3>
      <p>${escapeHtml(preview)}</p>
      <span class="category">${escapeHtml(book.category)}</span>
    `;
    
    card.addEventListener('click', () => openWorldBookEditor(book.id));
    container.appendChild(card);
  });
}

// 过滤世界书
function filterWorldBooks(category) {
  // 更新标签状态
  document.querySelectorAll('.world-book-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });
  
  // 渲染列表
  renderWorldBookList(category);
}

// 打开世界书编辑器
function openWorldBookEditor(bookId = null) {
  if (bookId) {
    // 编辑现有世界书
    const book = worldBooks.find(b => b.id === bookId);
    if (book) {
      document.getElementById('world-book-editor-title').textContent = '编辑世界书';
      document.getElementById('world-book-name-input').value = book.name;
      
      // 选择分类
      const categorySelect = document.getElementById('world-book-category-select');
      if (categorySelect) {
        categorySelect.value = book.category;
      }
      
      // 加载条目
      loadWorldBookEntries(book.content);
    }
  } else {
    // 创建新世界书
    document.getElementById('world-book-editor-title').textContent = '新建世界书';
    document.getElementById('world-book-name-input').value = '';
    document.getElementById('world-book-category-select').value = categories[0];
    clearWorldBookEntries();
  }
  
  showScreen('world-book-editor-screen');
}

// 加载世界书条目
function loadWorldBookEntries(content) {
  const container = document.getElementById('world-book-entries-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  let entries = [];
  if (typeof content === 'string') {
    try {
      entries = JSON.parse(content);
    } catch (e) {
      entries = [{ title: '内容', content: content }];
    }
  } else if (Array.isArray(content)) {
    entries = content;
  }
  
  entries.forEach((entry, index) => {
    addWorldBookEntry(entry.title, entry.content, index);
  });
  
  if (entries.length === 0) {
    addWorldBookEntry();
  }
}

// 清空世界书条目
function clearWorldBookEntries() {
  const container = document.getElementById('world-book-entries-container');
  if (container) {
    container.innerHTML = '';
    addWorldBookEntry();
  }
}

// 添加世界书条目
function addWorldBookEntry(title = '', content = '', index = null) {
  const container = document.getElementById('world-book-entries-container');
  if (!container) return;
  
  const entryIndex = index !== null ? index : container.children.length;
  
  const entryDiv = document.createElement('div');
  entryDiv.className = 'world-book-entry';
  entryDiv.style.border = '1px solid var(--border-color)';
  entryDiv.style.borderRadius = 'var(--element-radius)';
  entryDiv.style.padding = '15px';
  entryDiv.style.backgroundColor = 'var(--primary-bg)';
  
  entryDiv.innerHTML = `
    <div class="form-group">
      <input type="text" class="entry-title" placeholder="条目标题" value="${escapeHtml(title)}" style="font-weight: 600;">
    </div>
    <div class="form-group">
      <textarea class="entry-content" placeholder="条目内容..." rows="3">${escapeHtml(content)}</textarea>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button type="button" class="move-entry-up" ${entryIndex === 0 ? 'disabled' : ''}>上移</button>
      <button type="button" class="move-entry-down" ${entryIndex === container.children.length ? 'disabled' : ''}>下移</button>
      <button type="button" class="remove-entry-btn" ${container.children.length <= 1 ? 'disabled' : ''}>删除</button>
    </div>
  `;
  
  // 添加事件监听器
  const removeBtn = entryDiv.querySelector('.remove-entry-btn');
  const moveUpBtn = entryDiv.querySelector('.move-entry-up');
  const moveDownBtn = entryDiv.querySelector('.move-entry-down');
  
  removeBtn.addEventListener('click', () => {
    if (container.children.length > 1) {
      container.removeChild(entryDiv);
    }
  });
  
  moveUpBtn.addEventListener('click', () => {
    if (entryIndex > 0) {
      container.insertBefore(entryDiv, container.children[entryIndex - 1]);
      updateEntryButtons();
    }
  });
  
  moveDownBtn.addEventListener('click', () => {
    if (entryIndex < container.children.length - 1) {
      container.insertBefore(container.children[entryIndex + 1], entryDiv);
      updateEntryButtons();
    }
  });
  
  if (index !== null) {
    container.insertBefore(entryDiv, container.children[index]);
  } else {
    container.appendChild(entryDiv);
  }
  
  updateEntryButtons();
}

// 更新条目按钮状态
function updateEntryButtons() {
  const container = document.getElementById('world-book-entries-container');
  if (!container) return;
  
  const entries = container.querySelectorAll('.world-book-entry');
  entries.forEach((entry, index) => {
    const moveUpBtn = entry.querySelector('.move-entry-up');
    const moveDownBtn = entry.querySelector('.move-entry-down');
    const removeBtn = entry.querySelector('.remove-entry-btn');
    
    moveUpBtn.disabled = index === 0;
    moveDownBtn.disabled = index === entries.length - 1;
    removeBtn.disabled = entries.length <= 1;
  });
}

// 保存世界书
async function saveWorldBook() {
  const nameInput = document.getElementById('world-book-name-input');
  const categorySelect = document.getElementById('world-book-category-select');
  const entriesContainer = document.getElementById('world-book-entries-container');
  
  if (!nameInput || !categorySelect || !entriesContainer) return;
  
  const name = nameInput.value.trim();
  const category = categorySelect.value;
  
  if (!name) {
    showAlert('错误', '请输入世界书名称');
    return;
  }
  
  // 收集条目
  const entries = [];
  const entryElements = entriesContainer.querySelectorAll('.world-book-entry');
  entryElements.forEach(entry => {
    const title = entry.querySelector('.entry-title').value.trim();
    const content = entry.querySelector('.entry-content').value.trim();
    
    if (title || content) {
      entries.push({ title, content });
    }
  });
  
  if (entries.length === 0) {
    showAlert('错误', '请至少添加一个条目');
    return;
  }
  
  const worldBookData = {
    name,
    category,
    content: JSON.stringify(entries),
    updatedAt: Date.now()
  };
  
  try {
    // 检查是新建还是编辑
    const editorTitle = document.getElementById('world-book-editor-title').textContent;
    const isEditing = editorTitle === '编辑世界书';
    
    if (isEditing) {
      // 获取当前编辑的书籍ID（需要从其他地方获取）
      // 这里简化处理，实际应该保存当前编辑的书籍ID
      await db.worldBooks.add({
        ...worldBookData,
        createdAt: Date.now()
      });
    } else {
      await db.worldBooks.add({
        ...worldBookData,
        createdAt: Date.now()
      });
    }
    
    // 重新加载世界书
    await loadWorldBooks();
    
    // 显示成功消息
    showAlert('成功', '世界书已保存');
    
    // 返回世界书列表
    showScreen('world-book-screen');
  } catch (error) {
    console.error('保存世界书失败:', error);
    showAlert('错误', '保存失败，请重试');
  }
}
// 初始化设置屏幕
function initSettingsScreen() {
  loadSettingsForm();
  setupSettingsEvents();
}

// 加载设置表单
function loadSettingsForm() {
  // API设置
  const proxyUrlInput = document.getElementById('proxy-url');
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  const temperatureSlider = document.getElementById('api-temperature-slider');
  const temperatureValue = document.getElementById('api-temperature-value');
  
  if (proxyUrlInput) proxyUrlInput.value = apiConfig.proxyUrl;
  if (apiKeyInput) apiKeyInput.value = apiConfig.apiKey;
  if (temperatureSlider) temperatureSlider.value = apiConfig.temperature;
  if (temperatureValue) temperatureValue.textContent = apiConfig.temperature;
  
  // 语言选择
  const languageSelect = document.getElementById('language-select');
  if (languageSelect) languageSelect.value = userSettings.language;
  
  // 主题切换
  const themeToggle = document.getElementById('theme-toggle-switch');
  if (themeToggle) themeToggle.checked = userSettings.theme === 'dark';
  
  // 温度滑块事件
  if (temperatureSlider) {
    temperatureSlider.addEventListener('input', function() {
      if (temperatureValue) {
        temperatureValue.textContent = this.value;
        apiConfig.temperature = parseFloat(this.value);
      }
    });
  }
}

// 设置事件监听器
function setupSettingsEvents() {
  // 保存设置按钮
  const saveSettingsBtn = document.getElementById('save-api-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveAllSettings);
  }
  
  // 导出数据按钮
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }
  
  // 导入数据按钮
  const importBtn = document.getElementById('import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      document.getElementById('import-data-input').click();
    });
  }
  
  // 导入文件选择
  const importInput = document.getElementById('import-data-input');
  if (importInput) {
    importInput.addEventListener('change', handleImportFile);
  }
  
  // 清理数据按钮
  const cleanupBtn = document.getElementById('cleanup-data-btn');
  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', cleanupData);
  }
  
  // 删除世界书按钮
  const deleteWorldBooksBtn = document.getElementById('delete-world-books-btn');
  if (deleteWorldBooksBtn) {
    deleteWorldBooksBtn.addEventListener('click', showDeleteWorldBooksModal);
  }
  
  // 主题切换
  const themeToggle = document.getElementById('theme-toggle-switch');
  if (themeToggle) {
    themeToggle.addEventListener('change', function() {
      userSettings.theme = this.checked ? 'dark' : 'light';
      applyTheme();
    });
  }
  
  // 状态栏切换
  const statusBarToggle = document.getElementById('status-bar-toggle-switch');
  if (statusBarToggle) {
    statusBarToggle.checked = localStorage.getItem('showStatusBar') !== 'false';
    statusBarToggle.addEventListener('change', function() {
      localStorage.setItem('showStatusBar', this.checked);
      document.getElementById('status-bar').style.display = this.checked ? 'flex' : 'none';
    });
  }
}

// 保存所有设置
async function saveAllSettings() {
  // 收集API设置
  const proxyUrlInput = document.getElementById('proxy-url');
  const apiKeyInput = document.getElementById('api-key');
  const modelSelect = document.getElementById('model-select');
  const languageSelect = document.getElementById('language-select');
  
  if (proxyUrlInput) apiConfig.proxyUrl = proxyUrlInput.value.trim();
  if (apiKeyInput) apiConfig.apiKey = apiKeyInput.value.trim();
  if (modelSelect) apiConfig.model = modelSelect.value;
  if (languageSelect) userSettings.language = languageSelect.value;
  
  // 收集其他设置
  const backgroundActivitySwitch = document.getElementById('background-activity-switch');
  const backgroundIntervalInput = document.getElementById('background-interval-input');
  
  if (backgroundActivitySwitch) {
    apiConfig.enableBackgroundActivity = backgroundActivitySwitch.checked;
  }
  if (backgroundIntervalInput) {
    apiConfig.backgroundInterval = parseInt(backgroundIntervalInput.value) || 60;
  }
  
  // 保存到数据库
  await saveSettings();
  
  // 应用设置
  applySettings();
  
  // 显示成功消息
  showAlert('成功', '设置已保存');
}

// 导出数据
async function exportData() {
  try {
    // 收集所有数据
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      chats: await db.chats.toArray(),
      messages: await db.messages.toArray(),
      worldBooks: await db.worldBooks.toArray(),
      stickers: await db.stickers.toArray(),
      contacts: await db.contacts.toArray(),
      settings: {
        userSettings,
        apiConfig
      }
    };
    
    // 转换为JSON字符串
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // 创建Blob并下载
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myphone-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert('成功', '数据导出完成');
  } catch (error) {
    console.error('导出数据失败:', error);
    showAlert('错误', '导出失败，请重试');
  }
}

// 处理导入文件
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importData = JSON.parse(e.target.result);
      showImportOptionsModal(importData);
    } catch (error) {
      console.error('解析导入文件失败:', error);
      showAlert('错误', '文件格式不正确');
    }
  };
  reader.readAsText(file);
  
  // 清空input以便再次选择同一文件
  event.target.value = '';
}

// 显示导入选项模态框
function showImportOptionsModal(importData) {
  const previewList = document.getElementById('import-preview-list');
  if (!previewList) return;
  
  previewList.innerHTML = '';
  
  // 显示数据统计
  const stats = [];
  if (importData.chats && importData.chats.length > 0) {
    stats.push(`聊天：${importData.chats.length} 个`);
  }
  if (importData.messages && importData.messages.length > 0) {
    stats.push(`消息：${importData.messages.length} 条`);
  }
  if (importData.worldBooks && importData.worldBooks.length > 0) {
    stats.push(`世界书：${importData.worldBooks.length} 本`);
  }
  if (importData.stickers && importData.stickers.length > 0) {
    stats.push(`表情：${importData.stickers.length} 个`);
  }
  if (importData.contacts && importData.contacts.length > 0) {
    stats.push(`联系人：${importData.contacts.length} 个`);
  }
  
  stats.forEach(stat => {
    const li = document.createElement('li');
    li.textContent = stat;
    previewList.appendChild(li);
  });
  
  // 显示模态框
  showModal('import-options-modal');
  
  // 设置按钮事件
  const fullImportBtn = document.getElementById('confirm-full-import-btn');
  const selectiveImportBtn = document.getElementById('confirm-selective-import-btn');
  const cancelBtn = document.getElementById('cancel-import-options-btn');
  
  if (fullImportBtn) {
    fullImportBtn.onclick = () => confirmImport(importData, 'full');
  }
  if (selectiveImportBtn) {
    selectiveImportBtn.onclick = () => showSelectiveImportModal(importData);
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => hideModal('import-options-modal');
  }
}

// 显示选择性导入模态框
function showSelectiveImportModal(importData) {
  const importList = document.getElementById('selective-import-list');
  if (!importList) return;
  
  importList.innerHTML = '';
  
  const dataTypes = [
    { key: 'chats', name: '聊天', count: importData.chats?.length || 0 },
    { key: 'messages', name: '消息', count: importData.messages?.length || 0 },
    { key: 'worldBooks', name: '世界书', count: importData.worldBooks?.length || 0 },
    { key: 'stickers', name: '表情', count: importData.stickers?.length || 0 },
    { key: 'contacts', name: '联系人', count: importData.contacts?.length || 0 },
    { key: 'settings', name: '设置', count: importData.settings ? 1 : 0 }
  ];
  
  dataTypes.forEach(type => {
    if (type.count > 0) {
      const item = document.createElement('div');
      item.className = 'import-type-item';
      item.style.padding = '15px';
      item.style.borderBottom = '1px solid var(--border-color)';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      
      item.innerHTML = `
        <div>
          <strong>${type.name}</strong>
          <div style="font-size: 12px; color: var(--secondary-text);">${type.count} 个</div>
        </div>
        <input type="checkbox" class="import-type-checkbox" data-type="${type.key}" checked>
      `;
      
      importList.appendChild(item);
    }
  });
  
  // 全选功能
  const selectAllCheckbox = document.getElementById('select-all-import-types');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.onchange = function() {
      const checkboxes = importList.querySelectorAll('.import-type-checkbox');
      checkboxes.forEach(cb => cb.checked = this.checked);
    };
  }
  
  // 切换显示模态框
  hideModal('import-options-modal');
  showModal('selective-import-modal');
  
  // 设置按钮事件
  const cancelBtn = document.getElementById('cancel-selective-import-btn');
  const mergeBtn = document.getElementById('confirm-merge-import-btn');
  
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      hideModal('selective-import-modal');
      showModal('import-options-modal');
    };
  }
  
  if (mergeBtn) {
    mergeBtn.onclick = () => confirmImport(importData, 'selective');
  }
}

// 确认导入
async function confirmImport(importData, importType) {
  try {
    // 获取选中的数据类型
    let selectedTypes = [];
    if (importType === 'full') {
      selectedTypes = ['chats', 'messages', 'worldBooks', 'stickers', 'contacts', 'settings'];
    } else {
      const checkboxes = document.querySelectorAll('#selective-import-list .import-type-checkbox:checked');
      selectedTypes = Array.from(checkboxes).map(cb => cb.dataset.type);
    }
    
    // 备份当前数据（如果是完全导入）
    if (importType === 'full') {
      await db.chats.clear();
      await db.messages.clear();
      await db.worldBooks.clear();
      await db.stickers.clear();
      await db.contacts.clear();
    }
    
    // 导入数据
    for (const type of selectedTypes) {
      if (importData[type] && Array.isArray(importData[type])) {
        const table = db.table(type);
        await table.bulkPut(importData[type]);
      } else if (type === 'settings' && importData.settings) {
        // 导入设置
        userSettings = { ...userSettings, ...importData.settings.userSettings };
        apiConfig = { ...apiConfig, ...importData.settings.apiConfig };
        await saveSettings();
        applySettings();
      }
    }
    
    // 重新加载数据
    await loadWorldBooks();
    await loadStickers();
    await loadContacts();
    await loadChats();
    
    // 更新UI
    renderWorldBookList();
    renderChatList();
    
    // 隐藏模态框
    hideModal(importType === 'full' ? 'import-options-modal' : 'selective-import-modal');
    
    showAlert('成功', '数据导入完成');
  } catch (error) {
    console.error('导入数据失败:', error);
    showAlert('错误', '导入失败，请重试');
  }
}

// 清理数据
async function cleanupData() {
  const confirmed = await showConfirmModal('确认清理', '这将删除30天前的聊天记录和未使用的图片，继续吗？');
  if (!confirmed) return;
  
  try {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    // 删除旧消息
    await db.messages.where('timestamp').below(thirtyDaysAgo).delete();
    
    // 删除没有消息的聊天
    const chats = await db.chats.toArray();
    for (const chat of chats) {
      const messages = await db.messages.where('chatId').equals(chat.id).count();
      if (messages === 0) {
        await db.chats.delete(chat.id);
      }
    }
    
    showAlert('成功', '数据清理完成');
  } catch (error) {
    console.error('清理数据失败:', error);
    showAlert('错误', '清理失败，请重试');
  }
}

// 显示删除世界书模态框
function showDeleteWorldBooksModal() {
  const list = document.getElementById('delete-world-books-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  worldBooks.forEach(book => {
    const item = document.createElement('div');
    item.className = 'delete-item';
    item.style.padding = '15px';
    item.style.borderBottom = '1px solid var(--border-color)';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(book.name)}</strong>
        <div style="font-size: 12px; color: var(--secondary-text);">${escapeHtml(book.category)} · ${formatTime(book.updatedAt)}</div>
      </div>
      <input type="checkbox" class="delete-book-checkbox" data-id="${book.id}">
    `;
    
    list.appendChild(item);
  });
  
  // 全选功能
  const selectAllCheckbox = document.getElementById('select-all-world-books-for-clear');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.onchange = function() {
      const checkboxes = list.querySelectorAll('.delete-book-checkbox');
      checkboxes.forEach(cb => cb.checked = this.checked);
    };
  }
  
  // 显示模态框
  showModal('delete-world-books-modal');
  
  // 设置按钮事件
  const cancelBtn = document.getElementById('cancel-delete-world-books-btn');
  const confirmBtn = document.getElementById('confirm-delete-world-books-btn');
  
  if (cancelBtn) {
    cancelBtn.onclick = () => hideModal('delete-world-books-modal');
  }
  
  if (confirmBtn) {
    confirmBtn.onclick = deleteSelectedWorldBooks;
  }
}

// 删除选中的世界书
async function deleteSelectedWorldBooks() {
  try {
    const checkboxes = document.querySelectorAll('#delete-world-books-list .delete-book-checkbox:checked');
    const idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    
    for (const id of idsToDelete) {
      await db.worldBooks.delete(id);
    }
    
    // 重新加载世界书
    await loadWorldBooks();
    renderWorldBookList();
    
    hideModal('delete-world-books-modal');
    showAlert('成功', `已删除 ${idsToDelete.length} 本世界书`);
  } catch (error) {
    console.error('删除世界书失败:', error);
    showAlert('错误', '删除失败，请重试');
  }
}

// 加载表情
async function loadStickers() {
  try {
    const stickersData = await db.stickers.toArray();
    
    // 按分类分组
    stickers = {};
    stickersData.forEach(sticker => {
      if (!stickers[sticker.category]) {
        stickers[sticker.category] = [];
      }
      stickers[sticker.category].push(sticker);
    });
  } catch (error) {
    console.error('加载表情失败:', error);
    stickers = {};
  }
}

// 加载联系人
async function loadContacts() {
  try {
    contacts = await db.contacts.orderBy('createdAt').reverse().toArray();
  } catch (error) {
    console.error('加载联系人失败:', error);
    contacts = [];
  }
}

// 设置聊天事件
function setupChatEvents() {
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const stickerPanelBtn = document.getElementById('open-sticker-panel-btn');
  const closeStickerPanelBtn = document.getElementById('close-sticker-panel-btn');
  const stickerUploadBtn = document.getElementById('upload-sticker-btn');
  const stickerUploadInput = document.getElementById('sticker-upload-input');
  
  // 发送消息事件
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  // 输入框回车发送
  if (chatInput) {
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // 自动调整高度
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    // iOS特定：输入框聚焦时调整布局
    if (document.documentElement.classList.contains('ios-device')) {
      chatInput.addEventListener('focus', function() {
        setTimeout(() => {
          const chatMessages = document.getElementById('chat-messages');
          if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }, 300);
      });
    }
  }
  
  // 表情面板
  if (stickerPanelBtn) {
    stickerPanelBtn.addEventListener('click', toggleStickerPanel);
  }
  
  if (closeStickerPanelBtn) {
    closeStickerPanelBtn.addEventListener('click', toggleStickerPanel);
  }
  
  // 表情上传
  if (stickerUploadBtn && stickerUploadInput) {
    stickerUploadBtn.addEventListener('click', () => stickerUploadInput.click());
    stickerUploadInput.addEventListener('change', handleStickerUpload);
  }
}

// 切换表情面板
function toggleStickerPanel() {
  const stickerPanel = document.getElementById('sticker-panel');
  if (!stickerPanel) return;
  
  if (stickerPanel.classList.contains('active')) {
    stickerPanel.classList.remove('active');
    // iOS特定：表情面板关闭后调整输入区域
    if (document.documentElement.classList.contains('ios-device')) {
      setTimeout(() => {
        const chatInputArea = document.getElementById('chat-input-area');
        if (chatInputArea) {
          chatInputArea.style.paddingBottom = '';
        }
      }, 300);
    }
  } else {
    stickerPanel.classList.add('active');
    // iOS特定：表情面板打开时调整输入区域
    if (document.documentElement.classList.contains('ios-device')) {
      const chatInputArea = document.getElementById('chat-input-area');
      if (chatInputArea) {
        chatInputArea.style.paddingBottom = 'env(safe-area-inset-bottom, 20px)';
      }
    }
    renderStickerCategories();
    renderStickers('默认');
  }
}

// 渲染表情分类
function renderStickerCategories() {
  const tabsContainer = document.getElementById('sticker-category-tabs');
  if (!tabsContainer) return;
  
  tabsContainer.innerHTML = '';
  
  stickerCategories.forEach(category => {
    const tab = document.createElement('div');
    tab.className = 'sticker-category-tab';
    if (category === '默认') tab.classList.add('active');
    tab.textContent = category;
    tab.dataset.category = category;
    tab.addEventListener('click', () => {
      // 更新标签状态
      document.querySelectorAll('.sticker-category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // 渲染表情
      renderStickers(category);
    });
    tabsContainer.appendChild(tab);
  });
}

// 渲染表情
function renderStickers(category) {
  const stickerGrid = document.getElementById('sticker-grid');
  if (!stickerGrid) return;
  
  stickerGrid.innerHTML = '';
  
  const categoryStickers = stickers[category] || [];
  
  if (categoryStickers.length === 0) {
    stickerGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">😊</div>
        <div class="empty-state-text">还没有表情<br>点击右上角上传表情</div>
      </div>
    `;
    return;
  }
  
  categoryStickers.forEach(sticker => {
    const stickerItem = document.createElement('div');
    stickerItem.className = 'sticker-item';
    stickerItem.innerHTML = `<img src="${sticker.url}" alt="${sticker.name}">`;
    
    stickerItem.addEventListener('click', () => {
      sendSticker(sticker.url);
      toggleStickerPanel();
    });
    
    stickerGrid.appendChild(stickerItem);
  });
}

// 发送表情
function sendSticker(stickerUrl) {
  if (!currentChatId) return;
  
  // 发送表情消息
  const stickerMessage = {
    chatId: currentChatId,
    sender: 'user',
    content: `[表情]${stickerUrl}`,
    timestamp: Date.now(),
    type: 'sticker',
    isRead: true
  };
  
  db.messages.add(stickerMessage);
  
  // 更新聊天
  db.chats.update(currentChatId, {
    lastMessage: '[表情]',
    timestamp: Date.now()
  });
  
  // 重新加载消息
  loadChatMessages(currentChatId);
}

// 处理表情上传
async function handleStickerUpload(event) {
  const files = event.target.files;
  if (!files.length) return;
  
  const category = '默认'; // 默认分类
  const uploadPromises = [];
  
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      
      const promise = new Promise((resolve) => {
        reader.onload = async function(e) {
          try {
            const sticker = {
              category,
              url: e.target.result,
              name: file.name,
              addedAt: Date.now()
            };
            
            await db.stickers.add(sticker);
            resolve();
          } catch (error) {
            console.error('保存表情失败:', error);
            resolve();
          }
        };
        reader.readAsDataURL(file);
      });
      
      uploadPromises.push(promise);
    }
  }
  
  // 等待所有上传完成
  await Promise.all(uploadPromises);
  
  // 重新加载表情
  await loadStickers();
  
  // 更新UI
  renderStickers(category);
  
  showAlert('成功', `已上传 ${uploadPromises.length} 个表情`);
  
  // 清空input
  event.target.value = '';
}

// 设置世界书事件
function setupWorldBookEvents() {
  const addWorldBookBtn = document.getElementById('add-world-book-btn');
  const addWorldBookEntryBtn = document.getElementById('add-world-book-entry-btn');
  const saveWorldBookBtn = document.getElementById('save-world-book-btn');
  const manageCategoriesBtn = document.getElementById('manage-world-book-categories-btn');
  
  // 添加世界书按钮
  if (addWorldBookBtn) {
    addWorldBookBtn.addEventListener('click', () => openWorldBookEditor());
  }
  
  // 添加条目按钮
  if (addWorldBookEntryBtn) {
    addWorldBookEntryBtn.addEventListener('click', () => addWorldBookEntry());
  }
  
  // 保存世界书按钮
  if (saveWorldBookBtn) {
    saveWorldBookBtn.addEventListener('click', saveWorldBook);
  }
  
  // 管理分类按钮
  if (manageCategoriesBtn) {
    manageCategoriesBtn.addEventListener('click', showWorldBookCategoryManager);
  }
}

// 显示世界书分类管理器
function showWorldBookCategoryManager() {
  const list = document.getElementById('existing-categories-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  categories.forEach((category, index) => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '10px';
    item.style.border = '1px solid var(--border-color)';
    item.style.borderRadius = 'var(--element-radius)';
    
    item.innerHTML = `
      <span>${escapeHtml(category)}</span>
      <div style="display: flex; gap: 5px;">
        <button class="edit-category-btn" data-index="${index}">编辑</button>
        ${index > 0 ? `<button class="delete-category-btn" data-index="${index}">删除</button>` : ''}
      </div>
    `;
    
    list.appendChild(item);
  });
  
  // 添加编辑和删除事件
  document.querySelectorAll('.edit-category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      editCategory(index);
    });
  });
  
  document.querySelectorAll('.delete-category-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      deleteCategory(index);
    });
  });
  
  // 显示模态框
  showModal('world-book-category-manager-modal');
  
  // 添加分类按钮
  const addCategoryBtn = document.getElementById('add-new-category-btn');
  const newCategoryInput = document.getElementById('new-category-name-input');
  
  if (addCategoryBtn && newCategoryInput) {
    addCategoryBtn.onclick = () => {
      const name = newCategoryInput.value.trim();
      if (name && !categories.includes(name)) {
        categories.push(name);
        newCategoryInput.value = '';
        showWorldBookCategoryManager();
        renderWorldBookTabs();
      }
    };
    
    newCategoryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        addCategoryBtn.click();
      }
    });
  }
  
  // 关闭按钮
  const closeBtn = document.getElementById('close-category-manager-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      hideModal('world-book-category-manager-modal');
      renderWorldBookTabs();
    };
  }
}

// 编辑分类
function editCategory(index) {
  const oldName = categories[index];
  const newName = prompt('请输入新分类名称:', oldName);
  
  if (newName && newName.trim() && newName !== oldName) {
    categories[index] = newName.trim();
    showWorldBookCategoryManager();
    renderWorldBookTabs();
  }
}

// 删除分类
function deleteCategory(index) {
  if (confirm(`确定要删除分类 "${categories[index]}" 吗？`)) {
    categories.splice(index, 1);
    showWorldBookCategoryManager();
    renderWorldBookTabs();
  }
}

// 设置聊天列表事件
function setupChatListEvents() {
  const addChatBtn = document.getElementById('add-chat-btn');
  const addGroupChatBtn = document.getElementById('add-group-chat-btn');
  const navItems = document.querySelectorAll('.nav-item');
  
  // 添加聊天按钮
  if (addChatBtn) {
    addChatBtn.addEventListener('click', showAddChatModal);
  }
  
  // 添加群聊按钮
  if (addGroupChatBtn) {
    addGroupChatBtn.addEventListener('click', showAddGroupChatModal);
  }
  
  // 导航切换
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const viewId = this.dataset.view;
      switchView(viewId);
    });
  });
}

// 切换视图
function switchView(viewId) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewId);
  });
  
  // 显示对应视图
  document.querySelectorAll('.chat-list-view').forEach(view => {
    view.classList.toggle('active', view.id === viewId);
  });
}
// 显示添加聊天模态框
function showAddChatModal() {
  showCustomModal('新建聊天', `
    <div class="form-group">
      <label for="new-chat-name">聊天名称</label>
      <input type="text" id="new-chat-name" placeholder="输入聊天名称">
    </div>
    <div class="form-group">
      <label for="new-chat-type">聊天类型</label>
      <select id="new-chat-type">
        <option value="single">单聊</option>
        <option value="group">群聊</option>
      </select>
    </div>
    <div class="form-group" id="new-chat-avatar-group">
      <label>头像</label>
      <div class="avatar-upload" style="flex-direction: row; align-items: center; gap: 15px;">
        <img id="new-chat-avatar-preview" src="https://i.postimg.cc/y8xWzCqj/anime-boy.jpg" style="width: 60px; height: 60px;">
        <button type="button" onclick="changeNewChatAvatar()">更换头像</button>
      </div>
    </div>
  `, async () => {
    const nameInput = document.getElementById('new-chat-name');
    const typeSelect = document.getElementById('new-chat-type');
    const avatarPreview = document.getElementById('new-chat-avatar-preview');
    
    const name = nameInput?.value.trim();
    const type = typeSelect?.value;
    const avatar = avatarPreview?.src;
    
    if (!name) {
      showAlert('错误', '请输入聊天名称');
      return false;
    }
    
    try {
      const chatData = {
        name,
        avatar,
        isGroup: type === 'group',
        members: type === 'group' ? [] : null,
        lastMessage: '',
        timestamp: Date.now()
      };
      
      const chatId = await db.chats.add(chatData);
      
      // 如果是群聊，添加创建者
      if (type === 'group') {
        await db.chats.update(chatId, {
          members: [{
            id: 'user',
            name: '我',
            avatar: userSettings.myAvatar || 'https://i.postimg.cc/y8xWzCqj/anime-boy.jpg'
          }]
        });
      }
      
      // 重新加载聊天列表
      await loadChats();
      
      // 打开新聊天
      openChat(chatId);
      
      return true;
    } catch (error) {
      console.error('创建聊天失败:', error);
      showAlert('错误', '创建失败，请重试');
      return false;
    }
  });
}

// 显示添加群聊模态框
function showAddGroupChatModal() {
  showCustomModal('新建群聊', `
    <div class="form-group">
      <label for="new-group-name">群聊名称</label>
      <input type="text" id="new-group-name" placeholder="输入群聊名称">
    </div>
    <div class="form-group">
      <label for="new-group-description">群聊描述</label>
      <textarea id="new-group-description" rows="3" placeholder="输入群聊描述（可选）"></textarea>
    </div>
    <div class="form-group">
      <label>群头像</label>
      <div class="avatar-upload" style="flex-direction: row; align-items: center; gap: 15px;">
        <img id="new-group-avatar-preview" src="https://i.postimg.cc/y8xWzCqj/anime-boy.jpg" style="width: 60px; height: 60px;">
        <button type="button" onclick="changeNewGroupAvatar()">更换头像</button>
      </div>
    </div>
  `, async () => {
    const nameInput = document.getElementById('new-group-name');
    const descInput = document.getElementById('new-group-description');
    const avatarPreview = document.getElementById('new-group-avatar-preview');
    
    const name = nameInput?.value.trim();
    const description = descInput?.value.trim();
    const avatar = avatarPreview?.src;
    
    if (!name) {
      showAlert('错误', '请输入群聊名称');
      return false;
    }
    
    try {
      const chatData = {
        name,
        avatar,
        description: description || '',
        isGroup: true,
        members: [{
          id: 'user',
          name: '我',
          avatar: userSettings.myAvatar || 'https://i.postimg.cc/y8xWzCqj/anime-boy.jpg'
        }],
        lastMessage: '',
        timestamp: Date.now()
      };
      
      const chatId = await db.chats.add(chatData);
      
      // 重新加载聊天列表
      await loadChats();
      
      // 打开新群聊
      openChat(chatId);
      
      return true;
    } catch (error) {
      console.error('创建群聊失败:', error);
      showAlert('错误', '创建失败，请重试');
      return false;
    }
  });
}

// 更改新聊天头像
function changeNewChatAvatar() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const preview = document.getElementById('new-chat-avatar-preview');
        if (preview) preview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

// 更改新群聊头像
function changeNewGroupAvatar() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const preview = document.getElementById('new-group-avatar-preview');
        if (preview) preview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

// 通用工具函数

// 显示自定义模态框
function showCustomModal(title, content, onConfirm = null) {
  const modalOverlay = document.getElementById('custom-modal-overlay');
  const modalTitle = document.getElementById('custom-modal-title');
  const modalBody = document.getElementById('custom-modal-body');
  const cancelBtn = document.getElementById('custom-modal-cancel');
  const confirmBtn = document.getElementById('custom-modal-confirm');
  
  if (!modalOverlay || !modalTitle || !modalBody || !cancelBtn || !confirmBtn) {
    console.error('找不到模态框元素');
    return;
  }
  
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  
  const handleConfirm = async () => {
    if (onConfirm) {
      const success = await onConfirm();
      if (success !== false) {
        hideCustomModal();
      }
    } else {
      hideCustomModal();
    }
  };
  
  const handleCancel = () => {
    hideCustomModal();
  };
  
  // 移除旧的事件监听器
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  
  // 获取新的元素引用
  const newConfirmBtn = document.getElementById('custom-modal-confirm');
  const newCancelBtn = document.getElementById('custom-modal-cancel');
  
  // 添加新的事件监听器
  newConfirmBtn.addEventListener('click', handleConfirm);
  newCancelBtn.addEventListener('click', handleCancel);
  
  // 显示模态框
  modalOverlay.classList.add('active');
  
  // 处理回车键
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };
  
  document.addEventListener('keydown', handleKeyPress);
  
  // 保存事件处理函数以便清理
  modalOverlay._handleKeyPress = handleKeyPress;
  modalOverlay._handleConfirm = handleConfirm;
  modalOverlay._handleCancel = handleCancel;
}

// 隐藏自定义模态框
function hideCustomModal() {
  const modalOverlay = document.getElementById('custom-modal-overlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
    
    // 清理事件监听器
    if (modalOverlay._handleKeyPress) {
      document.removeEventListener('keydown', modalOverlay._handleKeyPress);
      delete modalOverlay._handleKeyPress;
    }
    
    delete modalOverlay._handleConfirm;
    delete modalOverlay._handleCancel;
  }
}

// 显示确认模态框
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    showCustomModal(title, `
      <p>${message}</p>
    `, () => {
      resolve(true);
      return true;
    }, () => {
      resolve(false);
      return false;
    });
  });
}

// 显示提示框
function showAlert(title, message) {
  showCustomModal(title, `
    <p>${message}</p>
  `, () => {
    return true;
  });
}

// 显示模态框
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    
    // iOS特定：模态框显示时调整布局
    if (document.documentElement.classList.contains('ios-device')) {
      setTimeout(() => {
        const modalContent = modal.querySelector('.modal-content, #custom-modal');
        if (modalContent) {
          modalContent.style.transform = 'translateY(0)';
        }
      }, 10);
    }
  }
}

// 隐藏模态框
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// 格式化时间
function formatTime(timestamp, format = 'MM-DD HH:mm') {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const oneDay = 24 * 60 * 60 * 1000;
  
  if (diff < oneDay && date.getDate() === now.getDate()) {
    // 今天
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } else if (diff < 2 * oneDay) {
    // 昨天
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } else if (diff < 7 * oneDay) {
    // 一周内
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()] + ' ' + date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  } else {
    // 更早
    return date.toLocaleDateString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit'
    }) + ' ' + date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 生成随机ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 加载聊天列表
async function loadChats() {
  try {
    chats = await db.chats.orderBy('timestamp').reverse().toArray();
    renderChatList();
  } catch (error) {
    console.error('加载聊天列表失败:', error);
  }
}

// 设置全局事件监听器
function setupEventListeners() {
  // 返回按钮
  window.addEventListener('popstate', function() {
    const hash = window.location.hash.substring(1);
    if (hash && document.getElementById(hash)) {
      showScreen(hash);
    }
  });
  
  // 全局点击事件
  document.addEventListener('click', function(e) {
    // 点击模态框背景关闭
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('active');
    }
  });
  
  // 全局键盘事件
  document.addEventListener('keydown', function(e) {
    // ESC键返回
    if (e.key === 'Escape' && currentScreen !== 'home-screen') {
      goBack();
    }
  });
  
  // 粘贴事件
  document.addEventListener('paste', function(e) {
    if (e.target.id === 'chat-input') {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            uploadImageToChat(file);
          }
          break;
        }
      }
    }
  });
  
  // 拖放事件
  document.addEventListener('dragover', function(e) {
    e.preventDefault();
  });
  
  document.addEventListener('drop', function(e) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && currentScreen === 'chat-interface-screen') {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        uploadImageToChat(file);
      }
    }
  });
  
  // iOS特定：防止页面缩放
  document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
  });
  
  // iOS特定：改善滚动体验
  if (document.documentElement.classList.contains('ios-device')) {
    document.addEventListener('touchstart', function(e) {
      // 为可滚动元素添加触摸反馈
      const scrollable = e.target.closest('[data-scrollable]');
      if (scrollable) {
        scrollable.style.webkitOverflowScrolling = 'touch';
      }
    }, { passive: true });
  }
}

// 上传图片到聊天
async function uploadImageToChat(file) {
  if (!currentChatId || !file) return;
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const imageMessage = {
      chatId: currentChatId,
      sender: 'user',
      content: `[图片]${e.target.result}`,
      timestamp: Date.now(),
      type: 'image',
      isRead: true
    };
    
    await db.messages.add(imageMessage);
    
    await db.chats.update(currentChatId, {
      lastMessage: '[图片]',
      timestamp: Date.now()
    });
    
    await loadChatMessages(currentChatId);
  };
  reader.readAsDataURL(file);
}

// 视频通话功能
function startVideoCall() {
  if (!currentChatId) return;
  
  const chat = chats.find(c => c.id === currentChatId);
  if (!chat) return;
  
  // 设置视频通话界面
  const callerName = document.getElementById('caller-name');
  const callerAvatar = document.getElementById('caller-avatar');
  
  if (callerName) callerName.textContent = chat.name;
  if (callerAvatar) callerAvatar.src = chat.avatar || 'https://i.postimg.cc/y8xWzCqj/anime-boy.jpg';
  
  // 显示来电界面
  showModal('incoming-call-modal');
  
  // 设置按钮事件
  const acceptBtn = document.getElementById('accept-call-btn');
  const declineBtn = document.getElementById('decline-call-btn');
  
  if (acceptBtn) {
    acceptBtn.onclick = () => {
      hideModal('incoming-call-modal');
      showScreen('video-call-screen');
      startCallTimer();
    };
  }
  
  if (declineBtn) {
    declineBtn.onclick = () => {
      hideModal('incoming-call-modal');
      // 发送拒绝消息
      sendCallMessage('视频通话已拒绝');
    };
  }
}

// 开始通话计时器
function startCallTimer() {
  let seconds = 0;
  const timerElement = document.getElementById('call-timer');
  
  const timer = setInterval(() => {
    seconds++;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (timerElement) {
      timerElement.textContent = 
        `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // 10秒后自动挂断（演示用）
    if (seconds >= 10) {
      clearInterval(timer);
      endVideoCall();
    }
  }, 1000);
  
  // 保存定时器以便清理
  window.callTimer = timer;
}

// 结束视频通话
function endVideoCall() {
  if (window.callTimer) {
    clearInterval(window.callTimer);
    window.callTimer = null;
  }
  
  showScreen('chat-interface-screen');
  
  // 发送通话结束消息
  sendCallMessage('视频通话已结束');
}

// 发送通话消息
async function sendCallMessage(message) {
  if (!currentChatId) return;
  
  const callMessage = {
    chatId: currentChatId,
    sender: 'system',
    content: message,
    timestamp: Date.now(),
    type: 'system',
    isRead: true
  };
  
  await db.messages.add(callMessage);
  await loadChatMessages(currentChatId);
}

// 外观设置相关函数
function initAppearanceSettings() {
  // 壁纸上传
  const wallpaperInput = document.getElementById('wallpaper-upload-input');
  const uploadWallpaperUrlBtn = document.getElementById('upload-wallpaper-url-btn');
  const removeWallpaperBtn = document.getElementById('remove-wallpaper-btn');
  
  if (wallpaperInput) {
    wallpaperInput.addEventListener('change', handleWallpaperUpload);
  }
  
  if (uploadWallpaperUrlBtn) {
    uploadWallpaperUrlBtn.addEventListener('click', () => {
      showCustomModal('设置壁纸URL', `
        <div class="form-group">
          <label for="wallpaper-url-input">壁纸URL</label>
          <input type="text" id="wallpaper-url-input" placeholder="输入图片URL">
        </div>
      `, () => {
        const urlInput = document.getElementById('wallpaper-url-input');
        const url = urlInput?.value.trim();
        if (url) {
          setWallpaper(url);
          return true;
        }
        return false;
      });
    });
  }
  
  if (removeWallpaperBtn) {
    removeWallpaperBtn.addEventListener('click', () => {
      userSettings.wallpaper = '';
      saveSettings();
      applySettings();
      document.getElementById('home-screen').style.backgroundImage = '';
      showAlert('成功', '壁纸已移除');
    });
  }
  
  // 聊天背景设置
  const globalBgInput = document.getElementById('global-bg-input');
  const uploadGlobalBgUrlBtn = document.getElementById('upload-global-bg-url-btn');
  const removeGlobalBgBtn = document.getElementById('remove-global-bg-btn');
  
  if (globalBgInput) {
    globalBgInput.addEventListener('change', handleGlobalBackgroundUpload);
  }
  
  if (uploadGlobalBgUrlBtn) {
    uploadGlobalBgUrlBtn.addEventListener('click', () => {
      showCustomModal('设置聊天背景URL', `
        <div class="form-group">
          <label for="global-bg-url-input">背景图片URL</label>
          <input type="text" id="global-bg-url-input" placeholder="输入图片URL">
        </div>
      `, () => {
        const urlInput = document.getElementById('global-bg-url-input');
        const url = urlInput?.value.trim();
        if (url) {
          setGlobalBackground(url);
          return true;
        }
        return false;
      });
    });
  }
  
  if (removeGlobalBgBtn) {
    removeGlobalBgBtn.addEventListener('click', () => {
      userSettings.globalBackground = '';
      saveSettings();
      applySettings();
      showAlert('成功', '聊天背景已移除');
    });
  }
}

// 处理壁纸上传
function handleWallpaperUpload(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    setWallpaper(e.target.result);
  };
  reader.readAsDataURL(file);
}

// 设置壁纸
function setWallpaper(dataUrl) {
  userSettings.wallpaper = dataUrl;
  saveSettings();
  applySettings();
  showAlert('成功', '壁纸已设置');
}

// 处理聊天背景上传
function handleGlobalBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    setGlobalBackground(e.target.result);
  };
  reader.readAsDataURL(file);
}

// 设置聊天背景
function setGlobalBackground(dataUrl) {
  userSettings.globalBackground = dataUrl;
  saveSettings();
  applySettings();
  showAlert('成功', '聊天背景已设置');
}

// 初始化图标设置
function initIconSettings() {
  const iconSettingsGrid = document.getElementById('icon-settings-grid');
  if (!iconSettingsGrid) return;
  
  const icons = [
    { id: 'icon-img-qq', label: 'QQ', defaultIcon: 'https://i.postimg.cc/MTC3Tkw8/IMG-6436.jpg' },
    { id: 'icon-img-world-book', label: '世界书', defaultIcon: 'https://i.postimg.cc/HWf1JKzn/IMG-6435.jpg' },
    { id: 'icon-img-wallpaper', label: '外观设置', defaultIcon: 'https://i.postimg.cc/T1j03pQr/IMG-6440.jpg' },
    { id: 'icon-img-api-settings', label: '设置', defaultIcon: 'https://i.postimg.cc/MK8rJ8t7/IMG-6438.jpg' },
    { id: 'icon-img-album', label: '相册', defaultIcon: 'https://i.postimg.cc/Y0T0rKz2/IMG-7303.jpg' },
    { id: 'icon-img-music', label: '音乐', defaultIcon: 'https://s3plus.meituan.net/opapisdk/op_ticket_885190757_1757748720126_qdqqd_1jt5sv.jpeg' },
    { id: 'icon-img-notes', label: '备忘录', defaultIcon: 'https://i.postimg.cc/3Rg6tT0W/IMG-7305.jpg' },
    { id: 'icon-img-files', label: '文件', defaultIcon: 'https://i.postimg.cc/7YjYxYvG/IMG-7306.jpg' }
  ];
  
  iconSettingsGrid.innerHTML = '';
  
  icons.forEach(icon => {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon-setting-item';
    iconDiv.style.display = 'flex';
    iconDiv.style.flexDirection = 'column';
    iconDiv.style.alignItems = 'center';
    iconDiv.style.gap = '8px';
    iconDiv.style.padding = '15px';
    iconDiv.style.border = '1px solid var(--border-color)';
    iconDiv.style.borderRadius = 'var(--element-radius)';
    
    const currentIcon = localStorage.getItem(`icon_${icon.id}`) || icon.defaultIcon;
    
    iconDiv.innerHTML = `
      <img src="${currentIcon}" alt="${icon.label}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover;">
      <div style="font-size: 12px; text-align: center;">${icon.label}</div>
      <button type="button" onclick="changeIcon('${icon.id}')" style="font-size: 12px; padding: 4px 8px;">更换</button>
    `;
    
    iconSettingsGrid.appendChild(iconDiv);
  });
}

// 更改图标
function changeIcon(iconId) {
  showCustomModal('更换图标', `
    <div class="form-group">
      <label>选择方式</label>
      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button type="button" onclick="uploadIcon('${iconId}')" style="flex: 1;">本地上传</button>
        <button type="button" onclick="setIconFromUrl('${iconId}')" style="flex: 1;">输入URL</button>
      </div>
    </div>
  `, () => {
    return true;
  });
}

// 上传图标
function uploadIcon(iconId) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        localStorage.setItem(`icon_${iconId}`, e.target.result);
        applyIcon(iconId, e.target.result);
        hideCustomModal();
        initIconSettings();
        showAlert('成功', '图标已更换');
      };
      reader.readAsDataURL(file);
    }
  });
  
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
}

// 从URL设置图标
function setIconFromUrl(iconId) {
  showCustomModal('设置图标URL', `
    <div class="form-group">
      <label for="icon-url-input">图标URL</label>
      <input type="text" id="icon-url-input" placeholder="输入图片URL">
    </div>
  `, () => {
    const urlInput = document.getElementById('icon-url-input');
    const url = urlInput?.value.trim();
    if (url) {
      localStorage.setItem(`icon_${iconId}`, url);
      applyIcon(iconId, url);
      initIconSettings();
      showAlert('成功', '图标已更换');
      return true;
    }
    return false;
  });
}

// 应用图标
function applyIcon(iconId, iconUrl) {
  // 更新主页图标
  const homeIcon = document.getElementById(iconId);
  if (homeIcon) {
    homeIcon.src = iconUrl;
  }
  
  // 更新其他地方的图标
  const allIcons = document.querySelectorAll(`[id*="${iconId}"]`);
  allIcons.forEach(icon => {
    if (icon.tagName === 'IMG') {
      icon.src = iconUrl;
    }
  });
}

// 保存外观预设
async function saveAppearancePreset() {
  const presetName = prompt('请输入预设名称:');
  if (!presetName) return;
  
  const preset = {
    name: presetName,
    wallpaper: userSettings.wallpaper,
    globalBackground: userSettings.globalBackground,
    theme: userSettings.theme,
    icons: {},
    css: document.getElementById('global-css-input')?.value || ''
  };
  
  // 收集图标
  const icons = [
    'icon-img-qq', 'icon-img-world-book', 'icon-img-wallpaper', 'icon-img-api-settings',
    'icon-img-album', 'icon-img-music', 'icon-img-notes', 'icon-img-files'
  ];
  
  icons.forEach(iconId => {
    preset.icons[iconId] = localStorage.getItem(`icon_${iconId}`) || '';
  });
  
  // 保存到数据库
  try {
    await db.settings.put({
      key: `appearance_preset_${Date.now()}`,
      value: preset
    });
    
    showAlert('成功', '外观预设已保存');
    loadAppearancePresets();
  } catch (error) {
    console.error('保存外观预设失败:', error);
    showAlert('错误', '保存失败，请重试');
  }
}

// 加载外观预设
async function loadAppearancePresets() {
  try {
    const allSettings = await db.settings.toArray();
    const presets = allSettings.filter(s => s.key.startsWith('appearance_preset_'));
    
    const select = document.getElementById('appearance-preset-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">选择预设...</option>';
    
    presets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.key;
      option.textContent = preset.value.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('加载外观预设失败:', error);
  }
}

// 应用外观预设
async function applyAppearancePreset(presetKey) {
  try {
    const presetData = await db.settings.get(presetKey);
    if (!presetData) return;
    
    const preset = presetData.value;
    
    // 应用预设
    userSettings.wallpaper = preset.wallpaper;
    userSettings.globalBackground = preset.globalBackground;
    userSettings.theme = preset.theme;
    
    // 应用图标
    Object.keys(preset.icons).forEach(iconId => {
      if (preset.icons[iconId]) {
        localStorage.setItem(`icon_${iconId}`, preset.icons[iconId]);
        applyIcon(iconId, preset.icons[iconId]);
      }
    });
    
    // 应用CSS
    const cssInput = document.getElementById('global-css-input');
    if (cssInput) {
      cssInput.value = preset.css;
      applyCustomCSS(preset.css);
    }
    
    // 保存设置
    await saveSettings();
    applySettings();
    
    // 刷新图标设置
    initIconSettings();
    
    showAlert('成功', '外观预设已应用');
  } catch (error) {
    console.error('应用外观预设失败:', error);
    showAlert('错误', '应用失败，请重试');
  }
}

// 应用自定义CSS
function applyCustomCSS(css) {
  let styleElement = document.getElementById('custom-css-style');
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = 'custom-css-style';
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}

// 删除外观预设
async function deleteAppearancePreset() {
  const select = document.getElementById('appearance-preset-select');
  if (!select || !select.value) {
    showAlert('提示', '请先选择要删除的预设');
    return;
  }
  
  const confirmed = await showConfirmModal('确认删除', `确定要删除预设 "${select.selectedOptions[0].textContent}" 吗？`);
  if (!confirmed) return;
  
  try {
    await db.settings.delete(select.value);
    loadAppearancePresets();
    showAlert('成功', '预设已删除');
  } catch (error) {
    console.error('删除预设失败:', error);
    showAlert('错误', '删除失败，请重试');
  }
}

// 窗口加载完成后初始化
window.addEventListener('load', function() {
  // iOS全屏适配：确保页面加载完成后调整布局
  if (document.documentElement.classList.contains('ios-device')) {
    // 延迟执行以确保所有元素都已加载
    setTimeout(() => {
      // 调整所有屏幕的高度
      document.querySelectorAll('.screen').forEach(screen => {
        screen.style.height = '100vh';
        screen.style.minHeight = '-webkit-fill-available';
      });
      
      // 调整主容器
      const phoneScreen = document.getElementById('phone-screen');
      if (phoneScreen) {
        phoneScreen.style.height = '100vh';
        phoneScreen.style.minHeight = '-webkit-fill-available';
      }
      
      console.log('iOS布局调整完成');
    }, 500);
  }
  
  // 加载外观预设
  loadAppearancePresets();
  
  // 设置外观预设按钮事件
  const savePresetBtn = document.getElementById('save-appearance-preset-btn');
  const deletePresetBtn = document.getElementById('delete-appearance-preset-btn');
  const presetSelect = document.getElementById('appearance-preset-select');
  
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', saveAppearancePreset);
  }
  
  if (deletePresetBtn) {
    deletePresetBtn.addEventListener('click', deleteAppearancePreset);
  }
  
  if (presetSelect) {
    presetSelect.addEventListener('change', function() {
      if (this.value) {
        applyAppearancePreset(this.value);
      }
    });
  }
  
  // 应用自定义CSS
  const cssInput = document.getElementById('global-css-input');
  if (cssInput) {
    cssInput.addEventListener('input', function() {
      applyCustomCSS(this.value);
    });
    
    // 加载保存的CSS
    const savedCSS = localStorage.getItem('custom_css');
    if (savedCSS) {
      cssInput.value = savedCSS;
      applyCustomCSS(savedCSS);
    }
  }
  
  // 保存CSS到localStorage
  const saveCssButton = document.getElementById('save-wallpaper-btn');
  if (saveCssButton) {
    saveCssButton.addEventListener('click', function() {
      if (cssInput) {
        localStorage.setItem('custom_css', cssInput.value);
      }
    });
  }
});

// 导出函数到全局作用域
window.showScreen = showScreen;
window.goBack = goBack;
window.sendMessage = sendMessage;
window.openChat = openChat;
window.startVideoCall = startVideoCall;
window.endVideoCall = endVideoCall;
window.toggleStickerPanel = toggleStickerPanel;
window.changeIcon = changeIcon;
window.uploadIcon = uploadIcon;
window.setIconFromUrl = setIconFromUrl;
window.initIOSFullscreen = initIOSFullscreen;

console.log('脚本加载完成');
