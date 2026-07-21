import { DBService } from './database.js'

const SELECT_FIELDS = `
  m.id,
  m.type,
  m.content,
  m.device_id,
  m.status,
  m.meta,
  m.timestamp,
  f.original_name,
  f.file_size,
  f.mime_type,
  f.r2_key
`

export const MessageService = {
  async getMessages(db, { limit = 50, offset = 0, beforeId = null, afterId = null } = {}) {
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200)
    const offsetNum = Math.max(0, parseInt(offset, 10) || 0)

    let sql
    let params

    if (afterId) {
      // 增量：取 id > afterId 的新消息（正序）
      sql = `
        SELECT ${SELECT_FIELDS}
        FROM messages m
        LEFT JOIN files f ON m.file_id = f.id
        WHERE m.id > ?
        ORDER BY m.id ASC
        LIMIT ?
      `
      params = [parseInt(afterId, 10) || 0, limitNum]
    } else if (beforeId) {
      // 历史：取 id < beforeId 的旧消息，再在服务端反转为正序
      sql = `
        SELECT ${SELECT_FIELDS}
        FROM messages m
        LEFT JOIN files f ON m.file_id = f.id
        WHERE m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
      `
      params = [parseInt(beforeId, 10) || 0, limitNum]
    } else {
      // 默认：最新一页（倒序取再翻转），offset 兼容旧客户端
      if (offsetNum > 0) {
        sql = `
          SELECT ${SELECT_FIELDS}
          FROM messages m
          LEFT JOIN files f ON m.file_id = f.id
          ORDER BY m.id ASC
          LIMIT ? OFFSET ?
        `
        params = [limitNum, offsetNum]
      } else {
        sql = `
          SELECT ${SELECT_FIELDS}
          FROM messages m
          LEFT JOIN files f ON m.file_id = f.id
          ORDER BY m.id DESC
          LIMIT ?
        `
        params = [limitNum]
      }
    }

    const countSql = `SELECT COUNT(*) as total FROM messages`
    const [dataResult, countResult] = await Promise.all([
      DBService.queryAll(db, sql, params),
      DBService.queryFirst(db, countSql)
    ])

    let rows = dataResult.results || []
    // beforeId / 默认最新页 都是 DESC 取的，需要翻成时间正序
    if (beforeId || (!afterId && offsetNum === 0)) {
      rows = rows.slice().reverse()
    }

    return {
      data: rows,
      total: countResult?.total || 0,
      limit: limitNum,
      offset: offsetNum
    }
  },

  async createMessage(db, { type = 'text', content, deviceId, meta = null }) {
    const result = await DBService.execute(db,
      `INSERT INTO messages (type, content, device_id, meta) VALUES (?, ?, ?, ?)`,
      [type, content, deviceId, meta]
    )
    return { id: result.meta.last_row_id }
  },

  async createFileMessage(db, fileId, deviceId) {
    const result = await DBService.execute(db,
      `INSERT INTO messages (type, file_id, device_id) VALUES (?, ?, ?)`,
      ['file', fileId, deviceId]
    )
    return { id: result.meta.last_row_id }
  },

  async createAIMessage(db, { content, deviceId, type = 'ai_response' }) {
    const meta = JSON.stringify({ aiType: type })
    const result = await DBService.execute(db,
      `INSERT INTO messages (type, content, device_id, meta) VALUES (?, ?, ?, ?)`,
      ['ai', content, deviceId || 'ai-system', meta]
    )
    return {
      id: result.meta.last_row_id,
      type: 'ai',
      content,
      device_id: deviceId || 'ai-system',
      timestamp: new Date().toISOString(),
      meta,
      originalType: type
    }
  },

  async getNewMessageCount(db, lastMessageId = '0') {
    const result = await DBService.queryFirst(db,
      `SELECT COUNT(*) as count FROM messages WHERE id > ?`,
      [parseInt(lastMessageId, 10) || 0]
    )
    return result?.count || 0
  },

  async getLatestMessageId(db) {
    const result = await DBService.queryFirst(db, `SELECT MAX(id) as maxId FROM messages`)
    return result?.maxId || 0
  },

  async getMessagesSince(db, lastMessageId = 0, limit = 50) {
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200)
    const result = await DBService.queryAll(db, `
      SELECT ${SELECT_FIELDS}
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE m.id > ?
      ORDER BY m.id ASC
      LIMIT ?
    `, [parseInt(lastMessageId, 10) || 0, limitNum])
    return result.results || []
  },

  async deleteAll(db) {
    await DBService.execute(db, `DELETE FROM messages`)
  },

  async countAll(db) {
    const result = await DBService.queryFirst(db, `SELECT COUNT(*) as count FROM messages`)
    return result?.count || 0
  }
}
