const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置 multer 用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名: 原始名称-时间戳.扩展名
    const uniqueSuffix = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制 5MB
  }
});

// 初始化数据库
const db = new Database('./database/lottery.db');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS prizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image TEXT,
    stock INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 1,
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

  -- 初始化默认金蛋数量
  INSERT OR IGNORE INTO config (key, value) VALUES ('egg_count', '6');

  -- 初始化管理员密码
  INSERT OR IGNORE INTO config (key, value) VALUES ('admin_password', 'admin123');

  -- 初始化金蛋图片配置
  INSERT OR IGNORE INTO config (key, value) VALUES ('egg_image', '/images/egg.png');
  INSERT OR IGNORE INTO config (key, value) VALUES ('egg_smashed_image', '/images/egg-smashed.png');
  INSERT OR IGNORE INTO config (key, value) VALUES ('egg_smash_effect', 'fade');  -- fade: 淡出, image: 切换图片

  -- 初始化默认音效（如果没有音效记录）
  INSERT OR IGNORE INTO sound_effects (type, name, url, is_active)
  VALUES
    ('hit', '默认敲击音效', '/audio/hit.mp3', 1),
    ('win', '默认中奖音效', '/audio/win.mp3', 1);
`);

// ==================== 用户接口 ====================

// 获取奖品列表（不含敏感信息）
app.get('/api/prizes', (req, res) => {
  const prizes = db.prepare('SELECT id, name, image, stock FROM prizes ORDER BY probability DESC').all();
  res.json(prizes);
});

// 获取奖品池状态
app.get('/api/prizes/pool', (req, res) => {
  const prizes = db.prepare('SELECT id, name, image, stock FROM prizes ORDER BY probability DESC').all();
  res.json(prizes);
});

// 抽奖接口
app.post('/api/draw', (req, res) => {
  // 获取所有有库存的奖品
  const availablePrizes = db.prepare('SELECT * FROM prizes WHERE stock > 0').all();

  if (availablePrizes.length === 0) {
    return res.json({ success: false, message: '奖品池已抽完' });
  }

  // 使用累积概率算法抽奖
  const totalProbability = availablePrizes.reduce((sum, p) => sum + p.probability, 0);

  // 如果总概率为0（所有奖品概率都是0），随机选择
  if (totalProbability === 0) {
    const selectedPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    return drawPrize(selectedPrize, res);
  }

  // 归一化概率到 0-100 范围
  const normalizedTotal = Math.min(totalProbability, 100);

  // 生成一个 0-100 的随机数
  const random = Math.random() * normalizedTotal;

  // 按累积概率选择奖品
  let cumulativeProbability = 0;
  let selectedPrize = availablePrizes[0];

  for (const prize of availablePrizes) {
    cumulativeProbability += prize.probability;
    if (random <= cumulativeProbability) {
      selectedPrize = prize;
      break;
    }
  }

  drawPrize(selectedPrize, res);
});

// 执行抽奖的辅助函数
function drawPrize(prize, res) {
  // 扣减库存
  const stmt = db.prepare('UPDATE prizes SET stock = stock - 1 WHERE id = ?');
  stmt.run(prize.id);

  // 记录中奖记录
  const recordStmt = db.prepare('INSERT INTO records (prize_id, prize_name) VALUES (?, ?)');
  recordStmt.run(prize.id, prize.name);

  res.json({
    success: true,
    prize: {
      id: prize.id,
      name: prize.name,
      image: prize.image
    }
  });
}

// 获取金蛋配置
app.get('/api/config', (req, res) => {
  const eggCount = db.prepare("SELECT value FROM config WHERE key = 'egg_count'").get();
  const eggImage = db.prepare("SELECT value FROM config WHERE key = 'egg_image'").get();
  const eggSmashedImage = db.prepare("SELECT value FROM config WHERE key = 'egg_smashed_image'").get();
  const eggSmashEffect = db.prepare("SELECT value FROM config WHERE key = 'egg_smash_effect'").get();

  res.json({
    eggCount: eggCount ? parseInt(eggCount.value) : 6,
    eggImage: eggImage ? eggImage.value : '/images/egg.png',
    eggSmashedImage: eggSmashedImage ? eggSmashedImage.value : '/images/egg-smashed.png',
    eggSmashEffect: eggSmashEffect ? eggSmashEffect.value : 'fade'
  });
});

// 获取当前激活的音效配置
app.get('/api/sounds', (req, res) => {
  const sounds = db.prepare("SELECT type, name, url FROM sound_effects WHERE is_active = 1").all();
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
  const stored = db.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();

  if (password === stored.value) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '密码错误' });
  }
});

// 获取所有奖品（管理后台用）
app.get('/api/admin/prizes', (req, res) => {
  const prizes = db.prepare('SELECT * FROM prizes ORDER BY probability DESC').all();
  res.json(prizes);
});

// 添加奖品
app.post('/api/admin/prizes', (req, res) => {
  const { name, image, stock, probability } = req.body;
  const stmt = db.prepare('INSERT INTO prizes (name, image, stock, probability) VALUES (?, ?, ?, ?)');
  const result = stmt.run(name, image || '', stock, probability);
  res.json({ success: true, id: result.lastInsertRowid });
});

// 更新奖品
app.put('/api/admin/prizes/:id', (req, res) => {
  const { name, image, stock, probability } = req.body;
  const stmt = db.prepare('UPDATE prizes SET name = ?, image = ?, stock = ?, probability = ? WHERE id = ?');
  stmt.run(name, image || '', stock, probability, req.params.id);
  res.json({ success: true });
});

// 删除奖品
app.delete('/api/admin/prizes/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM prizes WHERE id = ?');
  stmt.run(req.params.id);
  res.json({ success: true });
});

// 获取配置
app.get('/api/admin/config', (req, res) => {
  const eggCount = db.prepare("SELECT value FROM config WHERE key = 'egg_count'").get();
  const eggImage = db.prepare("SELECT value FROM config WHERE key = 'egg_image'").get();
  const eggSmashedImage = db.prepare("SELECT value FROM config WHERE key = 'egg_smashed_image'").get();
  const eggSmashEffect = db.prepare("SELECT value FROM config WHERE key = 'egg_smash_effect'").get();

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
    const stmt = db.prepare("UPDATE config SET value = ? WHERE key = 'egg_count'");
    stmt.run(eggCount.toString());
  }
  if (eggImage !== undefined) {
    const stmt = db.prepare("UPDATE config SET value = ? WHERE key = 'egg_image'");
    stmt.run(eggImage);
  }
  if (eggSmashedImage !== undefined) {
    const stmt = db.prepare("UPDATE config SET value = ? WHERE key = 'egg_smashed_image'");
    stmt.run(eggSmashedImage);
  }
  if (eggSmashEffect !== undefined) {
    const stmt = db.prepare("UPDATE config SET value = ? WHERE key = 'egg_smash_effect'");
    stmt.run(eggSmashEffect);
  }

  res.json({ success: true });
});

// 获取中奖记录
app.get('/api/admin/records', (req, res) => {
  const records = db.prepare(`
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
  const totalDraws = db.prepare('SELECT COUNT(*) as count FROM records').get();
  const prizes = db.prepare('SELECT * FROM prizes').all();
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
  const sounds = db.prepare('SELECT * FROM sound_effects ORDER BY type, created_at DESC').all();
  res.json(sounds);
});

// 添加音效
app.post('/api/admin/sounds', (req, res) => {
  const { type, name, url } = req.body;
  const stmt = db.prepare('INSERT INTO sound_effects (type, name, url) VALUES (?, ?, ?)');
  const result = stmt.run(type, name, url);
  res.json({ success: true, id: result.lastInsertRowid });
});

// 更新音效
app.put('/api/admin/sounds/:id', (req, res) => {
  const { name, url } = req.body;
  const stmt = db.prepare('UPDATE sound_effects SET name = ?, url = ? WHERE id = ?');
  stmt.run(name, url, req.params.id);
  res.json({ success: true });
});

// 删除音效
app.delete('/api/admin/sounds/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM sound_effects WHERE id = ?');
  stmt.run(req.params.id);
  res.json({ success: true });
});

// 激活音效
app.put('/api/admin/sounds/:id/activate', (req, res) => {
  const sound = db.prepare('SELECT type FROM sound_effects WHERE id = ?').get(req.params.id);
  if (!sound) {
    return res.json({ success: false, message: '音效不存在' });
  }

  // 取消该类型的所有激活状态
  db.prepare('UPDATE sound_effects SET is_active = 0 WHERE type = ?').run(sound.type);
  // 激活选中的音效
  db.prepare('UPDATE sound_effects SET is_active = 1 WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

// ==================== 文件上传接口 ====================

// 上传金蛋图片
app.post('/api/admin/upload/egg-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '没有上传文件' });
  }

  // 返回文件访问路径
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// 上传破碎金蛋图片
app.post('/api/admin/upload/smashed-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '没有上传文件' });
  }

  // 返回文件访问路径
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`管理后台: http://localhost:${PORT}/admin.html`);
});
