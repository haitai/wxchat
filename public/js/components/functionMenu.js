// 功能菜单组件 - 微信风格功能选项弹出层
// 提供Web端适用的功能选项界面框架

const FunctionMenu = {
    // 菜单配置 - 微信风格
    menuItems: [
        {
            id: 'photo',
            icon: '📷',
            title: '拍摄',
            action: 'photo'
        },
        {
            id: 'album',
            icon: '🖼️',
            title: '相册',
            action: 'album'
        },
        {
            id: 'video',
            icon: '📹',
            title: '视频通话',
            action: 'video'
        },
        {
            id: 'location',
            icon: '📍',
            title: '位置',
            action: 'location'
        },
        {
            id: 'red-packet',
            icon: '🧧',
            title: '红包',
            action: 'redPacket'
        },
        {
            id: 'transfer',
            icon: '💰',
            title: '转账',
            action: 'transfer'
        },
        {
            id: 'voice-input',
            icon: '🎤',
            title: '语音输入',
            action: 'voiceInput'
        },
        {
            id: 'emoji',
            icon: '😊',
            title: '表情',
            action: 'emoji'
        },
        {
            id: 'file',
            icon: '📁',
            title: '文件',
            action: 'file'
        },
        {
            id: 'music',
            icon: '🎵',
            title: '音乐',
            action: 'music'
        },
        {
            id: 'card',
            icon: '👤',
            title: '个人名片',
            action: 'card'
        },
        {
            id: 'favorite',
            icon: '⭐',
            title: '收藏',
            action: 'favorite'
        }
    ],

    // 组件状态
    isInitialized: false,

    // 初始化菜单
    init() {
        if (this.isInitialized) {
            console.log('FunctionMenu: 已经初始化过了');
            return;
        }

        console.log('FunctionMenu: 开始初始化');
        this.createMenuElement();
        this.bindEvents();
        this.isInitialized = true;
        console.log('FunctionMenu: 初始化完成');
    },

    // 创建菜单DOM元素
    createMenuElement() {
        // 检查是否已存在
        const existingMenu = document.getElementById('functionMenu');
        if (existingMenu) {
            console.log('FunctionMenu: 菜单元素已存在');
            return;
        }

        console.log('FunctionMenu: 创建菜单元素');
        const menuHTML = `
            <div class="function-menu" id="functionMenu">
                <div class="function-menu-overlay"></div>
                <div class="function-menu-content">
                    <div class="function-menu-header">
                        <h3>更多功能</h3>
                        <button class="function-menu-close" id="functionMenuClose">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path fill="currentColor" d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="function-menu-grid">
                        ${this.generateMenuItems()}
                    </div>
                </div>
            </div>
        `;

        // 插入到body中
        document.body.insertAdjacentHTML('beforeend', menuHTML);
        console.log('FunctionMenu: 菜单元素创建完成');
    },

    // 生成菜单项HTML - 微信风格
    generateMenuItems() {
        return this.menuItems.map(item => `
            <div class="function-menu-item" data-action="${item.action}" data-id="${item.id}">
                <div class="function-menu-item-icon">${item.icon}</div>
                <div class="function-menu-item-content">
                    <div class="function-menu-item-title">${item.title}</div>
                </div>
            </div>
        `).join('');
    },

    // 绑定事件
    bindEvents() {
        // 菜单项点击事件
        document.addEventListener('click', (e) => {
            const menuItem = e.target.closest('.function-menu-item');
            if (menuItem) {
                const action = menuItem.dataset.action;
                const itemId = menuItem.dataset.id;
                this.handleMenuItemClick(action, itemId);
            }
        });

        // 关闭按钮事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('#functionMenuClose')) {
                this.hide();
            }
        });

        // 遮罩层点击关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('function-menu-overlay')) {
                this.hide();
            }
        });
    },

    // 处理菜单项点击
    handleMenuItemClick(action, itemId) {
        // 分发自定义事件
        const event = new CustomEvent('functionMenu:itemClick', {
            detail: { action, itemId }
        });
        document.dispatchEvent(event);

        // 执行对应的动作
        this.executeAction(action, itemId);
        
        // 关闭菜单
        this.hide();
    },

    // 执行功能动作 - 微信风格功能
    executeAction(action, itemId) {
        switch (action) {
            case 'photo':
                this.handlePhoto();
                break;
            case 'album':
                this.handleAlbum();
                break;
            case 'video':
                this.handleVideo();
                break;
            case 'location':
                this.handleLocation();
                break;
            case 'redPacket':
                this.handleRedPacket();
                break;
            case 'transfer':
                this.handleTransfer();
                break;
            case 'voiceInput':
                this.handleVoiceInput();
                break;
            case 'emoji':
                this.handleEmoji();
                break;
            case 'file':
                this.handleFile();
                break;
            case 'music':
                this.handleMusic();
                break;
            case 'card':
                this.handleCard();
                break;
            case 'favorite':
                this.handleFavorite();
                break;
            default:
                console.log(`未实现的功能: ${action}`);
                this.showComingSoon(action);
        }
    },

    // 拍摄功能
    handlePhoto() {
        this.showComingSoon('拍摄');
    },

    // 相册功能
    handleAlbum() {
        // 触发文件选择
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.accept = 'image/*';
            fileInput.click();
        } else {
            this.showComingSoon('相册');
        }
    },

    // 视频通话功能
    handleVideo() {
        this.showComingSoon('视频通话');
    },

    // 位置功能
    handleLocation() {
        this.insertTextToInput('📍 [位置信息]');
    },

    // 红包功能
    handleRedPacket() {
        this.insertTextToInput('🧧 [红包] 恭喜发财，大吉大利！');
    },

    // 转账功能
    handleTransfer() {
        this.insertTextToInput('💰 [转账] 已向您转账');
    },

    // 语音输入功能
    handleVoiceInput() {
        this.showComingSoon('语音输入');
    },

    // 表情功能
    handleEmoji() {
        const emojis = ['😊', '👍', '❤️', '😂', '🎉', '👏', '🔥', '💯', '🥰', '😍', '🤔', '😅'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        this.insertTextToInput(randomEmoji);
    },

    // 文件功能
    handleFile() {
        // 触发文件选择
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.accept = '*/*';
            fileInput.click();
        } else {
            this.showComingSoon('文件');
        }
    },

    // 音乐功能
    handleMusic() {
        this.insertTextToInput('🎵 [音乐] 分享了一首歌曲');
    },

    // 个人名片功能
    handleCard() {
        this.insertTextToInput('👤 [个人名片] 推荐了一个联系人');
    },

    // 收藏功能
    handleFavorite() {
        this.insertTextToInput('⭐ [收藏] 分享了一个收藏');
    },

    // 显示即将推出提示
    showComingSoon(feature) {
        this.insertTextToInput(`🚧 ${feature}功能即将推出，敬请期待！`);
    },

    // 向输入框插入文本
    insertTextToInput(text) {
        const messageText = document.getElementById('messageText');
        if (!messageText) return;

        const currentValue = messageText.value;
        const cursorPos = messageText.selectionStart;
        
        const newValue = currentValue.slice(0, cursorPos) + text + currentValue.slice(cursorPos);
        messageText.value = newValue;
        
        // 设置光标位置
        const newCursorPos = cursorPos + text.length;
        messageText.setSelectionRange(newCursorPos, newCursorPos);
        
        // 触发input事件以更新UI状态
        messageText.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 聚焦输入框
        messageText.focus();
    },

    // 显示菜单
    show() {
        const menu = document.getElementById('functionMenu');
        if (menu) {
            console.log('FunctionMenu: 显示菜单');
            menu.classList.add('show');
        } else {
            console.error('FunctionMenu: 无法显示菜单，元素不存在');
        }
    },

    // 隐藏菜单
    hide() {
        const menu = document.getElementById('functionMenu');
        if (menu) {
            console.log('FunctionMenu: 隐藏菜单');
            menu.classList.remove('show');
        } else {
            console.error('FunctionMenu: 无法隐藏菜单，元素不存在');
        }
    },

    // 添加自定义菜单项
    addMenuItem(item) {
        this.menuItems.push(item);
        if (this.isInitialized) {
            this.refreshMenu();
        }
    },

    // 刷新菜单
    refreshMenu() {
        const menuGrid = document.querySelector('.function-menu-grid');
        if (menuGrid) {
            menuGrid.innerHTML = this.generateMenuItems();
        }
    }
};

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FunctionMenu;
}
