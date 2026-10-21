"""Extract BUHASA Smart 3D leaf codelists without modifying the source workbook.

Install: python -m pip install xlrd==2.0.2
Run: python scripts/extract_buhasa_codelists.py C:/SPEC/AllCodeLists-BUHASA.xls

Aliases are sheet-scoped candidate lists, not automatic matching decisions.
"""
from __future__ import annotations

import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path
import re

import xlrd


ROOT = Path(__file__).resolve().parents[1]
SHEETS = (
    "FlangeFacing", "EndPreparation", "PressureRating", "ScheduleThickness",
    "MaterialsGrade", "MaterialsOfConstructionClass", "BoltType", "PipingCommodityType",
)


def text(value):
    """Trim cell boundaries while retaining identifiers and description spelling."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip() if value is not None else ""


def header_key(value):
    return re.sub(r"\s+", "", text(value)).casefold()


def numeric_code(value):
    try:
        number = Decimal(text(value))
    except InvalidOperation:
        raise ValueError(f"Non-numeric codelist number: {value!r}") from None
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError(f"Codelist number must be a finite integer: {value!r}")
    return int(number)


def parse_sheet(sheet):
    """Read HEAD/START/END, emit leaves, and carry ancestor values forward.

    A parent's numeric code belongs to its declaration row, never to its leaves.
    A new ancestor clears all descendants, preventing stale inherited context.
    Only description columns resolve merged cells; codes are never filled down.
    """
    merged = {}
    for row_start, row_end, col_start, col_end in sheet.merged_cells:
        for col in range(col_start, col_end):
            merged.setdefault(col, []).append((row_start, row_end, col_start))

    def cell(row, col):
        for start, end, anchor_col in merged.get(col, []):
            if start <= row < end:
                return text(sheet.cell_value(start, anchor_col))
        return text(sheet.cell_value(row, col))

    levels = None
    parents = []
    active = False
    started = ended = False
    output = []
    for row in range(sheet.nrows):
        marker = text(sheet.cell_value(row, 0)).upper()
        if marker.startswith("!"):
            continue
        if marker == "HEAD":
            if started:
                raise ValueError("Unexpected HEAD inside data section")
            headers = [header_key(value) for value in sheet.row_values(row)]
            shorts = [i for i, value in enumerate(headers) if value.endswith("shortdescription")]
            if not shorts or headers.count("codelistnumber") != 1:
                raise ValueError("HEAD requires description columns and one CodelistNumber")
            levels = []
            for col in shorts:
                prefix = headers[col].removesuffix("shortdescription")
                long_key = prefix + "longdescription"
                if headers.count(long_key) != 1:
                    raise ValueError(f"Missing/duplicate LongDescription for column {col + 1}")
                levels.append((col, headers.index(long_key)))
            code_col = headers.index("codelistnumber")
            parents = [None] * (len(levels) - 1)
            continue
        if marker == "START":
            if levels is None or started:
                raise ValueError("START requires a preceding HEAD and one data section")
            active = started = True
            continue
        if marker == "END" and active:
            ended = True
            break
        if not active:
            continue
        try:
            for depth, (short_col, long_col) in enumerate(levels[:-1]):
                short = cell(row, short_col)
                long = cell(row, long_col)
                if short:
                    # Merged descriptions repeat their anchor; only declarations
                    # on this physical row introduce a new parent/code.
                    declared = bool(text(sheet.cell_value(row, short_col)))
                    if declared or parents[depth] is None or parents[depth]["shortDesc"] != short:
                        parent = {"shortDesc": short, "longDesc": long}
                        if declared:
                            parent["code"] = numeric_code(sheet.cell_value(row, code_col))
                        parents[depth] = parent
                        parents[depth + 1:] = [None] * (len(parents) - depth - 1)
                elif long and parents[depth] is not None:
                    parents[depth] = {**parents[depth], "longDesc": long}

            short_col, long_col = levels[-1]
            # Do not turn merged/blank leaf continuation rows into extra entries.
            short = text(sheet.cell_value(row, short_col))
            if not short:
                if text(sheet.cell_value(row, long_col)):
                    raise ValueError("Leaf LongDescription has no ShortDescription")
                continue
            if any(parent is None for parent in parents):
                raise ValueError("Leaf has no complete parent hierarchy")
            entry = {"shortDesc": short, "longDesc": cell(row, long_col),
                     "code": numeric_code(sheet.cell_value(row, code_col))}
            if parents:
                entry["parents"] = [dict(parent) for parent in parents]
            output.append(entry)
        except ValueError as error:
            raise ValueError(f"row {row + 1}: {error}") from error

    if not started or not ended or not output:
        raise ValueError("Expected START, END and at least one leaf entry")
    return output


def generate_aliases(codelists):
    """Resolve explicitly requested PMS aliases against exact workbook entries.

    Keep every candidate for an ambiguous synonym. No fuzzy matching, inferred
    rating conversion, or fabricated canonical descriptions/codes is performed.
    """
    targets = {
        "FlangeFacing": {"RF": ("Raised face",), "RTJ": ("Ring Type Joint face",)},
        "EndPreparation": {
            "BW": ("BE",), "BE": ("BE",), "SW": ("SWE",),
            "THD": ("MTE", "FTE"), "NPT": ("MTE", "FTE"),
        },
    }
    aliases = {}
    for sheet, synonyms in targets.items():
        aliases[sheet] = {}
        for alias, canonical_names in synonyms.items():
            candidates = []
            for canonical in canonical_names:
                matches = [entry for entry in codelists[sheet] if entry["shortDesc"] == canonical]
                if not matches:
                    raise ValueError(f"Alias {sheet}.{alias}: missing canonical entry {canonical!r}")
                candidates.extend(matches)
            aliases[sheet][alias] = candidates
    return aliases


def extract(workbook):
    book = xlrd.open_workbook(str(workbook), formatting_info=True, on_demand=True)
    try:
        result = {}
        for name in SHEETS:
            try:
                result[name] = parse_sheet(book.sheet_by_name(name))
            except (ValueError, xlrd.XLRDError) as error:
                raise ValueError(f"{name}: {error}") from error
        return result
    finally:
        book.release_resources()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Compact UTF-8, stable source order, and a final newline for reproducibility.
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "src/config/buhasa_codelists.json")
    parser.add_argument("--aliases-output", type=Path, default=ROOT / "src/config/buhasa_codelist_aliases.json")
    args = parser.parse_args()
    try:
        if len({args.workbook.resolve(), args.output.resolve(), args.aliases_output.resolve()}) != 3:
            raise ValueError("Workbook, dictionary and alias paths must be different")
        codelists = extract(args.workbook)
        aliases = generate_aliases(codelists)
        # Validate the entire input and alias targets before writing either file.
        write_json(args.output, codelists)
        write_json(args.aliases_output, aliases)
        print(json.dumps({"source_sha256": hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
                          "counts": {name: len(rows) for name, rows in codelists.items()},
                          "output": str(args.output), "aliases": str(args.aliases_output)}))
    except (OSError, ValueError, xlrd.XLRDError) as error:
        parser.exit(1, f"Extraction failed: {error}\n")


if __name__ == "__main__":
    main()
