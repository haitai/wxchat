import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

const app = new Hono()

// CORS配置
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 鉴权工具函数
const AuthUtils = {
  // 生成简单的JWT token
  async generateToken(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' }
    const encodedHeader = btoa(JSON.stringify(header))
    const encodedPayload = btoa(JSON.stringify(payload))
    const signature = await this.sign(`${encodedHeader}.${encodedPayload}`, secret)
    return `${encodedHeader}.${encodedPayload}.${signature}`
  },

  // 验证JWT token
  async verifyToken(token, secret) {
    try {
      const [header, payload, signature] = token.split('.')
      const expectedSignature = await this.sign(`${header}.${payload}`, secret)

      if (signature !== expectedSignature) {
        return null
      }

      const decodedPayload = JSON.parse(atob(payload))

      // 检查过期时间
      if (decodedPayload.exp && Date.now() > decodedPayload.exp) {
        return null
      }

      return decodedPayload
    } catch (error) {
      return null
    }
  },

  // 生成签名
  async sign(data, secret) {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
  }
}

// 鉴权中间件
const authMiddleware = async (c, next) => {
  // 跳过登录和静态资源
  const path = c.req.path
  if (path.startsWith('/api/auth/') || path.startsWith('/login.html') ||
      path.includes('.css') || path.includes('.js') || path.includes('.ico') ||
      path.includes('favicon')) {
    return next()
  }

  // 获取token - 优先从Authorization头获取，其次从URL参数获取（用于SSE）
  let token = null
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  } else {
    // 从URL参数获取token（用于SSE连接）
    token = c.req.query('token')
  }

  if (!token) {
    // 对于API请求返回401，对于页面请求重定向到登录页
    if (path.startsWith('/api/')) {
      return c.json({ success: false, message: '未授权访问' }, 401)
    }
    return c.redirect('/login.html')
  }

  const payload = await AuthUtils.verifyToken(token, c.env.JWT_SECRET)

  if (!payload) {
    // 对于API请求返回401，对于页面请求重定向到登录页
    if (path.startsWith('/api/')) {
      return c.json({ success: false, message: 'Token无效或已过期' }, 401)
    }
    return c.redirect('/login.html')
  }

  // 将用户信息添加到上下文
  c.set('user', payload)
  return next()
}

// API路由
const api = new Hono()

// 鉴权API路由
const authApi = new Hono()

// 登录接口
authApi.post('/login', async (c) => {
  try {
    const { password } = await c.req.json()

    if (!password) {
      return c.json({ success: false, message: '密码不能为空' }, 400)
    }

    // 直接验证明文密码（简化配置）
    const expectedPassword = c.env.ACCESS_PASSWORD

    if (password !== expectedPassword) {
      return c.json({ success: false, message: '密码错误' }, 401)
    }

    // 生成token
    const expireHours = parseInt(c.env.SESSION_EXPIRE_HOURS || '24')
    const payload = {
      iat: Date.now(),
      exp: Date.now() + (expireHours * 60 * 60 * 1000),
      type: 'access'
    }

    const token = await AuthUtils.generateToken(payload, c.env.JWT_SECRET)

    return c.json({
      success: true,
      token,
      expiresIn: expireHours * 60 * 60
    })
  } catch (error) {
    console.error('登录错误:', error)
    return c.json({ success: false, message: '服务器错误' }, 500)
  }
})

// 验证token接口
authApi.get('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ valid: false, message: '缺少认证信息' }, 401)
    }

    const token = authHeader.substring(7)
    const payload = await AuthUtils.verifyToken(token, c.env.JWT_SECRET)

    if (!payload) {
      return c.json({ valid: false, message: 'Token无效或已过期' }, 401)
    }

    return c.json({ valid: true, payload })
  } catch (error) {
    console.error('验证token错误:', error)
    return c.json({ valid: false, message: '服务器错误' }, 500)
  }
})

// 登出接口
authApi.post('/logout', async (c) => {
  // 简单的登出响应，实际的token清理在前端处理
  return c.json({ success: true, message: '已登出' })
})

// 获取消息列表
api.get('/messages', async (c) => {
  try {
    const { DB } = c.env
    const limit = c.req.query('limit') || 50
    const offset = c.req.query('offset') || 0

    const stmt = DB.prepare(`
      SELECT
        m.id,
        m.type,
        m.content,
        m.device_id,
        m.timestamp,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.r2_key
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `)

    const result = await stmt.bind(limit, offset).all()

    return c.json({
      success: true,
      data: result.results,
      total: result.results.length
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 发送文本消息
api.post('/messages', async (c) => {
  try {
    const { DB } = c.env
    const { content, deviceId } = await c.req.json()

    if (!content || !deviceId) {
      return c.json({
        success: false,
        error: '内容和设备ID不能为空'
      }, 400)
    }

    const stmt = DB.prepare(`
      INSERT INTO messages (type, content, device_id)
      VALUES (?, ?, ?)
    `)

    const result = await stmt.bind('text', content, deviceId).run()

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 文件上传
api.post('/files/upload', async (c) => {
  try {
    const { DB, R2 } = c.env
    const formData = await c.req.formData()
    const file = formData.get('file')
    const deviceId = formData.get('deviceId')

    if (!file || !deviceId) {
      return c.json({
        success: false,
        error: '文件和设备ID不能为空'
      }, 400)
    }

    // 生成唯一的文件名
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2)
    const fileExtension = file.name.split('.').pop()
    const r2Key = `${timestamp}-${randomStr}.${fileExtension}`

    // 上传到R2
    await R2.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      }
    })

    // 保存文件信息到数据库
    const fileStmt = DB.prepare(`
      INSERT INTO files (original_name, file_name, file_size, mime_type, r2_key, upload_device_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const fileResult = await fileStmt.bind(
      file.name,
      r2Key,
      file.size,
      file.type,
      r2Key,
      deviceId
    ).run()

    // 创建文件消息
    const messageStmt = DB.prepare(`
      INSERT INTO messages (type, file_id, device_id)
      VALUES (?, ?, ?)
    `)

    await messageStmt.bind('file', fileResult.meta.last_row_id, deviceId).run()

    return c.json({
      success: true,
      data: {
        fileId: fileResult.meta.last_row_id,
        fileName: file.name,
        fileSize: file.size,
        r2Key: r2Key
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 文件下载
api.get('/files/download/:r2Key', async (c) => {
  try {
    const { DB, R2 } = c.env
    const r2Key = c.req.param('r2Key')

    // 获取文件信息
    const stmt = DB.prepare(`
      SELECT * FROM files WHERE r2_key = ?
    `)
    const fileInfo = await stmt.bind(r2Key).first()

    if (!fileInfo) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    // 从R2获取文件
    const object = await R2.get(r2Key)

    if (!object) {
      return c.json({
        success: false,
        error: '文件不存在'
      }, 404)
    }

    // 更新下载次数
    const updateStmt = DB.prepare(`
      UPDATE files SET download_count = download_count + 1 WHERE r2_key = ?
    `)
    await updateStmt.bind(r2Key).run()

    return new Response(object.body, {
      headers: {
        'Content-Type': fileInfo.mime_type,
        'Content-Disposition': `attachment; filename="${fileInfo.original_name}"`,
        'Content-Length': fileInfo.file_size.toString()
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 设备同步
api.post('/sync', async (c) => {
  try {
    const { DB } = c.env
    const { deviceId, deviceName } = await c.req.json()

    // 更新或插入设备信息
    const stmt = DB.prepare(`
      INSERT OR REPLACE INTO devices (id, name, last_active)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `)

    await stmt.bind(deviceId, deviceName || '未知设备').run()

    return c.json({
      success: true,
      message: '设备同步成功'
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 批量删除消息
api.post('/messages/batch-delete', async (c) => {
  try {
    const { DB, R2 } = c.env
    const { messageIds, confirmCode } = await c.req.json()

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return c.json({
        success: false,
        error: '请选择要删除的消息'
      }, 400)
    }

    // 简单的确认码验证
    if (confirmCode !== '1234') {
      return c.json({
        success: false,
        error: '确认码错误，请输入正确的确认码'
      }, 400)
    }

    // 限制批量删除数量
    if (messageIds.length > 100) {
      return c.json({
        success: false,
        error: '单次最多只能删除100条消息'
      }, 400)
    }

    // 获取要删除的文件消息关联的文件信息
    const placeholders = messageIds.map(() => '?').join(',')
    const fileStmt = DB.prepare(`
      SELECT f.r2_key, f.file_size, f.original_name
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE m.id IN (${placeholders}) AND m.type = 'file' AND f.id IS NOT NULL
    `)
    const filesToDelete = await fileStmt.bind(...messageIds).all()

    // 删除R2中的关联文件
    let deletedFilesCount = 0
    let deletedFileSize = 0
    for (const file of filesToDelete.results) {
      try {
        await R2.delete(file.r2_key)
        deletedFilesCount++
        deletedFileSize += file.file_size || 0
      } catch (error) {
        console.warn('删除R2文件失败:', file.r2_key, error)
      }
    }

    // 删除数据库中的文件记录
    if (filesToDelete.results.length > 0) {
      const deleteFilesStmt = DB.prepare(`
        DELETE FROM files
        WHERE id IN (
          SELECT f.id FROM messages m
          LEFT JOIN files f ON m.file_id = f.id
          WHERE m.id IN (${placeholders}) AND m.type = 'file'
        )
      `)
      await deleteFilesStmt.bind(...messageIds).run()
    }

    // 删除消息记录
    const deleteMessagesStmt = DB.prepare(`
      DELETE FROM messages WHERE id IN (${placeholders})
    `)
    const deleteResult = await deleteMessagesStmt.bind(...messageIds).run()

    return c.json({
      success: true,
      data: {
        deletedMessages: deleteResult.changes || 0,
        deletedFiles: deletedFilesCount,
        deletedFileSize: deletedFileSize,
        message: `成功删除 ${deleteResult.changes || 0} 条消息`
      }
    })
  } catch (error) {
    console.error('批量删除消息失败:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 导出聊天记录
api.get('/export', async (c) => {
  try {
    const { DB } = c.env
    const format = c.req.query('format') || 'json' // json, html, txt
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const includeFiles = c.req.query('includeFiles') === 'true'
    const limit = parseInt(c.req.query('limit') || '1000') // 限制导出数量

    // 构建查询SQL
    let sql = `
      SELECT
        m.id,
        m.type,
        m.content,
        m.device_id,
        m.timestamp,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.r2_key
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE 1=1
    `

    const params = []

    // 添加时间范围过滤
    if (startDate) {
      sql += ` AND m.timestamp >= ?`
      params.push(startDate)
    }
    if (endDate) {
      sql += ` AND m.timestamp <= ?`
      params.push(endDate + ' 23:59:59')
    }

    // 添加排序和限制
    sql += ` ORDER BY m.timestamp ASC LIMIT ?`
    params.push(limit)

    const stmt = DB.prepare(sql)
    const result = await stmt.bind(...params).all()

    if (!result.results || result.results.length === 0) {
      return c.json({
        success: false,
        error: '没有找到符合条件的消息'
      }, 404)
    }

    // 根据格式生成导出内容
    let exportContent = ''
    let contentType = 'application/json'
    let filename = `wxchat_export_${new Date().toISOString().split('T')[0]}`

    switch (format.toLowerCase()) {
      case 'html':
        exportContent = generateHTMLExport(result.results, includeFiles)
        contentType = 'text/html; charset=utf-8'
        filename += '.html'
        break
      case 'txt':
        exportContent = generateTXTExport(result.results, includeFiles)
        contentType = 'text/plain; charset=utf-8'
        filename += '.txt'
        break
      case 'json':
      default:
        exportContent = JSON.stringify({
          exportInfo: {
            exportTime: new Date().toISOString(),
            totalMessages: result.results.length,
            dateRange: {
              start: startDate || null,
              end: endDate || null
            },
            includeFiles: includeFiles
          },
          messages: result.results
        }, null, 2)
        contentType = 'application/json; charset=utf-8'
        filename += '.json'
        break
    }

    // 设置下载响应头
    return new Response(exportContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('导出聊天记录失败:', error)
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// HTML格式导出生成器
function generateHTMLExport(messages, includeFiles) {
  const deviceNames = {}

  // 生成设备名称映射
  messages.forEach(msg => {
    if (!deviceNames[msg.device_id]) {
      deviceNames[msg.device_id] = `设备${Object.keys(deviceNames).length + 1}`
    }
  })

  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>微信文件传输助手 - 聊天记录</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f7f7f7; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #07c160; color: white; padding: 20px; text-align: center; }
        .messages { padding: 20px; }
        .message { margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px; }
        .message.own { flex-direction: row-reverse; }
        .message-content { max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; }
        .message.own .message-content { background: #95ec69; }
        .message:not(.own) .message-content { background: #fff; border: 1px solid #e5e5e5; }
        .message-info { font-size: 12px; color: #999; margin-bottom: 5px; }
        .file-message { display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; }
        .file-icon { font-size: 24px; }
        .file-details { flex: 1; }
        .file-name { font-weight: 500; margin-bottom: 2px; }
        .file-size { font-size: 12px; color: #666; }
        .export-info { background: #f8f9fa; padding: 15px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📱 微信文件传输助手</h1>
            <p>聊天记录导出 - ${new Date().toLocaleString('zh-CN')}</p>
        </div>
        <div class="messages">
  `

  messages.forEach(msg => {
    const deviceName = deviceNames[msg.device_id]
    const time = new Date(msg.timestamp).toLocaleString('zh-CN')
    const isOwn = msg.device_id === messages[0]?.device_id // 简单判断

    html += `
            <div class="message ${isOwn ? 'own' : ''}">
                <div class="message-content">
                    <div class="message-info">${deviceName} · ${time}</div>
    `

    if (msg.type === 'text') {
      html += `<div>${escapeHtml(msg.content)}</div>`
    } else if (msg.type === 'file') {
      const fileIcon = getFileIconForHTML(msg.original_name)
      const fileSize = formatFileSize(msg.file_size)
      html += `
                    <div class="file-message">
                        <div class="file-icon">${fileIcon}</div>
                        <div class="file-details">
                            <div class="file-name">${escapeHtml(msg.original_name)}</div>
                            <div class="file-size">${fileSize}</div>
                        </div>
                    </div>
      `
    }

    html += `
                </div>
            </div>
    `
  })

  html += `
        </div>
        <div class="export-info">
            <strong>导出信息：</strong><br>
            导出时间：${new Date().toLocaleString('zh-CN')}<br>
            消息总数：${messages.length} 条<br>
            包含文件：${includeFiles ? '是' : '否'}
        </div>
    </div>
</body>
</html>
  `

  return html
}

// TXT格式导出生成器
function generateTXTExport(messages, includeFiles) {
  let txt = `微信文件传输助手 - 聊天记录\n`
  txt += `导出时间：${new Date().toLocaleString('zh-CN')}\n`
  txt += `消息总数：${messages.length} 条\n`
  txt += `包含文件：${includeFiles ? '是' : '否'}\n`
  txt += `${'='.repeat(50)}\n\n`

  const deviceNames = {}

  messages.forEach(msg => {
    if (!deviceNames[msg.device_id]) {
      deviceNames[msg.device_id] = `设备${Object.keys(deviceNames).length + 1}`
    }
  })

  messages.forEach(msg => {
    const deviceName = deviceNames[msg.device_id]
    const time = new Date(msg.timestamp).toLocaleString('zh-CN')

    txt += `[${time}] ${deviceName}\n`

    if (msg.type === 'text') {
      txt += `${msg.content}\n`
    } else if (msg.type === 'file') {
      const fileSize = formatFileSize(msg.file_size)
      txt += `[文件] ${msg.original_name} (${fileSize})\n`
    }

    txt += `\n`
  })

  return txt
}

// HTML转义函数
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

// 获取文件图标（HTML版本）
function getFileIconForHTML(filename) {
  const ext = filename.split('.').pop()?.toLowerCase()

  const iconMap = {
    // 图片
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 'webp': '🖼️',
    // 文档
    'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📄', 'rtf': '📄',
    'xls': '📊', 'xlsx': '📊', 'csv': '📊',
    'ppt': '📊', 'pptx': '📊',
    // 音频
    'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'm4a': '🎵',
    // 视频
    'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'wmv': '🎬', 'flv': '🎬', 'mkv': '🎬',
    // 压缩包
    'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
    // 代码
    'js': '💻', 'html': '💻', 'css': '💻', 'py': '💻', 'java': '💻', 'cpp': '💻', 'c': '💻'
  }

  return iconMap[ext] || '📄'
}

// 文件大小格式化
function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 数据清理 - 清空所有数据
api.post('/clear-all', async (c) => {
  try {
    const { DB, R2 } = c.env
    const { confirmCode } = await c.req.json()

    // 简单的确认码验证
    if (confirmCode !== '1234') {
      return c.json({
        success: false,
        error: '确认码错误，请输入正确的确认码'
      }, 400)
    }

    // 统计清理前的数据
    const messageCountStmt = DB.prepare('SELECT COUNT(*) as count FROM messages')
    const fileCountStmt = DB.prepare('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalSize FROM files')

    const messageCount = await messageCountStmt.first()
    const fileStats = await fileCountStmt.first()

    // 获取所有文件的R2 keys
    const filesStmt = DB.prepare('SELECT r2_key FROM files')
    const files = await filesStmt.all()

    // 删除R2中的所有文件
    let deletedFilesCount = 0
    for (const file of files.results) {
      try {
        await R2.delete(file.r2_key)
        deletedFilesCount++
      } catch (error) {
        // 静默处理R2删除失败
      }
    }

    // 清空数据库表（使用事务确保原子性）
    const deleteMessagesStmt = DB.prepare('DELETE FROM messages')
    const deleteFilesStmt = DB.prepare('DELETE FROM files')
    const deleteDevicesStmt = DB.prepare('DELETE FROM devices')

    // 执行删除操作
    await deleteMessagesStmt.run()
    await deleteFilesStmt.run()
    await deleteDevicesStmt.run()

    return c.json({
      success: true,
      data: {
        deletedMessages: messageCount.count,
        deletedFiles: fileStats.count,
        deletedFileSize: fileStats.totalSize,
        deletedR2Files: deletedFilesCount,
        message: '所有数据已成功清理'
      }
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// Server-Sent Events 实时通信
api.get('/events', async (c) => {
  const deviceId = c.req.query('deviceId')

  if (!deviceId) {
    return c.json({ error: '设备ID不能为空' }, 400)
  }

  try {
    // 设置SSE响应头
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // 创建可读流
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // 发送SSE消息的辅助函数
    const sendSSE = (data, event = 'message') => {
      const message = `event: ${event}\ndata: ${data}\n\n`
      writer.write(encoder.encode(message))
    }

    // 发送连接确认
    sendSSE('connected', 'connection')

    // 定期发送心跳
    const heartbeat = setInterval(() => {
      try {
        sendSSE('ping', 'heartbeat')
      } catch (error) {
        clearInterval(heartbeat)
      }
    }, 30000)

    // 监听新消息
    const checkMessages = setInterval(async () => {
      try {
        const { DB } = c.env
        if (!DB) {
          return
        }

        const stmt = DB.prepare(`
          SELECT COUNT(*) as count
          FROM messages
          WHERE timestamp > datetime('now', '-10 seconds')
        `)
        const result = await stmt.first()

        if (result && result.count > 0) {
          sendSSE(JSON.stringify({ newMessages: result.count }), 'message')
        }
      } catch (error) {
        // 静默处理SSE消息检查失败
      }
    }, 5000)

    // 处理连接关闭
    const cleanup = () => {
      clearInterval(heartbeat)
      clearInterval(checkMessages)
      try {
        writer.close()
      } catch (error) {
        // 静默处理writer关闭失败
      }
    }

    // 设置超时清理（防止连接泄漏）
    const timeout = setTimeout(cleanup, 300000) // 5分钟超时

    // 监听中断信号
    c.req.signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      cleanup()
    })

    return new Response(readable, { headers })

  } catch (error) {
    return c.json({
      success: false,
      error: `SSE连接失败: ${error.message}`
    }, 500)
  }
})

// 消息搜索接口
api.get('/search', async (c) => {
  try {
    const { DB } = c.env
    const query = c.req.query('q') || ''
    const type = c.req.query('type') || 'all' // all, text, file
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    if (!query.trim()) {
      return c.json({
        success: false,
        error: '搜索关键词不能为空'
      }, 400)
    }

    // 构建搜索SQL
    let sql = `
      SELECT
        m.id,
        m.type,
        m.content,
        m.device_id,
        m.timestamp,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.r2_key
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE 1=1
    `

    const params = []

    // 添加搜索条件
    if (type === 'text') {
      sql += ` AND m.type = 'text' AND m.content LIKE ?`
      params.push(`%${query}%`)
    } else if (type === 'file') {
      sql += ` AND m.type = 'file' AND f.original_name LIKE ?`
      params.push(`%${query}%`)
    } else {
      // 搜索所有类型
      sql += ` AND (
        (m.type = 'text' AND m.content LIKE ?) OR
        (m.type = 'file' AND f.original_name LIKE ?)
      )`
      params.push(`%${query}%`, `%${query}%`)
    }

    // 添加时间范围过滤
    if (startDate) {
      sql += ` AND m.timestamp >= ?`
      params.push(startDate)
    }
    if (endDate) {
      sql += ` AND m.timestamp <= ?`
      params.push(endDate + ' 23:59:59')
    }

    // 添加排序和分页
    sql += ` ORDER BY m.timestamp DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const stmt = DB.prepare(sql)
    const result = await stmt.bind(...params).all()

    // 获取总数（用于分页）
    let countSql = `
      SELECT COUNT(*) as total
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE 1=1
    `

    const countParams = []

    if (type === 'text') {
      countSql += ` AND m.type = 'text' AND m.content LIKE ?`
      countParams.push(`%${query}%`)
    } else if (type === 'file') {
      countSql += ` AND m.type = 'file' AND f.original_name LIKE ?`
      countParams.push(`%${query}%`)
    } else {
      countSql += ` AND (
        (m.type = 'text' AND m.content LIKE ?) OR
        (m.type = 'file' AND f.original_name LIKE ?)
      )`
      countParams.push(`%${query}%`, `%${query}%`)
    }

    if (startDate) {
      countSql += ` AND m.timestamp >= ?`
      countParams.push(startDate)
    }
    if (endDate) {
      countSql += ` AND m.timestamp <= ?`
      countParams.push(endDate + ' 23:59:59')
    }

    const countStmt = DB.prepare(countSql)
    const countResult = await countStmt.bind(...countParams).first()

    return c.json({
      success: true,
      data: result.results,
      total: countResult.total,
      query: query,
      type: type,
      hasMore: (offset + limit) < countResult.total
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 文件分类接口
api.get('/files/categories', async (c) => {
  try {
    const { DB } = c.env
    const category = c.req.query('category') || 'all' // all, image, document, audio, video, archive, other
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    // 构建文件分类SQL
    let sql = `
      SELECT
        f.id,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.r2_key,
        f.upload_device_id,
        f.download_count,
        f.created_at,
        m.id as message_id,
        m.timestamp
      FROM files f
      LEFT JOIN messages m ON m.file_id = f.id
      WHERE 1=1
    `

    const params = []

    // 添加分类过滤条件
    if (category !== 'all') {
      switch (category) {
        case 'image':
          sql += ` AND f.mime_type LIKE 'image/%'`
          break
        case 'document':
          sql += ` AND (
            f.mime_type LIKE '%pdf%' OR
            f.mime_type LIKE '%document%' OR
            f.mime_type LIKE '%word%' OR
            f.mime_type LIKE '%excel%' OR
            f.mime_type LIKE '%powerpoint%' OR
            f.mime_type LIKE '%presentation%' OR
            f.mime_type LIKE 'text/%'
          )`
          break
        case 'audio':
          sql += ` AND f.mime_type LIKE 'audio/%'`
          break
        case 'video':
          sql += ` AND f.mime_type LIKE 'video/%'`
          break
        case 'archive':
          sql += ` AND (
            f.mime_type LIKE '%zip%' OR
            f.mime_type LIKE '%rar%' OR
            f.mime_type LIKE '%compressed%' OR
            f.mime_type LIKE '%archive%'
          )`
          break
        case 'other':
          sql += ` AND f.mime_type NOT LIKE 'image/%'
                   AND f.mime_type NOT LIKE 'audio/%'
                   AND f.mime_type NOT LIKE 'video/%'
                   AND f.mime_type NOT LIKE '%pdf%'
                   AND f.mime_type NOT LIKE '%document%'
                   AND f.mime_type NOT LIKE '%word%'
                   AND f.mime_type NOT LIKE '%excel%'
                   AND f.mime_type NOT LIKE '%powerpoint%'
                   AND f.mime_type NOT LIKE '%presentation%'
                   AND f.mime_type NOT LIKE 'text/%'
                   AND f.mime_type NOT LIKE '%zip%'
                   AND f.mime_type NOT LIKE '%rar%'
                   AND f.mime_type NOT LIKE '%compressed%'
                   AND f.mime_type NOT LIKE '%archive%'`
          break
      }
    }

    // 添加排序和分页
    sql += ` ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const stmt = DB.prepare(sql)
    const result = await stmt.bind(...params).all()

    // 获取总数和统计信息
    let countSql = `SELECT COUNT(*) as total FROM files f WHERE 1=1`
    let statsSql = `
      SELECT
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END) as image_count,
        COUNT(CASE WHEN mime_type LIKE 'audio/%' THEN 1 END) as audio_count,
        COUNT(CASE WHEN mime_type LIKE 'video/%' THEN 1 END) as video_count,
        COUNT(CASE WHEN mime_type LIKE '%pdf%' OR mime_type LIKE '%document%' OR mime_type LIKE '%word%' OR mime_type LIKE '%excel%' OR mime_type LIKE '%powerpoint%' OR mime_type LIKE '%presentation%' OR mime_type LIKE 'text/%' THEN 1 END) as document_count,
        COUNT(CASE WHEN mime_type LIKE '%zip%' OR mime_type LIKE '%rar%' OR mime_type LIKE '%compressed%' OR mime_type LIKE '%archive%' THEN 1 END) as archive_count
      FROM files
    `

    // 添加相同的分类过滤条件到计数查询
    if (category !== 'all') {
      const categoryCondition = sql.substring(sql.indexOf('WHERE 1=1') + 9, sql.indexOf('ORDER BY')).trim()
      if (categoryCondition) {
        countSql += categoryCondition
      }
    }

    const countStmt = DB.prepare(countSql)
    const countResult = await countStmt.bind(...params.slice(0, -2)).first() // 移除limit和offset参数

    const statsStmt = DB.prepare(statsSql)
    const statsResult = await statsStmt.first()

    return c.json({
      success: true,
      data: result.results,
      total: countResult.total,
      category: category,
      hasMore: (offset + limit) < countResult.total,
      stats: statsResult
    })
  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 长轮询接口（SSE降级方案）
api.get('/poll', async (c) => {
  try {
    const { DB } = c.env
    const deviceId = c.req.query('deviceId')
    const lastMessageId = c.req.query('lastMessageId') || '0'
    const timeout = parseInt(c.req.query('timeout') || '30') // 30秒超时

    if (!deviceId) {
      return c.json({ error: '设备ID不能为空' }, 400)
    }

    if (!DB) {
      return c.json({ error: '数据库未绑定' }, 500)
    }

    const startTime = Date.now()
    const maxWaitTime = Math.min(timeout * 1000, 30000) // 最大30秒

    // 轮询检查新消息
    while (Date.now() - startTime < maxWaitTime) {
      const stmt = DB.prepare(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE id > ?
      `)
      const result = await stmt.bind(lastMessageId).first()

      if (result && result.count > 0) {
        // 有新消息，立即返回
        return c.json({
          success: true,
          hasNewMessages: true,
          newMessageCount: result.count,
          timestamp: new Date().toISOString()
        })
      }

      // 等待1秒后再次检查
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // 超时，返回无新消息
    return c.json({
      success: true,
      hasNewMessages: false,
      newMessageCount: 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return c.json({
      success: false,
      error: error.message
    }, 500)
  }
})

// 挂载鉴权API路由（无需认证）
app.route('/api/auth', authApi)

// 应用鉴权中间件到所有路由
app.use('*', authMiddleware)

// 挂载API路由（需要认证）
app.route('/api', api)

// 静态文件服务 - 使用getAssetFromKV
app.get('*', async (c) => {
  try {
    return await getAssetFromKV(c.env, {
      request: c.req.raw,
      waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
    })
  } catch (e) {
    // 如果找不到文件，返回index.html
    try {
      return await getAssetFromKV(c.env, {
        request: new Request(new URL('/index.html', c.req.url).toString()),
        waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
      })
    } catch {
      return c.text('Not Found', 404)
    }
  }
})

export default app
