// 应用配置文件

const CONFIG = {
    // API 配置
    API: {
        BASE_URL: '',  // 使用相对路径
        ENDPOINTS: {
            MESSAGES: '/api/messages',
            FILES_UPLOAD: '/api/files/upload',
            FILES_DOWNLOAD: '/api/files/download',
            SYNC: '/api/sync',
            CLEAR_ALL: '/api/clear-all',
            // 鉴权相关接口
            AUTH_LOGIN: '/api/auth/login',
            AUTH_VERIFY: '/api/auth/verify',
            AUTH_LOGOUT: '/api/auth/logout'
        }
    },
    
    // 文件上传配置
    FILE: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: '*', // 允许所有类型
        CHUNK_SIZE: 1024 * 1024 // 1MB chunks (如果需要分片上传)
    },
    
    // UI 配置
    UI: {
        AUTO_REFRESH_INTERVAL: 3000, // 3秒自动刷新（更快响应）
        MESSAGE_LOAD_LIMIT: 50, // 每次加载消息数量
        ANIMATION_DURATION: 100, // 动画持续时间(ms)（更快动画）
        TYPING_INDICATOR_DELAY: 1000 // 输入指示器延迟
    },
    
    // 设备配置
    DEVICE: {
        ID_PREFIX: 'web-',
        NAME_MOBILE: '移动设备',
        NAME_DESKTOP: 'Web浏览器',
        STORAGE_KEY: 'deviceId'
    },
    
    // 消息类型
    MESSAGE_TYPES: {
        TEXT: 'text',
        FILE: 'file'
    },
    
    // 文件类型图标映射 - 完整版
    FILE_ICONS: {
        // 图片文件
        'image/': '🖼️',
        'image/jpeg': '🖼️',
        'image/jpg': '🖼️',
        'image/png': '🖼️',
        'image/gif': '🎞️',
        'image/bmp': '🖼️',
        'image/svg+xml': '🎨',
        'image/webp': '🖼️',
        'image/tiff': '🖼️',
        'image/ico': '🖼️',

        // 视频文件
        'video/': '🎥',
        'video/mp4': '🎥',
        'video/avi': '🎥',
        'video/mov': '🎥',
        'video/wmv': '🎥',
        'video/mkv': '🎥',
        'video/flv': '🎥',
        'video/webm': '🎥',
        'video/m4v': '🎥',

        // 音频文件
        'audio/': '🎵',
        'audio/mp3': '🎵',
        'audio/wav': '🎵',
        'audio/aac': '🎵',
        'audio/flac': '🎵',
        'audio/ogg': '🎵',
        'audio/m4a': '🎵',
        'audio/wma': '🎵',

        // 文档文件
        'application/pdf': '📕',
        'application/msword': '📘',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
        'application/vnd.ms-excel': '📗',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📗',
        'application/vnd.ms-powerpoint': '📙',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📙',
        'application/rtf': '📄',

        // 压缩文件
        'application/zip': '📦',
        'application/x-rar-compressed': '📦',
        'application/x-7z-compressed': '📦',
        'application/x-tar': '📦',
        'application/gzip': '📦',
        'application/x-bzip2': '📦',

        // 文本文件
        'text/': '📄',
        'text/plain': '📄',
        'text/html': '🌐',
        'text/css': '🎨',
        'text/javascript': '⚡',
        'text/xml': '📋',
        'text/csv': '📊',
        'text/markdown': '📝',

        // 代码文件
        'application/javascript': '⚡',
        'application/json': '📋',
        'application/xml': '📋',

        // 其他常见格式
        'application/octet-stream': '📄',
        'application/x-executable': '⚙️',
        'application/x-msi': '💿',
        'application/x-deb': '📦',
        'application/x-rpm': '📦',

        // 默认图标
        'default': '📄'
    },

    // 文件扩展名图标映射 - 用于无MIME类型时的备用检测
    FILE_EXTENSION_ICONS: {
        // 图片
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🎞️', 'bmp': '🖼️',
        'svg': '🎨', 'webp': '🖼️', 'tiff': '🖼️', 'tif': '🖼️', 'ico': '🖼️',

        // 视频
        'mp4': '🎥', 'avi': '🎥', 'mov': '🎥', 'wmv': '🎥', 'mkv': '🎥',
        'flv': '🎥', 'webm': '🎥', 'm4v': '🎥', 'mpg': '🎥', 'mpeg': '🎥',

        // 音频
        'mp3': '🎵', 'wav': '🎵', 'aac': '🎵', 'flac': '🎵', 'ogg': '🎵',
        'm4a': '🎵', 'wma': '🎵', 'opus': '🎵',

        // 文档
        'pdf': '📕', 'doc': '📘', 'docx': '📘', 'xls': '📗', 'xlsx': '📗',
        'ppt': '📙', 'pptx': '📙', 'rtf': '📄', 'odt': '📘', 'ods': '📗', 'odp': '📙',

        // 压缩
        'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
        'bz2': '📦', 'xz': '📦', 'dmg': '💿', 'iso': '💿',

        // 文本和代码
        'txt': '📄', 'md': '📝', 'html': '🌐', 'htm': '🌐', 'css': '🎨',
        'js': '⚡', 'ts': '⚡', 'jsx': '⚡', 'tsx': '⚡', 'json': '📋',
        'xml': '📋', 'csv': '📊', 'sql': '🗃️',

        // 编程语言
        'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️', 'h': '⚙️',
        'php': '🐘', 'rb': '💎', 'go': '🐹', 'rs': '🦀', 'swift': '🦉',
        'kt': '🎯', 'scala': '📐', 'r': '📊', 'matlab': '📊', 'm': '📊',

        // 配置文件
        'ini': '⚙️', 'cfg': '⚙️', 'conf': '⚙️', 'yaml': '⚙️', 'yml': '⚙️',
        'toml': '⚙️', 'env': '⚙️',

        // 可执行文件
        'exe': '⚙️', 'msi': '💿', 'deb': '📦', 'rpm': '📦', 'dmg': '💿',
        'app': '📱', 'apk': '📱',

        // 字体文件
        'ttf': '🔤', 'otf': '🔤', 'woff': '🔤', 'woff2': '🔤', 'eot': '🔤',

        // 其他
        'log': '📜', 'bak': '💾', 'tmp': '🗂️', 'cache': '🗂️'
    },
    
    // 清理功能配置
    CLEAR: {
        TRIGGER_COMMANDS: ['/clear-all', '清空数据', '/清空', 'clear all'],
        CONFIRM_CODE: '1234',
        CONFIRM_MESSAGE: '⚠️ 此操作将永久删除所有聊天记录和文件，无法恢复！\n\n请输入确认码：1234'
    },

    // PWA功能配置
    PWA: {
        TRIGGER_COMMANDS: ['/pwa', '/install', '/安装', 'pwa', 'install', '安装'],
        INSTALL_BENEFITS: [
            '像原生应用一样使用',
            '快速启动，无需浏览器',
            '离线访问缓存内容',
            '自动更新到最新版本'
        ]
    },

    // 错误消息
    ERRORS: {
        NETWORK: '网络连接失败，请检查网络',
        FILE_TOO_LARGE: '文件大小不能超过10MB',
        FILE_UPLOAD_FAILED: '文件上传失败',
        MESSAGE_SEND_FAILED: '消息发送失败',
        LOAD_MESSAGES_FAILED: '加载消息失败',
        DEVICE_SYNC_FAILED: '设备同步失败',
        CLEAR_FAILED: '数据清理失败',
        CLEAR_CANCELLED: '数据清理已取消'
    },
    
    // 成功消息
    SUCCESS: {
        FILE_UPLOADED: '文件上传成功',
        MESSAGE_SENT: '消息发送成功',
        DEVICE_SYNCED: '设备同步成功',
        DATA_CLEARED: '数据清理成功'
    }
};

// 冻结配置对象，防止意外修改
Object.freeze(CONFIG);
Object.freeze(CONFIG.API);
Object.freeze(CONFIG.API.ENDPOINTS);
Object.freeze(CONFIG.FILE);
Object.freeze(CONFIG.UI);
Object.freeze(CONFIG.DEVICE);
Object.freeze(CONFIG.MESSAGE_TYPES);
Object.freeze(CONFIG.FILE_ICONS);
Object.freeze(CONFIG.FILE_EXTENSION_ICONS);
Object.freeze(CONFIG.CLEAR);
Object.freeze(CONFIG.PWA);
Object.freeze(CONFIG.ERRORS);
Object.freeze(CONFIG.SUCCESS);
