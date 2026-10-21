# BUHASA codelist extraction

Authority: the user's 20 October 2026 request for an offline BUHASA dictionary,
under I-06 incremental reuse. This script supplies project reference data. The subsequent user-authorized
matching/review/release integration is documented in
`../../docs/features/s3d-buhasa-matching.md`; the script itself does not activate
matching or confer engineering approval. Sidebar behavior is unchanged.

```powershell
python -m pip install xlrd==2.0.2
python scripts/extract_buhasa_codelists.py C:/SPEC/AllCodeLists-BUHASA.xls
python -m unittest discover -s scripts -p test_extract_buhasa_codelists.py
```

The input is read only. Optional `--output` and `--aliases-output` select the
destination paths. The script validates all eight sheets and alias targets
before writing. Missing sheets, HEAD/START/END markers, parent context, or leaf
codes fail with a diagnostic. Fractional/nonfinite codes fail rather than round.
Descriptions retain source spelling; surrounding whitespace is removed and
numeric descriptions such as `150.0` become strings such as `150`.

`src/config/buhasa_codelists.json` has eight sheet-name keys with arrays of
`{shortDesc, longDesc, code}`. Hierarchical leaf entries additionally have a
`parents` array ordered from highest ancestor to immediate parent, each with
its own description and declaration code. Parent-only rows are not emitted as
leaves. Blank-down and merged parent descriptions inherit their context; a new
ancestor clears previous descendants. Codes are never filled down. Repeated
leaf labels/codes remain separate with their source context, preserving rating
practice, material category and component subclass distinctions.

`src/config/buhasa_codelist_aliases.json` contains sheet-scoped aliases. Every
alias maps to an array of actual dictionary entries, even when there is only
one candidate. Lookup keys are uppercase:

| Sheet | Alias | Canonical ShortDescription and code |
| --- | --- | --- |
| FlangeFacing | RF | Raised face (5) |
| FlangeFacing | RTJ | Ring Type Joint face (10) |
| EndPreparation | BW, BE | BE (301), long description: Beveled end |
| EndPreparation | SW | SWE (421), long description: Socket welded end |
| EndPreparation | THD, NPT | MTE (331) and FTE (441), male/female threaded end |

These are explicitly requested PMS lookup suggestions. In particular, the
workbook has no generic `Threaded` leaf or `NPT` leaf: both threaded candidates
are retained for review. This does not certify thread standard, gender, or that
every butt-weld connection has beveled ends. No automatic candidate selection,
unit conversion, fuzzy matching, or engineering equivalence is introduced.

Workbook comment rows are skipped as data. All coded leaves are retained;
formatting-based retirement warnings (for example red-filled material entries)
are not converted into eligibility rules. The dictionary is reference content,
not evidence that every listed value is approved for project use.

Generated from the supplied 326-sheet workbook with SHA-256
`4ec70c8276f1ea956a3a2dbc74e870ee3d9ad9e2b040fec37a3fe8055a725c3f`.
Counts: FlangeFacing 8; EndPreparation 144; PressureRating 330;
ScheduleThickness 449; MaterialsGrade 4,587; MaterialsOfConstructionClass 148;
BoltType 7; PipingCommodityType 1,379. Total: 7,052 leaf entries.
Output is compact UTF-8 JSON with deterministic workbook ordering.

Verification: all seven offline parser tests passed. An independent source-row
comparison checked all 7,052 emitted leaf names/codes; every generated alias
candidate exists in the dictionary. A second extraction produced byte-identical
files and the source workbook hash remained unchanged. Dictionary size is
1,606,695 bytes; aliases are 1,483 bytes. Git whitespace checks passed. This is
parser/data verification, not engineering approval or matching integration.
