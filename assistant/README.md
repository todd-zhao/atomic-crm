# Atomic CRM AI Assistant（内置助手）

基于 [`@earendil-works/pi-durable`](https://github.com/earendil-works/pi/tree/main/packages/durable) 的 CRM 内置 AI 助手：BYOK、持久化对话、读工具 + 写工具人工审批、SSE 流式输出。

- 前端：`src/components/atomic-crm/assistant/`（Ask AI 面板、工具卡片、审批卡片、BYOK 设置）
- 后端：本目录（Node ≥ 22.19 + pi-durable + SQLite）
- 契约：[API.md](./API.md)　部署：[../deploy/README.md](../deploy/README.md)　设计：[../AI-ASSISTANT-DESIGN.md](../AI-ASSISTANT-DESIGN.md)

## 架构

```
React AssistantPanel ──(Supabase JWT / SSE /assistant)──> assistant 服务
                                                            ├─ pi-durable Harness（对话、任务、崩溃恢复，SQLite）
                                                            ├─ 读工具：parameterized SQL，以用户 claims 跑 RLS
                                                            ├─ 写工具：审批闸门（ApprovalDoc）→ 用户点批准 → 重试执行
                                                            └─ pi-ai：OpenAI 兼容端点（BYOK Key 由服务端 AES-256-GCM 解密）
```

关键设计：

- **BYOK**：用户在 Settings → AI Assistant 填 baseUrl / model / apiKey；Key 用 `ASSISTANT_ENCRYPTION_KEY` 加密存 `public.assistant_credentials`（只有 service_role 可读）。
- **身份**：每个请求校验 Supabase 访问令牌（JWKS，ES256；兼容旧项目 HS256），工具用 `set_config('request.jwt.claims')` + `set local role authenticated` 执行，RLS 100% 生效。
- **对话归属**：`public.assistant_threads` 记录 `user_id → durable_conversation_id`，每个用户可有多条会话；面板支持“新对话”和历史会话切换，打开时默认进入最近使用的会话，会话标题取首条用户消息。
- **审批**：写工具计算 `sha256(toolName + canonicalJson(args))`；无有效 grant 时把提案写入对话文档 `app.approval` 并返回 `NOT EXECUTED`（**不落库**）；前端批准后后端写 grant 并提交一次"用户已批准"的后续输入，模型重试同一调用即执行。grant TTL 10 分钟、用后即焚。
- **流式**：`watchEvents()` → SSE（`snapshot` + `events` + `ping`），前端用 fetch + ReadableStream 解析（EventSource 不能带 Authorization）。
- **持久化**：SQLite（`./data/assistant.sqlite`，`ASSISTANT_SQLITE_PATH`）；进程崩溃重启后 `harness.resume()` 继续未完成的任务。

## 本地运行

```powershell
# 1) 本地 Supabase + Vite（仓库根目录；或直接双击 start-atomic-crm.cmd）
npx supabase start
npm run dev

# 2) 助手服务
cd assistant
copy .env.example .env
# 生成主密钥并填入 .env 的 ASSISTANT_ENCRYPTION_KEY：
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npm install
npm start          # http://127.0.0.1:8787/assistant/health
```

Vite 已代理 `/assistant` → `http://127.0.0.1:8787`（可用 `ASSISTANT_DEV_URL` 覆盖），所以前端只需 `VITE_ASSISTANT_URL=/assistant`。

首次使用：登录 CRM → Settings → AI Assistant → 填 baseUrl / model / apiKey → Test → Save。

## 测试

```powershell
# 端到端（不需要真实 API Key，内置 OpenAI 兼容 mock）
node --env-file=.env --import tsx test/mock-openai.mjs 8899 &   # 或单独窗口
node test/e2e.mjs
```

`test/e2e.mjs` 覆盖：BYOK 保存/测试 → 建线程 → 读工具 → SSE 流 → 写工具审批 → 批准后落库 → 拒绝流程。

## 环境变量

见 [.env.example](./.env.example)。生产部署见 [../deploy/README.md](../deploy/README.md)。

## 安全清单

- 模型 Key 只在服务端；`assistant_credentials` 无任何 RLS policy（仅 service_role 可读）。
- 读工具 SQL 全部参数化、只读事务、8s 超时；写工具同样参数化，且必须人工审批。
- 工具不暴露自由 SQL，模型无法扩权。
- API 只允许 `ASSISTANT_CORS_ORIGIN`；health 之外全部要求 Bearer。
- `SUPABASE_DB_URL`、`ASSISTANT_ENCRYPTION_KEY` 属于服务端机密（`chmod 600`），不要提交。
