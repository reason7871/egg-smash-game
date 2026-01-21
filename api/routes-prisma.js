/**
 * API 路由配置
 * 使用 Prisma + Vercel Postgres
 * 支持数据持久化
 */

const { PrismaClient } = require('@prisma/client');

// 使用全局变量避免在开发环境中创建多个连接
const globalForPrisma = global;
globalForPrisma.prisma = globalForPrisma.prisma || new PrismaClient();

const prisma = globalForPrisma.prisma;

// 初始化默认数据
async function initDefaultData() {
  // 检查是否已初始化
  const configCount = await prisma.config.count();

  if (configCount === 0) {
    // 初始化默认配置
    await prisma.config.createMany({
      data: [
        { key: 'egg_count', value: '6' },
        { key: 'admin_password', value: 'admin123' },
        { key: 'egg_image', value: '/images/egg.png' },
        { key: 'egg_smashed_image', value: '/images/egg-smashed.png' },
        { key: 'egg_smash_effect', value: 'fade' }
      ],
      skipDuplicates: true
    });

    // 初始化默认音效
    await prisma.soundEffect.createMany({
      data: [
        { type: 'hit', name: '默认敲击音效', url: '/audio/hit.mp3', is_active: 1 },
        { type: 'win', name: '默认中奖音效', url: '/audio/win.mp3', is_active: 1 }
      ],
      skipDuplicates: true
    });
  }
}

// 初始化数据库
async function initDatabase() {
  await initDefaultData();
}

// 设置所有路由
module.exports = async function(app) {
  await initDatabase();

  // ==================== 用户接口 ====================

  // 获取奖品列表
  app.get('/api/prizes', async (req, res) => {
    try {
      const prizes = await prisma.prize.findMany({
        select: { id: true, name: true, image: true, stock: true },
        orderBy: { probability: 'desc' }
      });
      res.json(prizes);
    } catch (error) {
      console.error('获取奖品列表失败:', error);
      res.json([]);
    }
  });

  // 获取奖品池状态
  app.get('/api/prizes/pool', async (req, res) => {
    try {
      const prizes = await prisma.prize.findMany({
        select: { id: true, name: true, image: true, stock: true },
        orderBy: { probability: 'desc' }
      });
      res.json(prizes);
    } catch (error) {
      console.error('获取奖品池失败:', error);
      res.json([]);
    }
  });

  // 抽奖接口
  app.post('/api/draw', async (req, res) => {
    try {
      const availablePrizes = await prisma.prize.findMany({
        where: { stock: { gt: 0 } }
      });

      if (availablePrizes.length === 0) {
        return res.json({ success: false, message: '奖品池已抽完' });
      }

      // 使用累积概率算法抽奖
      const totalProbability = availablePrizes.reduce((sum, p) => sum + (p.probability || 0), 0);

      let selectedPrize;
      if (totalProbability === 0) {
        selectedPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
      } else {
        const normalizedTotal = Math.min(totalProbability, 100);
        const random = Math.random() * normalizedTotal;

        let cumulativeProbability = 0;
        selectedPrize = availablePrizes[0];

        for (const prize of availablePrizes) {
          cumulativeProbability += prize.probability || 0;
          if (random <= cumulativeProbability) {
            selectedPrize = prize;
            break;
          }
        }
      }

      // 更新库存并记录
      await prisma.prize.update({
        where: { id: selectedPrize.id },
        data: { stock: { decrement: 1 } }
      });

      await prisma.record.create({
        data: {
          prize_id: selectedPrize.id,
          prize_name: selectedPrize.name
        }
      });

      res.json({
        success: true,
        prize: {
          id: selectedPrize.id,
          name: selectedPrize.name,
          image: selectedPrize.image
        }
      });
    } catch (error) {
      console.error('抽奖失败:', error);
      res.json({ success: false, message: '抽奖失败，请稍后重试' });
    }
  });

  // 获取金蛋配置
  app.get('/api/config', async (req, res) => {
    try {
      const configs = await prisma.config.findMany();
      const configMap = {};
      configs.forEach(c => configMap[c.key] = c.value);

      res.json({
        eggCount: parseInt(configMap['egg_count'] || '6'),
        eggImage: configMap['egg_image'] || '/images/egg.png',
        eggSmashedImage: configMap['egg_smashed_image'] || '/images/egg-smashed.png',
        eggSmashEffect: configMap['egg_smash_effect'] || 'fade'
      });
    } catch (error) {
      console.error('获取配置失败:', error);
      res.json({
        eggCount: 6,
        eggImage: '/images/egg.png',
        eggSmashedImage: '/images/egg-smashed.png',
        eggSmashEffect: 'fade'
      });
    }
  });

  // 获取当前激活的音效配置
  app.get('/api/sounds', async (req, res) => {
    try {
      const sounds = await prisma.soundEffect.findMany({
        where: { is_active: 1 },
        select: { type: true, name: true, url: true }
      });

      const result = {
        hit: sounds.find(s => s.type === 'hit') || { type: 'hit', name: '默认敲击音效', url: '/audio/hit.mp3' },
        win: sounds.find(s => s.type === 'win') || { type: 'win', name: '默认中奖音效', url: '/audio/win.mp3' }
      };
      res.json(result);
    } catch (error) {
      console.error('获取音效失败:', error);
      res.json({
        hit: { type: 'hit', name: '默认敲击音效', url: '/audio/hit.mp3' },
        win: { type: 'win', name: '默认中奖音效', url: '/audio/win.mp3' }
      });
    }
  });

  // ==================== 管理后台接口 ====================

  // 管理员登录
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { password } = req.body;
      const stored = await prisma.config.findUnique({
        where: { key: 'admin_password' }
      });

      if (password === stored?.value) {
        res.json({ success: true });
      } else {
        res.json({ success: false, message: '密码错误' });
      }
    } catch (error) {
      console.error('登录失败:', error);
      res.json({ success: false, message: '登录失败' });
    }
  });

  // 获取所有奖品
  app.get('/api/admin/prizes', async (req, res) => {
    try {
      const prizes = await prisma.prize.findMany({
        orderBy: { probability: 'desc' }
      });
      res.json(prizes);
    } catch (error) {
      console.error('获取奖品列表失败:', error);
      res.json([]);
    }
  });

  // 添加奖品
  app.post('/api/admin/prizes', async (req, res) => {
    try {
      const { name, image, stock, probability } = req.body;
      const prize = await prisma.prize.create({
        data: {
          name,
          image: image || '',
          stock: stock || 0,
          probability: probability || 1
        }
      });
      res.json({ success: true, id: prize.id });
    } catch (error) {
      console.error('添加奖品失败:', error);
      res.json({ success: false, message: '添加失败' });
    }
  });

  // 更新奖品
  app.put('/api/admin/prizes/:id', async (req, res) => {
    try {
      const { name, image, stock, probability } = req.body;
      await prisma.prize.update({
        where: { id: parseInt(req.params.id) },
        data: {
          name,
          image: image || '',
          stock: stock || 0,
          probability: probability || 1
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error('更新奖品失败:', error);
      res.json({ success: false, message: '更新失败' });
    }
  });

  // 删除奖品
  app.delete('/api/admin/prizes/:id', async (req, res) => {
    try {
      await prisma.prize.delete({
        where: { id: parseInt(req.params.id) }
      });
      res.json({ success: true });
    } catch (error) {
      console.error('删除奖品失败:', error);
      res.json({ success: false, message: '删除失败' });
    }
  });

  // 获取配置
  app.get('/api/admin/config', async (req, res) => {
    try {
      const configs = await prisma.config.findMany();
      const configMap = {};
      configs.forEach(c => configMap[c.key] = c.value);

      res.json({
        eggCount: parseInt(configMap['egg_count'] || '6'),
        eggImage: configMap['egg_image'] || '/images/egg.png',
        eggSmashedImage: configMap['egg_smashed_image'] || '/images/egg-smashed.png',
        eggSmashEffect: configMap['egg_smash_effect'] || 'fade'
      });
    } catch (error) {
      console.error('获取配置失败:', error);
      res.json({
        eggCount: 6,
        eggImage: '/images/egg.png',
        eggSmashedImage: '/images/egg-smashed.png',
        eggSmashEffect: 'fade'
      });
    }
  });

  // 更新配置
  app.put('/api/admin/config', async (req, res) => {
    try {
      const { eggCount, eggImage, eggSmashedImage, eggSmashEffect } = req.body;

      if (eggCount !== undefined) {
        await prisma.config.upsert({
          where: { key: 'egg_count' },
          update: { value: eggCount.toString() },
          create: { key: 'egg_count', value: eggCount.toString() }
        });
      }
      if (eggImage !== undefined) {
        await prisma.config.upsert({
          where: { key: 'egg_image' },
          update: { value: eggImage },
          create: { key: 'egg_image', value: eggImage }
        });
      }
      if (eggSmashedImage !== undefined) {
        await prisma.config.upsert({
          where: { key: 'egg_smashed_image' },
          update: { value: eggSmashedImage },
          create: { key: 'egg_smashed_image', value: eggSmashedImage }
        });
      }
      if (eggSmashEffect !== undefined) {
        await prisma.config.upsert({
          where: { key: 'egg_smash_effect' },
          update: { value: eggSmashEffect },
          create: { key: 'egg_smash_effect', value: eggSmashEffect }
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('保存配置失败:', error);
      res.json({ success: false, message: '保存失败' });
    }
  });

  // 获取中奖记录
  app.get('/api/admin/records', async (req, res) => {
    try {
      const records = await prisma.record.findMany({
        include: {
          prize: {
            select: { image: true }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 100
      });

      // 格式化结果以匹配原有格式
      const formattedRecords = records.map(r => ({
        ...r,
        image: r.prize?.image || null
      }));

      res.json(formattedRecords);
    } catch (error) {
      console.error('获取记录失败:', error);
      res.json([]);
    }
  });

  // 获取统计信息
  app.get('/api/admin/stats', async (req, res) => {
    try {
      const totalDraws = await prisma.record.count();
      const prizes = await prisma.prize.findMany({
        select: { id: true, name: true, stock: true }
      });
      const totalStock = prizes.reduce((sum, p) => sum + (p.stock || 0), 0);

      res.json({
        totalDraws,
        totalStock,
        prizes: prizes.map(p => ({
          id: p.id,
          name: p.name,
          stock: p.stock
        }))
      });
    } catch (error) {
      console.error('获取统计失败:', error);
      res.json({ totalDraws: 0, totalStock: 0, prizes: [] });
    }
  });

  // ==================== 音效管理接口 ====================

  // 获取所有音效
  app.get('/api/admin/sounds', async (req, res) => {
    try {
      const sounds = await prisma.soundEffect.findMany({
        orderBy: [{ type: 'asc' }, { created_at: 'desc' }]
      });
      res.json(sounds);
    } catch (error) {
      console.error('获取音效列表失败:', error);
      res.json([]);
    }
  });

  // 添加音效
  app.post('/api/admin/sounds', async (req, res) => {
    try {
      const { type, name, url } = req.body;
      const sound = await prisma.soundEffect.create({
        data: { type, name, url }
      });
      res.json({ success: true, id: sound.id });
    } catch (error) {
      console.error('添加音效失败:', error);
      res.json({ success: false, message: '添加失败' });
    }
  });

  // 更新音效
  app.put('/api/admin/sounds/:id', async (req, res) => {
    try {
      const { name, url } = req.body;
      await prisma.soundEffect.update({
        where: { id: parseInt(req.params.id) },
        data: { name, url }
      });
      res.json({ success: true });
    } catch (error) {
      console.error('更新音效失败:', error);
      res.json({ success: false, message: '更新失败' });
    }
  });

  // 删除音效
  app.delete('/api/admin/sounds/:id', async (req, res) => {
    try {
      await prisma.soundEffect.delete({
        where: { id: parseInt(req.params.id) }
      });
      res.json({ success: true });
    } catch (error) {
      console.error('删除音效失败:', error);
      res.json({ success: false, message: '删除失败' });
    }
  });

  // 激活音效
  app.put('/api/admin/sounds/:id/activate', async (req, res) => {
    try {
      const sound = await prisma.soundEffect.findUnique({
        where: { id: parseInt(req.params.id) }
      });

      if (!sound) {
        return res.json({ success: false, message: '音效不存在' });
      }

      // 取消同类型的其他激活音效
      await prisma.soundEffect.updateMany({
        where: { type: sound.type },
        data: { is_active: 0 }
      });

      // 激活当前音效
      await prisma.soundEffect.update({
        where: { id: parseInt(req.params.id) },
        data: { is_active: 1 }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('激活音效失败:', error);
      res.json({ success: false, message: '激活失败' });
    }
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
};
