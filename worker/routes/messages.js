import { Hono } from 'hono'
import { MessageService } from '../services/messageService.js'
import { validateParams, ok, fail } from '../middleware/errorHandler.js'

const messages = new Hono()

messages.get('/', async (c) => {
  try {
    const { DB } = c.env
    const limit = c.req.query('limit') || '50'
    const offset = c.req.query('offset') || '0'
    const beforeId = c.req.query('beforeId') || null
    const afterId = c.req.query('afterId') || null

    const result = await MessageService.getMessages(DB, { limit, offset, beforeId, afterId })
    return c.json({
      success: true,
      data: result.data,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    })
  } catch (error) {
    console.error('[Messages] 获取失败:', error)
    return fail(c, error)
  }
})

messages.post('/', async (c) => {
  try {
    const { DB } = c.env
    const body = await c.req.json()
    const { content, deviceId, type = 'text' } = body
    validateParams({ content, deviceId }, ['content', 'deviceId'])

    if (typeof content !== 'string' || !content.trim()) {
      return fail(c, { message: '消息内容不能为空', status: 400, code: 'EMPTY_CONTENT' })
    }
    if (content.length > 20000) {
      return fail(c, { message: '消息过长', status: 400, code: 'CONTENT_TOO_LONG' })
    }

    const allowed = ['text', 'system']
    const msgType = allowed.includes(type) ? type : 'text'
    const result = await MessageService.createMessage(DB, {
      type: msgType,
      content: content.trim(),
      deviceId
    })
    return ok(c, { id: result.id })
  } catch (error) {
    return fail(c, error)
  }
})

export default messages
