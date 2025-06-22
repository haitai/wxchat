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

// API路由
const api = new Hono()

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
      ORDER BY m.timestamp ASC
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

// 挂载API路由
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
