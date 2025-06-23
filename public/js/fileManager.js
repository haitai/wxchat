// 文件管理器 - 文件分类显示功能
const FileManager = {
    isFileManagerMode: false,
    currentCategory: 'all',
    currentFiles: [],
    fileOffset: 0,
    fileLimit: 20,
    hasMore: false,
    stats: null,
    
    // 初始化文件管理器
    init() {
        this.bindEvents();
        this.createFileManagerUI();
    },
    
    // 创建文件管理器界面
    createFileManagerUI() {
        // 检查是否已存在文件管理器界面
        if (document.getElementById('fileManagerContainer')) {
            return;
        }
        
        const fileManagerHTML = `
            <div class="file-manager-container" id="fileManagerContainer" style="display: none;">
                <div class="file-manager-header">
                    <div class="file-manager-title">
                        <h2>📁 文件管理器</h2>
                        <button type="button" id="closeFileManagerButton" class="close-file-manager-button">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="file-stats" id="fileStats">
                        <div class="stats-loading">加载统计信息中...</div>
                    </div>
                    
                    <div class="file-categories">
                        <button type="button" class="category-btn active" data-category="all">
                            📂 全部文件
                        </button>
                        <button type="button" class="category-btn" data-category="image">
                            🖼️ 图片
                        </button>
                        <button type="button" class="category-btn" data-category="document">
                            📄 文档
                        </button>
                        <button type="button" class="category-btn" data-category="audio">
                            🎵 音频
                        </button>
                        <button type="button" class="category-btn" data-category="video">
                            🎬 视频
                        </button>
                        <button type="button" class="category-btn" data-category="archive">
                            📦 压缩包
                        </button>
                        <button type="button" class="category-btn" data-category="other">
                            📋 其他
                        </button>
                    </div>
                </div>
                
                <div class="file-manager-content">
                    <div class="file-list" id="fileList">
                        <div class="file-loading" id="fileLoading">
                            <div class="loading-spinner"></div>
                            <span>加载文件中...</span>
                        </div>
                    </div>
                    
                    <div class="file-load-more" id="fileLoadMore" style="display: none;">
                        <button type="button" class="load-more-files-button">加载更多文件</button>
                    </div>
                </div>
            </div>
        `;
        
        // 插入到聊天容器前面
        const chatContainer = document.querySelector('.chat-container');
        chatContainer.insertAdjacentHTML('beforebegin', fileManagerHTML);
    },
    
    // 绑定事件
    bindEvents() {
        // 等待DOM加载完成后绑定事件
        document.addEventListener('DOMContentLoaded', () => {
            this.bindFileManagerEvents();
        });
        
        // 如果DOM已经加载完成，直接绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindFileManagerEvents();
            });
        } else {
            this.bindFileManagerEvents();
        }
    },
    
    // 绑定文件管理器相关事件
    bindFileManagerEvents() {
        // 关闭按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('#closeFileManagerButton')) {
                this.closeFileManager();
            } else if (e.target.closest('.category-btn')) {
                const category = e.target.closest('.category-btn').dataset.category;
                this.switchCategory(category);
            } else if (e.target.closest('.load-more-files-button')) {
                this.loadMoreFiles();
            } else if (e.target.closest('.file-download-action')) {
                const r2Key = e.target.closest('.file-download-action').dataset.r2Key;
                const fileName = e.target.closest('.file-download-action').dataset.fileName;
                API.downloadFile(r2Key, fileName);
            }
        });
    },
    
    // 显示文件管理器界面
    showFileManager() {
        this.isFileManagerMode = true;
        const fileManagerContainer = document.getElementById('fileManagerContainer');
        const chatContainer = document.querySelector('.chat-container');
        const searchContainer = document.getElementById('searchContainer');
        
        if (fileManagerContainer && chatContainer) {
            fileManagerContainer.style.display = 'block';
            chatContainer.style.display = 'none';
            
            // 如果搜索界面是打开的，也要关闭
            if (searchContainer) {
                searchContainer.style.display = 'none';
            }
        }
        
        // 更新UI状态
        UI.setFileManagerMode(true);
        
        // 加载文件列表
        this.loadFiles();
    },
    
    // 关闭文件管理器界面
    closeFileManager() {
        this.isFileManagerMode = false;
        const fileManagerContainer = document.getElementById('fileManagerContainer');
        const chatContainer = document.querySelector('.chat-container');
        
        if (fileManagerContainer && chatContainer) {
            fileManagerContainer.style.display = 'none';
            chatContainer.style.display = 'block';
        }
        
        // 清空文件列表
        this.currentFiles = [];
        this.fileOffset = 0;
        
        // 更新UI状态
        UI.setFileManagerMode(false);
    },
    
    // 切换文件分类
    switchCategory(category) {
        if (this.currentCategory === category) return;
        
        this.currentCategory = category;
        this.fileOffset = 0;
        this.currentFiles = [];
        
        // 更新分类按钮状态
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // 重新加载文件
        this.loadFiles();
    },
    
    // 加载文件列表
    async loadFiles(loadMore = false) {
        // 如果是新加载，重置偏移量
        if (!loadMore) {
            this.fileOffset = 0;
            this.currentFiles = [];
        }
        
        // 显示加载状态
        this.showFileLoading(!loadMore);
        
        try {
            const params = new URLSearchParams({
                category: this.currentCategory,
                limit: this.fileLimit,
                offset: this.fileOffset
            });
            
            const headers = Auth ? Auth.addAuthHeader({}) : {};
            const response = await fetch(`/api/files/categories?${params}`, { headers });
            const data = await response.json();
            
            if (data.success) {
                if (loadMore) {
                    this.currentFiles = [...this.currentFiles, ...data.data];
                } else {
                    this.currentFiles = data.data;
                }
                
                this.hasMore = data.hasMore;
                this.fileOffset += this.fileLimit;
                this.stats = data.stats;
                
                this.displayFiles();
                this.displayStats();
            } else {
                this.showFileError(`加载失败: ${data.error}`);
            }
        } catch (error) {
            this.showFileError(`加载出错: ${error.message}`);
        }
    },
    
    // 显示文件列表
    displayFiles() {
        const fileList = document.getElementById('fileList');
        const loadMoreBtn = document.getElementById('fileLoadMore');
        
        if (!fileList) return;
        
        if (this.currentFiles.length === 0) {
            fileList.innerHTML = `
                <div class="file-empty-state">
                    <div class="empty-icon">📁</div>
                    <h3>暂无文件</h3>
                    <p>该分类下还没有文件</p>
                </div>
            `;
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        // 渲染文件列表
        fileList.innerHTML = this.currentFiles.map(file => 
            this.renderFileItem(file)
        ).join('');
        
        // 显示/隐藏加载更多按钮
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.hasMore ? 'block' : 'none';
        }
    },
    
    // 渲染单个文件项
    renderFileItem(file) {
        const fileIcon = Utils.getFileIcon(file.mime_type, file.original_name);
        const fileSize = Utils.formatFileSize(file.file_size);
        const uploadTime = Utils.formatTime(file.created_at);
        const deviceName = Utils.getDeviceName(file.upload_device_id);
        const isImage = Utils.isImageFile(file.mime_type);
        
        return `
            <div class="file-item" data-file-id="${file.id}">
                <div class="file-item-icon">
                    ${fileIcon}
                </div>
                <div class="file-item-info">
                    <div class="file-item-name">${Utils.escapeHtml(file.original_name)}</div>
                    <div class="file-item-meta">
                        <span class="file-size">${fileSize}</span>
                        <span class="file-upload-time">${uploadTime}</span>
                        <span class="file-device">${deviceName}</span>
                        <span class="file-downloads">下载 ${file.download_count} 次</span>
                    </div>
                </div>
                <div class="file-item-actions">
                    ${isImage ? `<button class="file-preview-action" data-r2-key="${file.r2_key}" title="预览">👁️</button>` : ''}
                    <button class="file-download-action" data-r2-key="${file.r2_key}" data-file-name="${Utils.escapeHtml(file.original_name)}" title="下载">⬇️</button>
                </div>
            </div>
        `;
    },
    
    // 显示统计信息
    displayStats() {
        const statsElement = document.getElementById('fileStats');
        if (!statsElement || !this.stats) return;
        
        const totalSize = Utils.formatFileSize(this.stats.total_size || 0);
        
        statsElement.innerHTML = `
            <div class="stats-summary">
                <div class="stat-item">
                    <span class="stat-label">总文件:</span>
                    <span class="stat-value">${this.stats.total_files || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">总大小:</span>
                    <span class="stat-value">${totalSize}</span>
                </div>
            </div>
            <div class="stats-breakdown">
                <div class="breakdown-item">🖼️ ${this.stats.image_count || 0}</div>
                <div class="breakdown-item">📄 ${this.stats.document_count || 0}</div>
                <div class="breakdown-item">🎵 ${this.stats.audio_count || 0}</div>
                <div class="breakdown-item">🎬 ${this.stats.video_count || 0}</div>
                <div class="breakdown-item">📦 ${this.stats.archive_count || 0}</div>
            </div>
        `;
    },
    
    // 显示文件加载状态
    showFileLoading(show = true) {
        const loadingElement = document.getElementById('fileLoading');
        const fileList = document.getElementById('fileList');
        
        if (show) {
            if (loadingElement) {
                loadingElement.style.display = 'flex';
            }
            if (fileList && this.currentFiles.length === 0) {
                fileList.innerHTML = `
                    <div class="file-loading">
                        <div class="loading-spinner"></div>
                        <span>加载文件中...</span>
                    </div>
                `;
            }
        } else {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
    },
    
    // 显示文件错误
    showFileError(message) {
        const fileList = document.getElementById('fileList');
        if (fileList) {
            fileList.innerHTML = `
                <div class="file-error-state">
                    <div class="error-icon">❌</div>
                    <h3>加载失败</h3>
                    <p>${message}</p>
                    <button onclick="FileManager.loadFiles()" class="retry-button">重试</button>
                </div>
            `;
        }
    },
    
    // 加载更多文件
    async loadMoreFiles() {
        if (!this.hasMore) return;
        await this.loadFiles(true);
    }
};

// 导出到全局
window.FileManager = FileManager;
