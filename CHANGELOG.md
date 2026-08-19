# Changelog

All notable changes to the Silicon Desert Golf League commissioner app are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.1.1] - 2026-08-19

### Changed

- The printable check-in sheet now fits 24 player rows per landscape page, with larger names and sheet data for easier reading at the course.

## [0.2.1.0] - 2026-08-18

### Changed

- Club membership is now a single yes/no per player instead of one record per club. Members of Oakwood are members at Ironwood and vice versa, so there is nothing course-specific to keep in step. Anyone already marked a member keeps their status.
- On the check-in sheet, the Mem? column now prints an empty box for members and leaves the cell blank for guests, so the boxes line up with the other check-off columns.
- The "paired with this season" column now uses initials instead of surnames, which fits a player's whole season of opponents on the line rather than trimming it to "+2".
- Saving the sheet as a PDF now names the file after the season and week, e.g. "Check-In Sheet - Summer 2026 Week 8.pdf".

### Fixed

- The right edge of the check-in sheet no longer prints off the page. The Today's Group column was being clipped because the on-screen scrolling container kept its padding when printing.

## [0.2.0.0] - 2026-08-18

### Added

- Printable Friday check-in sheet. "Print sheet" on the week page opens a landscape sheet built for the course, not the screen: one row per player with pen-sized Here?, CTP and LPM boxes, the player's handicap index, their course handicap for every nine in the rotation, everyone they have already been paired with this season, and blank space to pencil in that day's groups. Pairs that have already played together twice or more are flagged so nobody gets paired a third time. The full roster fits on two pages.
- Course membership. A player can now be recorded as a member of the club being played that day. The check-in sheet prints an X for members and an open box for everyone else, so the commissioner can see at a glance who owes a guest fee for the year-end prize pool. Membership is editable directly from the check-in sheet page.

## [0.1.3.1] - 2026-08-10

### Fixed

- Public results links now resolve the correct locked week when an unpublished duplicate uses the same calendar date.

## [0.1.3.0] - 2026-08-03

### Added

- Public week pages now use a date-based URL (`/public/weeks/2026-07-31`) instead of the internal database ID. Old ID-based links still resolve and redirect permanently to the new dated path, so existing bookmarks and shared links keep working.

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
