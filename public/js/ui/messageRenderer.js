/**
 * 消息渲染器 v2 — 微信气泡
 */
const MessageRenderer = {
  createMessageElement(message, currentDeviceId) {
    const type = message.type || 'text';
    if (type === 'system') {
      return this.createSystemMessage(message);
    }

    const isOwn = message.device_id === currentDeviceId && type !== 'ai';
    const isAI = type === 'ai' || message.device_id === 'ai-system';
    const time = Utils.formatTime(message.timestamp);
    const sender = isAI ? 'AI助手' : (isOwn ? '我' : '其他设备');
    const avatarText = isAI ? 'AI' : (isOwn ? '我' : '他');

    const root = document.createElement('div');
    root.className = `message ${isAI ? 'ai' : (isOwn ? 'own' : 'other')}`;
    if (message._optimistic || message.status === 'sending') root.classList.add('pending');
    if (message.status === 'failed') root.classList.add('failed');
    root.dataset.messageId = message.id;
    root.dataset.timestamp = message.timestamp || '';
    root.dataset.type = type;
    if (message._optimistic) root.dataset.optimistic = '1';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = avatarText;
    avatar.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'message-body';

    const senderEl = document.createElement('div');
    senderEl.className = 'message-sender';
    senderEl.textContent = sender;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (type === 'file') {
      bubble.appendChild(this.renderFileContent(message));
    } else {
      bubble.appendChild(this.renderTextContent(message, isAI));
    }

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `<span class="message-time">${Utils.escapeHtml(time)}</span>`;

    body.appendChild(senderEl);
    body.appendChild(bubble);
    body.appendChild(meta);

    root.appendChild(avatar);
    root.appendChild(body);

    // 长按复制
    this.bindContext(root, message);

    return root;
  },

  createSystemMessage(message) {
    const root = document.createElement('div');
    root.className = 'message system';
    root.dataset.messageId = message.id;
    root.dataset.timestamp = message.timestamp || '';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = message.content || '';
    root.appendChild(bubble);
    return root;
  },

  createDateSeparator(timestamp) {
    const el = document.createElement('div');
    el.className = 'date-separator';
    el.innerHTML = `<span>${Utils.escapeHtml(Utils.formatDateSeparator(timestamp))}</span>`;
    el.dataset.date = Utils.formatDateSeparator(timestamp);
    return el;
  },

  renderTextContent(message, isAI = false) {
    const wrap = document.createElement('div');
    const content = message.content || '';
    const hasMd = Utils.markdown.hasMarkdownSyntax(content);
    const messageId = `msg-${message.id}`;

    // AI thinking meta
    let thinking = null;
    try {
      if (message.meta) {
        const meta = typeof message.meta === 'string' ? JSON.parse(message.meta) : message.meta;
        if (meta?.thinking) thinking = meta.thinking;
      }
    } catch { /* ignore */ }

    if (thinking) {
      const details = document.createElement('details');
      details.className = 'ai-thinking';
      details.innerHTML = `<summary>思考过程</summary><div class="ai-thinking-body"></div>`;
      details.querySelector('.ai-thinking-body').textContent = thinking;
      wrap.appendChild(details);
    }

    const textEl = document.createElement('div');
    textEl.className = hasMd ? 'text-message markdown-rendered' : 'text-message';
    textEl.id = messageId;
    textEl.dataset.original = content;
    textEl.dataset.isRendered = hasMd ? 'true' : 'false';

    if (hasMd) {
      textEl.innerHTML = Utils.markdown.renderToHtml(content);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'markdown-toggle';
      btn.title = '切换源码/渲染';
      btn.textContent = '📝';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        MarkdownHandler.toggleView(messageId);
      });
      textEl.appendChild(btn);
    } else {
      textEl.textContent = content;
    }

    wrap.appendChild(textEl);
    return wrap;
  },

  renderFileContent(message) {
    const wrap = document.createElement('div');
    wrap.className = 'file-message';

    const card = document.createElement('div');
    card.className = 'file-card';

    const icon = document.createElement('div');
    icon.className = 'file-icon';
    icon.textContent = Utils.getFileIcon(message.mime_type, message.original_name);

    const info = document.createElement('div');
    info.className = 'file-info';
    info.innerHTML = `
      <div class="file-name"></div>
      <div class="file-size"></div>
    `;
    info.querySelector('.file-name').textContent = message.original_name || '文件';
    info.querySelector('.file-size').textContent = Utils.formatFileSize(message.file_size);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'file-download-btn';
    btn.title = '下载';
    btn.setAttribute('aria-label', '下载文件');
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 20h14v-2H5v2zM12 2v12l4-4 1.4 1.4L12 18.8 6.6 11.4 8 10l4 4V2z"/></svg>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      API.downloadFile(message.r2_key, message.original_name);
    });

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(btn);
    wrap.appendChild(card);

    if (Utils.isImageFile(message.mime_type, message.original_name) && message.r2_key) {
      const safeId = this.createSafeId(message.r2_key);
      const preview = document.createElement('div');
      preview.className = 'image-preview';
      preview.id = `preview-${safeId}`;
      preview.innerHTML = `
        <div class="image-loading" id="loading-${safeId}">
          <div class="spinner"></div>
          <span>加载中...</span>
        </div>
        <img id="img-${safeId}" alt="" style="display:none" />
        <div class="image-error" id="error-${safeId}" style="display:none">
          <span>图片加载失败</span>
          <button type="button" class="retry-btn">重试</button>
        </div>
      `;
      preview.querySelector('.retry-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        ImageLoader.retry(message.r2_key, safeId);
      });
      wrap.appendChild(preview);
      message._needsImageLoad = { r2Key: message.r2_key, safeId };
    }

    return wrap;
  },

  createSafeId(str) {
    return String(str).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  },

  bindContext(root, message) {
    let timer = null;
    const showMenu = (x, y) => {
      document.querySelector('.context-menu')?.remove();
      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
      menu.style.top = `${Math.min(y, window.innerHeight - 120)}px`;

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'context-menu-item';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(message.content || message.original_name || '');
          Utils.showToast('已复制', 'success');
        } catch {
          Utils.showToast('复制失败', 'error');
        }
        menu.remove();
      });
      menu.appendChild(copyBtn);

      if (message.type === 'file' && message.r2_key) {
        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'context-menu-item';
        dl.textContent = '下载';
        dl.addEventListener('click', () => {
          API.downloadFile(message.r2_key, message.original_name);
          menu.remove();
        });
        menu.appendChild(dl);
      }

      document.body.appendChild(menu);
      const close = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('pointerdown', close, true);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
    };

    root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY);
    });

    root.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      timer = setTimeout(() => showMenu(t.clientX, t.clientY), 480);
    }, { passive: true });
    root.addEventListener('touchend', () => clearTimeout(timer));
    root.addEventListener('touchmove', () => clearTimeout(timer));
  }
};

if (typeof window !== 'undefined') window.MessageRenderer = MessageRenderer;
