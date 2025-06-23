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

            // 显示思考过程（临时前端显示）
            const thinkingElement = this.addMessageDirectly({
                id: `thinking-${Date.now()}`,
                type: 'ai_thinking',
                content: '🤔 AI正在思考...',
                device_id: 'ai-system',
                timestamp: new Date().toISOString(),
                isThinking: true
            });

            // 调用AI API
            const result = await AIAPI.streamChat(cleanContent);

            // 移除思考消息
            if (thinkingElement && thinkingElement.parentNode) {
                thinkingElement.parentNode.removeChild(thinkingElement);
            }

            // 直接存储最终的AI响应到数据库
            await this.storeAIResponse(result.response || '抱歉，我无法生成回答。');

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

        try {
            // 通过API存储思考消息到数据库
            const response = await fetch('/api/ai/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    content: '🤔 AI正在思考...',
                    deviceId: 'ai-system',
                    type: 'ai_thinking'
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('AIHandler: 思考消息已存储到数据库', result);

                // 触发消息刷新
                if (window.MessageHandler && typeof MessageHandler.loadMessages === 'function') {
                    await MessageHandler.loadMessages(true);
                }

                return result.data.id; // 返回数据库中的真实ID
            } else {
                console.error('AIHandler: 思考消息存储失败');
                // 降级到前端显示
                return this.showThinkingProcessFallback();
            }
        } catch (error) {
            console.error('AIHandler: 思考消息API调用失败', error);
            // 降级到前端显示
            return this.showThinkingProcessFallback();
        }
    },

    // 降级方案：前端显示思考过程
    showThinkingProcessFallback() {
        const thinkingId = `thinking-${Date.now()}`;
        this.currentThinkingMessageId = thinkingId;

        // 直接添加到DOM作为备用方案
        this.addMessageDirectly({
            id: thinkingId,
            type: 'ai_thinking',
            content: '🤔 AI正在思考...',
            device_id: 'ai-system',
            timestamp: new Date().toISOString(),
            isThinking: true
        });

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
            type: 'ai_response', // 直接使用字符串
            content: '',
            device_id: 'ai-system',
            timestamp: new Date().toISOString(),
            isAIResponse: true
        };

        // 添加到UI
        console.log('AIHandler: 准备添加响应消息到UI', { responseMessage });
        if (window.UI && typeof UI.addAIMessage === 'function') {
            UI.addAIMessage(responseMessage);
        } else {
            console.error('AIHandler: UI.addAIMessage 方法不可用');
            // 尝试直接添加到DOM作为备用方案
            this.addMessageDirectly(responseMessage);
        }

        return responseId;
    },

    // 存储AI响应到数据库
    async storeAIResponse(content) {
        try {
            console.log('AIHandler: 存储AI响应到数据库', { content });

            const response = await fetch('/api/ai/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    content: content,
                    deviceId: 'ai-system',
                    type: 'ai_response'
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('AIHandler: AI响应已存储到数据库', result);

                // 触发消息刷新，显示新的AI响应
                if (window.MessageHandler && typeof MessageHandler.loadMessages === 'function') {
                    await MessageHandler.loadMessages(true);
                }

                return result.data.id;
            } else {
                console.error('AIHandler: AI响应存储失败');
                throw new Error('存储AI响应失败');
            }
        } catch (error) {
            console.error('AIHandler: 存储AI响应时出错', error);
            // 降级处理：直接在前端显示
            this.addMessageDirectly({
                id: `response-${Date.now()}`,
                type: 'ai_response',
                content: content,
                device_id: 'ai-system',
                timestamp: new Date().toISOString(),
                isAIResponse: true
            });
        }
    },

    // 直接添加消息到DOM（备用方案）
    addMessageDirectly(message) {
        console.log('AIHandler: 使用备用方案直接添加消息到DOM');

        const messageList = document.getElementById('messageList');
        if (!messageList) {
            console.error('AIHandler: 找不到messageList元素');
            return null;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai fade-in';
        messageDiv.dataset.messageId = message.id;
        messageDiv.innerHTML = `
            <div class="message-content" style="background: #1e90ff; color: white; padding: 12px; border-radius: 8px;">
                <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">🤖 AI助手</div>
                <div id="ai-msg-${message.id}">${message.content || '正在处理...'}</div>
            </div>
            <div class="message-meta">
                <span>AI助手</span>
                <span class="message-time">${new Date().toLocaleTimeString()}</span>
            </div>
        `;

        messageList.appendChild(messageDiv);
        messageList.scrollTop = messageList.scrollHeight;

        console.log('AIHandler: 消息已直接添加到DOM');
        return messageDiv;
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

        try {
            // 将最终的AI响应存储到数据库
            const response = await fetch('/api/ai/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    content: result.response || '抱歉，我无法生成回答。',
                    deviceId: 'ai-system',
                    type: 'ai_response'
                })
            });

            if (response.ok) {
                const apiResult = await response.json();
                console.log('AIHandler: AI响应已存储到数据库', apiResult);

                // 触发消息刷新，显示完整的对话
                if (window.MessageHandler && typeof MessageHandler.loadMessages === 'function') {
                    await MessageHandler.loadMessages(true);
                }
            } else {
                console.error('AIHandler: AI响应存储失败');
                // 降级处理：直接在前端显示
                this.completeAIResponseFallback(result);
            }
        } catch (error) {
            console.error('AIHandler: AI响应API调用失败', error);
            // 降级处理：直接在前端显示
            this.completeAIResponseFallback(result);
        }
    },

    // 降级方案：前端显示AI响应
    completeAIResponseFallback(result) {
        // 直接添加AI响应到DOM
        this.addMessageDirectly({
            id: `response-${Date.now()}`,
            type: 'ai_response',
            content: result.response || '抱歉，我无法生成回答。',
            device_id: 'ai-system',
            timestamp: new Date().toISOString(),
            isAIResponse: true
        });
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
