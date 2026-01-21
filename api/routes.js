/**
 * API 路由配置
 * 适配 Vercel Serverless Functions
 * 使用 sql.js (纯 JavaScript SQLite 实现)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// 数据库文件路径（Vercel 使用 /tmp 目录存储临时数据）
const dbPath = process.env.VERCEL
  ? path.join('/tmp', 'lottery.db')
  : path.join(__dirname, '../database', 'lottery.db');

let db;
let SQL;

// 初始化数据库
async function initDatabase() {
  if (db) return db;

  // 手动获取 WASM 文件
  const wasmUrl = 'https://sql.js.org/dist/sql-wasm.wasm';
  const wasmResponse = await fetch(wasmUrl);
  const wasmBuffer = await wasmResponse.arrayBuffer();
  const wasmBinary = new Uint8Array(wasmBuffer);

  // 使用 WASM 二进制数据初始化 sql.js
  SQL = await initSqlJs({ wasmBinary });

  // 尝试加载现有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  setupDatabase();
  return db;
}

// 保存数据库到文件
function saveDatabase() {
  if (process.env.VERCEL) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } else {
    // 确保目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 数据库表创建和初始化
function setupDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      image TEXT,
      stock INTEGER DEFAULT 0,
      probability REAL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prize_id INTEGER,
      prize_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sound_effects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 检查是否需要初始化默认数据
  const configCount = db.exec("SELECT COUNT(*) as count FROM config")[0]?.values[0][0];
  if (!configCount || configCount === 0) {
    // 初始化默认配置
    db.run("INSERT INTO config (key, value) VALUES ('egg_count', '6')");
    db.run("INSERT INTO config (key, value) VALUES ('admin_password', 'admin123')");
    db.run("INSERT INTO config (key, value) VALUES ('egg_image', '/images/egg.png')");
    db.run("INSERT INTO config (key, value) VALUES ('egg_smashed_image', '/images/egg-smashed.png')");
    db.run("INSERT INTO config (key, value) VALUES ('egg_smash_effect', 'fade')");

    // 初始化默认音效
    db.run("INSERT INTO sound_effects (type, name, url, is_active) VALUES ('hit', '默认敲击音效', '/audio/hit.mp3', 1)");
    db.run("INSERT INTO sound_effects (type, name, url, is_active) VALUES ('win', '默认中奖音效', '/audio/win.mp3', 1)");

    saveDatabase();
  }
}

// 辅助函数：执行查询并返回结果
function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

// 辅助函数：执行查询并返回单个结果
function queryGet(db, sql, params = []) {
  const results = queryAll(db, sql, params);
  return results.length > 0 ? results[0] : null;
}

// 执行抽奖的辅助函数
function drawPrize(prize) {
  db.run('UPDATE prizes SET stock = stock - 1 WHERE id = ?', [prize.id]);
  db.run('INSERT INTO records (prize_id, prize_name) VALUES (?, ?)', [prize.id, prize.name]);
  saveDatabase();

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
module.exports = async function(app) {
  const database = await initDatabase();

  // ==================== 用户接口 ====================

  // 获取奖品列表
  app.get('/api/prizes', (req, res) => {
    const prizes = queryAll(database, 'SELECT id, name, image, stock FROM prizes ORDER BY probability DESC');
    res.json(prizes);
  });

  // 获取奖品池状态
  app.get('/api/prizes/pool', (req, res) => {
    const prizes = queryAll(database, 'SELECT id, name, image, stock FROM prizes ORDER BY probability DESC');
    res.json(prizes);
  });

  // 抽奖接口
  app.post('/api/draw', (req, res) => {
    const availablePrizes = queryAll(database, 'SELECT * FROM prizes WHERE stock > 0');

    if (availablePrizes.length === 0) {
      return res.json({ success: false, message: '奖品池已抽完' });
    }

    // 使用累积概率算法抽奖
    const totalProbability = availablePrizes.reduce((sum, p) => sum + (p.probability || 0), 0);

    if (totalProbability === 0) {
      const selectedPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
      return res.json(drawPrize(selectedPrize));
    }

    const normalizedTotal = Math.min(totalProbability, 100);
    const random = Math.random() * normalizedTotal;

    let cumulativeProbability = 0;
    let selectedPrize = availablePrizes[0];

    for (const prize of availablePrizes) {
      cumulativeProbability += prize.probability || 0;
      if (random <= cumulativeProbability) {
        selectedPrize = prize;
        break;
      }
    }

    res.json(drawPrize(selectedPrize));
  });

  // 获取金蛋配置
  app.get('/api/config', (req, res) => {
    const eggCount = queryGet(database, "SELECT value FROM config WHERE key = 'egg_count'");
    const eggImage = queryGet(database, "SELECT value FROM config WHERE key = 'egg_image'");
    const eggSmashedImage = queryGet(database, "SELECT value FROM config WHERE key = 'egg_smashed_image'");
    const eggSmashEffect = queryGet(database, "SELECT value FROM config WHERE key = 'egg_smash_effect'");

    res.json({
      eggCount: eggCount ? parseInt(eggCount.value) : 6,
      eggImage: eggImage ? eggImage.value : '/images/egg.png',
      eggSmashedImage: eggSmashedImage ? eggSmashedImage.value : '/images/egg-smashed.png',
      eggSmashEffect: eggSmashEffect ? eggSmashEffect.value : 'fade'
    });
  });

  // 获取当前激活的音效配置
  app.get('/api/sounds', (req, res) => {
    const sounds = queryAll(database, "SELECT type, name, url FROM sound_effects WHERE is_active = 1");
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
    const stored = queryGet(database, "SELECT value FROM config WHERE key = 'admin_password'");

    if (password === stored?.value) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: '密码错误' });
    }
  });

  // 获取所有奖品
  app.get('/api/admin/prizes', (req, res) => {
    const prizes = queryAll(database, 'SELECT * FROM prizes ORDER BY probability DESC');
    res.json(prizes);
  });

  // 添加奖品
  app.post('/api/admin/prizes', (req, res) => {
    const { name, image, stock, probability } = req.body;
    database.run('INSERT INTO prizes (name, image, stock, probability) VALUES (?, ?, ?, ?)', [name, image || '', stock, probability]);
    saveDatabase();
    const result = queryGet(database, 'SELECT last_insert_rowid() as id');
    res.json({ success: true, id: result?.id });
  });

  // 更新奖品
  app.put('/api/admin/prizes/:id', (req, res) => {
    const { name, image, stock, probability } = req.body;
    database.run('UPDATE prizes SET name = ?, image = ?, stock = ?, probability = ? WHERE id = ?', [name, image || '', stock, probability, req.params.id]);
    saveDatabase();
    res.json({ success: true });
  });

  // 删除奖品
  app.delete('/api/admin/prizes/:id', (req, res) => {
    database.run('DELETE FROM prizes WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  });

  // 获取配置
  app.get('/api/admin/config', (req, res) => {
    const eggCount = queryGet(database, "SELECT value FROM config WHERE key = 'egg_count'");
    const eggImage = queryGet(database, "SELECT value FROM config WHERE key = 'egg_image'");
    const eggSmashedImage = queryGet(database, "SELECT value FROM config WHERE key = 'egg_smashed_image'");
    const eggSmashEffect = queryGet(database, "SELECT value FROM config WHERE key = 'egg_smash_effect'");

    res.json({
      eggCount: eggCount ? parseInt(eggCount.value) : 6,
      eggImage: eggImage ? eggImage.value : '/images/egg.png',
      eggSmashedImage: eggSmashedImage ? eggSmashedImage.value : '/images/egg-smashed.png',
      eggSmashEffect: eggSmashEffect ? eggSmashEffect.value : 'fade'
    });
  });

  // 更新配置
  app.put('/api/admin/config', (req, res) => {
    const { eggCount, eggImage, eggSmashedImage, eggSmashEffect } = req.body;

    if (eggCount !== undefined) {
      database.run("UPDATE config SET value = ? WHERE key = 'egg_count'", [eggCount.toString()]);
    }
    if (eggImage !== undefined) {
      database.run("UPDATE config SET value = ? WHERE key = 'egg_image'", [eggImage]);
    }
    if (eggSmashedImage !== undefined) {
      database.run("UPDATE config SET value = ? WHERE key = 'egg_smashed_image'", [eggSmashedImage]);
    }
    if (eggSmashEffect !== undefined) {
      database.run("UPDATE config SET value = ? WHERE key = 'egg_smash_effect'", [eggSmashEffect]);
    }
    saveDatabase();
    res.json({ success: true });
  });

  // 获取中奖记录
  app.get('/api/admin/records', (req, res) => {
    const records = queryAll(database, `
      SELECT r.*, p.image
      FROM records r
      LEFT JOIN prizes p ON r.prize_id = p.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `);
    res.json(records);
  });

  // 获取统计信息
  app.get('/api/admin/stats', (req, res) => {
    const totalDrawsResult = queryGet(database, 'SELECT COUNT(*) as count FROM records');
    const prizes = queryAll(database, 'SELECT * FROM prizes');
    const totalStock = prizes.reduce((sum, p) => sum + (p.stock || 0), 0);

    res.json({
      totalDraws: totalDrawsResult?.count || 0,
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
    const sounds = queryAll(database, 'SELECT * FROM sound_effects ORDER BY type, created_at DESC');
    res.json(sounds);
  });

  // 添加音效
  app.post('/api/admin/sounds', (req, res) => {
    const { type, name, url } = req.body;
    database.run('INSERT INTO sound_effects (type, name, url) VALUES (?, ?, ?)', [type, name, url]);
    saveDatabase();
    const result = queryGet(database, 'SELECT last_insert_rowid() as id');
    res.json({ success: true, id: result?.id });
  });

  // 更新音效
  app.put('/api/admin/sounds/:id', (req, res) => {
    const { name, url } = req.body;
    database.run('UPDATE sound_effects SET name = ?, url = ? WHERE id = ?', [name, url, req.params.id]);
    saveDatabase();
    res.json({ success: true });
  });

  // 删除音效
  app.delete('/api/admin/sounds/:id', (req, res) => {
    database.run('DELETE FROM sound_effects WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true });
  });

  // 激活音效
  app.put('/api/admin/sounds/:id/activate', (req, res) => {
    const sound = queryGet(database, 'SELECT type FROM sound_effects WHERE id = ?', [req.params.id]);
    if (!sound) {
      return res.json({ success: false, message: '音效不存在' });
    }

    database.run('UPDATE sound_effects SET is_active = 0 WHERE type = ?', [sound.type]);
    database.run('UPDATE sound_effects SET is_active = 1 WHERE id = ?', [req.params.id]);
    saveDatabase();

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
