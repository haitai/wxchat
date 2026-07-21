/**
 * UI 主模块 v2
 */
const UI = {
  elements: {},
  messageCache: new Map(),
  lastDateLabel: null,

  init() {
    this.cacheElements();
    this.bindEvents();
    this.checkInputAndToggleSendButton();
  },

  cacheElements() {
    this.elements = {
      messageList: document.getElementById('messageList'),
      messageForm: document.getElementById('messageForm'),
      messageText: document.getElementById('messageText'),
      sendButton: document.getElementById('sendButton'),
      functionButton: document.getElementById('functionButton'),
      fileInput: document.getElementById('fileInput'),
      imageInput: document.getElementById('imageInput'),
      cameraInput: document.getElementById('cameraInput'),
      uploadStatus: document.getElementById('uploadStatus'),
      progressBar: document.getElementById('progressBar'),
      fileButton: document.getElementById('fileButton'),
      connectionBar: document.getElementById('connectionBar'),
      navStatusDot: document.getElementById('navStatusDot'),
      aiModeBar: document.getElementById('aiModeBar')
    };
  },

  bindEvents() {
    const ta = this.elements.messageText;
    if (!ta) return;

    ta.addEventListener('input', () => {
      this.autoResizeTextarea();
      this.checkInputAndToggleSendButton();
    });
    ta.addEventListener('paste', () => {
      setTimeout(() => this.checkInputAndToggleSendButton(), 10);
    });
    ta.addEventListener('cut', () => {
      setTimeout(() => this.checkInputAndToggleSendButton(), 10);
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        MessageHandler.sendMessage();
      }
    });
  },

  autoResizeTextarea() {
    const ta = this.elements.messageText;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  },

  getInputValue() {
    return this.elements.messageText?.value?.trim() || '';
  },

  clearInput() {
    if (this.elements.messageText) {
      this.elements.messageText.value = '';
      this.autoResizeTextarea();
      this.checkInputAndToggleSendButton();
    }
  },

  focusInput() {
    this.elements.messageText?.focus();
  },

  checkInputAndToggleSendButton() {
    const hasText = !!this.getInputValue();
    const send = this.elements.sendButton;
    const plus = this.elements.functionButton;
    if (send) send.classList.toggle('show', hasText);
    if (plus) plus.classList.toggle('hidden-btn', hasText);
  },

  setConnectionStatus(status) {
    const dot = this.elements.navStatusDot;
    const bar = this.elements.connectionBar;
    if (dot) {
      dot.className = 'nav-status-dot';
      if (status === 'connected' || status === 'online') dot.classList.add('online');
      else if (status === 'connecting' || status === 'reconnecting') dot.classList.add('connecting');
      else dot.classList.add('offline');
    }
    if (bar) {
      if (status === 'connected' || status === 'online') {
        bar.classList.remove('show', 'offline', 'connecting');
        bar.textContent = '';
      } else if (status === 'connecting' || status === 'reconnecting') {
        bar.className = 'connection-bar connecting show';
        bar.textContent = '正在连接...';
      } else {
        bar.className = 'connection-bar offline show';
        bar.textContent = '连接已断开，正在重试';
      }
    }
  },

  showUploadStatus(show, text = '正在上传...', percent = 0) {
    const el = this.elements.uploadStatus;
    const bar = this.elements.progressBar;
    const label = document.getElementById('uploadStatusText');
    if (!el) return;
    el.classList.toggle('show', !!show);
    if (label) label.textContent = text;
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  },

  updateAIMode(active) {
    this.elements.aiModeBar?.classList.toggle('active', !!active);
    const ta = this.elements.messageText;
    if (ta) ta.placeholder = active ? '向 AI 提问...' : '发送消息...';
  },

  isNearBottom(threshold = 120) {
    const list = this.elements.messageList;
    if (!list) return true;
    return list.scrollHeight - list.scrollTop - list.clientHeight < threshold;
  },

  scrollToBottom(force = false) {
    const list = this.elements.messageList;
    if (!list) return;
    if (force || this.isNearBottom()) {
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight;
      });
    }
  },

  ensureTopLoadingIndicator(show) {
    const list = this.elements.messageList;
    if (!list) return;
    let el = list.querySelector('.top-loading');
    if (show) {
      if (!el) {
        el = document.createElement('div');
        el.className = 'top-loading';
        el.innerHTML = `<div class="spinner"></div><span>加载历史消息...</span>`;
        list.insertBefore(el, list.firstChild);
      }
    } else {
      el?.remove();
    }
  },

  clearMessages() {
    if (this.elements.messageList) this.elements.messageList.innerHTML = '';
    this.messageCache.clear();
    this.lastDateLabel = null;
  },

  renderMessages(messages, { prepend = false, currentDeviceId } = {}) {
    const list = this.elements.messageList;
    if (!list) return;
    const deviceId = currentDeviceId || Utils.getDeviceId();
    const frag = document.createDocumentFragment();
    const pendingImages = [];

    let prevDate = prepend ? null : this.lastDateLabel;
    // prepend 时 messages 应已是正序（旧→新）
    const items = messages.slice();

    for (const msg of items) {
      if (msg == null || msg.id == null) continue;
      if (this.messageCache.has(String(msg.id))) continue;

      const dateLabel = Utils.formatDateSeparator(msg.timestamp);
      if (dateLabel && dateLabel !== prevDate) {
        frag.appendChild(MessageRenderer.createDateSeparator(msg.timestamp));
        prevDate = dateLabel;
      }

      const el = MessageRenderer.createMessageElement(msg, deviceId);
      frag.appendChild(el);
      this.messageCache.set(String(msg.id), msg);

      if (msg._needsImageLoad) pendingImages.push(msg._needsImageLoad);
    }

    if (!prepend) this.lastDateLabel = prevDate;

    if (prepend) {
      const prevHeight = list.scrollHeight;
      const prevTop = list.scrollTop;
      // 插到 top-loading 之后
      const loading = list.querySelector('.top-loading');
      if (loading && loading.nextSibling) {
        list.insertBefore(frag, loading.nextSibling);
      } else if (loading) {
        list.appendChild(frag);
      } else {
        list.insertBefore(frag, list.firstChild);
      }
      list.scrollTop = list.scrollHeight - prevHeight + prevTop;
    } else {
      const stick = this.isNearBottom();
      list.appendChild(frag);
      if (stick) this.scrollToBottom(true);
    }

    pendingImages.forEach(({ r2Key, safeId }) => {
      ImageLoader.load(r2Key, safeId);
    });
  },

  appendMessage(message, currentDeviceId) {
    this.renderMessages([message], { prepend: false, currentDeviceId });
  },

  /** 乐观发送气泡 */
  appendOptimisticMessage({ clientId, content, deviceId, status = 'sending' }) {
    const msg = {
      id: clientId,
      type: 'text',
      content,
      device_id: deviceId || Utils.getDeviceId(),
      timestamp: new Date().toISOString(),
      status,
      _optimistic: true
    };
    const el = MessageRenderer.createMessageElement(msg, Utils.getDeviceId());
    el.classList.add('pending');
    el.dataset.clientId = clientId;
    // 状态图标
    const meta = el.querySelector('.message-meta');
    if (meta) {
      const icon = document.createElement('span');
      icon.className = `message-status-icon ${status}`;
      icon.title = status === 'failed' ? '发送失败，点击重试' : '发送中';
      meta.prepend(icon);
    }
    this.elements.messageList?.appendChild(el);
    this.scrollToBottom(true);
    return el;
  },

  updateMessagesIncremental(messages, currentDeviceId) {
    const list = this.elements.messageList;
    if (!list) return;
    if (this.messageCache.size === 0) {
      this.renderMessages(messages, { currentDeviceId });
      this.scrollToBottom(true);
      return;
    }
    const fresh = (messages || []).filter((m) => m && !this.messageCache.has(String(m.id)));
    if (fresh.length) {
      this.renderMessages(fresh, { currentDeviceId });
    }
  },

  locateMessage(messageId) {
    const list = this.elements.messageList;
    if (!list) return false;
    const el = list.querySelector(`[data-message-id="${messageId}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('locate-flash');
    setTimeout(() => el.classList.remove('locate-flash'), 1200);
    return true;
  },

  showSuccess(msg) { Utils.showToast(msg, 'success'); },
  showError(msg) { Utils.showToast(msg, 'error'); },
  showInfo(msg) { Utils.showToast(msg, 'info'); },

  // 兼容
  showKeyboardHint() { /* no-op: 避免挡输入 */ }
};

if (typeof window !== 'undefined') window.UI = UI;
