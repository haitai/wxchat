// 应用主入口文件

class WeChatApp {
    constructor() {
        this.isInitialized = false;
        this.deviceId = null;
    }
    
    // 初始化应用
    async init() {
        try {
            // 检查浏览器兼容性
            this.checkBrowserCompatibility();

            // 初始化设备ID
            this.deviceId = Utils.getDeviceId();

            // 请求通知权限
            await Utils.requestNotificationPermission();

            // 初始化各个模块
            UI.init();
            FileUpload.init();

            // 设置初始连接状态
            UI.setConnectionStatus(navigator.onLine ? 'connected' : 'disconnected');

            MessageHandler.init();

            // 标记为已初始化
            this.isInitialized = true;

            // 显示欢迎消息
            this.showWelcomeMessage();

        } catch (error) {
            this.showInitError(error);
        }
    }
    
    // 检查浏览器兼容性
    checkBrowserCompatibility() {
        const requiredFeatures = [
            'fetch',
            'localStorage',
            'FormData',
            'FileReader'
        ];
        
        const missingFeatures = requiredFeatures.filter(feature => {
            return !(feature in window);
        });
        
        if (missingFeatures.length > 0) {
            throw new Error(`浏览器不支持以下功能: ${missingFeatures.join(', ')}`);
        }
        
        // 检查ES6支持
        try {
            eval('const test = () => {};');
        } catch (e) {
            throw new Error('浏览器不支持ES6语法，请使用现代浏览器');
        }
        
        // 浏览器兼容性检查通过
    }
    
    // 显示欢迎消息
    showWelcomeMessage() {
        const isFirstTime = !localStorage.getItem('hasVisited');
        
        if (isFirstTime) {
            localStorage.setItem('hasVisited', 'true');
            
            setTimeout(() => {
                Utils.showNotification('欢迎使用微信文件传输助手！', 'info');
            }, 1000);
        }
    }
    
    // 显示初始化错误
    showInitError(error) {
        const errorMessage = `
            <div style="text-align: center; padding: 2rem; color: #ff4757;">
                <h2>😵 应用启动失败</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()" style="
                    background: #07c160; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 5px; 
                    cursor: pointer;
                    margin-top: 1rem;
                ">
                    🔄 重新加载
                </button>
            </div>
        `;
        
        document.body.innerHTML = errorMessage;
    }
    
    // 获取应用状态
    getStatus() {
        return {
            initialized: this.isInitialized,
            deviceId: this.deviceId,
            online: navigator.onLine,
            timestamp: new Date().toISOString()
        };
    }
    
    // 重启应用
    restart() {
        console.log('🔄 重启应用...');
        location.reload();
    }
    
    // 清理应用数据
    clearData() {
        if (confirm('确定要清除所有本地数据吗？这将删除设备ID等信息。')) {
            localStorage.clear();
            console.log('🗑️ 本地数据已清除');
            this.restart();
        }
    }
}

// 创建应用实例
const app = new WeChatApp();

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    Utils.showNotification('应用发生错误，请刷新页面重试', 'error');
});

// 未处理的Promise错误
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise错误:', event.reason);
    Utils.showNotification('网络请求失败，请检查网络连接', 'error');
});

// 导出到全局作用域（用于调试）
window.WeChatApp = app;
window.CONFIG = CONFIG;
window.Utils = Utils;
window.API = API;
window.UI = UI;
window.FileUpload = FileUpload;
window.MessageHandler = MessageHandler;

// 开发模式下的调试信息
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('🔧 开发模式已启用');
    console.log('可用的全局对象:', {
        WeChatApp: app,
        CONFIG,
        Utils,
        API,
        UI,
        FileUpload,
        MessageHandler
    });
}
