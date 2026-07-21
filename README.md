# 文件传输助手 wxchat v2

基于 Cloudflare Workers 的跨设备文件 / 消息传输助手。  
v2 为全量重构版：微信风格 UI、移动端极致适配、密钥服务端托管、功能全保留。

## 功能

- 密码登录 + JWT 会话（含登录失败锁定）
- 文本消息 / 文件传输 / 图片预览 / Markdown
- SSE 实时同步（长轮询降级）
- 多条件搜索 + 历史 + 定位消息
- AI 对话（服务端代理流式）
- AI 绘画（服务端代理 + 自动入库）
- 一键清空数据
- PWA 安装 / 离线缓存

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML/CSS/JS，微信风 Design Tokens |
| 后端 | Hono + Cloudflare Workers |
| 数据库 | Cloudflare D1 |
| 文件 | Cloudflare R2 |
| 静态资源 | Workers Assets (`ASSETS`) |

## 快速部署

```bash
npm install
npx wrangler login

# 创建资源（首次）
npx wrangler d1 create wxchat
npx wrangler r2 bucket create wxchat
# 把 database_id 写入 wrangler.toml

# 初始化表结构
npm run db:remote

# 配置密钥（强烈建议用 Secrets，不要写进仓库）
npx wrangler secret put ACCESS_PASSWORD
npx wrangler secret put JWT_SECRET
npx wrangler secret put CLEAR_CONFIRM_CODE
npx wrangler secret put AI_API_KEY
npx wrangler secret put IMAGE_GEN_API_KEY

# 本地调试 / 部署
npm run dev
npm run deploy
```

健康检查：`GET /api/health`

## 环境变量

| 变量 | 说明 |
|---|---|
| `ACCESS_PASSWORD` | 访问密码 |
| `JWT_SECRET` | JWT 密钥（≥32 位随机） |
| `SESSION_EXPIRE_HOURS` | 会话小时，默认 24 |
| `MAX_LOGIN_ATTEMPTS` | 登录失败锁定次数 |
| `LOGIN_LOCKOUT_MINUTES` | 锁定分钟 |
| `CLEAR_CONFIRM_CODE` | 清空确认码 |
| `MAX_FILE_SIZE` | 单文件上限字节，0 不限 |
| `AI_API_KEY` | AI 对话密钥（仅服务端） |
| `IMAGE_GEN_API_KEY` | 生图密钥（仅服务端） |
| `AI_API_BASE_URL` / `AI_MODEL` 等 | 模型配置 |

## 指令

| 指令 | 作用 |
|---|---|
| `/clear` `/clear-all` `清空数据` | 清空全部数据 |
| `/logout` | 登出 |
| `/pwa` `/install` | 安装 PWA |

## 许可

CC BY-NC-SA 4.0（见 LICENSE）
