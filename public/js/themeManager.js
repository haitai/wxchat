// 主题管理器
const ThemeManager = {
    currentTheme: 'light',
    themes: {
        light: {
            name: '浅色主题',
            icon: '☀️',
            class: 'theme-light'
        },
        dark: {
            name: '深色主题', 
            icon: '🌙',
            class: 'theme-dark'
        }
    },
    
    // 初始化主题管理器
    init() {
        this.loadSavedTheme();
        this.bindEvents();
        this.createThemeUI();
        this.applyTheme(this.currentTheme);
    },
    
    // 创建主题切换界面
    createThemeUI() {
        // 检查是否已存在主题切换按钮
        if (document.getElementById('themeToggleButton')) {
            return;
        }
        
        // 在输入区域添加主题切换按钮
        const inputWrapper = document.querySelector('.input-wrapper');
        if (inputWrapper) {
            const themeButton = document.createElement('button');
            themeButton.type = 'button';
            themeButton.id = 'themeToggleButton';
            themeButton.className = 'theme-toggle-button';
            themeButton.title = '切换主题';
            themeButton.innerHTML = `
                <span class="theme-icon">${this.themes[this.currentTheme].icon}</span>
            `;
            
            // 插入到文件按钮后面
            const fileButton = document.getElementById('fileButton');
            if (fileButton) {
                fileButton.insertAdjacentElement('afterend', themeButton);
            }
        }
    },
    
    // 绑定事件
    bindEvents() {
        // 等待DOM加载完成后绑定事件
        document.addEventListener('DOMContentLoaded', () => {
            this.bindThemeEvents();
        });
        
        // 如果DOM已经加载完成，直接绑定
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindThemeEvents();
            });
        } else {
            this.bindThemeEvents();
        }
    },
    
    // 绑定主题相关事件
    bindThemeEvents() {
        // 主题切换按钮点击
        document.addEventListener('click', (e) => {
            if (e.target.closest('#themeToggleButton')) {
                this.toggleTheme();
            }
        });
        
        // 键盘快捷键 Ctrl+Shift+T
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
        
        // 监听系统主题变化
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addListener((e) => {
                // 如果用户没有手动设置过主题，跟随系统主题
                const savedTheme = localStorage.getItem('wxchat-theme');
                if (!savedTheme) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },
    
    // 切换主题
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.saveTheme(newTheme);
        
        // 显示切换提示
        this.showThemeNotification(newTheme);
    },
    
    // 应用主题
    applyTheme(theme) {
        if (!this.themes[theme]) {
            console.warn('未知主题:', theme);
            return;
        }
        
        const body = document.body;
        const html = document.documentElement;
        
        // 移除所有主题类
        Object.values(this.themes).forEach(themeConfig => {
            body.classList.remove(themeConfig.class);
            html.classList.remove(themeConfig.class);
        });
        
        // 添加新主题类
        body.classList.add(this.themes[theme].class);
        html.classList.add(this.themes[theme].class);
        
        // 更新当前主题
        this.currentTheme = theme;
        
        // 更新主题按钮图标
        this.updateThemeButton();
        
        // 更新meta标签（移动端状态栏）
        this.updateMetaThemeColor(theme);
        
        // 触发主题变化事件
        this.dispatchThemeChangeEvent(theme);
    },
    
    // 更新主题按钮
    updateThemeButton() {
        const themeButton = document.getElementById('themeToggleButton');
        if (themeButton) {
            const themeIcon = themeButton.querySelector('.theme-icon');
            if (themeIcon) {
                themeIcon.textContent = this.themes[this.currentTheme].icon;
            }
            themeButton.title = `切换到${this.themes[this.currentTheme === 'light' ? 'dark' : 'light'].name}`;
        }
    },
    
    // 更新meta主题颜色
    updateMetaThemeColor(theme) {
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }
        
        // 设置主题颜色
        const themeColors = {
            light: '#07c160',
            dark: '#1a1a1a'
        };
        
        themeColorMeta.content = themeColors[theme] || themeColors.light;
    },
    
    // 保存主题设置
    saveTheme(theme) {
        try {
            localStorage.setItem('wxchat-theme', theme);
        } catch (error) {
            console.warn('保存主题设置失败:', error);
        }
    },
    
    // 加载保存的主题
    loadSavedTheme() {
        try {
            const savedTheme = localStorage.getItem('wxchat-theme');
            if (savedTheme && this.themes[savedTheme]) {
                this.currentTheme = savedTheme;
                return;
            }
        } catch (error) {
            console.warn('加载主题设置失败:', error);
        }
        
        // 如果没有保存的主题，检测系统主题偏好
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.currentTheme = 'dark';
        } else {
            this.currentTheme = 'light';
        }
    },
    
    // 显示主题切换通知
    showThemeNotification(theme) {
        const themeName = this.themes[theme].name;
        const themeIcon = this.themes[theme].icon;
        
        if (typeof Utils !== 'undefined' && Utils.showNotification) {
            Utils.showNotification(`${themeIcon} 已切换到${themeName}`, 'success');
        } else {
            // 简单的通知实现
            this.showSimpleNotification(`${themeIcon} 已切换到${themeName}`);
        }
    },
    
    // 简单通知实现
    showSimpleNotification(message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'theme-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--notification-bg, #333);
            color: var(--notification-color, white);
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 14px;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    },
    
    // 触发主题变化事件
    dispatchThemeChangeEvent(theme) {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: theme,
                themeConfig: this.themes[theme]
            }
        });
        document.dispatchEvent(event);
    },
    
    // 获取当前主题
    getCurrentTheme() {
        return this.currentTheme;
    },
    
    // 获取主题配置
    getThemeConfig(theme) {
        return this.themes[theme] || null;
    },
    
    // 检查是否为深色主题
    isDarkTheme() {
        return this.currentTheme === 'dark';
    },
    
    // 检查是否为浅色主题
    isLightTheme() {
        return this.currentTheme === 'light';
    }
};

// 导出到全局
window.ThemeManager = ThemeManager;
