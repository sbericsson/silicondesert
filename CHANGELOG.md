# Changelog

All notable changes to the Silicon Desert Golf League commissioner app are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
