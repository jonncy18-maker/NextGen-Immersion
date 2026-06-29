# NGS Immersion — Update Log

Updates are listed newest-first. Each entry covers what changed and who it affects.

---

## 2026-06-29

### Hours broken down by 4 categories
**Affects:** Scholar (Progress page) · Admin (scholar drill-down)

The "Hours by Category" section now always shows all four input channels:

| Category | Source |
|---|---|
| 📱 App Video | Hours auto-tracked while watching in the app |
| 📺 Outside Listening | Hours logged manually via "Log Hours" → Outside Listening |
| 💬 ChatGPT Practice | Hours logged manually via "Log Hours" → ChatGPT |
| 📞 Mentor Calls | Hours logged manually via "Log Hours" → Weekly Mentor |

Previously this section was hidden unless category targets were configured. It now always appears so scholars and admins can see exactly where hours are coming from at a glance. No existing hours were changed — the data is only re-grouped for display.

---

### Multi-select level and topic filters on the Watch tab
**Affects:** Scholars (Watch page)

- **Level filter** is now 3 toggle chips (Beginner / Intermediate / Advanced). Multiple levels can be active at once — e.g. select both Beginner and Intermediate to see videos spanning that range. The app pre-selects the scholar's current level on first load.
- **Topic filter** is now a dropdown with grouped checkboxes. Select multiple topics at once; the button shows a summary of what's active. Click outside to close.

---

### Simplified level filter + duration dropdown on Watch tab
**Affects:** Scholars (Watch page)

- Level filter collapsed from 5 tiers to 3 (Beginner A1–B1 / Intermediate B1–B2 / Advanced B2–C1) to match the label language used throughout the app.
- New **Duration** dropdown filter: Any Duration / Under 5 min / 5–10 min / 10–15 min / 15–20 min / 20–30 min / Over 30 min.

---

### Topic chips in Discover & Import (admin)
**Affects:** Admin (Discover & Import tab)

When a scholar is selected in the context panel, topic chips appear grouped by category (OET/Career · Daily Life · Compelling Interest). Clicking a chip fires a YouTube search combining the topic keywords with the scholar's CEFR level range, so admins can quickly find level-appropriate content for each subject area.

---

### No duplicate videos in Discover & Import search results
**Affects:** Admin (Discover & Import tab)

Videos already in the library are now excluded from search results entirely, freeing up result slots for genuinely new content and preventing accidental re-adds.

---

### Category-split goals + progress breakdown (Phases 20–22)
**Affects:** Scholar (Progress page) · Admin (Goal Editor, Scholar Dashboard)

- **Goal Editor** now accepts per-category hour targets (Video / ChatGPT / Mentor) alongside the overall program target.
- **Progress page** shows a category breakdown below the pace analysis.
- **Admin dashboard** shows per-category actuals for each scholar.
- **Live refresh** — the progress page updates immediately after logging external hours without needing a manual reload.
- **Library search** — keyword search on the Watch tab filters across video titles and channel names.

---

### Admin video library editor (Phase 18)
**Affects:** Admin (Videos page → Manage Library tab)

New "Manage Library" tab on the Admin Videos page with:
- Per-card checkbox for bulk selection
- 3-dot menu per video: Delete (soft), Change Level, Change Topic
- Bulk-action bar for applying changes to multiple videos at once
- Filter row to narrow the library view

---

### Progress hours delta — ahead/behind analysis (Phase 19)
**Affects:** Scholar (Progress page) · Admin (scholar drill-down)

The pace section now shows a specific hours figure: how many hours ahead or behind the expected pace the scholar currently is, in addition to the ON TRACK / AT RISK status indicator.

---

### Unified Watch + Browse tab with sticky filter bar (Phase 17)
**Affects:** Scholars

Watch and Browse are now a single tab. The video player sits at the top; the browsable library is directly below it. A sticky filter bar (level, topic, watched/unwatched) stays visible while scrolling through the grid. Selecting a video scrolls back to the player automatically.

---

## 2026-06-28

### External hours logging (Phase 16)
**Affects:** Scholars (Progress page)

Scholars can now log study time that happens outside the app using the "Log Hours" button on the Progress page. Three session types: ChatGPT conversation practice, Outside Listening (videos watched elsewhere), and Weekly Mentor call. Logged hours count toward cumulative totals and pace calculations immediately.

---

### Per-scholar program goals (Phase 15)
**Affects:** Admin (Goal Editor) · Scholars (Progress page)

Admins can assign each scholar a start date, target hours, target date, and target level. The scholar's progress clock and pace calculations (ON TRACK / AT RISK) activate as soon as a start date is set. Scholars without a goal see a "waiting for goal" state.

---

### Phase 13 — Polish + launch prep
**Affects:** All users

Pre-launch refinements: loading skeletons, empty states, error handling, mobile layout fixes, and performance tuning ahead of Claire's first access.

---

### Offline resilience + connection indicator (Phase 12)
**Affects:** Scholars

Watch sessions are buffered locally if the network drops and flushed automatically on reconnect. A connection indicator appears when offline. Watch time is never lost due to a brief connectivity issue.

---

### Responsive layout + desktop sidebar (Phase 11)
**Affects:** All users

Full responsive layout across mobile (bottom nav), tablet, and desktop (sidebar). Video grid adapts from 1 to 3 columns based on screen width.

---

### Admin video management + AI-assisted search (Phase 10)
**Affects:** Admin

Admins can search YouTube from within the app and add videos directly to the library. The AI tagger (Claude Haiku) automatically assigns a CEFR level and topic tags to each video or channel on import. Music videos are automatically excluded from search results.

---

### Admin progress dashboard + goal editor (Phase 9)
**Affects:** Admin

Admin view showing all scholars with ON TRACK / AT RISK status cards. Clicking a scholar opens their full progress view. Goal editor for setting program-wide targets.

---

## 2026-06-27

### Phase 5–8 — Core watching experience
**Affects:** Scholars

- YouTube IFrame player embedded in the app with automatic watch-time tracking
- Hours counter, level badge (Super Beginner → Beginner → Intermediate → Advanced), milestone bar, and weekly stats
- Video library with level and topic filters, watched/unwatched toggle
- Session timer that only counts time while the video is actually playing (paused/buffering time excluded)
- Idempotent session flushing — hours are never double-counted even if the tab closes unexpectedly

---

### Phase 1–4 — Foundation
**Affects:** All

- Next.js + React app with same-origin authentication (session persists across page refresh)
- Neon Postgres database with full schema (users, videos, watch sessions, external sessions, goals)
- Scholar and admin roles — one login screen, role-driven UI
- Deployed to Vercel with environment variables configured
