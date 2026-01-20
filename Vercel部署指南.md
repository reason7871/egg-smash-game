# Vercel 部署指南 - 砸金蛋应用

## 目录

- [部署方式说明](#部署方式说明)
- [方式一：通过 Vercel 网站部署](#方式一通过-vercel-网站部署推荐)
- [方式二：通过 Vercel CLI 部署](#方式二通过-vercel-cli-部署)
- [部署后配置](#部署后配置)
- [重要注意事项](#重要注意事项)

---

## 部署方式说明

### Vercel 特点和限制

**优点：**
- 🚀 全球 CDN 加速
- 🔄 自动 HTTPS
- 📦 零配置部署
- 💰 免费额度充足

**限制：**
- ⚠️ **不提供持久化数据库** - 每次部署数据库会重置
- ⚠️ **不支持文件上传** - 需使用外部图片 URL
- ⚠️ **Serverless 限制** - 每个请求最多 10 秒执行时间

### 适用场景

✅ **适合：**
- 快速演示和原型
- 短期活动（几小时到几天）
- 测试功能

❌ **不适合：**
- 需要长期保存数据
- 需要频繁更新奖品
- 高并发生产环境

### 数据持久化方案

如需数据持久化，建议使用外部数据库：

| 方案 | 难度 | 成本 | 推荐度 |
|------|------|------|--------|
| Vercel Postgres | 中 | 免费5GB | ⭐⭐⭐⭐⭐ |
| Supabase | 中 | 免费额度 | ⭐⭐⭐⭐ |
| PlanetScale | 低 | 免费5GB | ⭐⭐⭐⭐ |

---

## 方式一：通过 Vercel 网站部署（推荐）

### 第一步：注册 Vercel 账号

1. 访问 https://vercel.com/
2. 点击 **Sign Up**
3. 使用 GitHub、GitLab 或 Bitbucket 账号登录（推荐使用 GitHub）

### 第二步：准备代码仓库

**选项 A：使用 GitHub（推荐）**

1. 将项目上传到 GitHub：
   ```bash
   # 在项目目录初始化 git
   git init

   # 添加所有文件
   git add .

   # 提交
   git commit -m "Initial commit"

   # 在 GitHub 创建新仓库后，推送代码
   git remote add origin https://github.com/你的用户名/仓库名.git
   git branch -M main
   git push -u origin main
   ```

2. 确保 `.gitignore` 文件包含：
   ```
   node_modules/
   database/*.db
   database/*.db-shm
   database/*.db-wal
   .DS_Store
   .env
   .env.local
   ```

**选项 B：不使用 GitHub**

可以直接从本地上传（功能受限，不推荐）

### 第三步：在 Vercel 导入项目

1. 登录 Vercel 后，点击 **Add New Project**
2. 选择 **Import Git Repository**
3. 找到你的砸金蛋项目仓库
4. 点击 **Import**

### 第四步：配置项目

**Project Settings:**

| 配置项 | 值 |
|--------|-----|
| **Project Name** | egg-smash-game（或自定义） |
| **Framework Preset** | Other |
| **Root Directory** | ./ |
| **Build Command** | 留空或 `npm run vercel-build` |
| **Output Directory** | 留空 |
| **Install Command** | `npm install` |

**Environment Variables (可选):**

如需自定义，可添加：
```
NODE_ENV=production
```

### 第五步：部署

1. 点击 **Deploy** 按钮
2. 等待部署完成（约 1-2 分钟）
3. 部署成功后会获得一个 `.vercel.app` 域名
   - 例如：`https://egg-smash-game.vercel.app`

### 第六步：配置自定义域名（可选）

1. 在项目页面进入 **Settings** → **Domains**
2. 添加自定义域名
3. 根据提示配置 DNS 记录

---

## 方式二：通过 Vercel CLI 部署

### 第一步：安装 Vercel CLI

```bash
npm install -g vercel
```

### 第二步：登录 Vercel

```bash
vercel login
```

按照提示选择登录方式（GitHub、GitLab 或 Bitbucket）

### 第三步：部署项目

在项目目录执行：

```bash
cd E:\项目\砸金蛋
vercel
```

**部署过程中的交互提示：**

```
? Set up and deploy "~/E:\项目\砸金蛋"? [Y/n] y
? Which scope do you want to deploy to? Your Name
? Link to existing project? [y/N] n
? What's your project's name? egg-smash-game
? In which directory is your code located? ./
? Want to override the settings? [y/N] n
```

### 第四步：确认部署

部署完成后会显示：

```
✅ Production: https://egg-smash-game.vercel.app [1m]
```

### 后续更新部署

代码更新后，只需执行：

```bash
vercel --prod
```

---

## 部署后配置

### 1. 访问应用

- 主页: `https://你的域名.vercel.app`
- 管理后台: `https://你的域名.vercel.app/admin.html`

默认密码：`admin123`

### 2. 配置奖品

**重要提示：** 由于 Vercel 的限制，每次重新部署后数据会丢失。

**临时方案：**
1. 访问管理后台
2. 添加奖品和库存
3. 在活动期间保持应用运行
4. 避免重新部署

**永久方案：使用外部数据库**

见下方"数据持久化方案"

### 3. 配置图片

由于 Vercel 不支持文件上传，需要：

**方法 1：使用图床服务**

推荐图床：
- imgbb.com（免费）
- imgur.com
- Cloudinary（免费额度）
- 阿里云 OSS

**方法 2：使用 GitHub 仓库存储图片**

1. 在 GitHub 仓库创建 `public/images/` 目录
2. 上传图片文件
3. 使用 GitHub Pages 或 jsDelivr CDN 访问：
   - 原始链接：`https://raw.githubusercontent.com/用户名/仓库名/main/public/images/egg.png`
   - CDN 链接：`https://cdn.jsdelivr.net/gh/用户名/仓库名@main/public/images/egg.png`

### 4. 配置音效

同样使用外部 URL：
- 使用音频托管服务
- 或使用 GitHub 仓库存储音频文件

---

## 重要注意事项

### ⚠️ 数据持久化问题

**Vercel Serverless Functions 的限制：**

- 每次部署都会重新创建容器
- 数据库存储在 `/tmp` 目录
- **数据会在每次部署后丢失**

**解决方案：**

#### 方案 1：使用 Vercel Postgres（推荐）

1. 在 Vercel 项目中进入 **Storage** → **Create Database**
2. 选择 **Postgres** → **Continue**
3. 创建数据库

**需要修改代码：**

安装 Prisma：
```bash
npm install prisma @prisma/client
npx prisma init
```

修改 `prisma/schema.prisma`：
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Prize {
  id          Int      @id @default(autoincrement())
  name        String
  image       String?
  stock       Int      @default(0)
  probability Float    @default(1)
  created_at  DateTime @default(now())
}

model Config {
  key   String @id
  value String
}

model Record {
  id         Int      @id @default(autoincrement())
  prize_id   Int?
  prize_name String
  created_at DateTime @default(now())
}

model SoundEffect {
  id         Int      @id @default(autoincrement())
  type       String
  name       String
  url        String
  is_active  Int      @default(0)
  created_at DateTime @default(now())
}
```

在 `.env` 添加：
```
DATABASE_URL=postgresql://user:password@host/dbname
```

#### 方案 2：使用 Supabase

1. 访问 https://supabase.com/
2. 创建项目
3. 获取数据库连接字符串
4. 同样使用 Prisma 连接

### ⚠️ 文件上传限制

Vercel 不支持本地文件上传，需要：

1. **使用 Cloudinary：**
   ```bash
   npm install cloudinary
   ```

2. **或使用 Vercel Blob Storage：**
   ```bash
   npm install @vercel/blob
   ```

### ⚠️ 免费额度限制

| 限制项 | 免费额度 |
|--------|----------|
| 每月请求数 | 100,000 |
| 每月带宽 | 100 GB |
| 函数执行时间 | 10 秒/请求 |
| 构建时间 | 6,000 分钟/月 |

对于小型活动完全够用。

---

## 常见问题

### Q1: 部署后访问 404？

检查：
1. 部署是否成功完成
2. 查看部署日志
3. 确认 `vercel.json` 配置正确

### Q2: API 请求失败？

1. 检查 `api/` 目录是否存在
2. 查看函数日志
3. 确认依赖已安装

### Q3: 数据丢失？

这是 Vercel 的正常限制：
- 每次部署会重置数据
- 解决方案：使用外部数据库

### Q4: 图片/音频无法加载？

确保：
- 使用完整的 URL（不是相对路径）
- 文件托管在外部服务
- URL 可公开访问

### Q5: 如何更新代码？

**使用 GitHub：**
1. 推送代码到 GitHub
2. Vercel 会自动部署

**使用 CLI：**
```bash
vercel --prod
```

### Q6: 如何查看日志？

在 Vercel 控制台：
1. 进入项目
2. 点击 **Deployments**
3. 选择部署 → **View Logs**

---

## 管理命令

```bash
# 本地开发（模拟 Vercel 环境）
vercel dev

# 部署到预览环境
vercel

# 部署到生产环境
vercel --prod

# 查看部署列表
vercel ls

# 查看项目信息
vercel inspect

# 查看日志
vercel logs

# 删除部署
vercel rm [deployment-url]
```

---

## 推荐工作流

### 活动前准备

1. **使用外部数据库**（Vercel Postgres 或 Supabase）
2. **上传图片到图床**（Cloudinary、imgbb 等）
3. **提前配置好所有奖品**

### 活动期间

1. **避免重新部署** - 会导致数据丢失
2. **监控访问量** - 确保在免费额度内
3. **备用方案** - 准备本地版本以防万一

### 活动结束后

1. **导出数据** - 从数据库导出中奖记录
2. **可以删除项目** - 如果不再需要

---

## 需要帮助？

- Vercel 文档：https://vercel.com/docs
- Vercel 社区：https://github.com/vercel/vercel/discussions
- 本项目支持：查看 README.md

---

**祝活动顺利！** 🎉

如有问题，请检查：
1. Vercel 部署日志
2. 浏览器控制台错误
3. API 响应状态
