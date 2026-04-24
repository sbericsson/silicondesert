#!/usr/bin/env python3

import argparse
import csv
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Tuple
from xml.etree import ElementTree as ET
from zipfile import ZipFile


SPREADSHEET_NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SHEET_REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
CURRENT_LEAGUE_DATES = {"2026-04-10", "2026-04-17"}
HISTORICAL_CUTOFF_DATE = "2026-04-10"


@dataclass(frozen=True)
class DifferentialRow:
    player_name: str
    played_on: str
    provided_differential: float
    source_sheet: str
    source_cell: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Transform the simple historical differential matrix into a normalized CSV "
            "and transactional Postgres import SQL."
        )
    )
    parser.add_argument("workbook", help="Path to the .xlsx workbook")
    parser.add_argument(
        "--out-dir",
        default="outputs/historical-differential-import",
        help="Directory to write generated CSV/SQL artifacts",
    )
    return parser.parse_args()


def column_name(column_number: int) -> str:
    name = ""
    current = column_number
    while current:
        current, remainder = divmod(current - 1, 26)
        name = chr(65 + remainder) + name
    return name


def column_number(cell_reference: str) -> int:
    letters = re.match(r"([A-Z]+)", cell_reference).group(1)
    value = 0
    for char in letters:
        value = value * 26 + ord(char) - 64
    return value


def row_number(cell_reference: str) -> int:
    return int(re.search(r"(\d+)$", cell_reference).group(1))


def excel_serial_to_iso_date(value: str) -> str:
    return (datetime(1899, 12, 30) + timedelta(days=float(value))).date().isoformat()


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def load_sheet_cells(workbook_path: Path) -> Tuple[str, Dict[str, str]]:
    with ZipFile(workbook_path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        workbook_rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            relationship.attrib["Id"]: relationship.attrib["Target"]
            for relationship in workbook_rels
        }

        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_strings_tree = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for string_item in shared_strings_tree.findall("a:si", SPREADSHEET_NS):
                shared_strings.append(
                    "".join(
                        node.text or ""
                        for node in string_item.iterfind(".//a:t", SPREADSHEET_NS)
                    )
                )

        sheet = workbook.find("a:sheets", SPREADSHEET_NS)[0]
        sheet_name = sheet.attrib["name"]
        sheet_target = "xl/" + relationship_map[sheet.attrib[SHEET_REL_NS]]
        worksheet = ET.fromstring(archive.read(sheet_target))

        cells: Dict[str, str] = {}
        for cell in worksheet.find("a:sheetData", SPREADSHEET_NS).iterfind(".//a:c", SPREADSHEET_NS):
            reference = cell.attrib["r"]
            value = ""
            value_node = cell.find("a:v", SPREADSHEET_NS)
            if value_node is not None and value_node.text is not None:
                value = value_node.text
                if cell.attrib.get("t") == "s":
                    value = shared_strings[int(value)]

            inline_string = cell.find("a:is", SPREADSHEET_NS)
            if inline_string is not None:
                value = "".join(
                    node.text or ""
                    for node in inline_string.iterfind(".//a:t", SPREADSHEET_NS)
                )

            cells[reference] = value

    return sheet_name, cells


def extract_player_headers(cells: Dict[str, str]) -> Dict[int, str]:
    headers: Dict[int, str] = {}
    for reference, value in cells.items():
        if row_number(reference) != 1:
            continue

        col = column_number(reference)
        if col == 1:
            continue

        player_name = normalize_name(value)
        if player_name:
            headers[col] = player_name

    return headers


def extract_rows(sheet_name: str, cells: Dict[str, str]) -> Tuple[List[DifferentialRow], List[dict]]:
    headers = extract_player_headers(cells)
    rows: List[DifferentialRow] = []
    rejects: List[dict] = []
    seen = set()

    for reference, raw_date in cells.items():
        if column_number(reference) != 1 or row_number(reference) == 1:
            continue

        try:
            played_on = excel_serial_to_iso_date(raw_date)
        except ValueError:
            rejects.append(
                {
                    "player_name": "",
                    "played_on": raw_date,
                    "provided_differential": "",
                    "source_sheet": sheet_name,
                    "source_cell": reference,
                    "reason": "invalid_round_date",
                }
            )
            continue

        row = row_number(reference)
        for col, player_name in headers.items():
            value_reference = f"{column_name(col)}{row}"
            raw_value = cells.get(value_reference, "").strip()
            if not raw_value:
                continue

            try:
                provided_differential = float(raw_value)
            except ValueError:
                rejects.append(
                    {
                        "player_name": player_name,
                        "played_on": played_on,
                        "provided_differential": raw_value,
                        "source_sheet": sheet_name,
                        "source_cell": value_reference,
                        "reason": "invalid_differential",
                    }
                )
                continue

            duplicate_key = (player_name.lower(), played_on)
            if duplicate_key in seen:
                rejects.append(
                    {
                        "player_name": player_name,
                        "played_on": played_on,
                        "provided_differential": provided_differential,
                        "source_sheet": sheet_name,
                        "source_cell": value_reference,
                        "reason": "duplicate_player_date",
                    }
                )
                continue

            seen.add(duplicate_key)
            rows.append(
                DifferentialRow(
                    player_name=player_name,
                    played_on=played_on,
                    provided_differential=provided_differential,
                    source_sheet=sheet_name,
                    source_cell=value_reference,
                )
            )

    return sorted(rows, key=lambda row: (row.played_on, row.player_name)), rejects


def write_csv(path: Path, rows: Iterable[dict], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def sql_literal(value: str) -> str:
    return value.replace("'", "''")


def build_import_sql(csv_path: Path) -> str:
    csv_literal = sql_literal(str(csv_path.resolve()))
    current_dates = ", ".join(f"DATE '{date}'" for date in sorted(CURRENT_LEAGUE_DATES))

    return f"""\\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _legacy_differential_import (
  "player_name" TEXT NOT NULL,
  "played_on" DATE NOT NULL,
  "provided_differential" DOUBLE PRECISION NOT NULL,
  "source_sheet" TEXT NOT NULL,
  "source_cell" TEXT NOT NULL
);

\\copy _legacy_differential_import ("player_name","played_on","provided_differential","source_sheet","source_cell") FROM '{csv_literal}' WITH (FORMAT csv, HEADER true)

CREATE TEMP TABLE _legacy_differential_resolved AS
SELECT
  source.*,
  player_match."id" AS player_id
FROM _legacy_differential_import source
LEFT JOIN LATERAL (
  SELECT p."id"
  FROM "Player" p
  WHERE regexp_replace(lower(p."name"), '\\s+', ' ', 'g')
      = regexp_replace(lower(source."player_name"), '\\s+', ' ', 'g')
  ORDER BY p."createdAt" ASC, p."id" ASC
  LIMIT 1
) player_match ON true;

CREATE TEMP TABLE _legacy_differential_unmatched_players AS
SELECT DISTINCT "player_name"
FROM _legacy_differential_resolved
WHERE player_id IS NULL
ORDER BY "player_name";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _legacy_differential_unmatched_players) THEN
    RAISE EXCEPTION 'Spreadsheet contains players that do not exist in the app. See _legacy_differential_unmatched_players.';
  END IF;
END $$;

CREATE TEMP TABLE _legacy_current_rounds AS
SELECT
  source.*,
  week_record."id" AS week_id,
  handicap_record."id" AS handicap_record_id,
  handicap_record."grossScore" AS existing_gross_score,
  handicap_record."adjustedGrossScore" AS existing_adjusted_gross_score
FROM _legacy_differential_resolved source
LEFT JOIN "Week" week_record
  ON week_record."date"::DATE = source."played_on"
LEFT JOIN "HandicapRecord" handicap_record
  ON handicap_record."playerId" = source.player_id
 AND handicap_record."weekId" = week_record."id"
WHERE source."played_on" IN ({current_dates});

CREATE TEMP TABLE _legacy_missing_current_rounds AS
SELECT *
FROM _legacy_current_rounds
WHERE handicap_record_id IS NULL
ORDER BY "played_on", "player_name";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _legacy_missing_current_rounds) THEN
    RAISE EXCEPTION 'Spreadsheet contains April 10/17 differentials without existing app score records. See _legacy_missing_current_rounds.';
  END IF;
END $$;

CREATE TEMP TABLE _legacy_affected_players AS
SELECT DISTINCT player_id
FROM _legacy_differential_resolved;

DELETE FROM "HandicapRecord" hr
USING _legacy_affected_players affected
WHERE hr."playerId" = affected.player_id
  AND hr."weekId" IS NULL
  AND hr."isImported" = true;

UPDATE "HandicapRecord" hr
SET
  "countsForHandicap" = false,
  "usedInIndex" = false
FROM _legacy_affected_players affected
WHERE hr."playerId" = affected.player_id
  AND hr."date"::DATE < DATE '{HISTORICAL_CUTOFF_DATE}';

INSERT INTO "HandicapRecord" (
  "id",
  "playerId",
  "weekId",
  "date",
  "grossScore",
  "adjustedGrossScore",
  "courseRating",
  "slopeRating",
  "coursePar",
  "courseDifferential",
  "usedInIndex",
  "isImported",
  "countsForHandicap"
)
SELECT
  'legacy-diff-' || md5(source.player_id || ':' || source."played_on"::TEXT),
  source.player_id,
  NULL,
  source."played_on"::TIMESTAMP + INTERVAL '7 hours',
  0,
  0,
  0 - source."provided_differential",
  113,
  36,
  source."provided_differential",
  false,
  true,
  true
FROM _legacy_differential_resolved source
WHERE source."played_on" < DATE '{HISTORICAL_CUTOFF_DATE}'
ON CONFLICT ("playerId","date","grossScore")
DO UPDATE SET
  "adjustedGrossScore" = EXCLUDED."adjustedGrossScore",
  "courseRating" = EXCLUDED."courseRating",
  "slopeRating" = EXCLUDED."slopeRating",
  "coursePar" = EXCLUDED."coursePar",
  "courseDifferential" = EXCLUDED."courseDifferential",
  "weekId" = NULL,
  "isImported" = true,
  "countsForHandicap" = true;

UPDATE "HandicapRecord" hr
SET
  "courseDifferential" = current_round."provided_differential",
  "countsForHandicap" = true
FROM _legacy_current_rounds current_round
WHERE hr."id" = current_round.handicap_record_id;

UPDATE "HandicapRecord" hr
SET "usedInIndex" = false
WHERE hr."playerId" IN (SELECT player_id FROM _legacy_affected_players);

WITH recent AS (
  SELECT
    hr."id",
    hr."playerId",
    hr."courseDifferential",
    hr."date",
    hr."createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY hr."playerId"
      ORDER BY hr."date" DESC, hr."createdAt" DESC, hr."id" DESC
    ) AS recent_rank,
    COUNT(*) OVER (PARTITION BY hr."playerId") AS total_records
  FROM "HandicapRecord" hr
  WHERE hr."playerId" IN (SELECT player_id FROM _legacy_affected_players)
    AND hr."countsForHandicap" = true
),
recent_twenty AS (
  SELECT
    recent.*,
    LEAST(recent.total_records, 20) AS recent_count
  FROM recent
  WHERE recent.recent_rank <= 20
),
scored AS (
  SELECT
    recent_twenty.*,
    CASE
      WHEN recent_twenty.recent_count <= 5 THEN 1
      WHEN recent_twenty.recent_count <= 8 THEN 2
      WHEN recent_twenty.recent_count <= 11 THEN 3
      WHEN recent_twenty.recent_count <= 14 THEN 4
      WHEN recent_twenty.recent_count <= 16 THEN 5
      WHEN recent_twenty.recent_count <= 18 THEN 6
      WHEN recent_twenty.recent_count = 19 THEN 7
      ELSE 8
    END AS use_count,
    ROW_NUMBER() OVER (
      PARTITION BY recent_twenty."playerId"
      ORDER BY recent_twenty."courseDifferential" ASC, recent_twenty."date" ASC, recent_twenty."createdAt" ASC, recent_twenty."id" ASC
    ) AS differential_rank
  FROM recent_twenty
)
UPDATE "HandicapRecord" hr
SET "usedInIndex" = true
FROM scored
WHERE hr."id" = scored."id"
  AND scored.differential_rank <= scored.use_count;

SELECT COUNT(*) AS spreadsheet_rows FROM _legacy_differential_import;
SELECT COUNT(*) AS historical_insert_rows
FROM _legacy_differential_resolved
WHERE "played_on" < DATE '{HISTORICAL_CUTOFF_DATE}';
SELECT COUNT(*) AS current_week_differential_updates
FROM _legacy_current_rounds;
SELECT COUNT(*) AS affected_players
FROM _legacy_affected_players;

COMMIT;
"""


def main() -> None:
    args = parse_args()
    workbook_path = Path(args.workbook).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()

    sheet_name, cells = load_sheet_cells(workbook_path)
    rows, rejects = extract_rows(sheet_name, cells)

    import_csv_path = out_dir / "historical_differentials_import.csv"
    rejects_csv_path = out_dir / "historical_differentials_rejects.csv"
    sql_path = out_dir / "historical_differentials_import.sql"
    summary_path = out_dir / "historical_differentials_summary.json"

    write_csv(
        import_csv_path,
        [
            {
                "player_name": row.player_name,
                "played_on": row.played_on,
                "provided_differential": row.provided_differential,
                "source_sheet": row.source_sheet,
                "source_cell": row.source_cell,
            }
            for row in rows
        ],
        ["player_name", "played_on", "provided_differential", "source_sheet", "source_cell"],
    )
    write_csv(
        rejects_csv_path,
        rejects,
        ["player_name", "played_on", "provided_differential", "source_sheet", "source_cell", "reason"],
    )
    sql_path.write_text(build_import_sql(import_csv_path), encoding="utf-8")

    summary = {
        "workbook": str(workbook_path),
        "sheet_name": sheet_name,
        "player_columns": len(extract_player_headers(cells)),
        "accepted_rows": len(rows),
        "rejected_rows": len(rejects),
        "date_range": {
            "min": min((row.played_on for row in rows), default=None),
            "max": max((row.played_on for row in rows), default=None),
        },
        "current_league_rows_to_patch": sum(1 for row in rows if row.played_on in CURRENT_LEAGUE_DATES),
        "historical_rows_to_insert": sum(1 for row in rows if row.played_on < HISTORICAL_CUTOFF_DATE),
        "entries_by_player": Counter(row.player_name for row in rows),
        "rejection_reasons": Counter(reject["reason"] for reject in rejects),
        "files": {
            "import_csv": str(import_csv_path),
            "rejects_csv": str(rejects_csv_path),
            "import_sql": str(sql_path),
            "summary": str(summary_path),
        },
        "notes": [
            "Rows before 2026-04-10 are inserted as weekless imported handicap records.",
            "Rows on 2026-04-10 and 2026-04-17 update only courseDifferential/countsForHandicap on existing week-linked records.",
            "Existing records before 2026-04-10 for affected players are kept for history but excluded from handicap calculations.",
            "The SQL runs in one transaction and aborts on unmatched players or missing current-week score records.",
        ],
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
