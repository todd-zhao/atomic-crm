# Assistant API v1 (BYOK)

> 契约文件。前端与后端并行开发时以此为准，任何改动需双方同步。
> 设计背景见 `../AI-ASSISTANT-DESIGN.md`。

## 基础

- Dev base URL：`http://127.0.0.1:8787/assistant`；开发模式下前端通过 Vite 代理 `/assistant` → `http://127.0.0.1:8787`，前端代码统一用相对路径 `/assistant`。
- 生产：同源路径 `/assistant`（Nginx 反代），或 `VITE_ASSISTANT_URL` 覆盖。
- 鉴权：所有请求带 `Authorization: Bearer <supabase access_token>`。服务端用 Supabase JWKS 验签（ES256），取 `sub`。
- 请求/响应均为 JSON（SSE 除外），`Content-Type: application/json`。
- 错误响应统一：`{ "error": { "code": "unauthorized" | "not_configured" | "not_found" | "forbidden" | "busy" | "rate_limited" | "upstream_error" | "bad_request", "message": "human readable" } }`，HTTP 状态与之对应（401/409/404/403/409/429/502/400）。

## 设置（BYOK）

### GET `/assistant/settings`
```json
{
  "configured": true,
  "baseUrl": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "apiKeyHint": "sk-…7f3a",
  "updatedAt": "2026-10-31T12:00:00.000Z"
}
```
未配置时：`{ "configured": false }`。

### DELETE `/assistant/settings`
删除当前用户保存的 provider 配置（encrypted key 一并删除）：`{ "ok": true, "configured": false }`。

### PUT `/assistant/settings`
```json
{ "baseUrl": "https://api.deepseek.com/v1", "model": "deepseek-chat", "apiKey": "sk-..." }
```
- `apiKey` 可省略：省略表示保留已存的 key（只改 baseUrl/model）。
- 服务端用 `ASSISTANT_ENCRYPTION_KEY`（AES-256-GCM）加密后存 Supabase，只返回 hint（末 4 位）。
- 成功：`{ "ok": true, "configured": true, "apiKeyHint": "…7f3a" }`。
- 校验：`baseUrl` 必须是 http(s)、`model` 非空、`apiKey` 首次必填。

### POST `/assistant/settings/test`
```json
{ "ok": true, "latencyMs": 412, "model": "deepseek-chat" }
```
失败：`{ "ok": false, "error": "..." }`（HTTP 200，带 ok:false；或 502 二选一，前端按 ok 判断）。

## 线程

### GET `/assistant/threads`
按最近使用倒序列出当前用户的全部会话（用于历史会话菜单）。
```json
{ "threads": [ { "id": "uuid", "title": "与 Ada 的跟进", "createdAt": "...", "lastMessageAt": "..." } ] }
```

### POST `/assistant/threads`
请求体为空 `{}`：取最近使用的会话，不存在则创建（面板默认入口）。
请求体 `{ "new": true }`：**总是新建一条会话**（“新对话”按钮）。
若用户尚未配置 BYOK（无 `assistant_credentials` 记录），返回 409 `not_configured`。
```json
{ "thread": { "id": "uuid", "title": "New conversation", "createdAt": "...", "lastMessageAt": null } }
```
新会话标题为 `New conversation`；发出第一条用户消息后，服务端把标题更新为消息前 60 个字符，历史菜单用它展示会话。
### GET `/assistant/threads/:id`
```json
{ "thread": {...}, "busy": false, "configured": true, "usage": { "totalTokens": 1234, "totalCost": 0.0021 } }
```

### POST `/assistant/threads/:id/messages`
```json
{ "input": "帮我看看这周要跟进的客户", "context": { "page": "dashboard", "entityId": null } }
```
`context.page`: `dashboard | contacts | contact | companies | company | deals | deal | tasks | settings | other`；`entityId` 为当前记录数字 id（contact/company/deal 时必填）。
返回：`{ "submissionId": "..." }`（立即返回，结果通过 SSE 推送）。
- 未配置 BYOK：409 `not_configured`。
- 已有 run 在跑：默认排队（followUp），不在 HTTP 层报错。

### GET `/assistant/threads/:id/events`（SSE）
- Header：`Accept: text/event-stream`；服务端返回 `text/event-stream`。
- 事件类型：
  - `event: snapshot` → `data:` 一帧 `SnapshotEvent`（pi-durable `watchEvents` 的 snapshot：entries、generation 部分文本、tools、inbox、agent、usage）。
  - `event: events` → `data:` 一批 `AgentEvent[]`（`message_start|message_update|message_end|tool_execution_start|tool_execution_update|tool_execution_end|run_start|run_end|turn_start|turn_end|entry_appended|inbox_update|auto_retry_start|auto_retry_end|deferred_poll|usage_changed|task_failed|...`），字段原样透传 pi-durable 1.4.0。
  - `event: ping` → `data: {"t": 1730000000000}`，约每 15s。
  - `event: end` → `data: {"kind":"stopped|ended|failed"}`。
- 前端断线重连：重新 GET 同一 URL 会再收到完整 `snapshot`，无需补 delta。
- 注意：`message_update.changes` 是"尽力而为"的增量，**最终文本以 `message_end.entry`（或 snapshot.entries 最后一条 assistant）为准**。

### POST `/assistant/threads/:id/abort`
停止当前 run：`{ "ok": true }`。

### POST `/assistant/threads/:id/approvals`
写操作审批（见下）：
```json
{ "hash": "sha256hex", "approve": true }
```
`approve:false` 表示拒绝（会从 pending 移除并通知模型）。
返回：`{ "ok": true, "executed": true }`（批准后会触发一次"用户已批准"的后续输入，实际执行结果通过 SSE 的 tool 事件返回）。

### GET `/assistant/threads/:id/approvals`
```json
{
  "pending": [
    {
      "hash": "sha256hex",
      "toolName": "crm_create_task",
      "args": { "contactId": 9, "type": "follow-up", "text": "下周跟进", "dueDate": "2026-11-05" },
      "summary": "为 Ada Lovelace 创建跟进任务：下周跟进（截止 2026-11-05）",
      "createdAt": "2026-10-31T12:00:00.000Z"
    }
  ]
}
```

### GET `/assistant/threads/:id/entries?before=<entryId>&limit=30`
历史分页：`{ "items": [EntryRecord...], "next": 123 }`（`next` 为空表示没有更早的）。

## 工具（模型可见）

### 读工具（直接执行）
- `crm_search_contacts({ query?, attitude?, tag?, ownerId?, limit? })` → 联系人 + 态度/分类/公司/标签/待办数
- `crm_get_contact({ contactId })` → 联系人档案（分类/态度/DISC/履历/院校）+ 最近笔记 + 未完成任务 + 相关商机（含角色/影响力）
- `crm_search_companies({ query?, sector?, companyKind?, limit? })` → 公司；公司分酒店（hotel）/渠道（channel）两份名录，含 KARE/酒店字段/渠道类型
- `crm_get_company({ companyId })` → 公司（含关联公司/酒店信息）+ 联系人 + 商机
- `crm_list_deals({ status?, stage?, ownerId?, sourceType?, unassigned?, minBudget?, limit? })` → 商机（状态/阶段/类型/来源/销售负责人/预算/成交价/竞争对手）；`unassigned: true` 只看线索公海
- `crm_get_deal({ dealId })` → 商机 + 商机联系人（角色/态度/影响力/个人痛）+ 痛点 + 关键节点 + 会议记录（含商机来源/渠道/销售负责人/是否公海）
- `crm_get_record({ resource, id })` → 任意表的一行完整数据（通用读取，resource 白名单见下）
- `crm_list_competitors({ query?, limit? })` → 竞争对手（品牌影响力/市场价格/优势/弱点）
- `crm_list_tasks({ contactId?, done?, dueBefore?, limit? })`
- `crm_list_activity({ contactId?, since?, limit? })`
- `crm_team_members({})` → 可见的 sales 列表

### 写工具（审批后才执行）
- `crm_create_contact({ name?, firstName?, lastName?, companyId?, title?, email?, phone?, wechatId?, contactType?, attitude? })`
- `crm_create_task({ contactId, type?, text, dueDate? })`
- `crm_add_contact_note({ contactId, text, status? })`
- `crm_create_deal({ name, companyId, budget?, stage?, status?, dealType?, competitorId?, expectedClosingDate?, description? })`
- `crm_update_deal_stage({ dealId, stage })`（Sandler 六阶段：contact/pain/budget/decision/solution/after_sale）
- `crm_update_deal_status({ dealId, status })`（看板状态：potential/active/won/exited）
- `crm_claim_deal({ dealId })` 从线索公海领取（当前用户成为销售负责人）
- `crm_release_deal({ dealId })` 释放回公海（清空销售负责人）
- `crm_create_competitor({ name, brandInfluence?, marketPrice?, advantages?, weaknesses? })`
- `crm_create_record({ resource, data })` / `crm_update_record({ resource, id, data })` / `crm_delete_record({ resource, id })` → 全表通用读写（需审批；resource 白名单：contacts, companies, deals, tasks, contact_notes, deal_notes, competitors, deal_contacts, deal_pains, deal_milestones, deal_meetings；列名白名单见 assistant/src/crm/records.ts）
- `crm_mark_task_done({ taskId })`

### 审批协议（后端实现细节，前端按此渲染）
1. 模型调用写工具 → 工具计算 `hash = sha256(toolName + "\n" + JSON.stringify(args))`。
2. 工具读取对话文档 `app.approval`：
   - 若 `granted` 里有 `hash` 且未过期（TTL 10 分钟）→ **执行**并消耗该 grant，返回成功结果。
   - 否则把 `{hash, toolName, args, summary, createdAt}` 写入 `pending`，返回给模型的文本为：`NOT EXECUTED: awaiting user approval (hash: <hash>). Do not retry; tell the user to approve it in the UI.`
3. 前端从 `/approvals` 或 SSE 工具卡片看到 pending → 显示 Approve/Reject。
4. 批准：`POST /approvals {hash, approve:true}` → 后端写入 grant、移除 pending、提交一条后续输入（"用户已批准操作 <hash>，请继续执行"）→ 模型重试该工具 → 执行成功。
5. 拒绝：`POST /approvals {hash, approve:false}` → 移除 pending，提交"用户拒绝了该操作，不要重试"。

工具结果 `details` 里附带 `{ pendingApproval?: { hash, toolName, args, summary } }`，便于 UI 直接渲染。
注意 pi-durable 的 tool-result entry 把工具输出放在 `entry.model[0]`（`role: "toolResult"`，含 `toolCallId/toolName/content/details/isError`），`entry.data` 只有 `diagnostics`；前端 reducer 已按此解析。

## SSE snapshot 中的 entries 结构（前端渲染用）
pi-durable `EntryRecord`：`{ id, kind, model?, data? }`，`kind` ∈ `pi.user | pi.assistant | pi.tool-result | pi.system | pi.reset | pi.compaction`；assistant 内容在 `model[0].content`（`{type:"text"|"thinking"|"toolCall"}`），tool-result 在 `data`（含 `toolName`、输出、`isError`、`diagnostics`）。
