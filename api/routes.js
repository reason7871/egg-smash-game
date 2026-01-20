/**
 * API 路由配置
 * 适配 Vercel Serverless Functions
 */

const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径（Vercel 使用 /tmp 目录存储临时数据）
const dbPath = process.env.VERCEL
  ? path.join('/tmp', 'lottery.db')
  : path.join(__dirname, '../database', 'lottery.db');

let db;

// 初始化数据库
function initDatabase() {
  if (!db) {
    db = new Database(dbPath);
    setupDatabase();
  }
  return db;
}

// 数据库表创建和初始化
function setupDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image TEXT,
      stock INTEGER DEFAULT 0,
      probability REAL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prize_id INTEGER,
      prize_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sound_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 初始化默认配置
    INSERT OR IGNORE INTO config (key, value) VALUES ('egg_count', '6');
    INSERT OR IGNORE INTO config (key, value) VALUES ('admin_password', 'admin123');
    INSERT OR IGNORE INTO config (key, value) VALUES ('egg_image', '/images/egg.png');
    INSERT OR IGNORE INTO config (key, value) VALUES ('egg_smashed_image', '/images/egg-smashed.png');
    INSERT OR IGNORE INTO config (key, value) VALUES ('egg_smash_effect', 'fade');

    -- 初始化默认音效
    INSERT OR IGNORE INTO sound_effects (type, name, url, is_active)
    VALUES
      ('hit', '默认敲击音效', '/audio/hit.mp3', 1),
      ('win', '默认中奖音效', '/audio/win.mp3', 1);
  `);
}

// 执行抽奖的辅助函数
function drawPrize(prize) {
  const stmt = db.prepare('UPDATE prizes SET stock = stock - 1 WHERE id = ?');
  stmt.run(prize.id);

  const recordStmt = db.prepare('INSERT INTO records (prize_id, prize_name) VALUES (?, ?)');
  recordStmt.run(prize.id, prize.name);

  return {
    success: true,
    prize: {
      id: prize.id,
      name: prize.name,
      image: prize.image
    }
  };
}

// 设置所有路由
module.exports = function(app) {
  const database = initDatabase();

  // ==================== 用户接口 ====================

  // 获取奖品列表
  app.get('/api/prizes', (req, res) => {
    const prizes = database.prepare('SELECT id, name, image, stock FROM prizes ORDER BY probability DESC').all();
    res.json(prizes);
  });

  // 获取奖品池状态
  app.get('/api/prizes/pool', (req, res) => {
    const prizes = database.prepare('SELECT id, name, image, stock FROM prizes ORDER BY probability DESC').all();
    res.json(prizes);
  });

  // 抽奖接口
  app.post('/api/draw', (req, res) => {
    const availablePrizes = database.prepare('SELECT * FROM prizes WHERE stock > 0').all();

    if (availablePrizes.length === 0) {
      return res.json({ success: false, message: '奖品池已抽完' });
    }

    // 使用累积概率算法抽奖
    const totalProbability = availablePrizes.reduce((sum, p) => sum + p.probability, 0);

    if (totalProbability === 0) {
      const selectedPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
      return res.json(drawPrize(selectedPrize));
    }

    const normalizedTotal = Math.min(totalProbability, 100);
    const random = Math.random() * normalizedTotal;

    let cumulativeProbability = 0;
    let selectedPrize = availablePrizes[0];

    for (const prize of availablePrizes) {
      cumulativeProbability += prize.probability;
      if (random <= cumulativeProbability) {
        selectedPrize = prize;
        break;
      }
    }

    res.json(drawPrize(selectedPrize));
  });

  // 获取金蛋配置
  app.get('/api/config', (req, res) => {
    const eggCount = database.prepare("SELECT value FROM config WHERE key = 'egg_count'").get();
    const eggImage = database.prepare("SELECT value FROM config WHERE key = 'egg_image'").get();
    const eggSmashedImage = database.prepare("SELECT value FROM config WHERE key = 'egg_smashed_image'").get();
    const eggSmashEffect = database.prepare("SELECT value FROM config WHERE key = 'egg_smash_effect'").get();

    res.json({
      eggCount: eggCount ? parseInt(eggCount.value) : 6,
      eggImage: eggImage ? eggImage.value : '/images/egg.png',
      eggSmashedImage: eggSmashedImage ? eggSmashedImage.value : '/images/egg-smashed.png',
      eggSmashEffect: eggSmashEffect ? eggSmashEffect.value : 'fade'
    });
  });

  // 获取当前激活的音效配置
  app.get('/api/sounds', (req, res) => {
    const sounds = database.prepare("SELECT type, name, url FROM sound_effects WHERE is_active = 1").all();
    const result = {
      hit: sounds.find(s => s.type === 'hit') || { type: 'hit', name: '默认敲击音效', url: '/audio/hit.mp3' },
      win: sounds.find(s => s.type === 'win') || { type: 'win', name: '默认中奖音效', url: '/audio/win.mp3' }
    };
    res.json(result);
  });

  // ==================== 管理后台接口 ====================

  // 管理员登录
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const stored = database.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();

    if (password === stored.value) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: '密码错误' });
    }
  });

  // 获取所有奖品
  app.get('/api/admin/prizes', (req, res) => {
    const prizes = database.prepare('SELECT * FROM prizes ORDER BY probability DESC').all();
    res.json(prizes);
  });

  // 添加奖品
  app.post('/api/admin/prizes', (req, res) => {
    const { name, image, stock, probability } = req.body;
    const stmt = database.prepare('INSERT INTO prizes (name, image, stock, probability) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, image || '', stock, probability);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // 更新奖品
  app.put('/api/admin/prizes/:id', (req, res) => {
    const { name, image, stock, probability } = req.body;
    const stmt = database.prepare('UPDATE prizes SET name = ?, image = ?, stock = ?, probability = ? WHERE id = ?');
    stmt.run(name, image || '', stock, probability, req.params.id);
    res.json({ success: true });
  });

  // 删除奖品
  app.delete('/api/admin/prizes/:id', (req, res) => {
    const stmt = database.prepare('DELETE FROM prizes WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  // 获取配置
  app.get('/api/admin/config', (req, res) => {
    const eggCount = database.prepare("SELECT value FROM config WHERE key = 'egg_count'").get();
    const eggImage = database.prepare("SELECT value FROM config WHERE key = 'egg_image'").get();
    const eggSmashedImage = database.prepare("SELECT value FROM config WHERE key = 'egg_smashed_image'").get();
    const eggSmashEffect = database.prepare("SELECT value FROM config WHERE key = 'egg_smash_effect'").get();

    res.json({
      eggCount: eggCount ? parseInt(eggCount.value) : 6,
      eggImage: eggImage ? eggImage.value : '/images/egg.png',
      eggSmashedImage: eggSmashedImage ? eggSmashedImage.value : '/images/egg-smashed.png',
      eggSmashEffect: eggSmashEffect ? eggSmashedEffect.value : 'fade'
    });
  });

  // 更新配置
  app.put('/api/admin/config', (req, res) => {
    const { eggCount, eggImage, eggSmashedImage, eggSmashEffect } = req.body;

    if (eggCount !== undefined) {
      const stmt = database.prepare("UPDATE config SET value = ? WHERE key = 'egg_count'");
      stmt.run(eggCount.toString());
    }
    if (eggImage !== undefined) {
      const stmt = database.prepare("UPDATE config SET value = ? WHERE key = 'egg_image'");
      stmt.run(eggImage);
    }
    if (eggSmashedImage !== undefined) {
      const stmt = database.prepare("UPDATE config SET value = ? WHERE key = 'egg_smashed_image'");
      stmt.run(eggSmashedImage);
    }
    if (eggSmashEffect !== undefined) {
      const stmt = database.prepare("UPDATE config SET value = ? WHERE key = 'egg_smash_effect'");
      stmt.run(eggSmashEffect);
    }

    res.json({ success: true });
  });

  // 获取中奖记录
  app.get('/api/admin/records', (req, res) => {
    const records = database.prepare(`
      SELECT r.*, p.image
      FROM records r
      LEFT JOIN prizes p ON r.prize_id = p.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `).all();
    res.json(records);
  });

  // 获取统计信息
  app.get('/api/admin/stats', (req, res) => {
    const totalDraws = database.prepare('SELECT COUNT(*) as count FROM records').get();
    const prizes = database.prepare('SELECT * FROM prizes').all();
    const totalStock = prizes.reduce((sum, p) => sum + p.stock, 0);

    res.json({
      totalDraws: totalDraws.count,
      totalStock,
      prizes: prizes.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock
      }))
    });
  });

  // ==================== 音效管理接口 ====================

  // 获取所有音效
  app.get('/api/admin/sounds', (req, res) => {
    const sounds = database.prepare('SELECT * FROM sound_effects ORDER BY type, created_at DESC').all();
    res.json(sounds);
  });

  // 添加音效
  app.post('/api/admin/sounds', (req, res) => {
    const { type, name, url } = req.body;
    const stmt = database.prepare('INSERT INTO sound_effects (type, name, url) VALUES (?, ?, ?)');
    const result = stmt.run(type, name, url);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // 更新音效
  app.put('/api/admin/sounds/:id', (req, res) => {
    const { name, url } = req.body;
    const stmt = database.prepare('UPDATE sound_effects SET name = ?, url = ? WHERE id = ?');
    stmt.run(name, url, req.params.id);
    res.json({ success: true });
  });

  // 删除音效
  app.delete('/api/admin/sounds/:id', (req, res) => {
    const stmt = database.prepare('DELETE FROM sound_effects WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  // 激活音效
  app.put('/api/admin/sounds/:id/activate', (req, res) => {
    const sound = database.prepare('SELECT type FROM sound_effects WHERE id = ?').get(req.params.id);
    if (!sound) {
      return res.json({ success: false, message: '音效不存在' });
    }

    database.prepare('UPDATE sound_effects SET is_active = 0 WHERE type = ?').run(sound.type);
    database.prepare('UPDATE sound_effects SET is_active = 1 WHERE id = ?').run(req.params.id);

    res.json({ success: true });
  });

  // ==================== 文件上传接口 ====================

  // 上传金蛋图片（Vercel 不支持本地文件上传，使用 URL）
  app.post('/api/admin/upload/egg-image', (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.json({ success: false, message: '请提供图片 URL' });
    }
    res.json({ success: true, url });
  });

  // 上传破碎金蛋图片（Vercel 不支持本地文件上传，使用 URL）
  app.post('/api/admin/upload/smashed-image', (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.json({ success: false, message: '请提供图片 URL' });
    }
    res.json({ success: true, url });
  });

  return database;
};
