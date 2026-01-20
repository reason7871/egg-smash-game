/**
 * 本地部署包打包脚本
 *
 * 用途：将项目文件打包成部署包，方便上传到服务器
 *
 * 使用方法：
 *   node prepare-deploy.js
 *
 * 生成文件：砸金蛋-部署包.zip
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 需要打包的文件和目录
const deployFiles = [
  'public/',
  'database/',
  'server.js',
  'package.json',
  'package-lock.json'
];

// 不需要打包的文件和目录
const excludePatterns = [
  'node_modules',
  '.git',
  'database/*.db',
  'database/*.db-shm',
  'database/*.db-wal',
  '.DS_Store',
  '.vscode',
  '*.log',
  '砸金蛋-部署包.zip',
  '部署脚本'
];

console.log('\n' + '='.repeat(50));
log('砸金蛋应用 - 部署包打包工具', 'blue');
console.log('='.repeat(50) + '\n');

// 创建部署脚本目录
const deployDir = path.join(__dirname, '部署脚本');
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

// 1. 生成服务器端部署脚本
log('步骤 1/4: 生成服务器端部署脚本...', 'yellow');
const deployScript = `#!/bin/bash
# 砸金蛋应用 - 服务器端部署脚本
# 用途：在服务器上自动安装和配置应用

set -e

echo "=========================================="
echo "  砸金蛋应用 - 服务器部署"
echo "=========================================="
echo ""

# 颜色定义
RED='\\\\033[0;31m'
GREEN='\\\\033[0;32m'
YELLOW='\\\\033[1;33m'
NC='\\\\033[0m' # No Color

# 步骤1：检查并安装 unzip
echo -e "\${YELLOW}[1/6] 检查系统依赖...\${NC}"
if ! command -v unzip &> /dev/null; then
    echo "安装 unzip..."
    sudo apt update
    sudo apt install -y unzip
fi

# 步骤2：安装 Node.js
echo -e "\${YELLOW}[2/6] 检查 Node.js...\${NC}"
if ! command -v node &> /dev/null; then
    echo "安装 Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo "Node.js 已安装: \$NODE_VERSION"
fi

# 步骤3：安装 PM2
echo -e "\${YELLOW}[3/6] 检查 PM2...\${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    npm install -g pm2
else
    echo "PM2 已安装"
fi

# 步骤4：安装项目依赖
echo -e "\${YELLOW}[4/6] 安装项目依赖...\${NC}"
npm install --production

# 步骤5：安装和配置 Nginx
echo -e "\${YELLOW}[5/6] 配置 Nginx...\${NC}"
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    sudo apt install -y nginx
fi

# 创建 Nginx 配置
sudo tee /etc/nginx/sites-available/lottery > /dev/null << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    # 最大上传大小
    client_max_body_size 5M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件缓存
    location ~* \\\\.(jpg|jpeg|png|gif|ico|css|js|mp3|mp4)$ {
        proxy_pass http://localhost:3000;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_CONF

# 启用配置
sudo ln -sf /etc/nginx/sites-available/lottery /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

echo -e "\${GREEN}Nginx 配置完成\${NC}"

# 步骤6：启动应用
echo -e "\${YELLOW}[6/6] 启动应用...\${NC}"

# 停止旧进程（如果存在）
pm2 stop lottery 2>/dev/null || true
pm2 delete lottery 2>/dev/null || true

# 启动应用
pm2 start server.js --name lottery

# 保存 PM2 配置
pm2 save

# 配置 PM2 开机自启
pm2 startup systemd -hp /root --user root | tail -n 1 | bash || true

echo ""
echo "=========================================="
echo -e "\${GREEN}部署完成！\${NC}"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - 主页: http://服务器IP/"
echo "  - 管理后台: http://服务器IP/admin.html"
echo ""
echo "默认密码: admin123"
echo ""
echo "管理命令："
echo "  - 查看状态: pm2 list"
echo "  - 查看日志: pm2 logs lottery"
echo "  - 重启应用: pm2 restart lottery"
echo ""
`;

fs.writeFileSync(path.join(deployDir, 'deploy.sh'), deployScript);
log('   ✓ 服务器端部署脚本已生成', 'green');

// 2. 生成 HTTPS 配置脚本
log('步骤 2/4: 生成 HTTPS 配置脚本...', 'yellow');
const httpsScript = `#!/bin/bash
# HTTPS 配置脚本
# 使用 Let's Encrypt 免费证书

set -e

YELLOW='\\\\033[1;33m'
GREEN='\\\\033[0;32m'
NC='\\\\033[0m'

echo -e "\${YELLOW}配置 HTTPS 证书...\${NC}"
echo ""
echo "使用前请确保："
echo "  1. 已有域名"
echo "  2. 域名已解析到服务器IP"
echo "  3. 服务器80端口可访问"
echo ""

read -p "请输入您的域名: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo -e "\${YELLOW}未输入域名，跳过配置\${NC}"
    exit 0
fi

echo ""
echo -e "\${YELLOW}域名: \$DOMAIN\${NC}"
echo ""

# 安装 certbot
echo "安装 certbot..."
sudo apt install -y certbot python3-certbot-nginx

# 修改 Nginx 配置中的域名
sudo sed -i "s/server_name _.*/server_name $DOMAIN;/" /etc/nginx/sites-available/lottery

# 重新加载 Nginx
sudo systemctl reload nginx

# 申请证书
echo "申请 SSL 证书..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

echo ""
echo -e "\${GREEN}HTTPS 配置完成！\${NC}"
echo ""
echo "访问地址："
echo "  - https://$DOMAIN/"
echo "  - https://$DOMAIN/admin.html"
echo ""
`;

fs.writeFileSync(path.join(deployDir, 'setup-https.sh'), httpsScript);
log('   ✓ HTTPS 配置脚本已生成', 'green');

// 3. 生成快速更新脚本
log('步骤 3/4: 生成快速更新脚本...', 'yellow');
const updateScript = `#!/bin/bash
# 快速更新脚本
# 用于更新应用代码而不影响数据库

set -e

YELLOW='\\\\033[1;33m'
GREEN='\\\\033[0;32m'
NC='\\\\033[0m'

echo -e "\${YELLOW}更新应用...\${NC}"

# 备份数据库
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR
cp database/lottery.db $BACKUP_DIR/lottery.db.backup.$(date +%Y%m%d_%H%M%S)
echo -e "\${GREEN}数据库已备份\${NC}"

# 停止应用
pm2 stop lottery

# 更新依赖（如果 package.json 有变化）
npm install --production

# 重启应用
pm2 restart lottery

echo -e "\${GREEN}更新完成！\${NC}"
`;

fs.writeFileSync(path.join(deployDir, 'update.sh'), updateScript);
log('   ✓ 快速更新脚本已生成', 'green');

// 4. 创建打包说明
log('步骤 4/4: 创建打包说明...', 'yellow');
const readme = `# 砸金蛋应用 - 部署包说明

本目录包含服务器部署所需的所有脚本。

## 文件说明

- deploy.sh - 主部署脚本，自动完成所有配置
- setup-https.sh - HTTPS 配置脚本（可选）
- update.sh - 快速更新脚本

## 使用方法

### 1. 上传到服务器

将整个项目目录（本目录）上传到服务器的 /root/lottery

### 2. 运行部署脚本

\\\`\\\`\\\`bash
cd /root/lottery
chmod +x 部署脚本/*.sh
./部署脚本/deploy.sh
\\\`\\\`\\\`

### 3. （可选）配置 HTTPS

如果你有域名，运行：

\\\`\\\`\\\`bash
./部署脚本/setup-https.sh
\\\`\\\`\\\`

### 4. 更新应用

当需要更新代码时：

\\\`\\\`\\\`bash
./部署脚本/update.sh
\\\`\\\`\\\`

## 注意事项

- 确保服务器端口 80 和 443 已在安全组中开放
- 首次部署会创建新的数据库
- 数据库文件位置：database/lottery.db

## 管理命令

\\\`\\\`\\\`bash
# 查看应用状态
pm2 list

# 查看日志
pm2 logs lottery

# 重启应用
pm2 restart lottery

# 停止应用
pm2 stop lottery

# 查看 Nginx 状态
sudo systemctl status nginx
\\\`\\\`\\\`

## 默认信息

- 管理后台地址: http://服务器IP/admin.html
- 默认密码: admin123

请及时修改默认密码！
`;

fs.writeFileSync(path.join(deployDir, 'README.md'), readme);
log('   ✓ 打包说明已生成', 'green');

// 5. 打包部署文件
log('\\n开始打包部署文件...', 'yellow');

const deployPackageDir = path.join(__dirname, 'deploy-temp');

// 创建临时目录
if (fs.existsSync(deployPackageDir)) {
  fs.rmSync(deployPackageDir, { recursive: true, force: true });
}
fs.mkdirSync(deployPackageDir, { recursive: true });

// 复制文件到临时目录
function copyDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  // 创建目标目录
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // 跳过 node_modules 和数据库文件
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name.endsWith('.db') ||
      entry.name.endsWith('.db-shm') ||
      entry.name.endsWith('.db-wal')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 复制 public 目录
if (fs.existsSync(path.join(__dirname, 'public'))) {
  copyDirectory(path.join(__dirname, 'public'), path.join(deployPackageDir, 'public'));
  log('   ✓ 已复制 public 目录', 'green');
}

// 复制 database 目录（不含 .db 文件）
const databaseDir = path.join(__dirname, 'database');
if (fs.existsSync(databaseDir)) {
  const destDatabaseDir = path.join(deployPackageDir, 'database');
  fs.mkdirSync(destDatabaseDir, { recursive: true });
  fs.writeFileSync(path.join(destDatabaseDir, '.gitkeep'), '');
  log('   ✓ 已复制 database 目录', 'green');
}

// 复制其他文件
const filesToCopy = ['server.js', 'package.json', 'package-lock.json'];
filesToCopy.forEach(file => {
  const srcPath = path.join(__dirname, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(deployPackageDir, file));
    log(`   ✓ 已复制 ${file}`, 'green');
  }
});

// 复制部署脚本目录
if (fs.existsSync(deployDir)) {
  copyDirectory(deployDir, path.join(deployPackageDir, '部署脚本'));
  log('   ✓ 已复制 部署脚本 目录', 'green');
}

// 6. 创建 ZIP 包
log('\\n创建 ZIP 压缩包...', 'yellow');

const outputZip = path.join(__dirname, '砸金蛋-部署包.zip');

// 删除旧的压缩包
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
}

// 使用系统压缩命令
let compressCommand;
if (process.platform === 'win32') {
  // Windows - 使用 PowerShell
  compressCommand = `Compress-Archive -Path "${deployPackageDir}\\*" -DestinationPath "${outputZip}" -Force`;
  try {
    execSync(`powershell -Command "${compressCommand}"`, { stdio: 'inherit' });
  } catch (e) {
    // 如果 PowerShell 失败，提供手动说明
    log('   ⚠ 自动压缩失败，请手动压缩', 'yellow');
    log(`     请将以下文件夹压缩为 ZIP:`, 'yellow');
    log(`     ${deployPackageDir}`, 'blue');
  }
} else {
  // Linux/Mac - 使用 zip 命令
  try {
    execSync(`cd "${deployPackageDir}/.." && zip -r "${outputZip}" "${path.basename(deployPackageDir)}"`, { stdio: 'inherit' });
  } catch (e) {
    log('   ⚠ 需要安装 zip 工具', 'yellow');
    log('     安装命令: sudo apt install zip 或 brew install zip', 'blue');
  }
}

// 清理临时目录
fs.rmSync(deployPackageDir, { recursive: true, force: true });

log('\\n' + '='.repeat(50), 'green');
log('打包完成！', 'green');
  console.log('='.repeat(50));

log('\\n部署包位置:', 'blue');
log(`  ${outputZip}`, 'yellow');

log('\\n后续步骤:', 'blue');
log('  1. 将 砸金蛋-部署包.zip 上传到服务器 /root/ 目录', 'white');
log('  2. 解压: unzip 砸金蛋-部署包.zip -d lottery', 'white');
log('  3. 运行: cd lottery && chmod +x 部署脚本/deploy.sh && ./部署脚本/deploy.sh', 'white');

log('\\n详细部署指南请查看: 腾讯云部署指南.md\\n', 'blue');
