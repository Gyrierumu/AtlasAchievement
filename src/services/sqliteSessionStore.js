const session = require('express-session');
const { get, run } = require('../db/db');

class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.tableName = options.tableName || 'sessions';
    this.ttlMs = Number(options.ttlMs || 1000 * 60 * 60 * 8);
    this.cleanupIntervalMs = Number(options.cleanupIntervalMs || 1000 * 60 * 30);
    this.cleanupTimer = null;

    this.ready = this.ensureTable();
    this.startCleanup();
  }

  async ensureTable() {
    await run(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    );
    await run(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at ON ${this.tableName}(expires_at)`);
  }

  getExpirationTime(sess = {}) {
    if (sess?.cookie?.expires) {
      const expiresAt = new Date(sess.cookie.expires).getTime();
      if (Number.isFinite(expiresAt)) return expiresAt;
    }

    if (typeof sess?.cookie?.maxAge === 'number') {
      return Date.now() + sess.cookie.maxAge;
    }

    return Date.now() + this.ttlMs;
  }

  startCleanup() {
    if (this.cleanupIntervalMs <= 0) return;
    this.cleanupTimer = setInterval(() => {
      this.prune(err => {
        if (err) {
          console.error('Falha ao limpar sessões expiradas:', err);
        }
      });
    }, this.cleanupIntervalMs);

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  async get(sid, callback) {
    try {
      await this.ready;
      const row = await get(
        `SELECT sess, expires_at FROM ${this.tableName} WHERE sid = ?`,
        [sid]
      );

      if (!row) return callback(null, null);

      if (row.expires_at <= Date.now()) {
        await run(`DELETE FROM ${this.tableName} WHERE sid = ?`, [sid]);
        return callback(null, null);
      }

      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  async set(sid, sess, callback) {
    try {
      await this.ready;
      const expiresAt = this.getExpirationTime(sess);
      await run(
        `INSERT INTO ${this.tableName} (sid, sess, expires_at, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(sid) DO UPDATE SET
           sess = excluded.sess,
           expires_at = excluded.expires_at,
           updated_at = CURRENT_TIMESTAMP`,
        [sid, JSON.stringify(sess), expiresAt]
      );
      return callback?.(null);
    } catch (error) {
      return callback?.(error);
    }
  }

  async destroy(sid, callback) {
    try {
      await this.ready;
      await run(`DELETE FROM ${this.tableName} WHERE sid = ?`, [sid]);
      return callback?.(null);
    } catch (error) {
      return callback?.(error);
    }
  }

  async touch(sid, sess, callback) {
    try {
      await this.ready;
      const expiresAt = this.getExpirationTime(sess);
      await run(
        `UPDATE ${this.tableName} SET expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?`,
        [expiresAt, sid]
      );
      return callback?.(null);
    } catch (error) {
      return callback?.(error);
    }
  }

  async length(callback) {
    try {
      await this.ready;
      const row = await get(
        `SELECT COUNT(*) AS count FROM ${this.tableName} WHERE expires_at > ?`,
        [Date.now()]
      );
      return callback?.(null, row?.count || 0);
    } catch (error) {
      return callback?.(error);
    }
  }

  async clear(callback) {
    try {
      await this.ready;
      await run(`DELETE FROM ${this.tableName}`);
      return callback?.(null);
    } catch (error) {
      return callback?.(error);
    }
  }

  async prune(callback) {
    try {
      await this.ready;
      await run(`DELETE FROM ${this.tableName} WHERE expires_at <= ?`, [Date.now()]);
      return callback?.(null);
    } catch (error) {
      return callback?.(error);
    }
  }
}

module.exports = SqliteSessionStore;
