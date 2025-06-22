// PWA功能管理模块
// 处理Service Worker注册、安装提示、离线检测等

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isOnline = navigator.onLine;
        this.swRegistration = null;
        
        this.init();
    }
    
    // 初始化PWA功能
    async init() {
        try {
            // 检查PWA支持
            await this.checkPWASupport();
            
            // 注册Service Worker
            await this.registerServiceWorker();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 检查安装状态
            this.checkInstallStatus();
            
            // 显示安装提示
            this.setupInstallPrompt();
            
            console.log('✅ PWA功能初始化完成');
        } catch (error) {
            console.error('❌ PWA初始化失败:', error);
        }
    }
    
    // 检查PWA支持
    async checkPWASupport() {
        // 检查Manifest是否可访问
        let manifestSupported = false;
        try {
            const response = await fetch('/manifest.json');
            manifestSupported = response.ok;
        } catch (error) {
            manifestSupported = false;
        }

        const features = {
            serviceWorker: 'serviceWorker' in navigator,
            manifest: manifestSupported,
            notification: 'Notification' in window,
            pushManager: 'PushManager' in window
        };

        console.log('🔍 PWA功能支持情况:', features);
        return features;
    }
    
    // 注册Service Worker
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('⚠️ 浏览器不支持Service Worker');
            return;
        }
        
        try {
            this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            console.log('✅ Service Worker注册成功:', this.swRegistration.scope);
            
            // 监听Service Worker更新
            this.swRegistration.addEventListener('updatefound', () => {
                this.handleServiceWorkerUpdate();
            });
            
        } catch (error) {
            console.error('❌ Service Worker注册失败:', error);
        }
    }
    
    // 处理Service Worker更新
    handleServiceWorkerUpdate() {
        const newWorker = this.swRegistration.installing;
        
        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 有新版本可用
                this.showUpdateAvailable();
            }
        });
    }
    
    // 显示更新可用提示
    showUpdateAvailable() {
        const updateBanner = this.createUpdateBanner();
        document.body.appendChild(updateBanner);
        
        // 3秒后自动隐藏
        setTimeout(() => {
            updateBanner.remove();
        }, 5000);
    }
    
    // 创建更新横幅
    createUpdateBanner() {
        const banner = document.createElement('div');
        banner.className = 'pwa-update-banner';
        banner.innerHTML = `
            <div class="update-content">
                <span>🚀 新版本可用</span>
                <button onclick="PWA.updateApp()" class="update-btn">更新</button>
                <button onclick="this.parentElement.parentElement.remove()" class="close-btn">×</button>
            </div>
        `;
        return banner;
    }
    
    // 更新应用
    updateApp() {
        if (this.swRegistration && this.swRegistration.waiting) {
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 监听安装提示事件
        window.addEventListener('beforeinstallprompt', (e) => {
            // 保存事件，但不阻止默认行为（让浏览器显示原生提示）
            this.deferredPrompt = e;

            // 可选：显示我们的自定义安装按钮
            this.showInstallButton();
        });
        
        // 监听应用安装事件
        window.addEventListener('appinstalled', () => {
            console.log('🎉 应用已安装');
            this.isInstalled = true;
            this.hideInstallButton();
            Utils.showNotification('应用已成功安装到桌面！', 'success');
        });
        
        // 使用统一的网络状态管理器
        if (typeof NetworkManager !== 'undefined') {
            // 监听网络状态变化
            NetworkManager.on('statusChange', (data) => {
                this.isOnline = data.isOnline;
                this.handleOnlineStatusChange();
            });
        } else {
            // 降级处理：如果NetworkManager不可用，使用原有逻辑
            console.warn('PWA: NetworkManager不可用，使用降级网络监听');

            window.addEventListener('online', () => {
                this.isOnline = true;
                this.handleOnlineStatusChange();
            });

            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.handleOnlineStatusChange();
            });
        }
    }
    
    // 处理网络状态变化
    handleOnlineStatusChange() {
        // 不再直接操作UI，让NetworkManager统一管理
        console.log(`PWA网络状态变化: ${this.isOnline ? '在线' : '离线'}`);

        // PWA特有的处理逻辑
        if (this.isOnline) {
            // 网络恢复时，可以执行PWA特有的同步操作
            this.handlePWAOnlineRestore();
        } else {
            // 离线时，可以执行PWA特有的离线准备
            this.handlePWAOfflineMode();
        }
    }

    // PWA网络恢复处理
    handlePWAOnlineRestore() {
        console.log('📱 PWA网络恢复处理');
        // 可以在这里添加PWA特有的网络恢复逻辑
        // 比如同步离线期间的数据等
    }

    // PWA离线模式处理
    handlePWAOfflineMode() {
        console.log('📱 PWA离线模式处理');
        // 可以在这里添加PWA特有的离线准备逻辑
        // 比如缓存重要数据等
    }
    
    // 检查安装状态
    checkInstallStatus() {
        // 检查是否在独立模式下运行（已安装）
        this.isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone === true;
        
        if (this.isInstalled) {
            console.log('📱 应用运行在独立模式（已安装）');
        }
    }
    
    // 设置安装提示
    setupInstallPrompt() {
        // 如果已安装，不显示安装按钮
        if (this.isInstalled) {
            return;
        }
        
        // 延迟显示安装提示（避免打扰用户）
        setTimeout(() => {
            if (this.deferredPrompt && !this.isInstalled) {
                this.showInstallBanner();
            }
        }, 30000); // 30秒后显示
    }
    
    // 显示安装按钮
    showInstallButton() {
        let installBtn = document.getElementById('pwa-install-btn');
        
        if (!installBtn) {
            installBtn = document.createElement('button');
            installBtn.id = 'pwa-install-btn';
            installBtn.className = 'pwa-install-button';
            installBtn.innerHTML = '📱 安装应用';
            installBtn.onclick = () => this.promptInstall();
            
            // 添加到页面右下角
            document.body.appendChild(installBtn);
        }
        
        installBtn.style.display = 'block';
    }
    
    // 隐藏安装按钮
    hideInstallButton() {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }
    
    // 显示安装横幅
    showInstallBanner() {
        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="install-content">
                <div class="install-icon">📱</div>
                <div class="install-text">
                    <h3>安装微信文件传输助手</h3>
                    <p>获得更好的使用体验，支持离线访问</p>
                </div>
                <div class="install-actions">
                    <button onclick="PWA.promptInstall()" class="install-yes">安装</button>
                    <button onclick="PWA.dismissInstallBanner()" class="install-no">暂不</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(banner);
        
        // 添加动画效果
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
    }
    
    // 提示安装
    async promptInstall() {
        if (!this.deferredPrompt) {
            Utils.showNotification('安装提示不可用，请使用浏览器菜单安装', 'warning');
            return;
        }
        
        try {
            // 显示安装提示
            this.deferredPrompt.prompt();
            
            // 等待用户响应
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('✅ 用户接受安装');
            } else {
                console.log('❌ 用户拒绝安装');
            }
            
            // 清除提示
            this.deferredPrompt = null;
            this.hideInstallButton();
            this.dismissInstallBanner();
            
        } catch (error) {
            console.error('安装提示失败:', error);
            Utils.showNotification('安装失败，请重试', 'error');
        }
    }
    
    // 关闭安装横幅
    dismissInstallBanner() {
        const banner = document.querySelector('.pwa-install-banner');
        if (banner) {
            banner.classList.add('hide');
            setTimeout(() => {
                banner.remove();
            }, 300);
        }
        
        // 记录用户拒绝安装，24小时内不再显示
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }
    
    // 获取缓存信息
    async getCacheInfo() {
        if (!('caches' in window)) {
            return { supported: false };
        }
        
        try {
            const cacheNames = await caches.keys();
            const cacheInfo = {};
            
            for (const cacheName of cacheNames) {
                const cache = await caches.open(cacheName);
                const keys = await cache.keys();
                cacheInfo[cacheName] = keys.length;
            }
            
            return {
                supported: true,
                caches: cacheInfo,
                total: cacheNames.length
            };
        } catch (error) {
            console.error('获取缓存信息失败:', error);
            return { supported: true, error: error.message };
        }
    }
    
    // 清理缓存
    async clearCache() {
        if (!('caches' in window)) {
            Utils.showNotification('浏览器不支持缓存API', 'error');
            return;
        }
        
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            
            Utils.showNotification('缓存已清理', 'success');
            console.log('🗑️ PWA缓存已清理');
        } catch (error) {
            console.error('清理缓存失败:', error);
            Utils.showNotification('清理缓存失败', 'error');
        }
    }
    
    // 获取PWA状态
    async getStatus() {
        const manifestCheck = await this.checkManifestStatus();

        return {
            installed: this.isInstalled,
            online: this.isOnline,
            serviceWorkerSupported: 'serviceWorker' in navigator,
            serviceWorkerRegistered: !!this.swRegistration,
            installPromptAvailable: !!this.deferredPrompt,
            manifestAccessible: manifestCheck.accessible,
            manifestValid: manifestCheck.valid,
            cacheCount: await this.getCacheCount()
        };
    }

    // 检查Manifest状态
    async checkManifestStatus() {
        try {
            const response = await fetch('/manifest.json');
            if (!response.ok) {
                return { accessible: false, valid: false, error: `HTTP ${response.status}` };
            }

            const manifest = await response.json();
            const hasRequiredFields = manifest.name && manifest.start_url && manifest.icons;

            return {
                accessible: true,
                valid: hasRequiredFields,
                data: manifest
            };
        } catch (error) {
            return { accessible: false, valid: false, error: error.message };
        }
    }

    // 获取缓存数量
    async getCacheCount() {
        if (!('caches' in window)) return 0;

        try {
            const cacheNames = await caches.keys();
            return cacheNames.length;
        } catch (error) {
            return 0;
        }
    }
}

// 创建全局PWA实例
const PWA = new PWAManager();

// 导出到全局作用域
window.PWA = PWA;
