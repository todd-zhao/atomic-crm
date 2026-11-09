# 云端部署指南（Supabase Cloud + VPS / Docker）

目标拓扑：

```
浏览器 ──HTTPS──> VPS: Nginx（dist 静态站 + /assistant 反代）
                      │
                      └── Docker: assistant 服务（HN + Node 24 + pi-durable SQLite）
                                    │ 直连 Postgres（服务端私密连接串）
                                    └──> Supabase Cloud (Postgres + Auth + Storage + Edge Functions)
```

> 本地开发不需要这套：本地直接 `npm run dev` + `supabase start` + `npm run dev`（assistant 目录）即可。
> 本指南用于把当前集成好的助手部署到你的 VPS。

## 0. 前置条件

- 一台 Linux VPS，已安装 Docker + Docker Compose v2（`docker compose version` 可用）。
- 一个 Supabase Cloud 项目（免费版即可），记下：
  - Project URL（`https://xxx.supabase.co`）
  - Publishable key（`sb_publishable_...`）
  - 数据库密码（创建项目时设置）
  - Supabase Access Token（https://supabase.com/dashboard/account/tokens）
- 仓库中已包含本次改动的迁移：`supabase/migrations/20261031123725_assistant_byok.sql`（两张表 + RLS）。

## 1. 初始化云端 Supabase

在仓库根目录（本机）：

```powershell
supabase login                                     # 或用 $env:SUPABASE_ACCESS_TOKEN
supabase link --project-ref <PROJECT_REF>          # PROJECT_REF 在项目 URL 里
supabase db push                                   # 应用全部迁移（含 AI 助手表）
supabase functions deploy users update_password merge_contacts postmark delete_note_attachments mcp
```

可选：云端已有数据时先用 `supabase db dump` 备份。

## 2. 构建前端（指向云端）

```powershell
# 在仓库根目录执行（PowerShell）
$env:VITE_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
$env:VITE_SB_PUBLISHABLE_KEY="sb_publishable_..."
$env:VITE_ASSISTANT_URL="/assistant"               # 同源反代，生产固定用相对路径
$env:VITE_IS_DEMO="false"
npm run build                                      # 产物在 dist\
```

注意：`.env.development` 是本地配置，不要用于生产构建；上面用环境变量覆盖。

## 3. 上传到 VPS

把 `dist/` 与 `deploy/` 一起传上去（示例）：

```powershell
scp -r dist deploy user@<VPS_IP>:/opt/atomic-crm/
```

服务器上的目录结构：

```
/opt/atomic-crm/
├── dist/                     # 前端产物
└── deploy/
    ├── docker-compose.yml
    ├── nginx.conf
    └── assistant.env         # 由 assistant.env.example 复制并填写（不要提交）
```

## 4. 配置 assistant.env

```bash
cd /opt/atomic-crm/deploy
cp assistant.env.example assistant.env
# 生成主密钥（必须备份！丢失后用户需重新填写 BYOK Key）
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
vi assistant.env
```

需要填写：

| 变量 | 说明 |
| --- | --- |
| `ASSISTANT_CORS_ORIGIN` | CRM 的对外地址，如 `https://crm.example.com` |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_DB_URL` | VPS 无 IPv6 时用 pooler 连接串（见文件内注释） |
| `ASSISTANT_ENCRYPTION_KEY` | 32 字节 base64，用于 AES-256-GCM 加密用户的 BYOK Key |

安全提示：`SUPABASE_DB_URL` / `ASSISTANT_ENCRYPTION_KEY` 只存在于服务端，`chmod 600 assistant.env`。

## 5. 启动

```bash
cd /opt/atomic-crm/deploy
docker compose up -d --build
docker compose ps          # assistant healthy / web running
curl -s http://127.0.0.1/assistant/health
```

访问 `http://<VPS_IP>/`：

1. 首次打开 → 创建第一个管理员账号。
2. 右上角 **Ask AI** 打开助手；若提示未配置 → Settings → **AI Assistant**，填写：
   - Base URL：任意 OpenAI 兼容端点（如 `https://api.deepseek.com/v1`、`https://api.siliconflow.cn/v1`、自建代理、`http://<内网>/v1`）
   - Model：如 `deepseek-chat`、`Qwen/Qwen2.5-72B-Instruct`
   - API Key：用户自己的 Key（加密存库，一次输入多设备可用）
3. 点 **Test** 验证，再开始对话。写操作会弹审批卡片，点 Approve 才落库。

## 6. HTTPS（强烈建议）

最省事：用 Caddy 替换 nginx 承担 TLS，或给 nginx 配 certbot：

```bash
# 例：certbot（把 80 改成 443 后再生成证书）
apt install -y certbot python3-certbot-nginx
certbot --nginx -d crm.example.com
```

若用 Caddy：把 `web` 服务换成 caddy，`Caddyfile`：

```
crm.example.com {
    root * /usr/share/nginx/html
    try_files {path} /index.html
    handle /assistant/* {
        reverse_proxy assistant:8787 {
            flush_interval -1
        }
    }
    file_server
}
```

## 7. 升级

```bash
# 本机：拉代码 → 重新构建 dist → 上传
git pull
$env:VITE_SUPABASE_URL=...; $env:VITE_SB_PUBLISHABLE_KEY=...; $env:VITE_ASSISTANT_URL="/assistant"; npm run build
scp -r dist deploy user@<VPS_IP>:/opt/atomic-crm/

# 服务器：重建镜像并滚动重启
cd /opt/atomic-crm/deploy && docker compose up -d --build
```

数据库迁移：`supabase db push`（本机执行）。

## 8. 备份

- 对话/运行记录：Docker volume `deploy_assistant-data` 内的 `assistant.sqlite`
  （`docker compose exec assistant ls -l /data`；备份用 `docker run --rm -v deploy_assistant-data:/data -v $PWD:/backup alpine tar czf /backup/assistant.tgz /data`）。
- CRM 数据：Supabase 自动备份 + 定期 `supabase db dump`。
- `ASSISTANT_ENCRYPTION_KEY` 单独备份（丢失则用户需重填 Key）。

## 9. 在本地用 Docker 试跑（可选）

Windows/Linux 上让容器访问宿主机的本地 Supabase：

```bash
cd deploy
# assistant.env 里写：
#   SUPABASE_URL=http://host.docker.internal:54321
#   SUPABASE_DB_URL=postgresql://postgres:postgres@host.docker.internal:54322/postgres
# 构建 dist 时 VITE_SUPABASE_URL=http://127.0.0.1:54321，VITE_ASSISTANT_URL=/assistant
docker compose up -d --build
# 浏览器访问 http://localhost/
```

Windows 上也可以直接不用 Docker：用仓库根目录的 `start-atomic-crm.cmd`（已集成助手服务）。

## 10. 故障排查

| 现象 | 排查 |
| --- | --- |
| 助手面板提示 `unreachable` | `docker compose logs assistant`；`curl /assistant/health`；确认 nginx `/assistant/` 反代 |
| 401 unauthorized | 前端登录态过期；确认 `SUPABASE_URL` 与前端一致（JWKS 验签） |
| 409 not_configured | 当前用户还没在 Settings → AI Assistant 填 BYOK |
| 模型报错 | 用 Settings 里的 **Test** 检查 baseURL/model/key；国内端点注意模型名大小写 |
| SSE 不流式 | nginx 必须 `proxy_buffering off`（本仓库 nginx.conf 已配） |
| 密钥无法解密 | `ASSISTANT_ENCRYPTION_KEY` 与写入时不一致，用户需重新保存 Key |
