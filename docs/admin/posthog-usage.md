# Using PostHog Analytics

A practical guide to using PostHog data to understand user behavior, identify problems, and improve the product.

## Understanding Your Users

### Who is actually using the product?

Navigate to **People > Persons** and filter by cohort to see active users.

**Key questions to answer:**
- How many unique users are active per week? (Trends: `$pageview` > unique users > weekly)
- What's the admin-to-client ratio? (Trends: `$pageview` > breakdown by `userType`)
- Which hubs are most active? (Trends: `$pageview` > breakdown by `hub` group)
- Are there hubs with zero client activity? These may need outreach or onboarding help.

### User journeys

Navigate to **Product Analytics > User paths** to see common navigation flows.

**What to look for:**
- Where do client users go first after logging in?
- Do they explore multiple tabs or stick to one view?
- What's the most common path to submitting a form?

## Measuring Feature Adoption

### Are clients using what we built?

Create a Trends insight with these events as separate series, each showing unique users:

- `issue_viewed`
- `comment_created`
- `form_submitted`
- `vote_cast`
- `roadmap_viewed`

**What to look for:**
- Features with zero or near-zero usage may indicate discoverability problems, not lack of need
- Compare per-hub: some hubs may use forms heavily but never comment (they have different workflows)
- Look at trends over time — is usage growing, flat, or declining?

### Feature adoption by hub

Use group analytics to compare feature usage across hubs:

1. Go to **Insights > New insight > Trends**
2. Select event (e.g. `form_submitted`)
3. Group by `hub`
4. Compare total events per hub

Low-usage hubs may benefit from onboarding improvements or workflow changes.

## Finding Friction Points

### Where do users get stuck?

**Session Replay** is your most powerful tool here.

1. Navigate to **Session Replay**
2. Filter by `userType = client`
3. Sort by duration (long sessions may indicate confusion)
4. Watch for:
   - Repeated clicks on non-interactive elements (rage clicks)
   - Users navigating back and forth (lost)
   - Abandoned forms (started but never submitted)
   - Long pauses before taking action (confusion)

**Specific playlists to create:**

| Playlist | Purpose |
|----------|---------|
| Rage clicks | Filter by `$rageclick` event — users clicking repeatedly out of frustration |
| Abandoned forms | Has `form_viewed` but NOT `form_submitted` in same session |
| Short sessions (<30s) | Users who bounce immediately — is the landing page unclear? |
| First-time users | Filter by `$initial_pageview` — how do new users experience the product? |

### Drop-off analysis

Use the **Client Onboarding Funnel** (see Setup Guide) to identify where users stop engaging:

- High drop-off between "first visit" and "tab switched" = the landing page isn't compelling
- High drop-off between "issue viewed" and "comment created" = the comment flow may be too complex
- High drop-off between "tab switched" and "issue viewed" = users can't find relevant content

## Improving Admin Workflows

### Are admins completing setup?

Use the **Admin Setup Funnel** to track completion:

1. `hub_settings_updated` — configured the hub
2. `member_invited` — added client users
3. `sync_triggered` — started data sync
4. `form_builder_saved` — set up forms

If admins complete step 1 but not step 2, the member invitation flow may need simplification.

### Sync health monitoring

Create a Trends insight:
- Event: `sync_completed` and `webhook_received`
- Display as: total count per day
- Add: `sync_triggered` as comparison

**What to look for:**
- `webhook_received` should be consistent daily (Linear sends webhooks regularly)
- Sudden drops in `webhook_received` may indicate webhook configuration issues
- `sync_triggered` spikes may indicate admins are manually re-syncing due to perceived data staleness

## Notification Effectiveness

### Are notifications driving engagement?

Create these insights:

**Notification click-through rate:**
1. Trends: `digest_sent` (sum of `recipientCount`) vs `notification_clicked`
2. Calculate ratio to get effective click-through rate

**Post-notification behavior:**
1. Funnel: `notification_clicked` > `issue_viewed` > `comment_created` (within 10 minutes)
2. This shows whether notifications lead to meaningful engagement

**Preference insights:**
- How many users have customized notification preferences? (Count of `notification_preferences_updated`)
- Are users turning notifications off? Check the properties of `notification_preferences_updated` events

## Weekly Review Checklist

Use this checklist during weekly product reviews:

### Health Metrics
- [ ] Daily active users trend (up, flat, down?)
- [ ] Active hubs count (any new? any gone quiet?)
- [ ] Error rate (check **Error Tracking** or `$exception` events)
- [ ] Session replay — watch 3-5 random client sessions

### Engagement Metrics
- [ ] Forms submitted this week vs last week
- [ ] Comments created this week vs last week
- [ ] New users onboarded (first-time `$pageview` events)

### Operational Metrics
- [ ] Webhook processing reliability (any gaps in `webhook_received`?)
- [ ] Digest delivery (are `digest_sent` counts consistent?)
- [ ] Manual sync frequency (high `sync_triggered` = possible sync issues)

### Action Items
- [ ] Identify the lowest-usage feature — investigate why
- [ ] Watch 2-3 session replays with rage clicks — note UX issues
- [ ] Check onboarding funnel — where is the biggest drop-off?
- [ ] Review any hubs with zero activity — reach out to those clients

## Advanced Techniques

### Correlation analysis

PostHog can find correlations between user properties/actions and outcomes.

1. Go to **Insights > New insight > Correlation**
2. Set success event: `form_submitted` (or any key action)
3. PostHog will show which properties or prior events correlate with higher conversion

**Example findings:**
- "Users who view the roadmap within their first session are 3x more likely to submit a form"
- "Users on hub X submit 5x more forms than average — investigate what's different about their setup"

### Retention analysis

Track whether users come back:

1. Go to **Insights > New insight > Retention**
2. First event: `$pageview` (user's first visit)
3. Return event: `$pageview` (any subsequent visit)
4. Period: weekly

**What to look for:**
- Week 1 retention below 30% = users try the product but don't come back
- Flat retention after week 4 = you've found your core engaged users
- Break down by `userType` — admin retention should be higher than client retention (admins use it daily)

### Custom HogQL queries

For complex analysis, use PostHog's SQL-like query language:

Navigate to **Data Management > SQL** and try:

```sql
-- Most active hubs by unique users this month
SELECT
  properties.$group_0 as hub,
  count(distinct person_id) as unique_users,
  count(*) as total_events
FROM events
WHERE timestamp > now() - interval 30 day
  AND properties.$group_0 IS NOT NULL
GROUP BY hub
ORDER BY unique_users DESC
```

```sql
-- Average time between first visit and first form submission per hub
SELECT
  properties.$group_0 as hub,
  avg(dateDiff('hour', first_seen, first_form)) as avg_hours_to_first_form
FROM (
  SELECT
    person_id,
    properties.$group_0,
    min(timestamp) as first_seen,
    min(case when event = 'form_submitted' then timestamp end) as first_form
  FROM events
  WHERE timestamp > now() - interval 90 day
  GROUP BY person_id, properties.$group_0
  HAVING first_form IS NOT NULL
)
GROUP BY hub
ORDER BY avg_hours_to_first_form
```
