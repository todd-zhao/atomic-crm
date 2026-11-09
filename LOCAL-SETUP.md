# Atomic CRM - local deployment on this Windows machine

Deployed on 2026-10-31 from `marmelab/atomic-crm` @ `v1.6.0` (HEAD `489537c3`).
Repo: `D:\coding\Atomic CRM` (clean working tree; this folder `.debug/` is git-ignored).

## Running services

| Service | URL | Notes |
| --- | --- | --- |
| CRM app (Vite dev server) | http://localhost:5173/ | English UI, dark/light theme |
| Supabase API (REST/GraphQL/Auth/Storage/Edge Functions) | http://127.0.0.1:54321 | `.env.development` already points here |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | |
| Supabase Studio | http://localhost:54323/ | table editor / SQL / logs |
| Mailpit (was Inbucket) | http://localhost:54324/ | catches auth/invite/password-reset emails |
| Edge functions | http://127.0.0.1:54321/functions/v1/ | auto-served by `supabase start`: users, update_password, merge_contacts, postmark, delete_note_attachments, mcp |

## Login

- First admin user created through the setup screen: **admin@example.com** / **password123**
  (change it in Settings → Profile if this instance will be shared)

## Data

Hotel-industry Sandler demo dataset (all rows are demo data, delete anytime):

- 8 hotels: 远山酒店集团 + 7 hotels (KARE 客户类别, 关联公司, 酒店类型/房间数/开业年份/服务内容/平均房价) — the **酒店名录** (`/companies`)
- 4 channels: 携程旅行网 / 中青旅控股 / 会唐网 / 环球企业协议服务 (渠道类型 OTA/旅行社/会务代理/企业协议) — the **渠道名录** (`/channels`)
- 14 contacts with Chinese names, 态度 (排斥/冷淡/中立/友好/支持), DISC 沟通风格, 在职年限, 社会组织, 工作履历/毕业院校, 微信号 (12 hotel contacts + 2 channel contacts); contacts are linked by **层层引荐关系** (引荐人) that you can explore in the **引荐树** page
- 3 competitors (石基信息 / 德比软件 / 绿云科技)
- 9 deals across all 4 board statuses and 6 Sandler stages, with stakeholders (角色/态度/影响力/个人痛), 痛点, 关键节点, 会议记录; some deals are **channel-sourced** (来源渠道) and **2 unassigned deals sit in the 线索公海** (`/deals/pool`) — the board only shows assigned deals
- 4 contact notes, 3 deal notes, 5 tasks, 3 tags

The dataset is in `test-data/hotel-demo.sql`. After `supabase db reset --local`, create the first admin through the app (or the auth admin API) and apply it with:

```powershell
docker exec -i supabase_db_atomic-crm-demo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < test-data/hotel-demo.sql
```

## Start / stop (one-click)

`make` is not installed on this Windows machine, so use the one-click launchers in the repo root:

| Action | Double-click | Or run from a terminal |
| --- | --- | --- |
| Start everything (Docker Desktop -> local Supabase -> Vite, opens browser) | `start-atomic-crm.cmd` | `powershell -ExecutionPolicy Bypass -File .\start-atomic-crm.ps1` |
| Stop everything (Vite + Supabase containers, keeps data) | `stop-atomic-crm.cmd` | `powershell -ExecutionPolicy Bypass -File .\stop-atomic-crm.ps1` |
| Repair Windows-reserved Supabase port 54321 (if startup fails) | `fix-supabase-port.cmd` (asks for admin) | `powershell -ExecutionPolicy Bypass -File .\fix-supabase-port.ps1` |

What the start script does (idempotent - already-running services are detected and skipped):

1. Checks Node.js / npm / `.env.development`, runs `npm install` on first use if `node_modules` is missing.
2. Starts Docker Desktop if the engine is down and waits up to 10 minutes for it.
3. Installs the Supabase CLI globally if it is missing, then runs `supabase start` (first run pulls ~7 GB of images).
4. Verifies the REST API and whether the DB is initialized, then starts Vite in its own window titled **Atomic CRM - Vite dev server** and opens the browser.
5. Writes a full log per run to `.debug\logs\start-YYYYMMDD-HHmmss.log` (stop logs too).

Useful parameters:

```powershell
.\start-atomic-crm.ps1 -NoBrowser      # do not open the browser
.\start-atomic-crm.ps1 -BackendOnly    # Supabase only, no Vite
.\start-atomic-crm.ps1 -ForceRestart   # start another Vite window even if 5173 is already in use
.\start-atomic-crm.ps1 -NoPause        # do not wait for a key press at the end (scripting)
.\stop-atomic-crm.ps1  -QuitDocker     # also quit Docker Desktop
.\stop-atomic-crm.ps1  -RemoveVolumes  # DESTRUCTIVE: delete the local database volumes as well
```

Note: both `.ps1` files are UTF-8 **with BOM** on purpose - Windows PowerShell 5.1 needs the BOM to read the Chinese messages correctly. If you edit them, save with BOM (or use `pwsh`).

Manual equivalent commands, from `D:\coding\Atomic CRM`:

```powershell
npm run dev          # frontend, http://localhost:5173
supabase start       # backend stack (requires Docker Desktop)
supabase stop        # stop backend (data is kept in Docker volumes)
supabase status      # print URLs + keys
supabase db reset    # DESTRUCTIVE: re-apply migrations + seed (wipes app data & users)
```

Demo mode without any backend (FakeRest, mocked data, resets on reload):
`npm run dev:demo` -> http://localhost:5174/

## Useful commands

```powershell
npm run typecheck                                # tsc, clean
npx vitest --config vitest.config.ts --project app        # 287 app tests (real Chromium)
npx vitest --config vitest.config.ts --project functions  # 192 edge-function tests
npm run build                                    # production build (tsc + vite build)
```

## What was installed / changed on the machine

1. `npm install` in the repo (1035 packages). `package-lock.json` was left untouched (lockfile churn reverted).
2. Supabase CLI **2.122.0** installed globally: `npm install -g supabase`
   (`C:\Users\赵涛\AppData\Roaming\npm\supabase.cmd`; `npm` global bin must be on PATH).
3. Docker Desktop engine started (WSL2 backend). Local Supabase pulls 10 images, ~6.9 GB.
4. Playwright browsers for `@playwright/test` 1.60 (`chromium-1248`, `chromium_headless_shell-1248`):
   `npx playwright install chromium chromium-headless-shell`.
5. No tracked repo file was modified. `.debug/` (git-ignored) holds the verification scripts and screenshots.

## Debug notes / gotchas found during deployment

1. **No `make` on Windows** - use the raw npm/npx/supabase commands above.
2. **Docker must be running** before `supabase start`; the first start downloads ~6.9 GB of images and can take a long time on a slow link to `public.ecr.aws`.
3. **Env is already correct**: `.env.development`'s `VITE_SB_PUBLISHABLE_KEY` matches the key the local stack generates (`supabase/signing_keys.json`), so nothing needs editing.
4. **Playwright browser version mismatch**: the repo pins Playwright 1.60 (browser build 1248); if only older browsers are cached, `npm run test:unit:app` / e2e fail with "Executable doesn't exist ... chromium_headless_shell-1248". Run `npx playwright install chromium chromium-headless-shell`.
5. **`npm run test:unit:app` also runs the `claude` project** (agent-harness hook tests under `.claude/`). Those 23 files fail on Windows because they assert POSIX executable bits / shebang behavior. Use `--project app` and `--project functions` to get the meaningful suites: app 287 passed / 1 skipped, functions 192 passed.
6. **Contact save does a synchronous gravatar HTTP lookup** (`20_contact_saved` trigger -> `get_avatar_for_email` -> `extensions.http_get('https://www.gravatar.com/...')`). Consequences:
   - Creating one contact from the UI takes ~1-2 s (network dependent).
   - Bulk-inserting contacts in a single SQL/REST statement can exceed the PostgREST 8 s statement timeout (`canceling statement due to statement timeout`). Insert contacts one row at a time when seeding.
   - When gravatar is unreachable/hangs, the trigger's exception handler stores `{"src":"ERROR"}` as the avatar; in this network 6 of 8 seeded contacts hit that path and were repaired to favicon URLs afterwards. If avatars look broken after creating contacts, that trigger is the cause.
7. **Deals page dev-mode React warning** (intermittent, benign): `Cannot update a component (FilterLiveForm) while rendering a different component (AutocompleteInput)` - upstream v1.6.0 issue, only in the account-manager filter; the page works.
8. **Deal creation dialog** uses Base UI comboboxes for Company/Contacts (canvas-heavy portal). It is easy to misclick in automation; if you script it, scope locators to `getByRole("dialog")` and pick the company input by position (`input[placeholder="Search"]`.boundingBox().y`) - the first one in DOM order is *Contacts*, the second is *Company*. The "Expected closing date *" is a native date input (`input[type="date"]`).
9. **Desktop has no `/tasks` route page** (`<Resource name="tasks" />` has no list component on desktop). Tasks are shown on the Dashboard and on contact pages; `/#/tasks` is intentionally blank on desktop (mobile has a Tasks page).
10. **User deletion is unsupported by design** (`sales.user_id -> auth.users` FK without cascade; the app says "use account disabling instead"). Deleting a user directly requires deleting their `public.sales` row first.
11. **Chinese locale number formatting**: with a zh-CN browser locale, amounts render as `$4.50万` etc. (Intl.NumberFormat follows the browser locale). Set the browser/OS locale to en-US if the English UI should show `$45,000`.
12. External avatar/logo images point at `https://favicon.show/<domain>` and `https://www.gravatar.com/...`; if those hosts are slow or blocked locally, initials fallback is shown instead (app still works).
13. **启动失败：Supabase API 端口 54321 无响应（Windows 保留端口）** - 重启后 Hyper-V/NAT（winnat）有时会把 54321 划进 Windows 保留端口段（`netsh interface ipv4 show excludedportrange protocol=tcp` 可看到类似 `54222 54321` 的范围），Docker 报 `ports are not available ... bind: An attempt was made to access a socket in a way forbidden by its access permissions`，一键启动会停在 `[4/6]` 并提示 “Supabase API 端口 54321 无响应”。修复：右键**以管理员身份运行** `fix-supabase-port.cmd`（内部依次执行 `net stop winnat` → `supabase stop/start` → `net start winnat`，不会丢数据），完成后重新双击 `start-atomic-crm.cmd`；或者直接重启电脑。`start-atomic-crm.ps1` 在管理员权限下检测到该情况会自动执行同样的修复。
