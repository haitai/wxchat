// 消息导出管理器
const ExportManager = {
    isExportMode: false,
    
    // 初始化导出功能
    init() {
        this.bindEvents();
        this.createExportUI();
    },
    
    // 创建导出界面
    createExportUI() {
        // 检查是否已存在导出界面
        if (document.getElementById('exportContainer')) {
            return;
        }
        
        const exportHTML = `
            <div class="export-container" id="exportContainer" style="display: none;">
                <div class="export-header">
                    <div class="export-title">
                        <h2>📤 导出聊天记录</h2>
                        <button type="button" id="closeExportButton" class="close-export-button">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="export-description">
                        <p>选择导出格式和时间范围，将您的聊天记录保存到本地。</p>
                    </div>
                </div>
                
                <div class="export-content">
                    <div class="export-form">
                        <div class="form-group">
                            <label for="exportFormat">导出格式</label>
                            <select id="exportFormat" class="export-select">
                                <option value="json">JSON - 完整数据格式</option>
                                <option value="html">HTML - 网页格式（推荐）</option>
                                <option value="txt">TXT - 纯文本格式</option>
                            </select>
                            <div class="format-description" id="formatDescription">
                                包含完整的消息数据，适合程序处理和备份
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>时间范围</label>
                            <div class="date-range-group">
                                <div class="date-input-group">
                                    <label for="exportStartDate">开始日期</label>
                                    <input type="date" id="exportStartDate" class="export-date-input">
                                </div>
                                <div class="date-separator">至</div>
                                <div class="date-input-group">
                                    <label for="exportEndDate">结束日期</label>
                                    <input type="date" id="exportEndDate" class="export-date-input">
                                </div>
                            </div>
                            <div class="date-presets">
                                <button type="button" class="preset-btn" data-days="7">最近7天</button>
                                <button type="button" class="preset-btn" data-days="30">最近30天</button>
                                <button type="button" class="preset-btn" data-days="90">最近90天</button>
                                <button type="button" class="preset-btn" data-days="0">全部</button>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>导出选项</label>
                            <div class="export-options">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="includeFiles" checked>
                                    <span class="checkmark"></span>
                                    包含文件信息
                                </label>
                                <div class="option-description">
                                    导出时包含文件名、大小等信息（不包含文件内容）
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="exportLimit">导出数量限制</label>
                            <select id="exportLimit" class="export-select">
                                <option value="100">最近100条消息</option>
                                <option value="500">最近500条消息</option>
                                <option value="1000" selected>最近1000条消息</option>
                                <option value="5000">最近5000条消息</option>
                                <option value="10000">全部消息（最多10000条）</option>
                            </select>
                        </div>
                        
                        <div class="export-preview" id="exportPreview">
                            <div class="preview-info">
                                <span class="preview-icon">📊</span>
                                <span class="preview-text">选择条件后将显示预览信息</span>
                            </div>
                        </div>
                        
                        <div class="export-actions">
                            <button type="button" id="previewExportButton" class="export-btn preview-btn">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                                </svg>
                                预览
                            </button>
                            <button type="button" id="startExportButton" class="export-btn export-btn-primary">
                                <svg viewBox="0 0 24 24" width="16" height="16">
                                    <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                                </svg>
                                开始导出
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 插入到聊天容器前面
        const chatContainer = document.querySelector('.chat-container');
        chatContainer.insertAdjacentHTML('beforebegin', exportHTML);
    },
    
    // 绑定事件
    bindEvents() {
        // 等待DOM加载完成后绑定事件
        document.addEventListener('DOMContentLoaded', () => {
            this.bindExportEvents();
        });
        
        // 如果DOM已经加载完成，直接绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindExportEvents();
            });
        } else {
            this.bindExportEvents();
        }
    },
    
    // 绑定导出相关事件
    bindExportEvents() {
        // 关闭按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('#closeExportButton')) {
                this.closeExport();
            } else if (e.target.closest('#previewExportButton')) {
                this.previewExport();
            } else if (e.target.closest('#startExportButton')) {
                this.startExport();
            } else if (e.target.closest('.preset-btn')) {
                const days = parseInt(e.target.closest('.preset-btn').dataset.days);
                this.setDatePreset(days);
            }
        });
        
        // 格式选择变化
        document.addEventListener('change', (e) => {
            if (e.target.id === 'exportFormat') {
                this.updateFormatDescription();
            }
            if (e.target.id === 'exportStartDate' || 
                e.target.id === 'exportEndDate' || 
                e.target.id === 'exportLimit' ||
                e.target.id === 'includeFiles') {
                this.updatePreview();
            }
        });
    },
    
    // 显示导出界面
    showExport() {
        this.isExportMode = true;
        const exportContainer = document.getElementById('exportContainer');
        const chatContainer = document.querySelector('.chat-container');
        
        if (exportContainer && chatContainer) {
            exportContainer.style.display = 'block';
            chatContainer.style.display = 'none';
            
            // 关闭其他界面
            const searchContainer = document.getElementById('searchContainer');
            const fileManagerContainer = document.getElementById('fileManagerContainer');
            if (searchContainer) searchContainer.style.display = 'none';
            if (fileManagerContainer) fileManagerContainer.style.display = 'none';
        }
        
        // 初始化表单
        this.initializeForm();
        this.updateFormatDescription();
        this.updatePreview();
        
        // 更新UI状态
        UI.setExportMode(true);
    },
    
    // 关闭导出界面
    closeExport() {
        this.isExportMode = false;
        const exportContainer = document.getElementById('exportContainer');
        const chatContainer = document.querySelector('.chat-container');
        
        if (exportContainer && chatContainer) {
            exportContainer.style.display = 'none';
            chatContainer.style.display = 'block';
        }
        
        // 更新UI状态
        UI.setExportMode(false);
    },
    
    // 初始化表单
    initializeForm() {
        // 设置默认结束日期为今天
        const today = new Date().toISOString().split('T')[0];
        const endDateInput = document.getElementById('exportEndDate');
        if (endDateInput) {
            endDateInput.value = today;
        }
        
        // 设置默认开始日期为30天前
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDateInput = document.getElementById('exportStartDate');
        if (startDateInput) {
            startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        }
    },
    
    // 设置日期预设
    setDatePreset(days) {
        const endDateInput = document.getElementById('exportEndDate');
        const startDateInput = document.getElementById('exportStartDate');
        
        if (!endDateInput || !startDateInput) return;
        
        const today = new Date();
        endDateInput.value = today.toISOString().split('T')[0];
        
        if (days === 0) {
            // 全部
            startDateInput.value = '';
        } else {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDateInput.value = startDate.toISOString().split('T')[0];
        }
        
        this.updatePreview();
    },
    
    // 更新格式描述
    updateFormatDescription() {
        const formatSelect = document.getElementById('exportFormat');
        const descriptionElement = document.getElementById('formatDescription');
        
        if (!formatSelect || !descriptionElement) return;
        
        const descriptions = {
            json: '包含完整的消息数据，适合程序处理和备份',
            html: '美观的网页格式，可在浏览器中查看，支持打印',
            txt: '纯文本格式，兼容性最好，文件最小'
        };
        
        descriptionElement.textContent = descriptions[formatSelect.value] || '';
    },
    
    // 更新预览信息
    async updatePreview() {
        const previewElement = document.getElementById('exportPreview');
        if (!previewElement) return;
        
        try {
            // 这里可以调用API获取预览信息
            // 暂时显示静态信息
            previewElement.innerHTML = `
                <div class="preview-info">
                    <span class="preview-icon">📊</span>
                    <span class="preview-text">准备导出聊天记录...</span>
                </div>
            `;
        } catch (error) {
            previewElement.innerHTML = `
                <div class="preview-info error">
                    <span class="preview-icon">❌</span>
                    <span class="preview-text">预览失败: ${error.message}</span>
                </div>
            `;
        }
    },
    
    // 预览导出
    async previewExport() {
        Utils.showNotification('预览功能开发中...', 'info');
    },
    
    // 开始导出
    async startExport() {
        try {
            const formatSelect = document.getElementById('exportFormat');
            const startDateInput = document.getElementById('exportStartDate');
            const endDateInput = document.getElementById('exportEndDate');
            const includeFilesInput = document.getElementById('includeFiles');
            const limitSelect = document.getElementById('exportLimit');
            
            if (!formatSelect || !limitSelect) {
                throw new Error('表单元素未找到');
            }
            
            const params = {
                format: formatSelect.value,
                limit: limitSelect.value,
                includeFiles: includeFilesInput ? includeFilesInput.checked : false
            };
            
            if (startDateInput && startDateInput.value) {
                params.startDate = startDateInput.value;
            }
            if (endDateInput && endDateInput.value) {
                params.endDate = endDateInput.value;
            }
            
            // 显示导出进度
            Utils.showNotification('正在导出聊天记录...', 'info');
            
            // 调用导出API
            await this.downloadExport(params);
            
            Utils.showNotification('导出完成！', 'success');
            
        } catch (error) {
            Utils.showNotification(`导出失败: ${error.message}`, 'error');
        }
    },
    
    // 下载导出文件
    async downloadExport(params) {
        try {
            const queryParams = new URLSearchParams(params);
            const headers = Auth ? Auth.addAuthHeader({}) : {};
            
            const response = await fetch(`/api/export?${queryParams}`, {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '导出失败');
            }
            
            // 获取文件名
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'wxchat_export';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            // 下载文件
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('下载导出文件失败:', error);
            throw error;
        }
    }
};

// 导出到全局
window.ExportManager = ExportManager;
