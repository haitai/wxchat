// 批量操作管理器
const BatchOperations = {
    isSelectionMode: false,
    selectedMessages: new Set(),
    
    // 初始化批量操作功能
    init() {
        this.bindEvents();
        this.createBatchUI();
    },
    
    // 创建批量操作界面
    createBatchUI() {
        // 检查是否已存在批量操作界面
        if (document.getElementById('batchOperationsBar')) {
            return;
        }
        
        const batchHTML = `
            <div class="batch-operations-bar" id="batchOperationsBar" style="display: none;">
                <div class="batch-info">
                    <span id="selectedCount">已选择 0 条消息</span>
                </div>
                <div class="batch-actions">
                    <button type="button" id="selectAllButton" class="batch-action-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                        </svg>
                        全选
                    </button>
                    <button type="button" id="deselectAllButton" class="batch-action-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                        </svg>
                        取消全选
                    </button>
                    <button type="button" id="batchDeleteButton" class="batch-action-btn delete-btn">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                        删除选中
                    </button>
                    <button type="button" id="cancelSelectionButton" class="batch-action-btn cancel-btn">
                        取消选择
                    </button>
                </div>
            </div>
        `;
        
        // 插入到消息列表上方
        const messageList = document.getElementById('messageList');
        if (messageList) {
            messageList.insertAdjacentHTML('beforebegin', batchHTML);
        }
    },
    
    // 绑定事件
    bindEvents() {
        // 等待DOM加载完成后绑定事件
        document.addEventListener('DOMContentLoaded', () => {
            this.bindBatchEvents();
        });
        
        // 如果DOM已经加载完成，直接绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindBatchEvents();
            });
        } else {
            this.bindBatchEvents();
        }
    },
    
    // 绑定批量操作相关事件
    bindBatchEvents() {
        // 批量操作按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('#selectAllButton')) {
                this.selectAll();
            } else if (e.target.closest('#deselectAllButton')) {
                this.deselectAll();
            } else if (e.target.closest('#batchDeleteButton')) {
                this.showDeleteConfirmation();
            } else if (e.target.closest('#cancelSelectionButton')) {
                this.exitSelectionMode();
            } else if (e.target.closest('.message-checkbox')) {
                const messageId = e.target.closest('.message').dataset.messageId;
                this.toggleMessageSelection(messageId);
            }
        });
        
        // 长按进入选择模式（移动端）
        let longPressTimer = null;
        document.addEventListener('touchstart', (e) => {
            const messageElement = e.target.closest('.message');
            if (messageElement && !this.isSelectionMode) {
                longPressTimer = setTimeout(() => {
                    this.enterSelectionMode();
                    const messageId = messageElement.dataset.messageId;
                    this.toggleMessageSelection(messageId);
                }, 800); // 800ms长按
            }
        });
        
        document.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        document.addEventListener('touchmove', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
    },
    
    // 进入选择模式
    enterSelectionMode() {
        this.isSelectionMode = true;
        this.selectedMessages.clear();
        
        // 显示批量操作栏
        const batchBar = document.getElementById('batchOperationsBar');
        if (batchBar) {
            batchBar.style.display = 'flex';
        }
        
        // 为所有消息添加选择框
        this.addCheckboxesToMessages();
        
        // 更新UI状态
        document.body.classList.add('selection-mode');
        this.updateSelectionCount();
    },
    
    // 退出选择模式
    exitSelectionMode() {
        this.isSelectionMode = false;
        this.selectedMessages.clear();
        
        // 隐藏批量操作栏
        const batchBar = document.getElementById('batchOperationsBar');
        if (batchBar) {
            batchBar.style.display = 'none';
        }
        
        // 移除所有选择框
        this.removeCheckboxesFromMessages();
        
        // 更新UI状态
        document.body.classList.remove('selection-mode');
    },
    
    // 为消息添加选择框
    addCheckboxesToMessages() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            if (!message.querySelector('.message-checkbox')) {
                const checkbox = document.createElement('div');
                checkbox.className = 'message-checkbox';
                checkbox.innerHTML = `
                    <input type="checkbox" id="checkbox-${message.dataset.messageId}">
                    <label for="checkbox-${message.dataset.messageId}"></label>
                `;
                message.insertBefore(checkbox, message.firstChild);
            }
        });
    },
    
    // 移除消息的选择框
    removeCheckboxesFromMessages() {
        const checkboxes = document.querySelectorAll('.message-checkbox');
        checkboxes.forEach(checkbox => checkbox.remove());
    },
    
    // 切换消息选择状态
    toggleMessageSelection(messageId) {
        if (!messageId) return;
        
        const checkbox = document.getElementById(`checkbox-${messageId}`);
        if (!checkbox) return;
        
        if (this.selectedMessages.has(messageId)) {
            this.selectedMessages.delete(messageId);
            checkbox.checked = false;
        } else {
            this.selectedMessages.add(messageId);
            checkbox.checked = true;
        }
        
        this.updateSelectionCount();
    },
    
    // 全选
    selectAll() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(message => {
            const messageId = message.dataset.messageId;
            if (messageId) {
                this.selectedMessages.add(messageId);
                const checkbox = document.getElementById(`checkbox-${messageId}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
        });
        this.updateSelectionCount();
    },
    
    // 取消全选
    deselectAll() {
        this.selectedMessages.clear();
        const checkboxes = document.querySelectorAll('.message-checkbox input');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updateSelectionCount();
    },
    
    // 更新选择计数
    updateSelectionCount() {
        const countElement = document.getElementById('selectedCount');
        if (countElement) {
            countElement.textContent = `已选择 ${this.selectedMessages.size} 条消息`;
        }
        
        // 更新删除按钮状态
        const deleteButton = document.getElementById('batchDeleteButton');
        if (deleteButton) {
            deleteButton.disabled = this.selectedMessages.size === 0;
        }
    },
    
    // 显示删除确认对话框
    showDeleteConfirmation() {
        if (this.selectedMessages.size === 0) {
            Utils.showNotification('请先选择要删除的消息', 'warning');
            return;
        }
        
        const confirmHTML = `
            <div class="batch-delete-modal" id="batchDeleteModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>⚠️ 确认删除</h3>
                        <button type="button" class="modal-close" id="closeBatchDeleteModal">×</button>
                    </div>
                    <div class="modal-body">
                        <p>您确定要删除选中的 <strong>${this.selectedMessages.size}</strong> 条消息吗？</p>
                        <p class="warning-text">此操作不可撤销，相关文件也将被永久删除。</p>
                        <div class="confirm-input">
                            <label for="batchDeleteConfirmCode">请输入确认码 <strong>1234</strong> 以确认删除：</label>
                            <input type="text" id="batchDeleteConfirmCode" placeholder="输入确认码" maxlength="4">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" id="cancelBatchDelete" class="btn-cancel">取消</button>
                        <button type="button" id="confirmBatchDelete" class="btn-delete">确认删除</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', confirmHTML);
        
        // 绑定确认对话框事件
        this.bindDeleteModalEvents();
    },
    
    // 绑定删除确认对话框事件
    bindDeleteModalEvents() {
        const modal = document.getElementById('batchDeleteModal');
        const closeBtn = document.getElementById('closeBatchDeleteModal');
        const cancelBtn = document.getElementById('cancelBatchDelete');
        const confirmBtn = document.getElementById('confirmBatchDelete');
        const confirmInput = document.getElementById('batchDeleteConfirmCode');
        
        // 关闭对话框
        const closeModal = () => {
            if (modal) {
                modal.remove();
            }
        };
        
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        
        // 点击背景关闭
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // 确认删除
        confirmBtn?.addEventListener('click', () => {
            const confirmCode = confirmInput?.value.trim();
            if (confirmCode === '1234') {
                closeModal();
                this.performBatchDelete();
            } else {
                Utils.showNotification('确认码错误，请输入 1234', 'error');
                confirmInput?.focus();
            }
        });
        
        // 回车确认
        confirmInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmBtn?.click();
            }
        });
        
        // 聚焦输入框
        setTimeout(() => {
            confirmInput?.focus();
        }, 100);
    },
    
    // 执行批量删除
    async performBatchDelete() {
        if (this.selectedMessages.size === 0) return;
        
        try {
            // 显示删除进度
            Utils.showNotification('正在删除消息...', 'info');
            
            const messageIds = Array.from(this.selectedMessages);
            const response = await API.batchDeleteMessages(messageIds, '1234');
            
            if (response.success) {
                Utils.showNotification(response.data.message, 'success');
                
                // 从UI中移除已删除的消息
                messageIds.forEach(messageId => {
                    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                    if (messageElement) {
                        messageElement.remove();
                    }
                });
                
                // 退出选择模式
                this.exitSelectionMode();
                
                // 重新加载消息列表
                if (typeof MessageHandler !== 'undefined') {
                    MessageHandler.loadMessages();
                }
            } else {
                Utils.showNotification(`删除失败: ${response.error}`, 'error');
            }
        } catch (error) {
            Utils.showNotification(`删除出错: ${error.message}`, 'error');
        }
    }
};

// 导出到全局
window.BatchOperations = BatchOperations;
