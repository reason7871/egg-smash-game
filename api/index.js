/**
 * Vercel Serverless Function 入口
 * 将 Express 应用适配为 Vercel API Routes
 * 使用 Prisma + Vercel Postgres 实现数据持久化
 */

const express = require('express');
const cors = require('cors');

// 创建 Express 应用
const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 导入所有路由（使用 Prisma）
const setupRoutes = require('./routes-prisma');

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
