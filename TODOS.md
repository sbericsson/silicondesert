# TODOS — Silicon Desert Golf League App

## v2: Hole-by-hole match play tracking
**What:** Allow score entry to record which player won each hole (W/L/H per hole) instead of just the final result.
**Why:** Currently the commissioner enters "2 & 1" manually. With hole-by-hole data, the app computes the match play result automatically, eliminates a manual entry error vector, and enables per-player stats (best holes, strongest par-3s, etc.).
**Pros:** Eliminates manual match play result entry; enables career stats for the player-profile 10x vision.
**Cons:** 9 inputs per match instead of 1; more complex score entry UX.
**Context:** HoleScore already stores per-hole gross scores. Add a `matchPlayResult` field to HoleScore (W/L/H) and derive Match.matchPlayLeadBy + matchPlayHolesRemaining from it. Match table's stored integers become derived; keep them for performance or remove.
**Depends on:** Player-facing score entry (v2) — hole-by-hole is most useful when players enter their own scores.

## v2: Player-facing score entry
**What:** Each player logs into the app from their phone and enters their hole-by-hole gross scores during or after the round.
**Why:** Currently the commissioner enters all scores after collecting paper scorecards. Player-entry removes the commissioner's data entry burden entirely.
**Pros:** Commissioner's post-round work drops to review + lock. Players see their own handicap update in real time.
**Cons:** Requires player accounts, auth for 35 players, mobile-first score entry UX, and handling concurrent submissions (two players in the same match entering at the same time).
**Context:** Player model already has email field (optional). Add password hash, role field (player | commissioner). Score entry UX should work offline-first (spotty course WiFi). Gate behind feature flag so commissioner-only mode still works.
**Depends on:** Hole-by-hole match play tracking (above) — player entry pairs naturally with hole-by-hole data.

## v2: Light mode / system preference support
**What:** Add `prefers-color-scheme` support so the app uses a light theme on devices with light mode enabled.
**Why:** Score entry is primarily done at home on desktop after the round. A dark-only theme at a bright desktop may be tiring for extended use. Commissioner feedback after v1 will clarify if this is actually wanted.
**Pros:** Better desktop ergonomics; respects OS preference automatically.
**Cons:** Doubles the CSS token surface area; requires all design tokens to have both dark and light values; Tailwind dark mode config change required.
**Context:** v1 uses dark-only (`#0f1117` background, `#4b9e6f` accent). All design tokens are in `tailwind.config.ts`. To add light mode: add `darkMode: 'class'` or `'media'` in config, duplicate tokens for light variants. Primary use case is desktop score entry, not mobile check-in/pairings.
**Depends on:** Nothing. Self-contained styling change.
