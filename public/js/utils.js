/**
 * 工具函数库 v2
 */
const Utils = {
  generateDeviceId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    return `${CONFIG.DEVICE.ID_PREFIX}${timestamp}-${random}`;
  },

  getDeviceId() {
    try {
      let id = localStorage.getItem(CONFIG.DEVICE.STORAGE_KEY);
      if (!id) {
        id = this.generateDeviceId();
        localStorage.setItem(CONFIG.DEVICE.STORAGE_KEY, id);
      }
      return id;
    } catch {
      return this.generateDeviceId();
    }
  },

  getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  },

  getDeviceName() {
    return this.getDeviceType() === 'mobile'
      ? CONFIG.DEVICE.NAME_MOBILE
      : CONFIG.DEVICE.NAME_DESKTOP;
  },

  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },

  formatFileSize(bytes) {
    const n = Number(bytes) || 0;
    if (n === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1);
    return `${parseFloat((n / Math.pow(k, i)).toFixed(i > 0 ? 2 : 0))} ${sizes[i]}`;
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(typeof timestamp === 'string' && !timestamp.includes('T')
      ? timestamp.replace(' ', 'T') + 'Z'
      : timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp);

    const now = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((startOf(now) - startOf(date)) / 86400000);

    if (dayDiff === 0) return hm;
    if (dayDiff === 1) return `昨天 ${hm}`;
    if (dayDiff < 7 && dayDiff > 1) {
      const week = ['日', '一', '二', '三', '四', '五', '六'];
      return `周${week[date.getDay()]} ${hm}`;
    }
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
    }
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hm}`;
  },

  formatDateSeparator(timestamp) {
    if (!timestamp) return '';
    const date = new Date(typeof timestamp === 'string' && !timestamp.includes('T')
      ? timestamp.replace(' ', 'T') + 'Z'
      : timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((startOf(now) - startOf(date)) / 86400000);
    if (dayDiff === 0) return '今天';
    if (dayDiff === 1) return '昨天';
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  },

  getFileIcon(mimeType, fileName = '') {
    if (mimeType) {
      if (CONFIG.FILE_ICONS[mimeType]) return CONFIG.FILE_ICONS[mimeType];
      for (const [prefix, icon] of Object.entries(CONFIG.FILE_ICONS)) {
        if (prefix !== 'default' && prefix.endsWith('/') && mimeType.startsWith(prefix)) {
          return icon;
        }
      }
    }
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    if (ext && CONFIG.FILE_EXTENSION_ICONS[ext]) return CONFIG.FILE_EXTENSION_ICONS[ext];
    return CONFIG.FILE_ICONS.default;
  },

  isImageFile(mimeType, fileName = '') {
    if (mimeType && mimeType.startsWith('image/')) return true;
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext);
  },

  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  debounce(fn, wait = 100) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  throttle(fn, wait = 100) {
    let last = 0;
    let timer = null;
    return function throttled(...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  },


  /**
   * 微信风格确认框
   * @returns {Promise<string|null>} 输入值；取消返回 null
   */
  confirmDialog({ title = '提示', message = '', confirmText = '确定', cancelText = '取消', danger = false, input = false, inputPlaceholder = '', inputValue = '' } = {}) {
    return new Promise((resolve) => {
      document.querySelector('.dialog-overlay.wx-dialog')?.remove();
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay wx-dialog';
      overlay.innerHTML = `
        <div class="dialog" role="dialog" aria-modal="true">
          <div class="dialog-header"><div class="dialog-title"></div></div>
          <div class="dialog-body">
            <div class="dialog-message"></div>
            ${input ? '<input class="dialog-input" />' : ''}
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn-cancel"></button>
            <button type="button" class="btn-confirm"></button>
          </div>
        </div>
      `;
      overlay.querySelector('.dialog-title').textContent = title;
      overlay.querySelector('.dialog-message').textContent = message;
      const cancelBtn = overlay.querySelector('.btn-cancel');
      const okBtn = overlay.querySelector('.btn-confirm');
      cancelBtn.textContent = cancelText;
      okBtn.textContent = confirmText;
      if (danger) okBtn.classList.add('btn-danger');
      const inputEl = overlay.querySelector('.dialog-input');
      if (inputEl) {
        inputEl.placeholder = inputPlaceholder;
        inputEl.value = inputValue;
      }
      const close = (val) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 180);
        resolve(val);
      };
      cancelBtn.addEventListener('click', () => close(null));
      okBtn.addEventListener('click', () => close(input ? (inputEl?.value ?? '') : true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
      setTimeout(() => inputEl?.focus(), 200);
    });
  },

  showToast(message, type = 'info', duration = CONFIG.UI.TOAST_DURATION) {
    const host = document.getElementById('toastHost');
    if (!host || !message) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 160);
    }, duration);
  },

  // 兼容旧调用
  showNotification(message, type = 'info') {
    this.showToast(message, type);
  },

  markdown: {
    hasMarkdownSyntax(text) {
      if (!text) return false;
      return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|```|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)]+\)/.test(text);
    },

    renderToHtml(text) {
      if (!text) return '';
      try {
        if (typeof marked !== 'undefined') {
          marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
          });
          // 基础消毒：去掉 script/on* 属性
          let html = marked.parse(String(text));
          html = html
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/\son\w+="[^"]*"/gi, '')
            .replace(/\son\w+='[^']*'/gi, '')
            .replace(/javascript:/gi, '');
          return html;
        }
      } catch (e) {
        console.warn('[Utils] markdown render failed', e);
      }
      return Utils.escapeHtml(text).replace(/\n/g, '<br>');
    }
  },

  storage: {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  },

  haptic(type = 'light') {
    try {
      if (!navigator.vibrate) return;
      if (type === 'success') navigator.vibrate([10, 30, 10]);
      else if (type === 'error') navigator.vibrate([30, 40, 30]);
      else navigator.vibrate(12);
    } catch { /* ignore */ }
  },

  initViewportFix() {
    const setVh = () => {
      const h = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.visualViewport?.addEventListener('resize', setVh);
    window.visualViewport?.addEventListener('scroll', setVh);

    // 键盘检测
    if (window.visualViewport) {
      let base = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', () => {
        const h = window.visualViewport.height;
        if (h < base - 120) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
          base = Math.max(base, h);
        }
      });
    }
  }
};

if (typeof window !== 'undefined') window.Utils = Utils;
