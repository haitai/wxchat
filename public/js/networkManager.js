// 统一网络状态管理器
// 解决多个模块监听网络状态造成的冲突问题

class NetworkManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.connectionQuality = 'unknown'; // unknown, good, poor, offline
        this.lastOnlineTime = Date.now();
        this.lastOfflineTime = null;
        this.listeners = new Map();
        
        // 移动端检测
        this.isMobile = this.detectMobileDevice();
        this.isIOS = this.detectIOSDevice();
        this.isPWA = this.detectPWAMode();
        
        // 网络质量检测
        this.qualityCheckInterval = null;
        this.qualityCheckFrequency = this.isMobile ? 10000 : 15000; // 移动端更频繁检测
        
        // 状态变化防抖
        this.statusChangeTimeout = null;
        this.statusChangeDelay = 500; // 500ms防抖
        
        // 连接状态历史
        this.connectionHistory = [];
        this.maxHistoryLength = 10;
        
        this.init();
    }
    
    // 初始化网络管理器
    init() {
        console.log('🌐 初始化统一网络状态管理器');
        
        // 设置网络状态监听
        this.setupNetworkListeners();
        
        // 开始网络质量检测
        this.startQualityMonitoring();
        
        // 初始状态检测
        this.checkInitialNetworkState();
        
        // 移动端特殊处理
        if (this.isMobile) {
            this.setupMobileOptimizations();
        }
    }
    
    // 检测移动设备
    detectMobileDevice() {
        return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // 检测iOS设备
    detectIOSDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    
    // 检测PWA模式
    detectPWAMode() {
        return window.matchMedia('(display-mode: standalone)').matches || 
               window.navigator.standalone === true;
    }
    
    // 设置网络状态监听器
    setupNetworkListeners() {
        // 移除其他模块的网络监听器，避免冲突
        this.removeConflictingListeners();
        
        // 统一的网络状态监听
        window.addEventListener('online', () => {
            this.handleNetworkChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkChange(false);
        });
        
        // 页面可见性变化监听
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }
    
    // 移除冲突的监听器
    removeConflictingListeners() {
        // 注意：这里不能直接移除，因为其他模块可能还有其他逻辑
        // 我们通过统一管理来避免冲突
        console.log('🔧 统一管理网络状态，避免模块间冲突');
    }
    
    // 处理网络状态变化
    handleNetworkChange(online) {
        // 防抖处理，避免频繁状态切换
        if (this.statusChangeTimeout) {
            clearTimeout(this.statusChangeTimeout);
        }
        
        this.statusChangeTimeout = setTimeout(() => {
            this.processNetworkChange(online);
        }, this.statusChangeDelay);
    }
    
    // 处理网络状态变化的核心逻辑
    processNetworkChange(online) {
        const previousState = this.isOnline;
        this.isOnline = online;
        
        // 记录状态变化历史
        this.recordConnectionHistory(online);
        
        if (online) {
            this.lastOnlineTime = Date.now();
            this.handleOnlineEvent(previousState);
        } else {
            this.lastOfflineTime = Date.now();
            this.handleOfflineEvent(previousState);
        }
        
        // 通知所有监听器
        this.notifyListeners('statusChange', {
            isOnline: this.isOnline,
            quality: this.connectionQuality,
            previousState,
            timestamp: Date.now()
        });
    }
    
    // 处理上线事件
    handleOnlineEvent(wasOffline) {
        console.log('🌐 网络已连接');
        
        // 立即检测网络质量
        this.checkNetworkQuality();
        
        // 更新UI状态
        this.updateConnectionStatus('connected');
        
        // 移动端特殊处理
        if (this.isMobile && wasOffline) {
            this.handleMobileReconnection();
        }
        
        // 显示通知
        if (wasOffline) {
            Utils.showNotification('网络已恢复连接', 'success');
        }
    }
    
    // 处理离线事件
    handleOfflineEvent(wasOnline) {
        console.log('🌐 网络已断开');
        
        this.connectionQuality = 'offline';
        
        // 更新UI状态
        this.updateConnectionStatus('offline');
        
        // 显示通知
        if (wasOnline) {
            Utils.showNotification('已切换到离线模式，部分功能可能受限', 'warning');
        }
    }
    
    // 处理页面可见性变化
    handleVisibilityChange() {
        if (!document.hidden) {
            // 页面变为可见时，重新检测网络状态
            setTimeout(() => {
                this.checkNetworkQuality();
                this.notifyListeners('visibilityChange', { visible: true });
            }, 100);
        } else {
            this.notifyListeners('visibilityChange', { visible: false });
        }
    }
    
    // 移动端重连处理
    handleMobileReconnection() {
        console.log('📱 移动端网络重连处理');

        // 移动端网络恢复时的特殊策略
        const reconnectionSteps = [
            { delay: 500, action: 'initial_check' },
            { delay: 2000, action: 'quality_check' },
            { delay: 5000, action: 'stability_check' }
        ];

        reconnectionSteps.forEach((step, index) => {
            setTimeout(async () => {
                switch (step.action) {
                    case 'initial_check':
                        console.log('📱 初始网络检查');
                        await this.checkNetworkQuality();
                        break;

                    case 'quality_check':
                        console.log('📱 网络质量检查');
                        await this.checkNetworkQuality();

                        // 如果网络质量好，通知其他模块可以重连
                        if (this.connectionQuality === 'good') {
                            this.notifyListeners('mobileReconnectionReady', {
                                quality: this.connectionQuality,
                                timestamp: Date.now()
                            });
                        }
                        break;

                    case 'stability_check':
                        console.log('📱 网络稳定性检查');
                        await this.checkNetworkQuality();

                        // 最终稳定性确认
                        this.notifyListeners('mobileReconnectionComplete', {
                            quality: this.connectionQuality,
                            stable: this.connectionQuality !== 'poor',
                            timestamp: Date.now()
                        });
                        break;
                }
            }, step.delay);
        });
    }
    
    // 设置移动端优化
    setupMobileOptimizations() {
        console.log('📱 启用移动端网络优化');
        
        // 移动端更频繁的网络质量检测
        this.qualityCheckFrequency = 8000;
        
        // iOS特殊处理
        if (this.isIOS) {
            this.setupIOSOptimizations();
        }
    }
    
    // iOS特殊优化
    setupIOSOptimizations() {
        console.log('🍎 启用iOS网络优化');
        
        // iOS Safari在PWA模式下的特殊处理
        if (this.isPWA) {
            // PWA模式下更保守的网络检测
            this.qualityCheckFrequency = 12000;
        }
    }
    
    // 开始网络质量监控
    startQualityMonitoring() {
        if (this.qualityCheckInterval) {
            clearInterval(this.qualityCheckInterval);
        }
        
        this.qualityCheckInterval = setInterval(() => {
            if (this.isOnline) {
                this.checkNetworkQuality();
            }
        }, this.qualityCheckFrequency);
    }
    
    // 停止网络质量监控
    stopQualityMonitoring() {
        if (this.qualityCheckInterval) {
            clearInterval(this.qualityCheckInterval);
            this.qualityCheckInterval = null;
        }
    }
    
    // 检测网络质量
    async checkNetworkQuality() {
        if (!this.isOnline) {
            this.connectionQuality = 'offline';
            return;
        }

        try {
            const startTime = Date.now();

            // 移动端使用更轻量的检测方式
            const testUrl = this.isMobile ? '/api/messages?limit=1' : '/api/ping';
            const timeoutMs = this.isMobile ? 8000 : 5000; // 移动端超时时间更长

            // 创建带超时的fetch请求
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(testUrl, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal,
                headers: Auth ? Auth.addAuthHeader({}) : {}
            });

            clearTimeout(timeoutId);
            const endTime = Date.now();
            const latency = endTime - startTime;

            // 移动端使用更宽松的质量判断标准
            if (response.ok) {
                if (this.isMobile) {
                    if (latency < 2000) {
                        this.connectionQuality = 'good';
                    } else if (latency < 5000) {
                        this.connectionQuality = 'poor';
                    } else {
                        this.connectionQuality = 'poor';
                    }
                } else {
                    if (latency < 1000) {
                        this.connectionQuality = 'good';
                    } else if (latency < 3000) {
                        this.connectionQuality = 'poor';
                    } else {
                        this.connectionQuality = 'poor';
                    }
                }

                console.log(`网络质量检测: ${this.connectionQuality} (延迟: ${latency}ms)`);
            } else {
                this.connectionQuality = 'poor';
                console.warn(`网络质量检测失败: HTTP ${response.status}`);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('网络质量检测超时');
                this.connectionQuality = 'poor';
            } else {
                console.warn('网络质量检测失败:', error);
                this.connectionQuality = 'poor';
            }
        }

        // 通知质量变化
        this.notifyListeners('qualityChange', {
            quality: this.connectionQuality,
            timestamp: Date.now(),
            isMobile: this.isMobile
        });
    }
    
    // 检查初始网络状态
    async checkInitialNetworkState() {
        console.log('🔍 检查初始网络状态');
        
        if (this.isOnline) {
            await this.checkNetworkQuality();
            this.updateConnectionStatus('connected');
        } else {
            this.connectionQuality = 'offline';
            this.updateConnectionStatus('offline');
        }
    }
    
    // 更新连接状态显示
    updateConnectionStatus(status) {
        // 统一更新UI状态
        if (typeof UI !== 'undefined' && UI.setConnectionStatus) {
            UI.setConnectionStatus(status);
        }
    }
    
    // 记录连接历史
    recordConnectionHistory(online) {
        this.connectionHistory.push({
            online,
            timestamp: Date.now(),
            quality: this.connectionQuality
        });
        
        // 保持历史记录长度
        if (this.connectionHistory.length > this.maxHistoryLength) {
            this.connectionHistory.shift();
        }
    }
    
    // 添加事件监听器
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    // 移除事件监听器
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    // 通知监听器
    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`网络事件回调执行失败 [${event}]:`, error);
                }
            });
        }
    }
    
    // 获取网络状态
    getStatus() {
        return {
            isOnline: this.isOnline,
            quality: this.connectionQuality,
            isMobile: this.isMobile,
            isIOS: this.isIOS,
            isPWA: this.isPWA,
            lastOnlineTime: this.lastOnlineTime,
            lastOfflineTime: this.lastOfflineTime,
            history: this.connectionHistory.slice(-5) // 返回最近5条记录
        };
    }
    
    // 强制重新检测网络状态
    async forceCheck() {
        console.log('🔄 强制检测网络状态');
        await this.checkNetworkQuality();
        return this.getStatus();
    }

    // 移动端网络诊断
    async diagnoseMobileNetwork() {
        if (!this.isMobile) {
            return { error: '此功能仅适用于移动端设备' };
        }

        console.log('📱 开始移动端网络诊断...');

        const diagnosis = {
            device: {
                isMobile: this.isMobile,
                isIOS: this.isIOS,
                isPWA: this.isPWA,
                userAgent: navigator.userAgent
            },
            network: {
                onLine: navigator.onLine,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt,
                    saveData: navigator.connection.saveData
                } : null
            },
            tests: []
        };

        // 测试1: 基础连通性
        try {
            const startTime = Date.now();
            const response = await fetch('/api/messages?limit=1', {
                method: 'GET',
                cache: 'no-cache',
                headers: Auth ? Auth.addAuthHeader({}) : {}
            });
            const endTime = Date.now();

            diagnosis.tests.push({
                name: '基础连通性测试',
                success: response.ok,
                latency: endTime - startTime,
                status: response.status
            });
        } catch (error) {
            diagnosis.tests.push({
                name: '基础连通性测试',
                success: false,
                error: error.message
            });
        }

        // 测试2: EventSource支持
        diagnosis.tests.push({
            name: 'EventSource支持',
            success: typeof EventSource !== 'undefined',
            available: typeof EventSource !== 'undefined'
        });

        // 测试3: 页面可见性API
        diagnosis.tests.push({
            name: '页面可见性API',
            success: typeof document.hidden !== 'undefined',
            hidden: document.hidden,
            visibilityState: document.visibilityState
        });

        // 测试4: Service Worker状态
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                diagnosis.tests.push({
                    name: 'Service Worker',
                    success: !!registration,
                    active: registration ? !!registration.active : false,
                    state: registration ? registration.active?.state : null
                });
            } catch (error) {
                diagnosis.tests.push({
                    name: 'Service Worker',
                    success: false,
                    error: error.message
                });
            }
        }

        // 添加当前网络状态
        diagnosis.currentStatus = this.getStatus();

        console.log('📱 移动端网络诊断完成:', diagnosis);
        return diagnosis;
    }

    // 生成网络诊断报告
    generateDiagnosisReport(diagnosis) {
        let report = '📱 移动端网络诊断报告\n\n';

        report += '🔧 设备信息:\n';
        report += `• 移动设备: ${diagnosis.device.isMobile ? '是' : '否'}\n`;
        report += `• iOS设备: ${diagnosis.device.isIOS ? '是' : '否'}\n`;
        report += `• PWA模式: ${diagnosis.device.isPWA ? '是' : '否'}\n\n`;

        report += '🌐 网络信息:\n';
        report += `• 浏览器在线状态: ${diagnosis.network.onLine ? '在线' : '离线'}\n`;
        if (diagnosis.network.connection) {
            report += `• 网络类型: ${diagnosis.network.connection.effectiveType}\n`;
            report += `• 下行速度: ${diagnosis.network.connection.downlink} Mbps\n`;
            report += `• 往返时间: ${diagnosis.network.connection.rtt} ms\n`;
        }
        report += '\n';

        report += '🧪 测试结果:\n';
        diagnosis.tests.forEach(test => {
            const status = test.success ? '✅' : '❌';
            report += `${status} ${test.name}: ${test.success ? '通过' : '失败'}\n`;
            if (test.latency) {
                report += `   延迟: ${test.latency}ms\n`;
            }
            if (test.error) {
                report += `   错误: ${test.error}\n`;
            }
        });

        report += '\n📊 当前状态:\n';
        report += `• 网络状态: ${diagnosis.currentStatus.isOnline ? '在线' : '离线'}\n`;
        report += `• 连接质量: ${diagnosis.currentStatus.quality}\n`;

        return report;
    }
    
    // 销毁管理器
    destroy() {
        this.stopQualityMonitoring();
        
        if (this.statusChangeTimeout) {
            clearTimeout(this.statusChangeTimeout);
        }
        
        this.listeners.clear();
        console.log('🗑️ 网络管理器已销毁');
    }
}

// 创建全局实例
const NetworkManager = new NetworkManager();

// 导出到全局
window.NetworkManager = NetworkManager;
