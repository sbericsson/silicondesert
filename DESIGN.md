# DESIGN.md — Silicone Desert Golf League Commissioner App

Generated from `/plan-design-review` on 2026-03-29. This is the design source of truth.
All implementation decisions calibrate against this file.

---

## App Classification

**APP UI** — commissioner workspace tool. Data-dense, task-focused, single user. Not a marketing page. No hero sections, no feature grids, no decorative elements.

Primary use context:
- **Check-in + Pairings:** phone, outdoors, bright sunlight, Friday afternoon
- **Score Entry:** desktop or laptop, home, Friday evening or Saturday morning

---

## Color System

All tokens live in `tailwind.config.ts` under `extend.colors`. Do not use Tailwind's default palette directly for brand/UI colors.

```ts
// tailwind.config.ts
extend: {
  colors: {
    surface: {
      base:     '#0f1117', // body background
      elevated: '#1a1f2e', // cards, nav bar, modals
      sunken:   '#131720', // table headers, input backgrounds, dividers
      border:   '#2a3040', // all borders
    },
    text: {
      primary:   '#f0f0f0',
      secondary: '#9ca3af',
      muted:     '#4b5563',
      disabled:  '#3a4050',
    },
    accent: {
      DEFAULT: '#4b9e6f', // primary CTA, checked state, success — muted fairway green
      hover:   '#3d8a5e',
      dim:     '#1a2818', // accent-tinted surface (CTP row, success states)
      text:    '#6fcf97', // accent-colored text on dark backgrounds
    },
    warning: {
      DEFAULT: '#f59e0b', // ESC-adjusted scores, handicap gap flags
      dim:     '#2d1f0e', // warning-tinted surface
      text:    '#fcd34d', // warning text on dark backgrounds
    },
    danger: {
      DEFAULT: '#ef4444',
      dim:     '#2d1010',
      text:    '#fca5a5',
    },
    info: {
      dim:  '#1e3a5f', // threesome badge background
      text: '#93c5fd', // threesome badge text
    },
  },
}
```

**Color mode:** Dark only in v1. No `prefers-color-scheme` handling. All components assume dark surface.

---

## Typography

```ts
// tailwind.config.ts + app/layout.tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
```

No system font stacks. No `font-sans` default. Use `font-[Inter]` or set `fontFamily.sans` to `['Inter', ...defaultTheme.fontFamily.sans]` in config.

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Screen title | 20px / `text-xl` | 700 | `text-primary` |
| Section label | 11px / `text-xs` | 600 | `text-muted`, uppercase, 0.06em tracking |
| Player name | 15px / `text-sm` | 500–600 | `text-primary` |
| Handicap index | 13px | 500 | `text-secondary` |
| Table header | 11px | 600 | `text-muted`, uppercase |
| Table cell | 14–15px | 400–500 | `text-primary` |
| Score input | 18px | 700 | `text-primary` |
| Meta / subtext | 12px | 400–500 | `text-secondary` |
| Badge / flag | 11px | 600 | varies by badge type |

---

## Spacing & Density

Base unit: 4px (Tailwind default).

| Context | Padding |
|---------|---------|
| Screen horizontal padding | 16px (`px-4`) |
| Player row (mobile) | `py-2.5` (10px top/bottom) |
| Card inner padding | `p-3` (12px) or `p-4` (16px) |
| Section header gap | `mb-2.5` (10px) |
| Bottom nav item | `py-2.5 pb-2` |

Touch targets: minimum 44×44px on all interactive elements (mobile).

---

## Border Radius

Consistent scale — not uniform bubbly on everything:

| Element | Radius |
|---------|--------|
| Cards, match cards | `rounded-xl` (10–12px) |
| Buttons | `rounded-lg` (8–10px) |
| Input fields | `rounded-md` (6px) |
| Badges, flags | `rounded` (4px) |
| Score input cells | `rounded-md` (6px) |
| Toggle checkboxes | `rounded-md` (6px) |
| Progress dots | `rounded-full` |

---

## Navigation

**Bottom nav (4 items):**

```
[🗓 Week] [🏆 Standings] [👥 Roster] [📜 History]
```

- Fixed at bottom, `max-w-[430px]` on mobile, full-width above
- Active item: `accent.DEFAULT` color + `accent.DEFAULT` border-top
- Inactive: `text-muted`
- Icon size: 18px, label: 10px

**Week tab has two sub-tabs:**
- `Check-in | Pairings`
- Commissioner bounces between these all Friday afternoon
- Both always accessible once a week is active
- Sub-tab indicator: `accent.DEFAULT` bottom border on active tab

**Score Entry** is not a nav destination. It's a full-screen push launched by tapping "Enter Scores →" on a match card in the Pairings sub-tab.

---

## Screen Specs

### Week / Check-in Tab

**Header:**
```
Silicone Desert Golf League          (11px, muted, uppercase)
Week 4 — Spring 2026                 (20px, bold, primary)
Oakwood CC · Course A · Today        (12px, accent.text)
```

Course selector: dropdown in header, required before "Generate Pairings" activates.

**Status bar** (shown when ≥1 player checked in):
- Accent-tinted background (`accent.dim`), left border `accent.DEFAULT`
- Text: "12 players checked in · Threesome will form" (odd count warning inline)

**Attendance list:**
- Checked-in players first (sorted to top), bold name, filled green dot
- Not-yet-arrived below: muted name, empty circle dot
- Tap anywhere on row to toggle
- Player row: `[dot] [Name] [HCP or PRO badge]`
- PRO badge: amber (`warning.text`) italic — players with < 3 rounds

**CTP + LP selectors:**
- 2-column grid below the player list
- Each: label (11px muted uppercase) + selected value (17px bold) or "— Select" (muted)
- Tap to open hole picker (1–9, must be a par-3 for CTP — invalid holes should be marked)

**Generate Pairings CTA:**
- Full-width, `accent.DEFAULT` background, 16px bold
- Disabled state: `surface.elevated` bg, `text-disabled` text
- Disabled label explains why: "Need ≥2 players" or "Select CTP hole first"

**Empty state (no week yet):**
```
Week 5 — Spring 2026
Friday, Apr 17

Course: [Oakwood A ▼]

[Start Week 5 →]
```

---

### Week / Pairings Tab

**Match cards:**

```
┌─────────────────────────────────┐
│ Match 1              [flag]     │  ← header bar (sunken bg)
│─────────────────────────────────│
│ Mike Sanderson           HCP 14 │  ← player row + swap button
│          vs                     │  ← divider (sunken bg, tiny)
│ Dave Torres              HCP 11 │
│─────────────────────────────────│
│ Gap: 2.8  [▓▓▓░░░░░░░]          │  ← gap indicator bar
└─────────────────────────────────┘
```

**Flags:**
- Repeat match: `danger.dim` card border + `danger.text` badge "⚠ Played 2× this season"
- Handicap gap > 6: `warning.dim` card border + `warning.text` badge "Gap: 8.1"
- Threesome: `info.dim` border + `info.text` badge "Threesome" + subtext explaining pivot

**After lock — match cards shift to score-entry mode:**
```
┌─────────────────────────────────┐
│ Match 1          ✓ Complete     │  ← green checkmark when done
│ Mike 3pts · Dave 2pts           │
│                [Enter Scores →] │  ← primary action when pending
└─────────────────────────────────┘
```

**Progress header:** "4 of 17 matches scored"

**Threesome section:** Labeled "Threesome (last group out)" with `info.dim` section header. Pivot player labeled "(pivot)" in small muted text. Note: "Ray's scorecard also refs Match 5."

**Action bar (before lock):**
- `[🖨 Print]` secondary button (1/3 width) + `[Lock Pairings →]` primary (2/3 width)
- After lock: `[Unlock]` secondary + `[Print]` secondary — no primary CTA needed

**Week complete banner:**
```
✓ All 17 matches scored · Standings updated
```
Shown in `accent.dim` tinted banner when all match scores are submitted.

---

### Score Entry

**Responsive:**
- Mobile (<768px): tabbed per-player
- Desktop (≥768px): side-by-side scorecard table, `max-w-[900px]` centered

**Desktop table columns:**
`Hole | Par | SI | [Player 1] Gross | [Player 1] Net | [Player 2] Gross | [Player 2] Net`

**Visual states for score cells:**
- Empty: `text-disabled`, shows `—`
- Filled: `accent.dim` background, `accent.text` text
- ESC-adjusted (gross capped at net double bogey): `warning.dim` background, `warning.text` text
- CTP hole row: entire row has `accent.dim` left-border highlight; CTP badge on hole number

**Keyboard navigation (desktop):**
Tab order: P1H1 → P2H1 → P1H2 → P2H2 → ... → P1H9 → P2H9 → match play dropdown → submit.
Enter submits when submit button is focused. Escape closes without saving.

**Match play result dropdown values:**
`All square | 1 up | 2 & 1 | 3 & 2 | 4 & 3 | 5 & 4 | 6 & 5 | 7 & 6 | 8 & 7`

**Submit button states:**
- Incomplete: `surface.elevated` bg, `text-disabled`, shows remaining holes count: "Submit Scores (5 holes remaining)"
- Ready: `accent.DEFAULT` bg, white text, "Submit Scores"
- Saving: spinner + "Saving..."

---

### Standings

**Three tabs:** `[Spring] [Summer] [Overall]`

- Active season tab highlighted with `accent.DEFAULT` underline
- Spring tab always accessible (even during Summer season)
- Overall tab = combined Spring + Summer points for year champion

**Table columns:** `# | Player | Pts | Stroke W | Match W | CTP | LP`

Sortable by all numeric columns. Default sort: Pts descending.

**Empty state:** "No matches played this season yet."

---

### Roster

**Two sections:**

1. **Players (N)** — list with name, HCP index, active/inactive toggle, tap to view history
2. **⚙ Admin** — collapsed by default, expands to:
   - Manage Seasons (create season, view schedule)
   - Import CSV (historical differentials)
   - Course Setup (name, par, rating, slope for each of the 3 Oakwood courses)

**PRO indicator:** Players with < 3 rounds show "PRO" badge (amber) instead of HCP number. Players with 0 rounds and a seed index show "EST" badge (muted).

**Season Setup flow (via Manage Seasons):**
1. Create season: name, type (spring/summer), start date, end date
2. Enter all Friday dates (date picker, weekly frequency helper)
3. Week records pre-created with no course assigned
4. Each Friday: course selected on Check-in tab header

---

### History

**Week list:** Each row = week number, date, course, match count, locked status.

Tap a week to expand: match results, pair list, CTP/LP winners.

**Pair history view:** Shows per-season and cross-season pair counts. Informational only — the pairing algorithm only uses current season history.

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
| Primary | Main CTA (Generate, Lock, Submit) | `accent.DEFAULT` bg, white, `rounded-lg`, full-width on mobile |
| Secondary | Supporting actions (Print, Regenerate) | `surface.elevated` bg, `text-secondary`, border |
| Destructive | Unlock | `danger.dim` bg, `danger.text` |
| Ghost | Swap, close | Transparent, `text-muted`, icon-only |

### Status / Info Bars

Left-border accent bars for contextual status:
```css
background: accent.dim;
border-left: 3px solid accent.DEFAULT;
padding: 10px 14px;
border-radius: 4px;
font-size: 13px;
```

Use for: check-in count, threesome flag, week complete, informational notes.

### Empty States

Every empty state needs: an icon or illustration (simple, not stock), a one-line description, and a primary action.

```
[icon]
No players yet.
Add the first player to get started.
[Add Player →]
```

---

## Print Stylesheet

`@media print` required for pairings sheet:

- White background, black text (`#000`)
- Match cards: 2-column grid, clean borders
- Flags (repeat, gap) omitted — informational only, not needed on paper
- Page title: "Week 4 — Spring 2026 · Oakwood CC · Apr 10"
- Font: Inter or fallback system serif — no icon fonts
- Hide: nav bar, swap buttons, action bar, status indicators

---

## Accessibility

- All form inputs have `aria-label` or associated `<label>`
- Minimum contrast: 4.5:1 on all body text (the token palette above meets this)
- Touch targets: 44×44px minimum on mobile
- Score entry grid (desktop): full keyboard navigation (see Score Entry spec above)
- Attendance list: each toggle has `role="checkbox"` and `aria-checked`
- Match cards: `role="listitem"` within a `role="list"`

---

## Wireframes

HTML wireframes (reference, not final):

```
~/.gstack/projects/silicon/designs/wireframes-20260329/
  weekly-dashboard.html
  pairings-generator.html
  score-entry.html
```

Open in browser to see the visual direction. These reflect the dark palette, layout, and component style described above.

To generate high-fidelity mockups, set `OPENAI_API_KEY` and run:
```bash
~/.claude/skills/gstack/design/dist/design variants \
  --brief "..." \
  --count 3 \
  --output-dir ~/.gstack/projects/silicon/designs/
```
