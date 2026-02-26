# Linear Sync Architecture

## Overview

This document explains how linear.gratis syncs data from Linear and the rationale behind the architecture. It serves as a reference for all sync-related development.

## Problem: Why We Moved Away From Pull-On-Demand

The original architecture called Linear's GraphQL API on every page load:

```
Browser → API Route → Decrypt Token → Linear GraphQL → Transform → Response
```

This had three fatal flaws:

1. **Rate limits** — Every public page viewer burned the form owner's Linear API quota (~60 req/min). A roadmap with 50 concurrent viewers would exhaust the token instantly.

2. **No event awareness** — Planned features like email notifications require knowing *when* something changed. Without webhooks, the only option is polling for diffs — fragile, expensive, and laggy.

3. **No write confirmation loop** — When a client adds a label or comment from gratis, we need to confirm the write succeeded and update the UI. Without a feedback mechanism, the client is blind.

4. **Poor performance** — Every page visit showed a loading spinner while waiting for Linear's API to respond. No caching meant no instant loads.

## Solution: Webhook-Driven Sync With Local Cache

```
┌──────────────────────────────────────────────────────────────────┐
│                        LINEAR (Source of Truth)                   │
│                                                                  │
│  Issues, Comments, Labels, Projects, Teams                       │
└──────────┬───────────────────────────────────┬───────────────────┘
           │                                   ▲
           │ Webhook push                      │ GraphQL mutations
           │ (on every change)                 │ (writes only)
           ▼                                   │
┌──────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API ROUTES                           │
│                                                                  │
│  /api/webhooks/linear     ← receives events, upserts to DB      │
│  /api/sync/subscribe      ← registers webhook with Linear       │
│  /api/sync/initial        ← backfills existing issues            │
│  /api/sync/reconcile      ← catches missed webhooks              │
│  /api/public-view/[slug]  ← reads from Supabase (not Linear)    │
│  /api/roadmap/[slug]      ← reads from Supabase (not Linear)    │
└──────────┬───────────────────────────────────┬───────────────────┘
           │                                   ▲
           │ Upsert/Query                      │ Query
           ▼                                   │
┌──────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Read Cache)                         │
│                                                                  │
│  synced_issues      — cached Linear issues                       │
│  synced_comments    — cached Linear comments                     │
│  sync_subscriptions — webhook registrations per user             │
│  notification_queue — pending email notifications                │
│                                                                  │
│  (Existing tables unchanged: profiles, public_views, roadmaps,   │
│   roadmap_votes, roadmap_comments, customer_request_forms, etc.) │
└──────────────────────────────────────────────────────────────────┘
           ▲
           │ Fetch
           │
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                          │
│                                                                  │
│  Public views, roadmaps, forms                                   │
│  Admin pages (forms config, views config, profile)               │
└──────────────────────────────────────────────────────────────────┘
```

### Core Principle

**Supabase is the read layer. Linear is the write target.**

- All client reads come from Supabase — fast, no API quota burned
- All client writes go to Linear — it stays the source of truth
- Webhooks close the loop: Linear → Supabase, keeping the cache fresh
- Notifications are a side effect of webhook processing

## Data Flow: Read Path

When a user visits a public view, roadmap, or admin page:

```
1. Browser requests /api/public-view/my-board
2. API route queries synced_issues WHERE project_id = X AND user_id = Y
3. Applies filters (status, labels, priority) as SQL WHERE clauses
4. Returns JSON (same shape as before — no frontend changes)
5. If no synced data exists, falls back to direct Linear API call
```

Latency: ~50ms (Supabase query) vs ~500-2000ms (Linear API).

## Data Flow: Write Path

When a client adds a label, posts a comment, or creates an issue:

```
1. Browser calls POST /api/issues/123/labels  (future feature)
2. API route calls Linear GraphQL mutation (issueLabelAdd, commentCreate, etc.)
3. Returns optimistic success to browser
4. Linear processes the mutation
5. Linear fires webhook to /api/webhooks/linear
6. Webhook handler upserts updated issue into synced_issues
7. Next time the page loads, it reads the updated data from Supabase
```

The webhook confirms the write. If the webhook is missed, the reconciliation job catches it.

## Data Flow: Webhook Processing

```
1. Linear sends POST /api/webhooks/linear
   Headers: { "linear-signature": "<HMAC-SHA256>" }
   Body: { "action": "update", "type": "Issue", "data": { ... } }

2. Webhook handler:
   a. Read raw body
   b. Compute HMAC-SHA256(body, webhook_secret)
   c. Compare with linear-signature header → reject if mismatch
   d. Look up sync_subscriptions by webhook metadata to find user_id
   e. Switch on event type:
      - Issue.create  → INSERT into synced_issues
      - Issue.update  → UPDATE synced_issues SET ... WHERE linear_id = X
      - Issue.remove  → DELETE FROM synced_issues WHERE linear_id = X
      - Comment.create/update/remove → same pattern for synced_comments
   f. Check notification rules → enqueue emails if applicable
   g. Return 200
```

## Data Flow: Initial Sync

When a user first enables sync:

```
1. User clicks "Enable Sync" on profile page
2. POST /api/sync/subscribe:
   a. Generate random webhook secret
   b. Call Linear webhookCreate mutation (url, resourceTypes, secret)
   c. Store webhook_id + encrypted secret in sync_subscriptions
3. POST /api/sync/initial:
   a. Fetch all issues from user's connected projects (paginated, 50 per page)
   b. For each issue, fetch comments
   c. Upsert everything into synced_issues and synced_comments
   d. Set synced_at = now() on all records
4. From this point, webhooks keep data fresh
```

## Data Flow: Reconciliation

Safety net for missed webhooks (network blips, server downtime, etc.):

```
1. Cron job runs every 5 minutes: GET /api/sync/reconcile
2. For each active sync_subscription:
   a. Find MAX(synced_at) from synced_issues for this user
   b. Query Linear for issues WHERE updatedAt > max_synced_at
   c. Upsert any differences into synced_issues
   d. Log: "Reconciled 3 issues for user X"
3. This catches:
   - Missed webhooks
   - Issues created/updated during downtime
   - Deleted issues (compare ID sets)
```

## Database Tables

### synced_issues

Local cache of Linear issues. One row per issue per user.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| linear_id | text | Linear's issue UUID |
| user_id | text | WorkOS user ID (owner of the Linear token) |
| project_id | text | Linear project UUID |
| team_id | text | Linear team UUID |
| identifier | text | Human-readable ID (e.g., "ENG-123") |
| title | text | Issue title |
| description | text | Issue description (markdown) |
| state | text | Status name (e.g., "In Progress") |
| priority | integer | Priority value (0-4) |
| assignee | text | Assignee display name |
| labels | jsonb | Array of {id, name, color} |
| due_date | date | Due date |
| url | text | Linear issue URL |
| created_at | timestamptz | Row creation / Linear created timestamp |
| updated_at | timestamptz | Row update / Linear updated timestamp |
| synced_at | timestamptz | When last synced to this table |

**Unique constraint:** `(user_id, linear_id)`
**Indexes:** `linear_id`, `user_id`, `project_id`, `team_id`

### synced_comments

Local cache of Linear issue comments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| linear_id | text | Linear's comment UUID |
| issue_linear_id | text | Parent issue's Linear UUID |
| user_id | text | WorkOS user ID |
| body | text | Comment body (markdown) |
| author_name | text | Comment author display name |
| created_at | timestamptz | Row creation / Linear created timestamp |
| updated_at | timestamptz | Row update / Linear updated timestamp |
| synced_at | timestamptz | When last synced |

**Unique constraint:** `(user_id, linear_id)`
**Indexes:** `linear_id`, `user_id`, `issue_linear_id`

### sync_subscriptions

Tracks webhook registrations per user.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | text | WorkOS user ID |
| linear_team_id | text | Linear team UUID |
| webhook_id | text | Linear webhook UUID (returned by webhookCreate) |
| webhook_secret | text | Encrypted signing secret |
| events | text[] | Subscribed event types |
| is_active | boolean | Whether sync is enabled |
| created_at | timestamptz | When subscription was created |
| updated_at | timestamptz | Last updated |

### notification_queue

Pending email notifications, populated by webhook handler.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | text | Who to notify |
| event_type | text | What happened (e.g., "issue.status_changed") |
| issue_linear_id | text | Which issue |
| payload | jsonb | Full event data for email template |
| sent_at | timestamptz | When email was sent (null if pending) |
| created_at | timestamptz | When queued |

## Freshness Guarantees

| Scenario | Latency | Mechanism |
|----------|---------|-----------|
| Normal operation | < 5 seconds | Webhook fires near-instantly |
| Missed webhook | < 5 minutes | Reconciliation cron catches it |
| First sync | Seconds to minutes | Initial sync backfills all data |
| Linear API down | Stale but available | Supabase cache serves last known state |
| Supabase down | Unavailable | No fallback (Supabase is the read layer) |

## Fallback Behavior

If a user hasn't enabled sync (no sync_subscription), the app falls back to the original behavior: direct Linear API calls on every request. This ensures:

- Existing users aren't broken
- New users can use the app before enabling sync
- Gradual migration — no big bang cutover

## Security

- **Webhook signatures**: Every incoming webhook is verified via HMAC-SHA256 with a per-user secret. Unverified payloads are rejected with 401.
- **Token encryption**: Linear API tokens are encrypted at rest in Supabase using AES (existing mechanism in `src/lib/encryption.ts`).
- **Webhook secrets**: Stored in sync_subscriptions. Generated server-side as 32-byte random hex. Only used for HMAC verification.
- **No RLS**: All queries go through `supabaseAdmin` (service role), scoped by `user_id` in application code. This is intentional — auth is handled by WorkOS, not Supabase.

## Future Features This Enables

This sync architecture is the foundation for:

1. **Client-side label management** — Write to Linear via mutation, webhook confirms and updates cache
2. **Client-side commenting** — Same pattern as labels
3. **Email notifications** — Webhook handler populates notification_queue, background job sends emails
4. **Real-time UI updates** — Supabase Realtime can push changes to connected clients via WebSocket
5. **Activity feeds** — Webhook events can be logged as an activity stream
6. **Digest emails** — notification_queue can be batched into daily/weekly summaries

## Implementation Status

All specs completed on 2026-02-26:

| Spec | Title | Est | Status |
|------|-------|-----|--------|
| PPMLG-32 | Sync architecture documentation | 4h | Done |
| PPMLG-33 | Supabase sync tables migration | 4h | Done |
| PPMLG-34 | Webhook endpoint + verification | 8h | Done |
| PPMLG-35 | Subscription management UI/API | 8h | Done |
| PPMLG-36 | Initial sync job | 8h | Done |
| PPMLG-37 | Migrate public view API | 8h | Done |
| PPMLG-38 | Migrate roadmap API | 8h | Done |
| PPMLG-39 | Reconciliation job | 4h | Done |
| PPMLG-40 | Admin API migration | 4h | Done |

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260226_sync_tables.sql` | Database migration for all 4 sync tables |
| `src/lib/webhook-handlers.ts` | Signature verification, issue/comment upsert handlers |
| `src/lib/initial-sync.ts` | Paginated backfill from Linear GraphQL |
| `src/lib/sync-read.ts` | Shared Supabase read helpers (issues, comments, metadata, roadmap) |
| `src/lib/supabase.ts` | TypeScript types for sync tables |
| `src/app/api/webhooks/linear/route.ts` | Webhook receiver endpoint |
| `src/app/api/sync/subscribe/route.ts` | POST/DELETE/GET subscription management |
| `src/app/api/sync/initial/route.ts` | Manual re-sync trigger |
| `src/app/api/sync/reconcile/route.ts` | Cron + manual reconciliation |
| `vercel.json` | Cron config (reconcile every 5 min) |
