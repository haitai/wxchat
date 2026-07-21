/**
 * 文件上传 v2
 */
const FileUpload = {
  isDragging: false,
  dragCounter: 0,
  uploading: false,

  init() {
    this.bindEvents();
    this.createDragOverlay();
    this.setupClipboardListener();
  },

  bindEvents() {
    const fileInput = document.getElementById('fileInput');
    const imageInput = document.getElementById('imageInput');
    const cameraInput = document.getElementById('cameraInput');
    const fileButton = document.getElementById('fileButton');

    fileButton?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
      e.target.value = '';
    });
    imageInput?.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
      e.target.value = '';
    });
    cameraInput?.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
      e.target.value = '';
    });

    document.addEventListener('dragenter', this.handleDragEnter.bind(this));
    document.addEventListener('dragover', this.handleDragOver.bind(this));
    document.addEventListener('dragleave', this.handleDragLeave.bind(this));
    document.addEventListener('drop', this.handleDrop.bind(this));
  },

  createDragOverlay() {
    if (document.getElementById('dragOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'dragOverlay';
    overlay.className = 'drag-overlay';
    overlay.innerHTML = `
      <div class="drag-content">
        <div class="drag-icon">📁</div>
        <div class="drag-text">拖拽文件到此处上传</div>
        <div class="drag-hint">支持多文件同时上传</div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  setupClipboardListener() {
    document.addEventListener('paste', this.handlePaste.bind(this));
  },

  async handleFileSelect(fileList) {
    if (!fileList || !fileList.length) return;
    await this.uploadMultipleFiles(Array.from(fileList));
  },

  handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter += 1;
    if (e.dataTransfer?.types?.includes('Files')) {
      this.isDragging = true;
      document.getElementById('dragOverlay')?.classList.add('show');
    }
  },

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  },

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) {
      this.isDragging = false;
      document.getElementById('dragOverlay')?.classList.remove('show');
    }
  },

  async handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter = 0;
    this.isDragging = false;
    document.getElementById('dragOverlay')?.classList.remove('show');
    const files = e.dataTransfer?.files;
    if (files?.length) await this.uploadMultipleFiles(Array.from(files));
  },

  async handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      await this.uploadMultipleFiles(files);
    }
  },

  validateFile(file) {
    if (!file) return '无效文件';
    if (CONFIG.FILE.MAX_SIZE > 0 && file.size > CONFIG.FILE.MAX_SIZE) {
      return `${CONFIG.ERRORS.FILE_TOO_LARGE}（${Utils.formatFileSize(CONFIG.FILE.MAX_SIZE)}）`;
    }
    return null;
  },

  async uploadMultipleFiles(files) {
    if (this.uploading) {
      Utils.showToast('正在上传中，请稍候', 'info');
      return;
    }
    const valid = [];
    for (const f of files) {
      const err = this.validateFile(f);
      if (err) Utils.showToast(`${f.name}: ${err}`, 'error');
      else valid.push(f);
    }
    if (!valid.length) return;

    this.uploading = true;
    const deviceId = Utils.getDeviceId();
    try {
      for (let i = 0; i < valid.length; i++) {
        const file = valid[i];
        UI.showUploadStatus(true, `上传中 (${i + 1}/${valid.length}) ${file.name}`, 0);
        await API.uploadFile(file, deviceId, (p) => {
          UI.showUploadStatus(true, `上传中 (${i + 1}/${valid.length}) ${file.name}`, p);
        });
      }
      UI.showUploadStatus(false);
      Utils.showToast(CONFIG.SUCCESS.FILE_UPLOADED, 'success');
      MessageHandler.loadMessages(true);
    } catch (e) {
      UI.showUploadStatus(false);
      Utils.showToast(e.message || CONFIG.ERRORS.FILE_UPLOAD_FAILED, 'error');
    } finally {
      this.uploading = false;
    }
  },

  openAlbum() {
    document.getElementById('imageInput')?.click();
  },

  openCamera() {
    document.getElementById('cameraInput')?.click();
  },

  openFiles() {
    document.getElementById('fileInput')?.click();
  }
};

if (typeof window !== 'undefined') window.FileUpload = FileUpload;
