# DESIGN.md — Silicon Desert Golf League Commissioner App

Last updated 2026-04-18. This is the design source of truth.
All implementation decisions calibrate against this file.

---

## App Classification

**APP UI** — commissioner workspace tool. Data-dense, task-focused, single user. Not a marketing page. No hero sections, no feature grids, no decorative elements.

Primary use contexts:
- **Check-in + Pairings:** phone, outdoors, bright sunlight, Friday afternoon
- **Score Entry:** desktop or laptop, home, Friday evening or Saturday morning

The UI ships two distinct layouts: mobile (below 1280px) and desktop (1280px and above). They coexist in the same codebase via Tailwind's `xl:` breakpoint — no JS viewport detection, no UA sniffing, no separate routes.

---

## Color System

**Light theme only.** All tokens live in `globals.css` as CSS variables and map to Tailwind classes via `tailwind.config.ts`. Do not use Tailwind's default palette directly for brand/UI colors.

```css
/* globals.css */
:root {
  --surface-base:     #ffffff;   /* body background */
  --surface-elevated: #f8fafc;   /* cards, nav bar, modals */
  --surface-sunken:   #f1f5f9;   /* table headers, input backgrounds, dividers */
  --surface-border:   #e2e8f0;   /* all borders */

  --text-primary:     #0f172a;
  --text-secondary:   #475569;
  --text-muted:       #94a3b8;
  --text-disabled:    #cbd5e1;

  --accent:           #16a34a;   /* primary CTA, checked state, success — green */
  --accent-hover:     #15803d;
  --accent-bright:    #22c55e;
  --accent-dim:       #dcfce7;   /* accent-tinted surface */
  --accent-text:      #166534;   /* accent-colored text on light backgrounds */

  --warning:          #d97706;
  --warning-dim:      #fef3c7;
  --warning-text:     #92400e;

  --danger:           #dc2626;
  --danger-dim:       #fee2e2;
  --danger-text:      #991b1b;

  --info-dim:         #dbeafe;   /* threesome badge background */
  --info-text:        #1e40af;   /* threesome badge text */
}
```

```ts
// tailwind.config.ts — token mapping (do not hard-code hex values in components)
extend: {
  colors: {
    surface: { base, elevated, sunken, border },
    text: { primary, secondary, muted, disabled },
    accent: { DEFAULT, hover, bright, dim, text },
    warning: { DEFAULT, dim, text },
    danger: { DEFAULT, dim, text },
    info: { dim, text },
  }
}
```

---

## Typography

```ts
// tailwind.config.ts + app/layout.tsx
fontFamily: {
  sans:      ['var(--font-barlow)', 'system-ui', 'sans-serif'],
  condensed: ['var(--font-barlow-condensed)', 'system-ui', 'sans-serif'],
}
```

Two fonts: **Barlow** (body, table cells, UI text) and **Barlow Condensed** (labels, nav items, section headers, scores). Use `font-condensed` for uppercase tracking labels. Never `font-sans` for labels that need tight letter-spacing.

| Role | Size | Weight | Font | Color |
|------|------|--------|------|-------|
| Screen title | 24px / `text-2xl` (mobile), `text-lg` (desktop) | 700 | Condensed | `text-primary` |
| Section label | 11px / `text-xs` | 600 | Condensed | `text-muted`, uppercase, widest tracking |
| Nav items | 11px (mobile), 14px / `text-sm` (desktop) | 600 | Condensed | uppercase |
| Player name | 15px / `text-sm` | 500–600 | Sans | `text-primary` |
| Handicap index | 13px | 500 | Sans | `text-secondary` |
| Table header | 11px | 600 | Condensed | `text-muted`, uppercase |
| Table cell | 14–15px | 400–500 | Sans | `text-primary` |
| Score input | 14px / `text-sm` | 700 | Sans | `text-primary` |
| Meta / subtext | 12px | 400–500 | Sans | `text-secondary` |
| Badge / flag | 11px | 600 | Sans | varies by badge type |

---

## Spacing & Density

Base unit: 4px (Tailwind default).

### Mobile
| Context | Padding |
|---------|---------|
| Screen horizontal padding | 16px (`px-4`) |
| Player row | `py-2.5` (10px top/bottom) |
| Card inner padding | `p-3` or `p-4` |
| Section header gap | `mb-2.5` |
| Bottom nav item | `py-3` |

Touch targets: minimum 44×44px on all interactive elements.

### Desktop (≥1280px / `xl:`)
| Element | Spec |
|---------|------|
| Screen horizontal padding | 24px (`xl:px-6`) |
| Table row height | 36px |
| Score input cell | 40px wide (`w-10`), 32px tall (`h-8`) |
| Sidebar nav item | 32px tall, `px-3 py-1.5` |
| Section header gap | `mb-3` |
| Touch targets | N/A — keyboard + mouse. Min 28px for clickable elements. |

---

## Border Radius

| Element | Radius |
|---------|--------|
| Cards, match cards | `rounded-xl` |
| Buttons | `rounded-lg` |
| Input fields | `rounded-md` |
| Badges, flags | `rounded` |
| Score input cells | `rounded` |
| Toggle checkboxes | `rounded-md` |
| Progress dots | `rounded-full` |

---

## Navigation

### Mobile (below 1280px)

**Bottom nav (4 items):** Week, Standings, Roster, History

- Fixed at bottom, full-width, `xl:hidden`
- `max-w-md` inner grid centered
- Active item: `accent-text` color
- Inactive: `text-secondary`
- Font: Condensed, 11px, uppercase, semibold
- No icons — text labels only

**Week tab has two sub-tabs:** `Check-in | Pairings`

**Score Entry** on mobile: full-screen push launched by "Enter Scores →" link on a match card. Not a persistent nav destination.

### Desktop (1280px and above / `xl:`)

**Persistent left sidebar** instead of bottom nav.

- `hidden xl:flex fixed left-0 top-0 bottom-0 w-[200px]`
- Branding at top: "Silicon Desert" (10px muted) + "Commissioner" (14px bold) — both Condensed uppercase
- Nav items: text-only, no icons, no colored-circle wrappers
- Active item: 3px left border (`border-l-[3px] border-accent`) + `bg-accent-dim` tint + `text-accent-text`
- Inactive: `border-l-[3px] border-transparent text-secondary hover:text-primary`
- Content area offset: `xl:ml-[200px]`
- Main content: `xl:max-w-none` (full remaining width, not capped at 5xl)

---

## Screen Specs

### Week / Check-in Tab

**Header:**
```
Silicon Desert Golf League           (11px, muted, uppercase)
Week 4 — Spring 2026                 (20px, bold)
Oakwood CC · Course A · Today        (12px, accent.text)
```

**Attendance list:**
- Checked-in players first (sorted to top), bold name, filled green dot
- Not-yet-arrived: muted name, empty circle dot
- Tap anywhere on row to toggle
- Player row: `[dot] [Name] [HCP or PRO badge]`
- PRO badge: amber (`warning.text`) — players with < 3 rounds
- Attendance-only check-ins (players who show up but aren't paired): supported; they appear in attendance without generating a match

**CTP + LP selectors:**
- 2-column grid below the player list
- Each: label (11px muted uppercase) + selected value or "— Select" (muted)

**Generate Pairings CTA:**
- Full-width, `accent.DEFAULT` background, 16px bold
- Disabled state: explains why ("Need ≥2 players", etc.)

---

### Week / Pairings Tab

**Match cards:**
```
┌─────────────────────────────────┐
│ Match 1              [flag]     │  ← header bar
│─────────────────────────────────│
│ Mike Sanderson           HCP 14 │
│          vs                     │
│ Dave Torres              HCP 11 │
│─────────────────────────────────│
│ Gap: 2.8  [▓▓▓░░░░░░░]          │
└─────────────────────────────────┘
```

**Flags:** Repeat match (danger), HCP gap > 6 (warning), threesome (info).

**After lock — match cards:**
```
┌─────────────────────────────────┐
│ Match 1          ✓ Complete     │  ← green when done
│ Mike 3pts · Dave 2pts           │
│                [Enter Scores →] │  ← mobile only (xl:hidden)
└─────────────────────────────────┘
```

The "Enter Scores →" link is `xl:hidden` — on desktop, score entry happens in the inline grid below the match cards.

---

### Score Entry — Mobile

Full-screen push flow, per-player, per-hole. Each player's 9 holes on a scrollable card. Tap a hole to enter the score.

---

### Score Entry — Desktop (`xl:`)

Inline grid below the match card list. Shown only when the card is locked and matches exist.

**Match tabs:** Horizontal tab row above the scorecard. Each tab = one match, abbreviated as "Last, F. / Last, F.". Active tab has accent underline. Checkmark icon when complete, amber dot when pending.

**Scorecard grid:**
```
Player       | H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | Total
Smith, J.    | [  | [  | [  | [  | [  | [  | [  | [  | [  |  —
Jones, K.    | [  | [  | [  | [  | [  | [  | [  | [  | [  |  —
Par          | 4  | 3  | 5  | 4  | 3  | 4  | 5  | 4  | 3  |  35
```

Green dot indicator on holes where the player receives strokes (based on playing handicap vs SI).

**Score cell specs:**
- `h-8 w-10 rounded border text-center text-sm font-bold`
- Focus: `border-accent` ring
- Warning: amber color if score > 12
- Empty: placeholder `—`
- `inputMode="numeric"`, auto-select on focus

**Keyboard navigation:**
- Tab / Enter: advance to next cell
- Shift+Tab: go back
- Escape: clear current cell
- ArrowRight / ArrowLeft: adjacent hole, same player
- ArrowDown / ArrowUp: same hole, other player
- Tab order: P1H1 → P1H2 → ... → P1H9 → P2H1 → P2H2 → ... → P2H9 → Save button
- Tab past H9 of Player 2: moves to Save button
- Save button enabled when all 18 inputs are filled

**Live scoring:**
- Running net totals update as holes are entered (via `applyESC`)
- Match play result shown as you type (`calculateMatchPlayResult`)
- Match points shown (`calculateMatchPoints`)

**Data loading:** Per-tab, lazy. Fetches from `GET /api/weeks/[id]/matches/[matchId]/scores` on tab click. Cached in component state for the session.

**Save:** `POST /api/weeks/[id]/matches/[matchId]/scores`. On success, cache is invalidated and next incomplete match tab is auto-selected.

---

### Roster

**Mobile:** Player list with name, HCP index, active/inactive toggle. Tap to view handicap history.

**Desktop (`xl:`):** Full data table — Name, Tee, HCP, Rounds, Status columns. Click a row to open a 360px slide-in panel from the right. Table stays visible and scrollable in the background. Panel contains the edit form. ESC or X button closes without saving; Save closes with update. Add Player: same panel, empty form.

**PRO indicator:** Players with < 3 rounds show "PRO" badge (amber) instead of HCP number. 0 rounds + seed index shows "EST" badge (muted).

---

### Standings

**Three tabs:** Spring · Summer · Overall

**Table columns:** # | Player | Pts | Stroke W | Match W | CTP | LP

Default sort: Pts descending. Sortable by all numeric columns.

---

### History

**Week list:** Each row = week number, date, course, match count, locked status.

Expand a week: match results, pair list, CTP/LP winners.

---

## Component Patterns

### Badges / Flags

| Type | Background | Text color | Use |
|------|-----------|------------|-----|
| Count | `accent.DEFAULT` | white | Player count, checked-in count |
| PRO | `warning.dim` | `warning.text` | < 3 rounds |
| EST | `surface.elevated` | `text-muted` | 0 rounds, seeded index |
| Repeat | `danger.dim` | `danger.text` | Prior match this season |
| Gap | `warning.dim` | `warning.text` | HCP gap > 6 |
| Threesome | `info.dim` | `info.text` | Threesome group |
| CTP | `info.dim` | `info.text` | CTP hole marker in scorecard |

### Buttons

| Variant | Use | Style |
|---------|-----|-------|
| Primary | Main CTA (Generate, Lock, Submit) | `accent.DEFAULT` bg, white text, `rounded-lg` |
| Secondary | Supporting actions (Print, Regenerate) | `surface.elevated` bg, `text-secondary`, border |
| Destructive | Unlock | `danger.dim` bg, `danger.text` |
| Ghost | Swap, close | Transparent, `text-muted`, icon-only |

### Status / Info Bars

Left-border accent bars for contextual status:
```
background: accent.dim (#dcfce7)
border-left: 3px solid accent (#16a34a)
padding: 10px 14px
border-radius: 4px
font-size: 13px
```

Use for: check-in count, threesome flag, week complete, informational notes.

### Empty States

Every empty state: one-line description + primary action.

```
No players yet.
Add the first player to get started.
[Add Player →]
```

---

## Accessibility

- All form inputs have `aria-label` or associated `<label>`
- Minimum contrast: 4.5:1 on all body text (light palette meets this)
- Touch targets: 44×44px minimum on mobile; 28px minimum on desktop
- Score entry grid: full keyboard navigation (see Score Entry spec above)
- Attendance list: each toggle has `role="checkbox"` and `aria-checked`
- Match cards: `role="listitem"` within `role="list"`

---

## Print Stylesheet

`@media print` for pairings sheet (defined in `globals.css`):

- White background, black text
- Match cards: 2-column grid, clean borders
- Flags (repeat, gap) omitted
- Page title: "Week 4 — Spring 2026 · Oakwood CC · Apr 10"
- Font: Barlow (already loaded)
- Hide: nav bar, swap buttons, action bar, status indicators, standings sort picker

On the public week results sheet the standings sort picker is `print:hidden`, but the
"Sorted by &lt;season&gt; points" caption below the heading does print, so a printed sheet
states which order it is in.
