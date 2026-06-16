# 天理 Harness - Vercel 部署指南

## 首次部署（需要登录）

### 1. 登录 Vercel

```bash
cd /Users/ping/Desktop/TianLi/web
vercel login
```

会打开浏览器，使用 **1425499266@qq.com** 登录。

### 2. 首次部署

```bash
vercel --prod
```

按提示操作：
- Set up and deploy? **Y**
- Which scope? 选择你的账号
- Link to existing project? **N**
- What's your project's name? **tianli-console**
- In which directory is your code located? **./**
- Want to override the settings? **N**

### 3. 后续部署

```bash
# 部署到生产环境
vercel --prod

# 或者部署到预览环境
vercel
```

## 自动化部署（推荐）

### 连接 GitHub

1. 访问 https://vercel.com/new
2. 使用 **1425499266@qq.com** 登录
3. 点击 "Import Git Repository"
4. 选择 **seastaradmin/TianLi**
5. 设置：
   - Framework Preset: **Vite**
   - Root Directory: **web**
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. 点击 "Deploy"

之后每次 push 到 GitHub 都会自动部署！

## 部署后访问

- **星空页面**: `https://tianli-console-xxx.vercel.app/visible.html`
- **管理后台**: `https://tianli-console-xxx.vercel.app/`
- **仪表盘**: `https://tianli-console-xxx.vercel.app/dashboard`

## 自定义域名（可选）

在 Vercel 控制台：
1. Settings → Domains
2. 添加你的域名
3. 按提示配置 DNS

## 环境变量（如需）

如果后端需要环境变量，在 Vercel 控制台：
1. Settings → Environment Variables
2. 添加：
   - `VITE_API_URL` - 后端 API 地址
   - 其他变量...

## 快速命令

```bash
# 查看部署历史
vercel ls

# 查看日志
vercel logs

# 删除部署
vercel rm <deployment-url>
```

## 问题排查

**构建失败？**
```bash
cd web
npm run build
# 本地测试构建
```

**页面 404？**
检查 `vercel.json` 的 rewrites 配置，确保 SPA 路由正确。

**需要帮助？**
运行 `vercel --help` 或访问 https://vercel.com/docs
