# 沙游心语 × 知乎

一个将沙盘游戏、知乎内容探索与 AI 互动叙事结合起来的 Web Demo。

玩家从随机沙具出发，通过阅读和回应知乎内容获得灵感值、解锁更多沙具，在沙盘中自由布置，并生成温和、非诊断式的 AI 沙盘报告。完成的作品可以发布到游戏内社区展示和互动。

> 本项目参加知乎黑客松「跨次元游乐场：游戏与互动叙事」赛道。

## 核心玩法

```text
随机发现沙具 → 探索知乎内容 → 获得灵感值 → 解锁沙具
→ 自由布置沙盘 → 生成 AI 报告 → 发布到游戏社区
```

### 随机沙具

首页随机展示人物、建筑、交通工具、自然元素、象征物和幻想生物等沙具。玩家可以从感兴趣的沙具进入对应主题。

### 知乎探索与解锁

游戏可以读取知乎搜索、热榜和用户内容。用户阅读后可以记录感受并获得灵感值，也可以前往知乎完成真实创作，再把内容链接带回游戏进行归属验证。

知乎站内的赞同、评论和发布必须由用户本人完成。本项目不会模拟或绕过知乎未开放的写入接口。

### 沙盘与 AI 报告

已解锁的沙具会进入沙具库，可以放入沙盘、移动和删除。游戏根据沙具类型、数量、位置、密度和整体结构生成氛围描述、关系观察、象征性解读和开放问题。

报告不构成心理诊断，也不能替代专业心理咨询或医疗建议。

### 游戏内社区

玩家可以发布沙盘和报告摘要，并进行点赞、收藏、评论和分享。目前社区数据只保存在当前浏览器，属于 Demo 功能，不是正式的多人在线社区。

## 当前功能

- 随机沙具、分类探索、灵感值和解锁
- 知乎搜索、热榜和离线示例内容
- Windows/macOS 自动发现并调用本地 `zhihu-cli`
- 知乎 OAuth 登录，包含一次性 `state` 校验和安全 Session Cookie
- 登录用户中心：资料、创作和关注列表，支持“加载更多”分页
- 用户创作链接归属验证；需要可用数据源和用户身份
- 沙具库与拖拽式沙盘
- 本地规则报告与知乎 AI 报告接口
- 游戏内本地社区和浏览器自动保存
- API 不可用时的降级处理

## 技术结构

```text
浏览器（页面、交互、localStorage）
             ↓ /api/*
Node.js + Express（内容代理、OAuth、验证、AI 报告）
             ↓
知乎开放平台 / 本地示例数据
```

## 文件结构

```text
2026_zhihu_heikesong/
├─ public/
│  ├─ index.html       页面结构
│  ├─ style.css        页面和沙盘样式
│  ├─ app.js           前端游戏主流程
│  └─ js/
│     ├─ api.js         浏览器端 API 请求封装
│     └─ user-center.js 用户资料、创作与关注分页
├─ server/
│  ├─ index.js         Express 服务、路由、OAuth 和验证
│  ├─ zhihu.js         知乎开放平台 API 客户端
│  ├─ cli-source.js    跨平台本地 zhihu-cli 数据源
│  └─ oauth-state.js   OAuth state 生成与一次性校验
├─ docs/               后续开发计划和服务器部署指南
├─ Dockerfile          容器化部署入口
├─ render.yaml         Render Blueprint 配置
├─ .dockerignore       Docker 构建忽略规则
├─ .env.example        环境变量模板
├─ .gitignore          Git 忽略规则
├─ package.json        项目命令和直接依赖
├─ package-lock.json   精确依赖版本
└─ README.md           项目说明
```

`node_modules/` 由 npm 自动生成，不提交到 GitHub。

## 环境要求

- Node.js 20 或更高版本，推荐当前 LTS
- npm
- Chrome、Edge 或其他现代浏览器

检查环境：

```powershell
node --version
npm --version
```

Windows 安装 Node.js LTS：

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

安装后需要关闭并重新打开 PowerShell，让 PATH 生效。

## 获取与运行

### 1. 获取代码

```powershell
git clone https://github.com/NightMarks/2026_zhihu_heikesong.git
cd 2026_zhihu_heikesong
```

如果代码已经在电脑上，只需要进入自己的项目目录，不要求使用固定盘符：

```powershell
cd E:\2026_zhihu_heikesong
```

### 2. 安装依赖

```powershell
npm ci
```

首次安装通常需要联网下载依赖。如果正在新增或升级依赖，则使用 `npm install`。

### 3. 启动

```powershell
npm start
```

看到下面的信息表示启动成功：

```text
沙游心语 → http://127.0.0.1:3000
```

浏览器打开 <http://127.0.0.1:3000>。停止服务时，在 PowerShell 中按 `Ctrl+C`。

开发模式使用 `npm run dev`。服务端文件变化后会自动重启，修改前端文件后刷新浏览器即可。

## 运行模式

| 模式 | 需要配置 | 可以使用 | 暂不可用 |
|---|---|---|---|
| 无知乎凭证 | 无 | 沙具、解锁、沙盘、本地报告、本地社区、示例内容 | 实时内容、真实登录、归属验证 |
| 内容 API | `ZHIHU_ACCESS_SECRET` | 上述功能、搜索、热榜、AI 报告 | OAuth 登录和登录用户归属验证 |
| 完整在线 | Access Secret、App ID、App Key、公网 HTTPS 回调 | 内容 API、OAuth、用户内容、归属验证 | 平台未开放的代点赞、代评论、代发布 |
| 本地 CLI 数据源 | 已授权 CLI | Windows/macOS 上的搜索、热榜、本人创作、关注与校验 | OAuth 仍需要 App ID、App Key 和公网 HTTPS 回调 |

这里的“无知乎凭证”表示不连接知乎 API，不代表首次安装可以完全断网；`npm ci` 仍可能需要网络。

### 检查当前模式

启动后访问 <http://127.0.0.1:3000/api/capabilities>。

- `sourceType: "none"`：使用示例内容。
- `sourceType: "api"`：使用 Access Secret 直连内容 API。
- `sourceType: "cli"`：使用本地 CLI。
- `oauthReady: false`：当前环境不能完成 OAuth 登录。
- `loggedIn: true`：当前浏览器已经登录。

## 配置知乎开放平台

复制模板：

```powershell
Copy-Item .env.example .env
```

编辑本地 `.env`：

```dotenv
ZHIHU_ACCESS_SECRET=
ZHIHU_APP_ID=
ZHIHU_APP_KEY=
ZHIHU_REDIRECT_URI=https://your-domain.example/auth/callback
PORT=3000
```

| 配置 | 用途 |
|---|---|
| `ZHIHU_ACCESS_SECRET` | 搜索、热榜和 AI 报告等内容 API |
| `ZHIHU_APP_ID` | 知乎 OAuth 应用标识 |
| `ZHIHU_APP_KEY` | OAuth 服务端秘钥 |
| `ZHIHU_REDIRECT_URI` | OAuth 完成后的公网 HTTPS 回调 |
| `PORT` | 服务端口，默认 3000 |

真实秘钥只能放在 `.env` 或部署平台的 Secret 中，不得写入 `public/`、README、截图或提交记录。`.env` 已被 `.gitignore` 忽略。

### OAuth 说明

真实 OAuth 登录需要先将站点部署到公网 HTTPS，并在知乎开放平台登记完全一致的回调地址。`http://127.0.0.1:3000/auth/callback` 只是服务端本地默认值，当前代码会判定它不能用于真实 OAuth。

## 服务器部署

项目支持 Docker 部署。使用自有域名最稳定；比赛 Demo 也可以为公网 IP 申请短期 HTTPS 证书，或者使用免费固定隧道地址。

针对当前 TencentOS Server 4 和公网 IP 的完整步骤见 [腾讯云无域名部署指南](docs/DEPLOYMENT.md)。部署完成后重点检查：

- `GET /healthz` 返回 `{"ok":true}`；
- `GET /api/capabilities` 中 `sourceType` 为 `api`；
- 知乎后台登记的 OAuth 回调与线上 `/auth/callback` 完全一致。

### zhihu-cli 说明

服务端通过 `process.platform` 选择运行方式：Windows 直接执行 `zhihu-cli.exe`；macOS/Linux 直接执行二进制，只有显式配置的 `.sh` 包装脚本才经 `bash`。查找顺序为：

1. `ZHIHU_CLI_PATH` 或兼容变量 `ZHIHU_CLI`；
2. Windows 的 `%LOCALAPPDATA%\ZhihuCLI\current\zhihu-cli.exe`；
3. 当前系统 `PATH`；
4. macOS/Linux 常见安装目录。

代码中不包含任何开发者电脑的绝对路径。

## 服务端接口

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/healthz` | 部署平台健康检查 |
| GET | `/api/capabilities` | 查询数据源、OAuth 和登录状态 |
| GET | `/api/search` | 搜索知乎内容 |
| GET | `/api/hot` | 获取知乎热榜 |
| GET | `/api/me/contents` | 获取当前用户创作内容 |
| GET | `/api/me/followees` | 分页获取当前用户关注的人 |
| POST | `/api/verify-contribution` | 验证内容归属并发放奖励 |
| POST | `/api/report` | 生成沙盘报告 |
| GET | `/auth/login` | 开始知乎 OAuth 登录 |
| GET | `/auth/callback` | 接收 OAuth 回调 |
| POST | `/auth/logout` | 退出登录 |

## 数据保存与当前限制

- 沙盘、灵感值、解锁记录和社区帖子保存在浏览器 `localStorage`。
- 登录 Session 和已领取记录保存在 Node.js 服务器内存。
- 清除浏览器数据会丢失本地作品，重启服务会清除登录状态。
- OAuth 需要公网 HTTPS；本地 `127.0.0.1` 只能验证配置与页面状态，不能完成知乎回调。
- 社区暂时不是跨设备、多人共享社区。
- 前端游戏主流程仍在 `public/app.js`，API 与用户中心已经拆成独立模块。
- 发布前仍应依据最新官方文档复核开放平台接口和模型名。

运行自动测试：

```powershell
npm test
```

## 常见问题

### `node` 或 `npm` 无法识别

确认 Node.js 已安装，然后关闭并重新打开 PowerShell。

### 端口 3000 被占用

在 `.env` 中设置 `PORT=3001`，然后访问 `http://127.0.0.1:3001`。

### 页面显示“离线示例”

这是无知乎凭证模式的正常行为，不代表启动失败。访问 `/api/capabilities` 可以确认数据源。

### 是否上传 `node_modules`

不上传。其他开发者运行 `npm ci` 即可重新生成。

## 后续开发

完整计划见 [后续开发实施计划](docs/superpowers/plans/2026-09-13-hackathon-development-roadmap.md)。优先顺序：

1. 建立自动测试基线。
2. 修复 Windows 知乎数据源。
3. 加固 OAuth `state` 和 Session。
4. 稳定知乎 API 与 AI 报告。
5. 拆分前端并增强沙盘操作。
6. 实现作品和社区持久化。
7. 完成 HTTPS 部署和演示彩排。

## 团队协作

```powershell
git pull --rebase origin main
git switch -c feature/功能名称
# 修改并验证功能
git status
git add 修改过的文件
git commit -m "feat: 简短说明"
git push -u origin feature/功能名称
```

提交前确认 `.env`、`node_modules` 和日志没有进入 Git。
