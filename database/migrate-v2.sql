-- wxchat 手工迁移（可选）
-- 线上已接入 Worker 内 ensureSchema（worker/services/schema.js），
-- 正常情况：部署后第一次打 /api/* 会自动补 status/meta 或重建 type 约束。
--
-- 仅当你要用 wrangler 手动修库时再执行下面语句。
-- ⚠️ 不要整段无脑 DROP；优先用 Worker 自动迁移。

-- 1) 看现状
-- PRAGMA table_info(messages);
-- SELECT sql FROM sqlite_master WHERE name = 'messages';

-- 2) 轻量补列（列已存在会报 duplicate column，可忽略）
-- ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'sent';
-- ALTER TABLE messages ADD COLUMN meta TEXT DEFAULT NULL;

-- 3) 登录限流表
CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO devices (id, name) VALUES
  ('web-default', 'Web浏览器'),
  ('mobile-default', '移动设备'),
  ('ai-system', 'AI助手');
