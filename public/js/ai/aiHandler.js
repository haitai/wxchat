// AI消息处理核心
// 负责AI模式管理、消息处理和与UI的交互

const AIHandler = {
    // AI模式状态
    isAIMode: false,
    
    // 当前AI对话状态
    currentThinkingMessageId: null,
    currentResponseMessageId: null,
    isProcessing: false,
    
    // 初始化AI处理器
    init() {
        console.log('AIHandler: 初始化AI处理器');
        
        // 验证AI配置
        try {
            AIAPI.validateConfig();
            console.log('AIHandler: AI配置验证成功');
        } catch (error) {
            console.error('AIHandler: AI配置验证失败', error);
            return false;
        }
        
        // 绑定事件
        this.bindEvents();
        
        return true;
    },
    
    // 绑定事件
    bindEvents() {
        // 监听消息发送事件，检查是否为AI消息
        document.addEventListener('beforeMessageSend', (event) => {
            const { content } = event.detail;
            if (this.isAIMessage(content)) {
                event.preventDefault();
                this.handleAIMessage(content);
            }
        });
        
        // 监听AI模式切换事件
        document.addEventListener('aiModeToggle', (event) => {
            this.toggleAIMode();
        });
    },
    
    // 检查是否为AI消息
    isAIMessage(content) {
        return this.isAIMode || content.startsWith('🤖') || content.toLowerCase().includes('ai');
    },
    
    // 切换AI模式
    toggleAIMode() {
        this.isAIMode = !this.isAIMode;
        
        console.log('AIHandler: AI模式切换', { isAIMode: this.isAIMode });
        
        // 更新UI状态
        if (window.UI && typeof UI.updateAIMode === 'function') {
            UI.updateAIMode(this.isAIMode);
        }
        
        // 显示模式切换提示
        const message = this.isAIMode ? CONFIG.SUCCESS.AI_MODE_ENABLED : CONFIG.SUCCESS.AI_MODE_DISABLED;
        if (window.UI && typeof UI.showSuccess === 'function') {
            UI.showSuccess(message);
        }
        
        // 分发自定义事件
        document.dispatchEvent(new CustomEvent('aiModeChanged', {
            detail: { isAIMode: this.isAIMode }
        }));
        
        return this.isAIMode;
    },
    
    // 处理AI消息
    async handleAIMessage(content) {
        if (this.isProcessing) {
            console.log('AIHandler: AI正在处理中，忽略新请求');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            console.log('AIHandler: 开始处理AI消息', { content });
            
            // 清理消息内容（移除AI标识符）
            const cleanContent = this.cleanAIMessage(content);
            
            // 发送用户消息（标记为AI消息）
            await this.sendUserAIMessage(cleanContent);
            
            // 显示思考过程
            const thinkingId = await this.showThinkingProcess();
            
            // 调用AI API
            const result = await AIAPI.streamChat(cleanContent, {
                onThinking: (thinking) => this.updateThinking(thinkingId, thinking),
                onThinkingComplete: (thinking) => this.completeThinking(thinkingId, thinking),
                onResponse: (chunk, fullResponse) => this.updateResponse(chunk, fullResponse)
            });
            
            // 完成AI响应
            await this.completeAIResponse(result);
            
            console.log('AIHandler: AI消息处理完成');
            
        } catch (error) {
            console.error('AIHandler: AI消息处理失败', error);
            await this.handleAIError(error);
        } finally {
            this.isProcessing = false;
            this.currentThinkingMessageId = null;
            this.currentResponseMessageId = null;
        }
    },
    
    // 清理AI消息内容
    cleanAIMessage(content) {
        return content
            .replace(/^🤖\s*/, '')  // 移除开头的AI图标
            .replace(/\s*🤖\s*$/, '') // 移除结尾的AI图标
            .trim();
    },
    
    // 发送用户AI消息
    async sendUserAIMessage(content) {
        const deviceId = Utils.getDeviceId();
        
        // 创建AI用户消息
        const message = {
            type: CONFIG.MESSAGE_TYPES.TEXT,
            content: content,
            device_id: deviceId,
            timestamp: new Date().toISOString(),
            isAI: true // 标记为AI相关消息
        };
        
        // 通过API发送消息
        await API.sendMessage(content, deviceId);
        
        // 立即刷新消息列表
        if (window.MessageHandler && typeof MessageHandler.loadMessages === 'function') {
            await MessageHandler.loadMessages(true);
        }
    },
    
    // 显示思考过程
    async showThinkingProcess() {
        const thinkingId = `thinking-${Date.now()}`;
        this.currentThinkingMessageId = thinkingId;
        
        // 创建思考消息元素
        const thinkingMessage = {
            id: thinkingId,
            type: CONFIG.MESSAGE_TYPES.AI_THINKING,
            content: CONFIG.AI.THINKING_INDICATOR,
            device_id: 'ai-system',
            timestamp: new Date().toISOString(),
            isThinking: true
        };
        
        // 添加到UI
        if (window.UI && typeof UI.addAIMessage === 'function') {
            UI.addAIMessage(thinkingMessage);
        }
        
        return thinkingId;
    },
    
    // 更新思考过程
    updateThinking(thinkingId, thinking) {
        if (window.UI && typeof UI.updateAIThinking === 'function') {
            UI.updateAIThinking(thinkingId, thinking);
        }
    },
    
    // 完成思考过程
    completeThinking(thinkingId, thinking) {
        console.log('AIHandler: 思考过程完成', { thinkingId, thinkingLength: thinking.length });
        
        // 开始显示AI响应
        this.startAIResponse();
    },
    
    // 开始AI响应
    async startAIResponse() {
        const responseId = `response-${Date.now()}`;
        this.currentResponseMessageId = responseId;
        
        // 创建响应消息元素
        const responseMessage = {
            id: responseId,
            type: CONFIG.MESSAGE_TYPES.AI_RESPONSE,
            content: '',
            device_id: 'ai-system',
            timestamp: new Date().toISOString(),
            isAIResponse: true
        };
        
        // 添加到UI
        if (window.UI && typeof UI.addAIMessage === 'function') {
            UI.addAIMessage(responseMessage);
        }
        
        return responseId;
    },
    
    // 更新AI响应
    updateResponse(chunk, fullResponse) {
        if (this.currentResponseMessageId && window.UI && typeof UI.updateAIResponse === 'function') {
            UI.updateAIResponse(this.currentResponseMessageId, chunk, fullResponse);
        }
    },
    
    // 完成AI响应
    async completeAIResponse(result) {
        console.log('AIHandler: AI响应完成', { 
            thinkingLength: result.thinking?.length || 0,
            responseLength: result.response?.length || 0
        });
        
        // 标记响应完成
        if (this.currentResponseMessageId && window.UI && typeof UI.completeAIResponse === 'function') {
            UI.completeAIResponse(this.currentResponseMessageId, result.response);
        }
        
        // 滚动到底部
        if (window.UI && typeof UI.scrollToBottom === 'function') {
            UI.scrollToBottom();
        }
    },
    
    // 处理AI错误
    async handleAIError(error) {
        console.error('AIHandler: 处理AI错误', error);
        
        // 移除思考和响应消息
        if (this.currentThinkingMessageId && window.UI && typeof UI.removeMessage === 'function') {
            UI.removeMessage(this.currentThinkingMessageId);
        }
        
        if (this.currentResponseMessageId && window.UI && typeof UI.removeMessage === 'function') {
            UI.removeMessage(this.currentResponseMessageId);
        }
        
        // 显示错误消息
        const errorMessage = error.message || CONFIG.ERRORS.AI_REQUEST_FAILED;
        if (window.UI && typeof UI.showError === 'function') {
            UI.showError(errorMessage);
        }
        
        // 添加错误消息到聊天
        const errorChatMessage = {
            id: `error-${Date.now()}`,
            type: CONFIG.MESSAGE_TYPES.AI_RESPONSE,
            content: `❌ ${errorMessage}`,
            device_id: 'ai-system',
            timestamp: new Date().toISOString(),
            isError: true
        };
        
        if (window.UI && typeof UI.addAIMessage === 'function') {
            UI.addAIMessage(errorChatMessage);
        }
    },
    
    // 取消当前AI请求
    cancelCurrentRequest() {
        if (this.isProcessing) {
            console.log('AIHandler: 取消当前AI请求');
            
            // 取消API请求
            if (window.AIAPI && typeof AIAPI.cancelCurrentRequest === 'function') {
                AIAPI.cancelCurrentRequest();
            }
            
            // 重置状态
            this.isProcessing = false;
            this.currentThinkingMessageId = null;
            this.currentResponseMessageId = null;
        }
    },
    
    // 获取AI状态
    getStatus() {
        return {
            isAIMode: this.isAIMode,
            isProcessing: this.isProcessing,
            hasThinking: !!this.currentThinkingMessageId,
            hasResponse: !!this.currentResponseMessageId
        };
    }
};

// 导出到全局
window.AIHandler = AIHandler;
