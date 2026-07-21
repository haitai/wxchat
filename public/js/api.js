/**
 * API 封装 v2
 */
const API = {
  _imageBlobCache: new Map(),

  async request(url, options = {}) {
    const { timeout = 15000, raw = false, ...fetchOptions } = options;
    const headers = Auth ? Auth.addAuthHeader({ ...(fetchOptions.headers || {}) }) : { ...(fetchOptions.headers || {}) };

    // JSON 默认头
    if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        Auth?.handleUnauthorized?.();
        const err = new Error(CONFIG.ERRORS.UNAUTHORIZED);
        err.status = 401;
        throw err;
      }

      if (raw) return response;

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          message = errBody.error || errBody.message || message;
        } catch { /* ignore */ }
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`请求超时: ${url}`);
      }
      throw error;
    }
  },

  get(url, params = {}, options = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    const full = qs.toString() ? `${url}?${qs}` : url;
    return this.request(full, { method: 'GET', ...options });
  },

  post(url, data = {}, options = {}) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    });
  },

  // —— 业务 API ——
  getMessages(params = {}) {
    return this.get(CONFIG.API.ENDPOINTS.MESSAGES, {
      limit: params.limit ?? CONFIG.UI.MESSAGE_LOAD_LIMIT,
      offset: params.offset ?? 0,
      beforeId: params.beforeId,
      afterId: params.afterId
    });
  },

  sendMessage(content, deviceId) {
    return this.post(CONFIG.API.ENDPOINTS.MESSAGES, { content, deviceId, type: 'text' });
  },

  sendAIMessage(content, deviceId, type = 'ai_response') {
    return this.post(CONFIG.API.ENDPOINTS.AI_MESSAGE, { content, deviceId, type });
  },

  syncDevice(deviceId, deviceName) {
    return this.post(CONFIG.API.ENDPOINTS.SYNC, { deviceId, deviceName });
  },

  async clearAllData(confirmCode) {
    try {
      return await this.post(CONFIG.API.ENDPOINTS.CLEAR_ALL, { confirmCode });
    } catch (e) {
      if (e.status === 404) {
        return this.post(CONFIG.API.ENDPOINTS.CLEAR_ALL_LEGACY, { confirmCode });
      }
      throw e;
    }
  },

  uploadFile(file, deviceId, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deviceId', deviceId);

      xhr.open('POST', CONFIG.API.ENDPOINTS.FILES_UPLOAD);
      const token = Auth?.getToken?.();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          Auth?.handleUnauthorized?.();
          reject(new Error(CONFIG.ERRORS.UNAUTHORIZED));
          return;
        }
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.success) resolve(data);
          else reject(new Error(data.error || data.message || CONFIG.ERRORS.FILE_UPLOAD_FAILED));
        } catch {
          reject(new Error(CONFIG.ERRORS.FILE_UPLOAD_FAILED));
        }
      };
      xhr.onerror = () => reject(new Error(CONFIG.ERRORS.NETWORK));
      xhr.ontimeout = () => reject(new Error('上传超时'));
      xhr.timeout = 120000;
      xhr.send(formData);
    });
  },

  async downloadFile(r2Key, fileName) {
    try {
      const url = `${CONFIG.API.ENDPOINTS.FILES_DOWNLOAD}/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}`;
      const res = await this.request(url, { method: 'GET', raw: true, timeout: 60000 });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (Utils.isIOS()) {
        const w = window.open(objectUrl, '_blank');
        if (!w) {
          const a = document.createElement('a');
          a.href = objectUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
      return true;
    } catch (e) {
      Utils.showToast(e.message || '下载失败', 'error');
      throw e;
    }
  },

  async getImageBlobUrl(r2Key) {
    if (!r2Key) return null;
    if (this._imageBlobCache.has(r2Key)) {
      return this._imageBlobCache.get(r2Key);
    }
    const url = `${CONFIG.API.ENDPOINTS.FILES_DOWNLOAD}/${encodeURIComponent(r2Key).replace(/%2F/g, '/')}`;
    const res = await this.request(url, { method: 'GET', raw: true, timeout: 60000 });
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    this._imageBlobCache.set(r2Key, objectUrl);
    return objectUrl;
  },

  revokeImageBlobUrl(r2Key) {
    const url = this._imageBlobCache.get(r2Key);
    if (url) {
      URL.revokeObjectURL(url);
      this._imageBlobCache.delete(r2Key);
    }
  },

  clearImageBlobCache() {
    for (const url of this._imageBlobCache.values()) {
      URL.revokeObjectURL(url);
    }
    this._imageBlobCache.clear();
  },

  search(params = {}) {
    return this.get(CONFIG.API.ENDPOINTS.SEARCH, params);
  },

  searchSuggestions(q) {
    return this.get(CONFIG.API.ENDPOINTS.SEARCH_SUGGESTIONS, { q });
  },

  getAIConfig() {
    return this.get(CONFIG.API.ENDPOINTS.AI_CONFIG);
  },

  async streamAIChat(payload, { onChunk, signal } = {}) {
    const token = Auth?.getToken?.();
    const res = await fetch(CONFIG.API.ENDPOINTS.AI_CHAT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      signal
    });
    if (res.status === 401) {
      Auth?.handleUnauthorized?.();
      throw new Error(CONFIG.ERRORS.UNAUTHORIZED);
    }
    if (!res.ok) {
      let msg = CONFIG.ERRORS.AI_REQUEST_FAILED;
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res;
  },

  generateImage(body) {
    return this.post(CONFIG.API.ENDPOINTS.AI_IMAGE, body, { timeout: 120000 });
  },

  saveGeneratedImage(body) {
    return this.post(CONFIG.API.ENDPOINTS.AI_IMAGE_SAVE, body, { timeout: 120000 });
  }
};

if (typeof window !== 'undefined') window.API = API;
