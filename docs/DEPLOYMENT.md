# 腾讯云无域名部署指南

本指南适用于 TencentOS Server 4 和公网 IP `212.129.255.239`。项目以 Docker 运行，Nginx 负责公网入口与 HTTPS。

## 先确认 OAuth 回调

在知乎开放平台尝试保存：

```text
https://212.129.255.239/auth/callback
```

如果平台接受，可直接使用公网 IP 部署完整 OAuth。如果平台拒绝 IP 回调，请使用文末的“免费固定隧道地址”方案。

## 1. 安全组

只开放以下入站端口：

| 端口 | 来源 | 用途 |
|---|---|---|
| TCP 22 | 管理者 IP | SSH |
| TCP 80 | `0.0.0.0/0` | ACME 验证与 HTTP 跳转 |
| TCP 443 | `0.0.0.0/0` | HTTPS |

不要向公网开放 3000 端口。

## 2. 安装 Docker 与 Git

```bash
sudo dnf install -y git moby
sudo systemctl enable --now docker
sudo docker info
```

## 3. 获取项目

```bash
sudo mkdir -p /opt/shayu
sudo chown "$USER":"$USER" /opt/shayu
git clone https://github.com/NightMarks/2026_zhihu_heikesong.git /opt/shayu
cd /opt/shayu
```

## 4. 创建生产环境变量

创建仅存在于服务器的 `/opt/shayu/.env.production`：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
PUBLIC_URL=https://212.129.255.239
ZHIHU_ACCESS_SECRET=填写数据开放平台秘钥
ZHIHU_APP_ID=504
ZHIHU_APP_KEY=填写OAuth秘钥
ZHIHU_REDIRECT_URI=https://212.129.255.239/auth/callback
AI_API_KEY=填写大模型API秘钥
AI_BASE_URL=https://api.openai-next.com/v1
AI_MODEL=gpt-5.6-sol
COMMUNITY_DATA_PATH=/app/data/local-store.json
```

保护该文件：

```bash
chmod 600 /opt/shayu/.env.production
```

创建独立于代码仓库的社区数据目录。容器中的 `node` 用户 UID/GID 为 1000：

```bash
sudo install -d -o 1000 -g 1000 -m 700 /opt/shayu-data
```

## 5. 构建并运行应用

```bash
cd /opt/shayu
sudo docker build -t shayu-zhihu .
sudo docker run -d \
  --name shayu-zhihu \
  --restart unless-stopped \
  --env-file /opt/shayu/.env.production \
  -v /opt/shayu-data:/app/data \
  -p 127.0.0.1:3000:3000 \
  shayu-zhihu
```

检查：

```bash
curl http://127.0.0.1:3000/healthz
sudo docker logs --tail 100 shayu-zhihu
```

## 6. 安装 Nginx 与 Certbot

先安装 Nginx、Python 和虚拟环境支持：

```bash
sudo dnf install -y nginx python3 python3-pip
sudo python3 -m venv /opt/certbot
sudo /opt/certbot/bin/pip install --upgrade certbot
/opt/certbot/bin/certbot --version
```

Certbot 必须为 5.4 或更高版本，才能使用公网 IP 和 webroot 模式。

创建验证目录：

```bash
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
```

复制仓库提供的 HTTP 配置，然后启动 Nginx：

```bash
sudo cp /opt/shayu/deploy/nginx/shayu-http.conf /etc/nginx/conf.d/shayu.conf
sudo nginx -t
sudo systemctl enable --now nginx
```

申请 IP 证书，先使用测试环境：

```bash
sudo /opt/certbot/bin/certbot certonly --staging \
  --preferred-profile shortlived \
  --webroot --webroot-path /var/www/certbot \
  --ip-address 212.129.255.239
```

测试成功后删除 `--staging` 再申请正式证书。证书路径为：

```text
/etc/letsencrypt/live/212.129.255.239/fullchain.pem
/etc/letsencrypt/live/212.129.255.239/privkey.pem
```

复制 HTTPS 配置并启用证书自动续期：

```bash
sudo cp /opt/shayu/deploy/nginx/shayu-https.conf /etc/nginx/conf.d/shayu.conf
sudo nginx -t
sudo systemctl reload nginx

sudo cp /opt/shayu/deploy/systemd/certbot-renew.service /etc/systemd/system/
sudo cp /opt/shayu/deploy/systemd/certbot-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now certbot-renew.timer
systemctl list-timers certbot-renew.timer
```

IP 证书仅约 6 天有效，定时器会每天检查两次，并在续期后重新加载 Nginx。

## 7. 验收

```text
https://212.129.255.239/healthz
https://212.129.255.239/api/capabilities
```

检查：

- `/healthz` 返回 `{"ok":true}`。
- `/api/health` 的 `community` 为 `ready`。
- `sourceType` 为 `api`。
- `oauthReady` 为 `true`。
- `aiReport` 为 `true`，`aiModel` 为 `gpt-5.6-sol`。
- OAuth 登录后显示头像和用户中心。
- 创作、关注列表和加载更多正常。
- 未登录时只能看到登录门禁，不能进入沙盘或生成报告。
- 用户 A 发布公开作品后，用户 B 能看到并进行点赞、收藏和评论。

### OAuth 登录故障判断

- 页面停在知乎“网络环境异常风险”或验证码：请求还未回调本站。让访问者关闭 VPN/代理、允许知乎 Cookie，并先在同一浏览器登录知乎后重试；服务端无法绕过知乎风控。
- 本站显示“授权校验失败”：通常是登录过程中 Cookie 丢失、重复打开旧回调链接，回首页重新开始授权。
- 本站显示“换取 token 失败”：核对 `.env.production` 与知乎开放平台登记的回调地址是否逐字符一致，并查看 `sudo docker logs --tail 100 shayu-zhihu`。

## 知乎拒绝 IP 回调时

可注册一个免费 ngrok 账号。免费方案会分配一个固定的 `*.ngrok-free.app` HTTPS 开发地址，不需要购买域名。将它转发到 `127.0.0.1:3000`，再把以下三处统一成该地址：

- `PUBLIC_URL`
- `ZHIHU_REDIRECT_URI`
- 知乎开放平台 OAuth 回调

Cloudflare Quick Tunnel 也无需账号，但地址会在进程重启后变化，因此不适合作为需要固定回调的评委链接。

## 更新代码

```bash
cd /opt/shayu
git pull --ff-only
sudo docker build -t shayu-zhihu .
sudo docker rm -f shayu-zhihu
sudo docker run -d \
  --name shayu-zhihu \
  --restart unless-stopped \
  --env-file /opt/shayu/.env.production \
  -v /opt/shayu-data:/app/data \
  -p 127.0.0.1:3000:3000 \
  shayu-zhihu
```

社区作品和互动保存在宿主机 `/opt/shayu-data/local-store.json`，重建容器不会丢失。建议定期备份：

```bash
sudo cp /opt/shayu-data/local-store.json "/opt/shayu-data/local-store.$(date +%F-%H%M%S).bak"
```

当前 Session 仍保存在单个 Node 进程内存中，重启容器后用户需要重新登录。比赛单实例演示可以使用，正式发布前应迁移到 Redis 或数据库。
