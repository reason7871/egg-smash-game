/**
 * Vercel Serverless Function 入口
 * 将 Express 应用适配为 Vercel API Routes
 */

const express = require('express');
const cors = require('cors');

// 创建 Express 应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件服务（用于上传的图片）
app.use('/uploads', express.static('public/uploads'));

// 导入所有路由
const setupRoutes = require('./routes');

// 初始化数据库和路由
let isInitialized = false;

async function initializeApp() {
  if (isInitialized) return;
  await setupRoutes(app);
  isInitialized = true;
}

// Vercel Serverless Function 导出
module.exports = async (req, res) => {
  await initializeApp();
  return app(req, res);
};

// 本地开发支持（使用 vercel dev）
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initializeApp().then(() => {
    app.listen(PORT, () => {
      console.log(`开发服务器运行在 http://localhost:${PORT}`);
    });
  });
}
