# Research: backing options for in-app Notifications

Checked: 2026-11-10. Pages were fetched with `curl` and read as text. Each claim cites a primary source (see [Sources](#sources)). Anything not confirmed from a primary source is marked **unverified**.

Recipients in scope: Student, Instructor, Team Admin, and Platform Admin. In Cadence these map to `UserRole` and `TeamMemberRole` in `app/db/schema.ts`. Under every option, Cadence still has to work out who receives each event. The vendors only take a list of user ids (or a topic or list) at trigger time.

> Repo note: `package.json` pins `react-router` / `@react-router/*` **8.3.0**, not 7. Resource routes work the same way. Production runs `react-router-serve` (a long-running Express process) on a local `better-sqlite3` file, so the app runs as a **single instance**.

## TL;DR

- **Hosted notification platforms (Knock, Novu Cloud, Courier, SuprSend, MagicBell)** all include a React inbox with real-time WebSocket updates, read/seen/archive state, and an email/push path. All have a free tier. Knock, Novu, Courier and SuprSend each allow about 10k messages or runs per month. MagicBell allows 1k deliveries.
- **Cheapest step up from free:** Courier is pay-as-you-go at $0.005 per send with no platform fee. Novu Pro starts at $30/mo. SuprSend Essentials is $100/mo (billed annually). Knock Starter is $250/mo. MagicBell Startup is $249/mo.
- **Self-hosted Novu (MIT core)** needs MongoDB, Redis, S3 and API/Worker/WS services, and its own docs recommend 4 vCPU / 8 GB even for a single VM. That is far heavier than this app.
- **Stream Feeds** is a social activity-feed product, priced at $499/mo or more after a 5k-activity free tier. It has no preferences or email orchestration. **Pusher Channels and Ably** are transports only: you keep the notifications table and add their WebSocket fan-out.
- **Building it in-house** fits this app well. The app runs as a single Node process, so an in-process event emitter plus an SSE resource route is enough for real-time. The main traps are the `compression` middleware in `react-router-serve`, which buffers SSE unless the response sets `Cache-Control: no-transform`; proxy idle timeouts, which need ~15 s heartbeats; serverless duration caps; and a future move to multiple instances, which would need pub/sub.
- **Engagespot** could not be verified. Its marketing and pricing site returned "Site not found" or 404, and the last push to its GitHub org was 2025-01-25.

## Comparison table

| Option | Inbox UI: prebuilt / headless | Real-time | Free tier → first paid (unit) | Server trigger / identity | Read/seen/archive; prefs | Email/push later | Testability |
|---|---|---|---|---|---|---|---|
| **Knock** | `@knocklabs/react` feed and popover / hooks (`useNotifications`, `useNotificationStore`) | WebSocket (`new-message` event) | 10k messages/mo free → Starter $250/mo incl. 50k, then $0.005 (unit: message = 1 user × 1 channel) | `@knocklabs/node` `workflows.trigger`; users are identified with your own id | seen/read/archived, unseen and unread counts; preferences on all plans | Yes, unlimited channels | Separate environments with isolated data; Node client accepts an injected `fetch` |
| **Novu Cloud** | `<Inbox/>`, Bell, Notifications, Preferences / `@novu/react` hooks (`useNotifications`, `useCounts`) | WebSocket (`ws` service) | 10k workflow runs/mo, 5 workflows, 2 envs → Pro from $30/mo (30k runs, $1.20 per 1k) (unit: workflow run per subscriber) | `@novu/api` `novu.trigger({workflowId,to})`; `subscriberId` is your user id, created on the fly | read/unread/archive, unseen counts, snooze (Cloud only); Preferences component | Yes (email, SMS, push, chat) | Dev and Prod environments on Free |
| **Novu self-hosted (community)** | Same components (no snooze; branding stays) | WebSocket (`ws` container) | Free software; you pay for MongoDB, Redis, S3 and VMs | Same API, pointed at your own host | Same as Cloud minus snooze | Yes | You run it; only 1 team member; no custom environments |
| **Courier** | `CourierInbox`, toasts, preferences / `useCourier` hook + custom renderers | "Realtime connection" / socket (protocol not named in docs) | 10k sends/mo free → Business $0.005 per send, PAYG (unit: send) | `@trycourier/courier` `send.message`; `user_id` in a backend-minted JWT | read/opened/archived synced across devices; preference center | Yes | Production and Test environments; billing **counts sends from every environment** |
| **SuprSend** | `@suprsend/react` inbox / headless `@suprsend/react-core` (`useFeedData`, `useFeedClient`) | "Feed socket" | 10k notifications/mo (with branding) → Essentials $100/mo annual, 50k, $2 per 1k (unit: notification per user per channel) | `@suprsend/node-sdk`; `distinct_id` | read/seen/archive; **preferences only on Business ($250/mo)** | Yes | Sandbox, Staging and Production workspaces by default |
| **MagicBell** | `@magicbell/react` `Inbox` / `FloatingInbox`; headless via `magicbell-js` user client + `Realtime` | WebSocket | 1,000 deliveries/mo, 1 project → Startup $249/mo, 50k, $0.0025 each (unit: delivery per channel) | `magicbell-js` project client (broadcasts); user is `external_id` or email, upserted | read/seen/archived; per-channel and per-category preferences | Yes (email, push, SMS, Slack…) | Only 1 project on Free, so no separate dev project; **unverified** whether a sandbox exists |
| **Stream Activity Feeds** | React SDK + UI kits; state-layer hooks | WebSocket (`watch: true`) | 5k activities + 125k API calls → Start $499/mo annual ($599 monthly); "Maker" program free for <5 people and <$10k MRR | Node SDK; Stream user tokens | is_seen / is_read, unread and unseen counts; no preference center | Push only; **no email orchestration** | **Unverified** |
| **Pusher Channels** (transport only) | None; you build the UI | WebSocket | Sandbox: 200k msgs/day, 100 concurrent connections → Startup $49/mo (1M/day, 500 connections) | Server publishes; you own identity | None; you build state | Beams is a separate push product (pricing not checked) | Server SDK is easy to mock |
| **Ably** (transport only) | None | WebSocket | 500 MAU → Pro $29/mo per 1k MAU (billed annually) (unit: MAU) | Server publishes; you own identity | None | None for email | Server SDK is easy to mock |
| **Build in-house** | You build the bell, list and preferences | SSE (or polling / WebSocket) from a resource route | $0 | Direct Drizzle insert; existing `users` ids | You build everything | Add a provider (Resend, Postmark, etc.) later | Full control; in-memory SQLite in vitest |
| **Engagespot** | **Unverified** (docs site is a JS-rendered SPA) | **Unverified** | **Unverified**: pricing page unreachable | **Unverified** | **Unverified** | **Unverified** | **Unverified** |

## Per-option notes

### Knock
- **Inbox:** `@knocklabs/react` includes a real-time feed (`NotificationFeed`, `NotificationFeedPopover`, `NotificationIconButton`) themed with CSS variables. The headless option uses `useNotifications` and the client library. In headless mode you must call `markAllAsSeen` yourself. [K2][K3]
- **Real-time:** "a real-time web socket connection" emits `new-message` events, which "might be throttled". [K4]
- **State:** feed metadata carries `unread_count` and `unseen_count`. Items carry `seen_at`, `read_at` and `archived_at`. Archived items are hidden from the feed by default. Feed retention is unlimited on all plans. [K4][K1]
- **Pricing (checked 2026-11-10, https://knock.app/pricing):**
  - Free: $0 with 10,000 messages/mo, unlimited stored profiles, preferences, unlimited environments, and Knock branding.
  - Starter: $250/mo including 50,000 messages, then $0.005 each.
  - A message is one message to one user on one channel. Messages suppressed by preferences are not billed. There is no hard cap; Knock contacts you if you go over. [K1]
- **Server:** `npm install @knocklabs/node`, then `client.workflows.trigger(key, { recipients, data })`. Users are identified by your stable internal id, and properties are deep-merged. [K5][K6]
- **Security:** in production you must turn on "enhanced security mode" and pass a server-signed user token. Without it, anyone holding the public key can act as any user. [K7]
- **Testability:** each environment has isolated users and messages and its own keys. [K8] The Node client accepts a custom `fetch`, which makes it easy to stub in vitest. [K5]

### Novu (Cloud and OSS)
- **Inbox:** the `<Inbox />` component is composed of Bell, Notifications, InboxContent and Preferences, with tabs, localization and snooze. The headless option uses `@novu/react` hooks: `useNotifications` (paginated, real-time) and `useCounts` (unread/unseen counts, real-time), plus `novu.notifications.read/archive`. [N2][N3]
- **Real-time:** a dedicated WebSocket service (`ws`). Self-hosted clients set `socketUrl` to it. [N5]
- **Pricing (checked 2026-11-10, https://novu.co/pricing):**
  - Free: 10k workflow runs/mo, up to 5 workflows, 2 environments, 3 team members, branding. Inbox retention appears to be 30 days, though the pricing table rendered ambiguously as text.
  - Pro: from $30/mo with 30k runs, $1.20 per 1k extra, branding removed.
  - Team: from $250/mo.
  - Billing is per workflow run. One trigger to one subscriber counts as 1 run. A topic with 100 subscribers counts as 100 runs. Subscribers are unlimited, and Novu says it never stops or throttles sends when you go over. [N1]
  - The 5-workflow cap matters if each notification type is its own workflow.
- **Server:** `@novu/api` with `novu.trigger({ workflowId, to: subscriberId, payload })`. Subscribers are created or updated on the fly at trigger time. [N6][N7]
- **Security:** an HMAC `subscriberHash` is required in production. [N9]
- **Environments:** Development and Production are included on Free. Custom environments need the Team plan. [N8]
- **OSS / self-host:**
  - The core is MIT. The `enterprise/` folder is under a commercial license. [N4]
  - It needs MongoDB, Redis (AOF), S3 storage, and API, Worker, WS and Dashboard services. The minimum single-VM spec is 4 vCPU / 8 GB plus Mongo and Redis. [N5]
  - The community edition has 1 team member, no snooze, no branding removal, no custom environments and no MFA. [N10]

### Courier
- **Inbox:** `CourierInbox` (inline or popup), toasts, and a preference center. The `useCourier` hook and render slots support custom UI on the web SDKs. [C2][C3]
- **Real-time:** after sign-in "the inbox opens a realtime connection". Read, opened and archived states sync across devices, and the socket reuses the JWT session. The docs do not name the protocol. Messages persist until they are archived or reach `expiresAt`. [C4]
- **Pricing (checked 2026-11-10, https://www.courier.com/pricing):**
  - Developer: free with 10,000 sends/mo and 7-day log retention.
  - Business: $0.005 per send, pay-as-you-go, with no seat or channel fees.
  - The FAQ answers are hidden behind JS accordions, so whether in-app plus email counts as two sends is **unverified**.
  - Billing counts sends from every environment, including Test. [C1][C5]
- **Server:** `@trycourier/courier` with `client.send.message`. The backend mints a scoped JWT, e.g. `user_id:… inbox:read:messages`. [C6][C7]
- **Testability:** each workspace starts with Production and Test environments, and the Test email provider only delivers to the signup address. There is no separate "test mode". [C5]

### SuprSend
- **Inbox:** a drop-in React inbox, plus headless `@suprsend/react-core` hooks (`useFeedData`, `useFeedClient`). The client tracks a "feed socket" for reachability. Read, seen and archive state are managed for you. [S2][S3][S4]
- **Pricing (checked 2026-11-10, https://www.suprsend.com/pricing):**
  - Free: 10k notifications/mo with an in-app feed carrying SuprSend branding.
  - Essentials: $100/mo billed annually ($1,200/yr), 50k notifications, $2 per 1k extra.
  - Business: $250/mo annual, 50k notifications, $0.005 extra. This is the first plan with channel and category preferences and digests.
  - Each channel and each user counts separately. Opt-outs are not billed. [S1]
- **Server:** `@suprsend/node-sdk`. Users are keyed by `distinct_id`. [S5][S6]
- **Testability:** Sandbox, Staging and Production workspaces are created by default. Sandbox email and SMS only go to verified addresses; inbox is unrestricted. [S7]

### MagicBell
- **Inbox:** `@magicbell/react` with `Inbox`, `FloatingInbox` and toasts, authenticated by a User JWT. No React hooks are documented. Headless use goes through `magicbell-js` (`UserClient` + `Realtime`). [M2][M3]
- **Real-time:** "real-time notification delivery through WebSocket connections" with auto-reconnect. [M3]
- **State and preferences:** read, seen and archived timestamps; per-channel and per-category preferences. [M4][M5]
- **Pricing (checked 2026-11-10, https://www.magicbell.com/pricing):**
  - Builder: $0 with 1,000 deliveries/mo, 1 project, unlimited users.
  - Startup: $249/mo with 50,000 deliveries, $0.0025 extra, 5 projects.
  - Deliveries are counted per channel per user. [M1]
- **Identity:** `external_id` or email, upserted. The User JWT is signed with the project secret. [M6][M7]

### Stream Activity Feeds
- **Inbox and state:** a notification feed group with `track_seen` and `track_read`, `is_seen` / `is_read`, and unread/unseen counts. React SDK; real-time via WebSocket `watch`. [ST2][ST3]
- **Pricing (checked 2026-11-10, https://getstream.io/activity-feeds/pricing/):**
  - Free: 5,000 activities and 125k API calls.
  - Start: $499/mo annual or $599/mo monthly.
  - Maker program: free for teams under 5 people and under $10k monthly revenue, "availability is limited". [ST1]
- **Fit:** no preference center and no email routing. It is built for social feeds, so it is a weak fit for this use case.

### Pusher Channels / Ably (transport only)
- **Pusher Channels:**
  - Sandbox: free, 200k messages/day, 100 concurrent connections.
  - Startup: $49/mo, 1M messages/day, 500 connections.
  - One publish to 50 subscribers counts as 51 messages. [P1]
- **Ably:**
  - Free: 500 MAU.
  - Pro: $29/mo for 1k MAU, billed annually.
  - Business: $349/mo.
  - Delivered over WebSocket edge infrastructure. [A1]
- **What they add:** both only replace the "push to browser" step of the in-house build. They become relevant only if Cadence runs multiple instances or moves to serverless.

### Engagespot
- `engagespot.co/pricing` returned a Framer "Site not found" page, and `engagespot.co` returned 404. The docs site loads, but it is a JS-rendered SPA that `curl` could not read. The GitHub org's most recent push was 2025-01-25. [E1][E2]
- Nothing about features or pricing could be verified. Treat it as possibly inactive.

## Build-in-house baseline

**Data model (Drizzle / SQLite):**
- `notifications`: id, recipient_user_id, type, payload JSON, link, created_at, seen_at, read_at, archived_at. Index on `(recipient_user_id, archived_at, created_at)`.
- Optional `notification_preferences`: user_id, type, channel, enabled.

Recipient resolution for Student, Instructor, Team Admin and Platform Admin is a query over `users.role`, `team_members.role` and enrollments, run at insert time. You need this step for vendors too.

**What you build yourself:**
- Unread and unseen counts: `COUNT(*) WHERE read_at IS NULL`, loaded in the root loader or the SSE stream.
- Mark read, mark all read, archive: actions.
- Pagination.
- A preferences UI and checks at send time.
- Real-time updates.
- Retention: a scheduled delete of rows older than N days. There is no scheduler in the repo today.
- Later: email via a provider plus an outbox/retry, digests, and push via Web Push or FCM.

**Real-time mechanics:**
- **SSE.** A resource route (a module with a `loader` and no default export) returns a `Response` whose body is a `ReadableStream` with `Content-Type: text/event-stream`. Close the stream when `request.signal` aborts. [RR1][MDN1]
  - `remix-utils` 10.x wraps this as `eventStream(request.signal, setup)` with a `useEventSource` hook, which shares one connection per URL. Its peer dependency is react-router ^8. [RU1]
  - `EventSource` reconnects automatically and resends `Last-Event-ID`, so a missed-event replay can be keyed off notification id. [WH1]
- **Fan-out in one process:** a module-level `EventEmitter` keyed by user id is enough while there is one Node process, which better-sqlite3 implies. With several instances, each one only sees its own clients. You would then need a shared bus (Redis pub/sub, or Ably or Pusher), or polling.
- **The `compression` trap:** `react-router-serve` calls `app.use(compression())` (`@react-router/serve/dist/cli.js`). The `compression` README says it "does not work out of the box with server-sent events" because it buffers output. Its source skips compression when the response has `Cache-Control: no-transform`, so send `Cache-Control: no-cache, no-transform`. [CM1]
- **Proxies:** nginx `proxy_read_timeout` defaults to 60 s between reads, and nginx buffers proxied responses unless `X-Accel-Buffering: no` is set. The WHATWG spec recommends a `:` comment line "every 15 seconds or so" to keep connections alive through proxies. [NG1][WH1]
- **Browser limits:** over HTTP/1.1, browsers allow only 6 SSE connections per browser and domain, shared across all tabs. HTTP/2 negotiates about 100 streams. One shared connection per tab, or HTTP/2 at the edge, avoids exhausting this. [MDN1]
- **Serverless or edge hosting:** Vercel Functions cap request duration, including streamed responses, at 300 s on Hobby and 800 s max on Pro, so SSE would reconnect periodically. Vercel lists WebSocket support as public beta. [V1] A long-running Node host has no such cap.
- **Polling fallback:** `useRevalidator` or a `fetcher` on a 15–30 s interval. It needs no infrastructure but is not instant.
- **WebSocket:** needs a custom server, because `react-router-serve` exposes no upgrade hook. That is more work than SSE for one-way server-to-client notifications. This is inferred from the `cli.js` setup, not documented.

**Rough effort** (estimate, not sourced, for one developer familiar with the codebase):

| Scope | Estimate |
|---|---|
| Table and migration, insert helper with recipient resolution, bell with unread count, list page, mark read / all read / archive, tests | ~2–3 days |
| SSE route with heartbeat and emitter | +0.5–1 day |
| Preferences (per-type toggles) | +1–2 days |
| Retention job | +0.5 day |
| Email channel later (provider, outbox, retries, unsubscribe) | +2–4 days |

**Testability:** fully in-process. Use in-memory SQLite for Drizzle in vitest, plus pure functions for recipient resolution and preference filtering. No vendor stubs are needed.

## Shortlist (top 2–3)

1. **Build in-house (SQLite + SSE resource route).** The app is already a single long-running Node process with SQLite, so real-time fan-out is trivial and costs nothing. It has no vendor lock-in, no user sync and no token signing, and it is the easiest option to test in vitest. The cost is building preferences, retention and email yourself.
2. **Knock.** It has the most complete free tier for this need: 10k messages, preferences, unlimited environments, unlimited feed retention, and seen/read/archive state. It offers both prebuilt and headless React, WebSocket real-time, and a Node SDK with an injectable `fetch`. The catch is that the first paid tier is $250/mo.
3. **Novu Cloud.** It has a comparable inbox, headless hooks and preferences component, the cheapest paid step ($30/mo), and an MIT self-host escape hatch. Its limits are 5 workflows on Free, and self-hosting needs Mongo and Redis.

(Courier is a close alternative to #2/#3: it is pure pay-as-you-go at $0.005 per send with no platform fee, but billing includes Test-environment sends.)

## Trade-offs for the build-or-buy decision

- **Cost at small scale:** every hosted option is $0 under about 10k notifications per month (MagicBell under 1k). The jump past free ranges from pay-per-send (Courier) through $30 (Novu) and $100 (SuprSend) to $250 (Knock and MagicBell). In-house costs only engineering time.
- **Feature depth vs. build time:** vendors include preferences UIs, digests and batching, and email or push routing. Those are the parts that take the most time to build in-house. The inbox and real-time parts alone are small to build.
- **Identity and security work:** every vendor requires syncing user ids and signing per-user tokens server-side (Knock user token, Novu HMAC, Courier JWT, MagicBell User JWT, SuprSend JWT). In-house reuses the existing session cookie.
- **Hosting coupling:** in-house SSE depends on staying single-instance on a long-running host, getting the `no-transform` and heartbeat details right, and on proxy settings. Vendors move the long-lived connections off your server, which matters for serverless or multi-instance hosting.
- **Data locality and testing:** in-house keeps notifications in SQLite next to the domain data, so it can join with enrollments and teams and is fully testable in vitest. Vendors need an adapter interface that is mocked in tests, plus a dev environment or workspace for integration checks.

## Sources

All checked 2026-11-10.

- [K1] Knock pricing: https://knock.app/pricing
- [K2] Knock React feed: https://docs.knock.app/in-app-ui/react/feed
- [K3] Knock headless feed: https://docs.knock.app/in-app-ui/react/headless/feed
- [K4] Knock in-app API and real-time: https://docs.knock.app/in-app-ui/api-overview
- [K5] Knock Node SDK README: https://github.com/knocklabs/knock-node (raw README.md)
- [K6] Knock users: https://docs.knock.app/concepts/users
- [K7] Knock security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [K8] Knock environments: https://docs.knock.app/concepts/environments
- [N1] Novu pricing (incl. FAQ JSON-LD): https://novu.co/pricing
- [N2] Novu Inbox overview: https://docs.novu.co/platform/inbox/overview
- [N3] Novu headless: https://docs.novu.co/platform/inbox/headless/get-started
- [N4] Novu README, license section: https://github.com/novuhq/novu (branch `next`)
- [N5] Novu self-hosting: https://docs.novu.co/community/self-hosting-novu/overview and https://docs.novu.co/community/self-hosting-novu/deploy-with-docker
- [N6] Novu trigger examples: https://docs.novu.co/.mintlify/skills/trigger-notification/references/single-trigger-examples.md
- [N7] Novu subscribers: https://docs.novu.co/platform/concepts/subscribers
- [N8] Novu environments: https://docs.novu.co/platform/concepts/environments
- [N9] Novu Inbox security (HMAC): https://docs.novu.co/.mintlify/skills/inbox-integration/references/security.md
- [N10] Novu self-hosted vs Cloud: https://docs.novu.co/community/self-hosted-and-novu-cloud
- [C1] Courier pricing: https://www.courier.com/pricing
- [C2] Courier docs index: https://www.courier.com/docs/llms.txt
- [C3] Courier custom inbox: https://www.courier.com/docs/in-app/build-a-custom-inbox
- [C4] Courier inbox runtime behavior: https://www.courier.com/docs/in-app/how-the-inbox-behaves
- [C5] Courier environments: https://www.courier.com/docs/workspaces/environments
- [C6] Courier JWT auth: https://www.courier.com/docs/in-app/authenticate-users
- [C7] Courier Node SDK: https://www.courier.com/docs/sdk-libraries/node
- [S1] SuprSend pricing: https://www.suprsend.com/pricing
- [S2] SuprSend inbox overview: https://docs.suprsend.com/docs/inbox-overview
- [S3] SuprSend React inbox: https://docs.suprsend.com/docs/inbox-react
- [S4] SuprSend headless feed: https://docs.suprsend.com/docs/react-sdk-headless-feed
- [S5] SuprSend Node SDK: https://docs.suprsend.com/docs/integrate-node-sdk
- [S6] SuprSend API docs index (preferences by `distinct_id`): https://docs.suprsend.com/llms.txt
- [S7] SuprSend workspaces: https://docs.suprsend.com/docs/workspaces
- [M1] MagicBell pricing: https://www.magicbell.com/pricing
- [M2] MagicBell React: https://www.magicbell.com/docs/libraries/magicbell-react
- [M3] MagicBell JS / Realtime: https://www.magicbell.com/docs/libraries/magicbell-js
- [M4] MagicBell in-app channel: https://www.magicbell.com/docs/channels/in_app
- [M5] MagicBell notification primitive: https://www.magicbell.com/docs/primitive/notification
- [M6] MagicBell user primitive: https://www.magicbell.com/docs/primitive/user
- [M7] MagicBell User JWT: https://www.magicbell.com/docs/api/authentication/user
- [ST1] Stream Feeds pricing: https://getstream.io/activity-feeds/pricing/
- [ST2] Stream notification feeds: https://getstream.io/activity-feeds/docs/react/notification-feeds/
- [ST3] Stream React docs: https://getstream.io/activity-feeds/docs/react/
- [P1] Pusher Channels pricing: https://pusher.com/channels/pricing/
- [A1] Ably pricing: https://ably.com/pricing
- [E1] Engagespot site (unreachable): https://engagespot.co/pricing ; docs: https://docs.engagespot.co
- [E2] Engagespot GitHub org: https://api.github.com/orgs/Engagespot/repos
- [RR1] React Router resource routes: https://reactrouter.com/how-to/resource-routes
- [RU1] remix-utils SSE: https://github.com/sergiodxa/remix-utils (README, "Server-Sent Events"); npm `remix-utils@10.0.1`
- [MDN1] MDN Using server-sent events: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events ; MDN EventSource: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- [WH1] WHATWG HTML, server-sent events (§9.2.4 Last-Event-ID, §9.2.7 authoring notes): https://html.spec.whatwg.org/multipage/server-sent-events.html
- [NG1] nginx proxy module (`proxy_read_timeout`, `X-Accel-Buffering`): https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- [V1] Vercel Functions limitations: https://vercel.com/docs/functions/limitations
- [CM1] `compression` 1.8.2 README ("Server-Sent Events") and `index.js` (no-transform check), as installed in `node_modules/compression`; upstream https://github.com/expressjs/compression
