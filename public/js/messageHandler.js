// 消息处理逻辑

const MessageHandler = {
    // 自动刷新定时器
    autoRefreshTimer: null,

    // 消息缓存（用于检测变化）
    lastMessages: [],

    // 加载状态（防止重复请求）
    isLoading: false,

    // 初始化消息处理
    init() {
        this.bindEvents();

        // 初始化实时通信
        this.initRealtime();

        // 直接加载消息，不显示加载状态
        this.loadMessages(true); // 初始加载时强制滚动
        this.syncDevice();

        // 如果实时连接失败，启用轮询
        setTimeout(() => {
            if (!window.Realtime || !window.Realtime.isConnectionAlive()) {
                this.startAutoRefresh();
            }
        }, 2000);
    },

    // 初始化实时通信
    initRealtime() {
        // 检查是否支持SSE
        if (typeof EventSource === 'undefined') {
            this.startAutoRefresh();
            return;
        }

        const deviceId = Utils.getDeviceId();

        // 初始化实时连接
        if (window.Realtime) {
            Realtime.init(deviceId);

            // 监听实时事件
            Realtime.on('connected', () => {
                this.stopAutoRefresh();
            });

            Realtime.on('disconnected', () => {
                this.startAutoRefresh();
            });

            Realtime.on('newMessages', (data) => {
                this.loadMessages();
            });
        } else {
            this.startAutoRefresh();
        }
    },
    
    // 绑定事件
    bindEvents() {
        const messageForm = document.getElementById('messageForm');
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
    },
    
    // 加载消息列表
    async loadMessages(forceScroll = false) {
        // 防止重复请求
        if (this.isLoading) {
            return;
        }

        this.isLoading = true;

        try {
            const messages = await API.getMessages();

            // 检测消息变化
            const hasChanges = this.detectMessageChanges(messages);

            // 总是更新UI，即使没有变化（首次加载时需要显示最终状态）
            const isFirstLoad = this.lastMessages.length === 0;
            if (hasChanges || forceScroll || isFirstLoad) {
                // 智能滚动逻辑：
                // 1. 强制滚动时总是滚动
                // 2. 有新消息且用户在底部时滚动
                // 3. 初次加载时滚动
                const userAtBottom = UI.isAtBottom();
                const shouldScroll = forceScroll || (hasChanges && userAtBottom) || isFirstLoad;

                UI.renderMessages(messages, shouldScroll);

                // 更新缓存
                this.lastMessages = [...messages];
            }

        } catch (error) {
            console.error('加载消息失败:', error);

            // 如果是首次加载失败，静默处理，显示空状态
            if (this.lastMessages.length === 0) {
                UI.showEmpty('还没有消息，开始聊天吧！');
            } else {
                // 非首次加载失败时才显示错误提示
                UI.showError(error.message || CONFIG.ERRORS.LOAD_MESSAGES_FAILED);
            }
        } finally {
            this.isLoading = false;
        }
    },

    // 检测消息变化
    detectMessageChanges(newMessages) {
        // 如果数量不同，肯定有变化
        if (newMessages.length !== this.lastMessages.length) {
            return true;
        }

        // 检查每条消息的ID和时间戳
        for (let i = 0; i < newMessages.length; i++) {
            const newMsg = newMessages[i];
            const oldMsg = this.lastMessages[i];

            if (!oldMsg || newMsg.id !== oldMsg.id || newMsg.timestamp !== oldMsg.timestamp) {
                return true;
            }
        }

        return false;
    },
    
    // 发送文本消息
    async sendMessage() {
        const content = UI.getInputValue();

        if (!content) {
            return;
        }

        // 检查是否为清理指令
        if (this.isClearCommand(content)) {
            await this.handleClearCommand();
            return;
        }

        try {
            UI.setSendButtonState(true, true);
            UI.setConnectionStatus('connecting');

            const deviceId = Utils.getDeviceId();
            await API.sendMessage(content, deviceId);

            // 清空输入框
            UI.clearInput();

            // 重新加载消息（发送消息后强制滚动到底部）
            await this.loadMessages(true);

            UI.showSuccess(CONFIG.SUCCESS.MESSAGE_SENT);
            UI.setConnectionStatus('connected');

        } catch (error) {
            console.error('发送消息失败:', error);
            UI.showError(error.message || CONFIG.ERRORS.MESSAGE_SEND_FAILED);
            UI.setConnectionStatus('disconnected');
        } finally {
            UI.setSendButtonState(false, false);
        }
    },

    // 检查是否为清理指令
    isClearCommand(content) {
        const trimmedContent = content.trim().toLowerCase();
        return CONFIG.CLEAR.TRIGGER_COMMANDS.some(cmd =>
            trimmedContent === cmd.toLowerCase()
        );
    },

    // 处理清理指令
    async handleClearCommand() {
        // 清空输入框
        UI.clearInput();

        // 显示确认对话框
        const userConfirmed = confirm(CONFIG.CLEAR.CONFIRM_MESSAGE);

        if (!userConfirmed) {
            UI.showError(CONFIG.ERRORS.CLEAR_CANCELLED);
            return;
        }

        // 获取用户输入的确认码
        const confirmCode = prompt('请输入确认码：');

        if (confirmCode !== CONFIG.CLEAR.CONFIRM_CODE) {
            UI.showError('确认码错误，数据清理已取消');
            return;
        }

        try {
            UI.setSendButtonState(true, true);
            UI.setConnectionStatus('connecting');

            // 执行清理操作
            const result = await API.clearAllData(confirmCode);

            // 清空前端界面
            UI.showEmpty('数据已清空，开始新的聊天吧！');
            this.lastMessages = [];

            // 显示清理结果
            const resultMessage = `✅ 数据清理完成！\n\n📊 清理统计：\n• 删除消息：${result.deletedMessages} 条\n• 删除文件：${result.deletedFiles} 个\n• 释放空间：${Utils.formatFileSize(result.deletedFileSize)}\n• R2文件：${result.deletedR2Files} 个`;

            UI.showSuccess(resultMessage);
            UI.setConnectionStatus('connected');

        } catch (error) {
            console.error('数据清理失败:', error);
            UI.showError(error.message || CONFIG.ERRORS.CLEAR_FAILED);
            UI.setConnectionStatus('disconnected');
        } finally {
            UI.setSendButtonState(false, false);
        }
    },
    
    // 设备同步
    async syncDevice() {
        try {
            const deviceId = Utils.getDeviceId();
            const deviceName = Utils.getDeviceType();
            
            const success = await API.syncDevice(deviceId, deviceName);
            
            if (success) {
                console.log('设备同步成功');
            }
            
        } catch (error) {
            console.error('设备同步失败:', error);
            // 设备同步失败不影响应用正常使用
        }
    },
    
    // 开始自动刷新
    startAutoRefresh() {
        // 清除现有定时器
        this.stopAutoRefresh();
        
        // 设置新的定时器
        this.autoRefreshTimer = setInterval(() => {
            this.loadMessages();
        }, CONFIG.UI.AUTO_REFRESH_INTERVAL);
        
        // 自动刷新已启动
    },
    
    // 停止自动刷新
    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
            // 自动刷新已停止
        }
    },
    
    // 重启自动刷新
    restartAutoRefresh() {
        this.stopAutoRefresh();
        this.startAutoRefresh();
    },
    
    // 处理页面可见性变化
    handleVisibilityChange() {
        if (document.hidden) {
            // 页面隐藏时停止自动刷新
            this.stopAutoRefresh();
        } else {
            // 页面显示时重启自动刷新并立即刷新一次（不强制滚动）
            this.startAutoRefresh();
            this.loadMessages(false);
        }
    },
    
    // 处理网络状态变化
    handleOnlineStatusChange() {
        if (navigator.onLine) {
            UI.setConnectionStatus('connected');
            this.restartAutoRefresh();
            this.loadMessages(false); // 网络恢复时不强制滚动
        } else {
            UI.setConnectionStatus('disconnected');
            this.stopAutoRefresh();
            UI.showError('网络连接已断开');
        }
    },
    
    // 添加新消息到列表（用于实时更新）
    addNewMessage(message) {
        UI.addMessage(message);
    },
    
    // 清空所有消息
    clearAllMessages() {
        UI.showEmpty('消息已清空');
    },
    
    // 搜索消息（预留功能）
    searchMessages(keyword) {
        // 预留：消息搜索功能
    },

    // 导出消息（预留功能）
    exportMessages() {
        // 预留：消息导出功能
    }
};

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    MessageHandler.handleVisibilityChange();
});

// 监听网络状态变化
window.addEventListener('online', () => {
    MessageHandler.handleOnlineStatusChange();
});

window.addEventListener('offline', () => {
    MessageHandler.handleOnlineStatusChange();
});

// 页面卸载时清理定时器
window.addEventListener('beforeunload', () => {
    MessageHandler.stopAutoRefresh();
});
