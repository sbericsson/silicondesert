# Changelog

All notable changes to the Silicon Desert Golf League commissioner app are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.2.5] - 2026-08-01

### Changed

- Internal cleanup of the player name sorting/surname logic (no user-facing change): removed duplicate normalization code and added test coverage for the less common name-suffix formats (Sr, Sr., Jr., II, IV).

## [0.1.2.4] - 2026-08-01

### Fixed

- A player name ending in a suffix like "Jr" or "III" (e.g. "Lowell Vande Kamp Jr") had that suffix treated as the whole surname on the standings and match results pages, instead of the actual last name. The suffix now stays attached after the surname ("Vande Kamp Jr") rather than replacing it.

## [0.1.2.3] - 2026-08-01

### Fixed

- A player whose first name happened to match a surname-prefix word (e.g. "Van" as in "Van Morrison") had that first name swallowed into the surname when the previous fix reused the standings' compound-surname logic, so the match results page would show the full name instead of just the last name. The surname extraction now always leaves the given name intact.

## [0.1.2.2] - 2026-08-01

### Fixed

- The hole-by-hole match results page compared to the standings page named the same match-play winner two different ways: a player with a compound surname like "Vande Kamp" won a hole as "Kamp" in that table but appeared correctly as "Vande Kamp" everywhere else. Hole winners, match state ("Vande Kamp 1 up"), and clinched-match text now use the same surname logic as standings.

## [0.1.2.1] - 2026-07-30

### Fixed

- The standings table on the printable week results page had ragged row spacing: the player column was being squeezed to nothing, so longer names wrapped onto a second line and those rows printed taller than the rest. Names now sit on one line and every row is the same height. The numbers also spread evenly across the sheet instead of bunching to the right.
- The standings heading no longer strands itself at the foot of a page with its table starting on the next one, and a player's row no longer splits across a page break.

## [0.1.2.0] - 2026-07-30

### Added

- The printable week results page now lets you choose how the standings are ordered before you print. Pick Overall, Summer, or Spring and the table renumbers to match, with the column you sorted by shown in bold. The picker itself does not print; instead the sheet carries a line reading "Sorted by Summer points" so anyone holding the paper knows what they are looking at. Leagues running a single season see no picker, since there is only one points column to order by.

### Changed

- The sort buttons meet the 44px touch target the design system calls for, and keep a visible keyboard focus ring.

## [0.1.1.3] - 2026-07-25

### Fixed

- Spreadsheet comparison standings now bold only the active validation sort column.

## [0.1.1.2] - 2026-07-25

### Fixed

- Standings values now bold only the column currently used for sorting on public and commissioner pages.

## [0.1.1.1] - 2026-07-25

### Changed

- Players with the surname prefix "Vande" now sort under V. Lowell Vande Kamp appears with the V names across roster, standings, and pairing views.

## [0.1.1.0] - 2026-07-25

### Added

- The pairings card now names the holes where a pop lands, so you can read the tee sheet without working out the stroke index by hand. A match reads "Natasha Ericsson gets 6 pops on holes 1, 3, 5, 6, 8, 9." When a player carries more than nine pops, the holes worth two strokes are called out separately.

### Fixed

- In a threesome, the player matched against a reference scorecard now shows that opponent in the check-in list. Previously the whole reference row was skipped, so that player showed no past opponents for the week at all. The anchor player, who only lends the scorecard, correctly does not pick up the scorecard player as an opponent.
- Repeat-pairing warnings now count reference-scorecard matches, matching what pairing generation already did. Two players who met through a reference scorecard are flagged if you pair them again.
- The score entry screen reported the wrong pop total. It read the count off a single hole rather than summing them, so a player with twelve pops was shown as having two.
