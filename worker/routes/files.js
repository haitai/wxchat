import { Hono } from 'hono'
import { FileService } from '../services/fileService.js'
import { MessageService } from '../services/messageService.js'
import { validateParams, ok, fail, AppError } from '../middleware/errorHandler.js'

const files = new Hono()

files.post('/upload', async (c) => {
  const { DB, R2 } = c.env
  let r2Key = null
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')
    const deviceId = formData.get('deviceId')

    if (!file || typeof file === 'string') {
      throw new AppError('缺少文件', 400, 'MISSING_FILE')
    }
    validateParams({ deviceId }, ['deviceId'])

    const maxSize = parseInt(c.env.MAX_FILE_SIZE || '0', 10)
    if (maxSize > 0 && file.size > maxSize) {
      throw new AppError(`文件大小超过限制（最大 ${Math.round(maxSize / 1024 / 1024)}MB）`, 400, 'FILE_TOO_LARGE')
    }

    r2Key = FileService.generateR2Key(file.name || 'file.bin')
    await FileService.uploadToR2(R2, r2Key, file.stream(), {
      contentType: file.type,
      fileName: file.name || 'file.bin'
    })

    try {
      const fileRecord = await FileService.saveFileRecord(DB, {
        fileName: file.name || 'file.bin',
        r2Key,
        fileSize: file.size,
        mimeType: file.type,
        deviceId
      })
      await MessageService.createFileMessage(DB, fileRecord.id, deviceId)

      return ok(c, {
        fileId: fileRecord.id,
        fileName: file.name || 'file.bin',
        fileSize: file.size,
        r2Key
      })
    } catch (dbError) {
      console.error('[Files] 数据库失败，回滚 R2:', dbError)
      await FileService.deleteFromR2(R2, r2Key)
      throw new AppError(`数据库操作失败: ${dbError.message}`, 500, 'DB_ERROR')
    }
  } catch (error) {
    console.error('[Files] 上传失败:', error)
    return fail(c, error)
  }
})

files.get('/download/:r2Key{.+}', async (c) => {
  try {
    const { DB, R2 } = c.env
    // 兼容 files/xxx 带路径的 key
    const r2Key = c.req.param('r2Key')

    const fileInfo = await FileService.getFileByR2Key(DB, r2Key)
    if (!fileInfo) {
      return fail(c, new AppError('文件不存在', 404, 'FILE_NOT_FOUND'))
    }

    const object = await FileService.getFromR2(R2, r2Key)
    if (!object) {
      return fail(c, new AppError('文件不存在', 404, 'FILE_NOT_FOUND'))
    }

    c.executionCtx.waitUntil(FileService.incrementDownloadCount(DB, r2Key))

    const safeName = String(fileInfo.original_name || 'file').replace(/["\r\n]/g, '_')
    return new Response(object.body, {
      headers: {
        'Content-Type': fileInfo.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        'Content-Length': String(fileInfo.file_size || ''),
        'Cache-Control': 'private, max-age=3600'
      }
    })
  } catch (error) {
    console.error('[Files] 下载失败:', error)
    return fail(c, error)
  }
})

export default files
