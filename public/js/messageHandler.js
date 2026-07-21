/**
 * 消息处理核心 v3 — 乐观发送 + 失败重试
 */
const MessageHandler = {
  isLoading: false,
  isLoadingMore: false,
  hasMoreMessages: true,
  oldestId: null,
  newestId: null,
  sendQueue: [],
  pending: new Map(), // clientId -> { content, deviceId, el }
  scrollListener: null,
  autoRefreshTimer: null,
  clientSeq: 0,

  init() {
    this.bindEvents();
    this.loadSendQueue();
    this.loadMessages(true);
    this.syncDevice();
    this.initInfiniteScroll();
    this.initRealtime();
    EventBus?.on?.('network:online', () => this.flushSendQueue());
  },

  bindEvents() {
    document.getElementById('messageForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });
  },

  initRealtime() {
    const deviceId = Utils.getDeviceId();
    if (window.Realtime) {
      Realtime.init(deviceId, this.newestId || 0);
      Realtime.on('connected', () => {
        this.stopAutoRefresh();
        this.flushSendQueue();
        this.loadMessages(true);
      });
      Realtime.on('disconnected', () => {
        this.startAutoRefresh();
      });
      Realtime.on('newMessages', (data) => {
        if (data?.messages?.length) this.ingestMessages(data.messages);
        else this.loadMessages(true);
      });
      setTimeout(() => {
        if (!Realtime.isConnectionAlive()) this.startAutoRefresh();
      }, 2500);
    } else {
      this.startAutoRefresh();
    }
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => {
      if (!document.hidden) this.loadMessages(true);
    }, CONFIG.UI.AUTO_REFRESH_INTERVAL);
  },

  stopAutoRefresh() {
    clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = null;
  },

  initInfiniteScroll() {
    const list = document.getElementById('messageList');
    if (!list) return;
    this.scrollListener = Utils.throttle(() => {
      if (list.scrollTop <= CONFIG.UI.INFINITE_SCROLL_THRESHOLD) {
        this.loadMoreMessages();
      }
    }, CONFIG.UI.SCROLL_DEBOUNCE_DELAY);
    list.addEventListener('scroll', this.scrollListener, { passive: true });
  },

  async syncDevice() {
    try {
      await API.syncDevice(Utils.getDeviceId(), Utils.getDeviceName());
    } catch (e) {
      console.warn('[MessageHandler] sync device failed', e);
    }
  },

  nextClientId() {
    this.clientSeq += 1;
    return `c-${Date.now()}-${this.clientSeq}`;
  },

  async loadMessages(silent = false) {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      const res = this.newestId
        ? await API.getMessages({ afterId: this.newestId, limit: CONFIG.UI.MESSAGE_LOAD_LIMIT })
        : await API.getMessages({ limit: CONFIG.UI.MESSAGE_LOAD_LIMIT });

      const rows = res.data || [];
      if (!this.newestId) {
        UI.clearMessages();
        UI.renderMessages(rows, { currentDeviceId: Utils.getDeviceId() });
        // 恢复仍在 pending 的乐观消息
        this.rehydratePending();
        UI.scrollToBottom(true);
        if (rows.length) {
          this.oldestId = rows[0].id;
          this.newestId = rows[rows.length - 1].id;
          this.hasMoreMessages = (res.total || 0) > rows.length;
        } else {
          this.hasMoreMessages = false;
        }
      } else if (rows.length) {
        this.ingestMessages(rows);
      }

      if (window.Realtime && this.newestId) Realtime.setLastMessageId(this.newestId);
    } catch (e) {
      if (!silent) UI.showError(e.message || CONFIG.ERRORS.LOAD_MESSAGES_FAILED);
      console.error('[MessageHandler] loadMessages', e);
    } finally {
      this.isLoading = false;
    }
  },

  rehydratePending() {
    for (const [clientId, item] of this.pending.entries()) {
      const el = UI.appendOptimisticMessage({
        clientId,
        content: item.content,
        deviceId: item.deviceId,
        status: item.status || 'sending'
      });
      item.el = el;
    }
  },

  ingestMessages(rows) {
    if (!rows?.length) return;
    const deviceId = Utils.getDeviceId();

    // 若服务端已有相同内容的自己消息，移除对应乐观气泡
    for (const m of rows) {
      if (m.device_id === deviceId && m.type === 'text' && m.content) {
        this.reconcileOptimistic(m);
      }
    }

    UI.updateMessagesIncremental(rows, deviceId);
    for (const m of rows) {
      if (m.id != null) {
        if (this.newestId == null || m.id > this.newestId) this.newestId = m.id;
        if (this.oldestId == null || m.id < this.oldestId) this.oldestId = m.id;
      }
    }
    if (window.Realtime && this.newestId) Realtime.setLastMessageId(this.newestId);
  },

  reconcileOptimistic(serverMsg) {
    for (const [clientId, item] of this.pending.entries()) {
      if (item.content === serverMsg.content && item.deviceId === serverMsg.device_id) {
        item.el?.remove();
        this.pending.delete(clientId);
        break;
      }
    }
  },

  async loadMoreMessages() {
    if (this.isLoadingMore || !this.hasMoreMessages || !this.oldestId) return;
    this.isLoadingMore = true;
    UI.ensureTopLoadingIndicator(true);
    try {
      const res = await API.getMessages({
        beforeId: this.oldestId,
        limit: CONFIG.UI.LOAD_MORE_BATCH_SIZE
      });
      const rows = res.data || [];
      if (!rows.length) {
        this.hasMoreMessages = false;
      } else {
        UI.renderMessages(rows, { prepend: true, currentDeviceId: Utils.getDeviceId() });
        this.oldestId = rows[0].id;
        if (rows.length < CONFIG.UI.LOAD_MORE_BATCH_SIZE) this.hasMoreMessages = false;
      }
    } catch (e) {
      console.error('[MessageHandler] loadMore', e);
    } finally {
      UI.ensureTopLoadingIndicator(false);
      this.isLoadingMore = false;
    }
  },

  async sendMessage() {
    const content = UI.getInputValue();
    if (!content) return;

    if (this.handleCommand(content)) {
      UI.clearInput();
      FunctionButton?.closePanels?.();
      return;
    }

    // AI
    if (window.AIHandler?.isAIMode || this.isAITrigger(content)) {
      const before = new CustomEvent('beforeMessageSend', {
        detail: { content },
        cancelable: true
      });
      document.dispatchEvent(before);
      if (before.defaultPrevented) {
        UI.clearInput();
        return;
      }
      if (window.AIHandler) {
        UI.clearInput();
        FunctionButton?.closePanels?.();
        await AIHandler.handleAIMessage(content);
        return;
      }
    }

    const deviceId = Utils.getDeviceId();
    UI.clearInput();
    FunctionButton?.closePanels?.();

    Utils.haptic('light');
    const clientId = this.nextClientId();
    const el = UI.appendOptimisticMessage({
      clientId,
      content,
      deviceId,
      status: 'sending'
    });
    this.pending.set(clientId, { content, deviceId, el, status: 'sending' });
    UI.scrollToBottom(true);

    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await API.sendMessage(content, deviceId);
      // 成功：用服务端 id 替换乐观节点，或拉增量
      if (res?.data?.id) {
        Utils.haptic('success');
        this.promoteOptimistic(clientId, {
          id: res.data.id,
          type: 'text',
          content,
          device_id: deviceId,
          timestamp: new Date().toISOString(),
          status: 'sent'
        });
      } else {
        this.pending.delete(clientId);
        el?.remove();
        await this.loadMessages(true);
      }
    } catch (e) {
      if (e.message === 'offline' || !navigator.onLine) {
        this.enqueue({ content, deviceId, clientId });
        this.markOptimistic(clientId, 'failed');
        UI.showInfo('已离线，点击感叹号可重试');
      } else {
        Utils.haptic('error');
        this.markOptimistic(clientId, 'failed');
        UI.showError(e.message || CONFIG.ERRORS.MESSAGE_SEND_FAILED);
      }
    }
  },

  promoteOptimistic(clientId, serverMsg) {
    const item = this.pending.get(clientId);
    if (!item) return;
    const old = item.el;
    this.pending.delete(clientId);
    // 渲染正式消息并移除乐观节点
    if (old) {
      const real = MessageRenderer.createMessageElement(serverMsg, Utils.getDeviceId());
      old.replaceWith(real);
      UI.messageCache.set(String(serverMsg.id), serverMsg);
      if (this.newestId == null || serverMsg.id > this.newestId) this.newestId = serverMsg.id;
      if (window.Realtime) Realtime.setLastMessageId(this.newestId);
    } else {
      UI.appendMessage(serverMsg, Utils.getDeviceId());
    }
  },

  markOptimistic(clientId, status) {
    const item = this.pending.get(clientId);
    if (!item) return;
    item.status = status;
    const el = item.el;
    if (!el) return;
    el.classList.toggle('pending', status === 'sending');
    el.classList.toggle('failed', status === 'failed');
    const slot = el.querySelector('.message-meta');
    if (!slot) return;
    let icon = slot.querySelector('.message-status-icon');
    if (!icon) {
      icon = document.createElement('span');
      icon.className = 'message-status-icon';
      slot.prepend(icon);
    }
    icon.className = `message-status-icon ${status}`;
    icon.title = status === 'failed' ? '发送失败，点击重试' : '发送中';
    if (status === 'failed') {
      icon.onclick = (e) => {
        e.stopPropagation();
        this.retryOptimistic(clientId);
      };
    } else {
      icon.onclick = null;
    }
  },

  async retryOptimistic(clientId) {
    const item = this.pending.get(clientId);
    if (!item) return;
    this.markOptimistic(clientId, 'sending');
    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await API.sendMessage(item.content, item.deviceId);
      if (res?.data?.id) {
        this.promoteOptimistic(clientId, {
          id: res.data.id,
          type: 'text',
          content: item.content,
          device_id: item.deviceId,
          timestamp: new Date().toISOString(),
          status: 'sent'
        });
        // 从离线队列剔除
        this.sendQueue = this.sendQueue.filter((q) => q.clientId !== clientId);
        this.persistSendQueue();
      } else {
        await this.loadMessages(true);
        this.pending.delete(clientId);
        item.el?.remove();
      }
    } catch {
      this.markOptimistic(clientId, 'failed');
      UI.showError(CONFIG.ERRORS.MESSAGE_SEND_FAILED);
    }
  },

  isAITrigger(content) {
    const c = content.trim().toLowerCase();
    return c.startsWith('🤖') || c.startsWith('ai:') || c.startsWith('ai ');
  },

  handleCommand(content) {
    const text = content.trim();
    const lower = text.toLowerCase();

    if (CONFIG.CLEAR.TRIGGER_COMMANDS.some((cmd) => lower === cmd.toLowerCase())) {
      this.handleClearCommand();
      return true;
    }
    if (lower === '/logout' || text === '登出') {
      Auth.logout();
      return true;
    }
    if (CONFIG.PWA.TRIGGER_COMMANDS.some((cmd) => lower === cmd.toLowerCase())) {
      window.PWA?.promptInstall?.();
      return true;
    }
    return false;
  },

  async handleClearCommand() {
    const code = await Utils.confirmDialog({
      title: '清理全部数据',
      message: CONFIG.CLEAR.CONFIRM_MESSAGE,
      confirmText: '清理',
      cancelText: '取消',
      danger: true,
      input: true,
      inputPlaceholder: '请输入确认码'
    });
    if (code == null) {
      UI.showInfo(CONFIG.ERRORS.CLEAR_CANCELLED);
      return;
    }
    if (String(code).trim() !== CONFIG.CLEAR.CONFIRM_CODE) {
      UI.showError('确认码错误');
      return;
    }
    try {
      const res = await API.clearAllData(code);
      if (res.success) {
        UI.clearMessages();
        this.pending.clear();
        this.oldestId = null;
        this.newestId = null;
        this.hasMoreMessages = true;
        UI.showSuccess(CONFIG.SUCCESS.DATA_CLEARED);
      } else {
        UI.showError(res.error || CONFIG.ERRORS.CLEAR_FAILED);
      }
    } catch (e) {
      UI.showError(e.message || CONFIG.ERRORS.CLEAR_FAILED);
    }
  },

  clearAllMessages() {
    return this.handleClearCommand();
  },

  async locateMessage(messageId) {
    if (UI.locateMessage(messageId)) return true;
    for (let i = 0; i < 10 && this.hasMoreMessages; i++) {
      await this.loadMoreMessages();
      if (UI.locateMessage(messageId)) return true;
    }
    return false;
  },

  loadSendQueue() {
    this.sendQueue = Utils.storage.get('wxchat_send_queue', []) || [];
  },
  persistSendQueue() {
    Utils.storage.set('wxchat_send_queue', this.sendQueue);
  },
  enqueue(item) {
    if (!this.sendQueue.some((q) => q.clientId === item.clientId)) {
      this.sendQueue.push({ ...item, ts: Date.now() });
      this.persistSendQueue();
    }
  },
  async flushSendQueue() {
    if (!this.sendQueue.length || !navigator.onLine) return;
    const queue = this.sendQueue.slice();
    this.sendQueue = [];
    this.persistSendQueue();
    for (const item of queue) {
      if (item.clientId && this.pending.has(item.clientId)) {
        await this.retryOptimistic(item.clientId);
      } else {
        try {
          await API.sendMessage(item.content, item.deviceId);
        } catch {
          this.sendQueue.push(item);
        }
      }
    }
    this.persistSendQueue();
    await this.loadMessages(true);
  }
};

if (typeof window !== 'undefined') window.MessageHandler = MessageHandler;
