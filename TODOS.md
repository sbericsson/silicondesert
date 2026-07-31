# TODOS — Silicon Desert Golf League App

Grouped by component, then priority (P0 highest through P4, then Completed).

## Design System

### Accent color fails WCAG AA contrast
**Priority:** P1
**What:** `--accent` (#16a34a) with white text measures 3.3:1. WCAG AA needs 4.5:1 for normal-size text. Every primary button, count badge, and active nav pill in the app inherits this.
**Why:** DESIGN.md:359 states "Minimum contrast: 4.5:1 on all body text (light palette meets this)" — that claim is wrong today. DESIGN.md:326 simultaneously blesses white-on-accent for all primary CTAs, so the whole app is built on the failing pair.
**Pros:** Fixes accessibility across the entire app in one token change; makes DESIGN.md truthful.
**Cons:** Touches every accent surface — needs a visual pass over buttons, badges, nav pills, and status bars. Darkening `--accent` may make `--accent-hover` (#15803d, 5.0:1) too close to the resting state, so both tokens likely move together.
**Context:** Found during /ship review of v0.1.2.0 by cross-model agreement (Claude design pass + Codex). Deliberately NOT fixed in the print-view sort control, because fixing one component in isolation would make it diverge from the Print button directly above it. `--accent-hover` #15803d already passes at 5.0:1 and is a candidate resting value. Tokens live in `app/globals.css`; mapped in `tailwind.config.ts`.
**Depends on:** Nothing. Self-contained token change plus a visual sweep.

### Light mode / system preference support
**Priority:** P3
**What:** Add `prefers-color-scheme` support so the app uses a light theme on devices with light mode enabled.
**Why:** Score entry is primarily done at home on desktop after the round. A dark-only theme at a bright desktop may be tiring for extended use. Commissioner feedback after v1 will clarify if this is actually wanted.
**Pros:** Better desktop ergonomics; respects OS preference automatically.
**Cons:** Doubles the CSS token surface area; requires all design tokens to have both dark and light values; Tailwind dark mode config change required.
**Context:** v1 uses dark-only (`#0f1117` background, `#4b9e6f` accent). All design tokens are in `tailwind.config.ts`. To add light mode: add `darkMode: 'class'` or `'media'` in config, duplicate tokens for light variants. Primary use case is desktop score entry, not mobile check-in/pairings.
**Depends on:** Nothing. Self-contained styling change.

## Score Entry

### Hole-by-hole match play tracking
**Priority:** P2
**What:** Allow score entry to record which player won each hole (W/L/H per hole) instead of just the final result.
**Why:** Currently the commissioner enters "2 & 1" manually. With hole-by-hole data, the app computes the match play result automatically, eliminates a manual entry error vector, and enables per-player stats (best holes, strongest par-3s, etc.).
**Pros:** Eliminates manual match play result entry; enables career stats for the player-profile 10x vision.
**Cons:** 9 inputs per match instead of 1; more complex score entry UX.
**Context:** HoleScore already stores per-hole gross scores. Add a `matchPlayResult` field to HoleScore (W/L/H) and derive Match.matchPlayLeadBy + matchPlayHolesRemaining from it. Match table's stored integers become derived; keep them for performance or remove.
**Depends on:** Player-facing score entry (below) — hole-by-hole is most useful when players enter their own scores.

### Player-facing score entry
**Priority:** P2
**What:** Each player logs into the app from their phone and enters their hole-by-hole gross scores during or after the round.
**Why:** Currently the commissioner enters all scores after collecting paper scorecards. Player-entry removes the commissioner's data entry burden entirely.
**Pros:** Commissioner's post-round work drops to review + lock. Players see their own handicap update in real time.
**Cons:** Requires player accounts, auth for 35 players, mobile-first score entry UX, and handling concurrent submissions (two players in the same match entering at the same time).
**Context:** Player model already has email field (optional). Add password hash, role field (player | commissioner). Score entry UX should work offline-first (spotty course WiFi). Gate behind feature flag so commissioner-only mode still works.
**Depends on:** Hole-by-hole match play tracking (above) — player entry pairs naturally with hole-by-hole data.

## Completed

_Nothing recorded yet. Completed items move here with a `**Completed:** vX.Y.Z.W (YYYY-MM-DD)` line._
