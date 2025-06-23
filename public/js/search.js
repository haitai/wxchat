// 搜索功能管理器
const Search = {
    isSearchMode: false,
    currentQuery: '',
    currentType: 'all',
    currentResults: [],
    searchOffset: 0,
    searchLimit: 20,
    hasMore: false,
    
    // 初始化搜索功能
    init() {
        this.bindEvents();
        this.createSearchUI();
    },
    
    // 创建搜索界面
    createSearchUI() {
        // 检查是否已存在搜索界面
        if (document.getElementById('searchContainer')) {
            return;
        }
        
        const searchHTML = `
            <div class="search-container" id="searchContainer" style="display: none;">
                <div class="search-header">
                    <div class="search-input-wrapper">
                        <input type="text" id="searchInput" placeholder="搜索消息和文件..." class="search-input">
                        <button type="button" id="searchButton" class="search-button">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path fill="currentColor" d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
                            </svg>
                        </button>
                        <button type="button" id="closeSearchButton" class="close-search-button">
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="search-filters">
                        <select id="searchType" class="search-type-select">
                            <option value="all">全部</option>
                            <option value="text">文本消息</option>
                            <option value="file">文件</option>
                        </select>
                        
                        <div class="search-date-range">
                            <input type="date" id="searchStartDate" class="search-date-input" title="开始日期">
                            <span class="date-separator">至</span>
                            <input type="date" id="searchEndDate" class="search-date-input" title="结束日期">
                        </div>
                        
                        <button type="button" id="clearFiltersButton" class="clear-filters-button" title="清除筛选">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="search-results" id="searchResults">
                    <div class="search-status" id="searchStatus">
                        <div class="search-tips">
                            <p>💡 搜索小贴士：</p>
                            <ul>
                                <li>输入关键词搜索消息内容或文件名</li>
                                <li>选择类型可以精确搜索文本或文件</li>
                                <li>设置日期范围可以缩小搜索范围</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="search-result-list" id="searchResultList"></div>
                    
                    <div class="search-load-more" id="searchLoadMore" style="display: none;">
                        <button type="button" class="load-more-button">加载更多结果</button>
                    </div>
                </div>
            </div>
        `;
        
        // 插入到聊天容器前面
        const chatContainer = document.querySelector('.chat-container');
        chatContainer.insertAdjacentHTML('beforebegin', searchHTML);
    },
    
    // 绑定事件
    bindEvents() {
        // 等待DOM加载完成后绑定事件
        document.addEventListener('DOMContentLoaded', () => {
            this.bindSearchEvents();
        });
        
        // 如果DOM已经加载完成，直接绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindSearchEvents();
            });
        } else {
            this.bindSearchEvents();
        }
    },
    
    // 绑定搜索相关事件
    bindSearchEvents() {
        // 搜索按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('#searchButton')) {
                this.performSearch();
            } else if (e.target.closest('#closeSearchButton')) {
                this.closeSearch();
            } else if (e.target.closest('#clearFiltersButton')) {
                this.clearFilters();
            } else if (e.target.closest('.load-more-button')) {
                this.loadMoreResults();
            }
        });
        
        // 搜索输入框回车
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'searchInput' && e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // 筛选条件变化
        document.addEventListener('change', (e) => {
            if (e.target.id === 'searchType' || 
                e.target.id === 'searchStartDate' || 
                e.target.id === 'searchEndDate') {
                if (this.currentQuery) {
                    this.performSearch();
                }
            }
        });
    },
    
    // 显示搜索界面
    showSearch() {
        this.isSearchMode = true;
        const searchContainer = document.getElementById('searchContainer');
        const chatContainer = document.querySelector('.chat-container');
        
        if (searchContainer && chatContainer) {
            searchContainer.style.display = 'block';
            chatContainer.style.display = 'none';
            
            // 聚焦搜索输入框
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
            }
        }
        
        // 更新UI状态
        UI.setSearchMode(true);
    },
    
    // 关闭搜索界面
    closeSearch() {
        this.isSearchMode = false;
        const searchContainer = document.getElementById('searchContainer');
        const chatContainer = document.querySelector('.chat-container');
        
        if (searchContainer && chatContainer) {
            searchContainer.style.display = 'none';
            chatContainer.style.display = 'block';
        }
        
        // 清空搜索结果
        this.currentQuery = '';
        this.currentResults = [];
        this.searchOffset = 0;
        
        // 更新UI状态
        UI.setSearchMode(false);
    },
    
    // 执行搜索
    async performSearch(loadMore = false) {
        const searchInput = document.getElementById('searchInput');
        const searchType = document.getElementById('searchType');
        const startDate = document.getElementById('searchStartDate');
        const endDate = document.getElementById('searchEndDate');
        
        if (!searchInput) return;
        
        const query = searchInput.value.trim();
        if (!query) {
            this.showSearchStatus('请输入搜索关键词');
            return;
        }
        
        // 如果是新搜索，重置偏移量
        if (!loadMore) {
            this.searchOffset = 0;
            this.currentResults = [];
        }
        
        this.currentQuery = query;
        this.currentType = searchType ? searchType.value : 'all';
        
        // 显示加载状态
        this.showSearchStatus('搜索中...', true);
        
        try {
            const params = new URLSearchParams({
                q: query,
                type: this.currentType,
                limit: this.searchLimit,
                offset: this.searchOffset
            });
            
            if (startDate && startDate.value) {
                params.append('startDate', startDate.value);
            }
            if (endDate && endDate.value) {
                params.append('endDate', endDate.value);
            }
            
            const headers = Auth ? Auth.addAuthHeader({}) : {};
            const response = await fetch(`/api/search?${params}`, { headers });
            const data = await response.json();
            
            if (data.success) {
                if (loadMore) {
                    this.currentResults = [...this.currentResults, ...data.data];
                } else {
                    this.currentResults = data.data;
                }
                
                this.hasMore = data.hasMore;
                this.searchOffset += this.searchLimit;
                
                this.displaySearchResults(data.total);
            } else {
                this.showSearchStatus(`搜索失败: ${data.error}`);
            }
        } catch (error) {
            this.showSearchStatus(`搜索出错: ${error.message}`);
        }
    },
    
    // 显示搜索结果
    displaySearchResults(total) {
        const resultList = document.getElementById('searchResultList');
        const loadMoreBtn = document.getElementById('searchLoadMore');
        
        if (!resultList) return;
        
        if (this.currentResults.length === 0) {
            this.showSearchStatus('未找到相关结果');
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }
        
        // 显示结果统计
        this.showSearchStatus(`找到 ${total} 条相关结果`);
        
        // 渲染搜索结果
        resultList.innerHTML = this.currentResults.map(message => 
            this.renderSearchResult(message)
        ).join('');
        
        // 显示/隐藏加载更多按钮
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.hasMore ? 'block' : 'none';
        }
        
        // 高亮搜索关键词
        this.highlightSearchTerms();
    },
    
    // 渲染单个搜索结果
    renderSearchResult(message) {
        const time = Utils.formatTime(message.timestamp);
        const deviceName = Utils.getDeviceName(message.device_id);
        
        if (message.type === 'text') {
            return `
                <div class="search-result-item" data-message-id="${message.id}">
                    <div class="search-result-header">
                        <span class="search-result-type">💬 文本消息</span>
                        <span class="search-result-time">${time}</span>
                        <span class="search-result-device">${deviceName}</span>
                    </div>
                    <div class="search-result-content">
                        ${Utils.escapeHtml(message.content)}
                    </div>
                </div>
            `;
        } else if (message.type === 'file') {
            const fileIcon = UI.getFileIcon(message.original_name);
            const fileSize = Utils.formatFileSize(message.file_size);
            
            return `
                <div class="search-result-item" data-message-id="${message.id}">
                    <div class="search-result-header">
                        <span class="search-result-type">📁 文件</span>
                        <span class="search-result-time">${time}</span>
                        <span class="search-result-device">${deviceName}</span>
                    </div>
                    <div class="search-result-content file-result">
                        <div class="file-info">
                            <span class="file-icon">${fileIcon}</span>
                            <div class="file-details">
                                <div class="file-name">${Utils.escapeHtml(message.original_name)}</div>
                                <div class="file-size">${fileSize}</div>
                            </div>
                        </div>
                        <a href="/api/files/download/${message.r2_key}" 
                           class="file-download-btn" 
                           download="${message.original_name}">
                            下载
                        </a>
                    </div>
                </div>
            `;
        }
        
        return '';
    },
    
    // 高亮搜索关键词
    highlightSearchTerms() {
        if (!this.currentQuery) return;
        
        const resultItems = document.querySelectorAll('.search-result-content');
        const query = this.currentQuery.toLowerCase();
        
        resultItems.forEach(item => {
            const text = item.textContent;
            const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
            
            if (regex.test(text)) {
                item.innerHTML = item.innerHTML.replace(regex, '<mark class="search-highlight">$1</mark>');
            }
        });
    },
    
    // 转义正则表达式特殊字符
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    
    // 显示搜索状态
    showSearchStatus(message, isLoading = false) {
        const statusElement = document.getElementById('searchStatus');
        if (!statusElement) return;
        
        if (isLoading) {
            statusElement.innerHTML = `
                <div class="search-loading">
                    <div class="loading-spinner"></div>
                    <span>${message}</span>
                </div>
            `;
        } else {
            statusElement.innerHTML = `<div class="search-message">${message}</div>`;
        }
    },
    
    // 加载更多结果
    async loadMoreResults() {
        if (!this.hasMore || !this.currentQuery) return;
        await this.performSearch(true);
    },
    
    // 清除筛选条件
    clearFilters() {
        const searchType = document.getElementById('searchType');
        const startDate = document.getElementById('searchStartDate');
        const endDate = document.getElementById('searchEndDate');
        
        if (searchType) searchType.value = 'all';
        if (startDate) startDate.value = '';
        if (endDate) endDate.value = '';
        
        // 如果有搜索关键词，重新搜索
        if (this.currentQuery) {
            this.performSearch();
        }
    }
};

// 导出到全局
window.Search = Search;
