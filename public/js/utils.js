// 工具函数库

const Utils = {
    // 生成设备ID
    generateDeviceId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        return `${CONFIG.DEVICE.ID_PREFIX}${timestamp}-${random}`;
    },
    
    // 获取或创建设备ID
    getDeviceId() {
        let deviceId = localStorage.getItem(CONFIG.DEVICE.STORAGE_KEY);
        if (!deviceId) {
            deviceId = this.generateDeviceId();
            localStorage.setItem(CONFIG.DEVICE.STORAGE_KEY, deviceId);
        }
        return deviceId;
    },
    
    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // 如果是今天
        if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // 如果是昨天
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate()) {
            return '昨天 ' + date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // 其他日期
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // 获取文件图标
    getFileIcon(mimeType) {
        if (!mimeType) return CONFIG.FILE_ICONS.default;
        
        // 检查具体的MIME类型
        if (CONFIG.FILE_ICONS[mimeType]) {
            return CONFIG.FILE_ICONS[mimeType];
        }
        
        // 检查MIME类型前缀
        for (const [prefix, icon] of Object.entries(CONFIG.FILE_ICONS)) {
            if (mimeType.startsWith(prefix)) {
                return icon;
            }
        }
        
        return CONFIG.FILE_ICONS.default;
    },
    
    // 检查是否为图片文件
    isImageFile(mimeType) {
        return mimeType && mimeType.startsWith('image/');
    },
    
    // 检查文件大小
    validateFileSize(size) {
        return size <= CONFIG.FILE.MAX_SIZE;
    },
    
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // 节流函数
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // 安全的JSON解析
    safeJsonParse(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON解析失败:', e);
            return defaultValue;
        }
    },
    
    // 复制文本到剪贴板
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('复制到剪贴板失败:', err);
            return false;
        }
    },
    
    // 检测设备类型
    getDeviceType() {
        const userAgent = navigator.userAgent;
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
            return CONFIG.DEVICE.NAME_MOBILE;
        }
        return CONFIG.DEVICE.NAME_DESKTOP;
    },
    
    // 创建元素
    createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    },
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 简单的通知实现，可以后续扩展
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 如果浏览器支持通知API
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('微信文件传输助手', {
                body: message,
                icon: '/favicon.ico'
            });
        }
    },
    
    // 请求通知权限
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Markdown相关工具函数
    markdown: {
        // 检测文本是否包含markdown语法
        hasMarkdownSyntax(text) {
            if (!text || typeof text !== 'string') return false;

            const markdownPatterns = [
                /^#{1,6}\s+/m,           // 标题 # ## ###
                /\*\*[^*]+\*\*/,         // 粗体 **text**
                /\*[^*]+\*/,             // 斜体 *text*
                /^[-*+]\s+/m,            // 列表 - item
                /^>\s+/m,                // 引用 > text
                /```[\s\S]*?```/,        // 代码块 ```code```
                /`[^`]+`/,               // 行内代码 `code`
                /\[([^\]]+)\]\(([^)]+)\)/, // 链接 [text](url)
                /^---+$/m,               // 分割线 ---
                /^\d+\.\s+/m             // 有序列表 1. item
            ];

            return markdownPatterns.some(pattern => pattern.test(text));
        },

        // 渲染markdown为HTML
        renderToHtml(text) {
            if (!window.marked) {
                console.warn('Marked.js 未加载，返回原始文本');
                return Utils.escapeHtml(text);
            }

            try {
                // 配置marked选项
                marked.setOptions({
                    breaks: true,        // 支持换行
                    gfm: true,          // GitHub风格markdown
                    sanitize: false,    // 不过度清理HTML
                    smartLists: true,   // 智能列表
                    smartypants: false  // 不转换引号
                });

                return marked.parse(text);
            } catch (error) {
                console.error('Markdown渲染失败:', error);
                return Utils.escapeHtml(text);
            }
        }
    }
};

// 冻结工具对象
Object.freeze(Utils);
