"""Offline parser checks: python -m unittest discover -s scripts -p test_extract_buhasa_codelists.py"""
import unittest

from extract_buhasa_codelists import generate_aliases, numeric_code, parse_sheet


class Sheet:
    def __init__(self, rows, merged_cells=()):
        self.rows = rows
        self.nrows = len(rows)
        self.merged_cells = merged_cells

    def cell_value(self, row, col):
        return self.rows[row][col]

    def row_values(self, row):
        return self.rows[row]


HEAD = ["HEAD", "Practice ShortDescription", "Practice LongDescription",
        "Item ShortDescription", "Item LongDescription", "Codelist\nNumber"]


class ParserTests(unittest.TestCase):
    def test_comments_markers_and_single_level_values(self):
        rows = [["", "Ignored", "", 9],
                ["HEAD", "BoltType\nShortDescription", "BoltType LongDescription", "Codelist Number"],
                ["START", "", "", ""], ["! Comment", "Ignore", "", "bad"],
                ["", "Stud Bolt", "", 5.0], ["END", "", "", ""],
                ["", "After END", "", 10]]
        self.assertEqual(parse_sheet(Sheet(rows)), [{"shortDesc": "Stud Bolt", "longDesc": "", "code": 5}])

    def test_parent_codes_are_not_emitted_as_leaves_and_scopes_are_retained(self):
        rows = [HEAD, ["START", "", "", "", "", ""],
                ["", "US", "US standards", "", "", 5],
                ["", "", "", 150.0, "CL150", 30.0],
                ["", "Metric", "", "", "", 10],
                ["", "", "", 150.0, "PN150", "300"],
                ["END", "", "", "", "", ""]]
        entries = parse_sheet(Sheet(rows))
        self.assertEqual([entry["code"] for entry in entries], [30, 300])
        self.assertEqual([entry["shortDesc"] for entry in entries], ["150", "150"])
        self.assertEqual(entries[0]["parents"], [{"shortDesc": "US", "longDesc": "US standards", "code": 5}])
        self.assertEqual(entries[1]["parents"][0]["shortDesc"], "Metric")

    def test_merged_parent_continuation_retains_original_code(self):
        rows = [HEAD, ["START", "", "", "", "", ""],
                ["", "US", "US standards", "", "", 5],
                ["", "", "", "150", "CL150", 30],
                ["", "", "", "300", "CL300", 40],
                ["END", "", "", "", "", ""]]
        entries = parse_sheet(Sheet(rows, [(2, 5, 1, 2), (2, 5, 2, 3)]))
        self.assertEqual([entry["parents"][0]["code"] for entry in entries], [5, 5])

    def test_new_grandparent_clears_previous_subclass(self):
        head = ["HEAD", "Class ShortDescription", "Class LongDescription",
                "Subclass ShortDescription", "Subclass LongDescription",
                "Leaf ShortDescription", "Leaf LongDescription", "Codelist Number"]
        rows = [head, ["START", "", "", "", "", "", "", ""],
                ["", "Class A", "", "", "", "", "", 5],
                ["", "", "", "Subclass A", "", "", "", 6],
                ["", "", "", "", "", "Leaf A", "", 7],
                ["", "Class B", "", "", "", "", "", 8],
                ["", "", "", "", "", "Orphan", "", 9],
                ["END", "", "", "", "", "", "", ""]]
        with self.assertRaisesRegex(ValueError, "complete parent hierarchy"):
            parse_sheet(Sheet(rows))

    def test_invalid_or_missing_codes_fail_instead_of_rounding_or_filling_down(self):
        for value in ("", "text", 5.5, "NaN", "Infinity"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                numeric_code(value)
        self.assertEqual(numeric_code("5.0"), 5)

    def test_missing_end_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "START, END"):
            parse_sheet(Sheet([HEAD, ["START", "", "", "", "", ""],
                               ["", "P", "", "Leaf", "", 1]]))

    def test_aliases_preserve_ambiguity_and_reject_missing_targets(self):
        lists = {
            "FlangeFacing": [{"shortDesc": "Raised face", "code": 5},
                             {"shortDesc": "Ring Type Joint face", "code": 10}],
            "EndPreparation": [{"shortDesc": short, "code": code} for short, code in
                               [("BE", 301), ("SWE", 421), ("MTE", 331), ("FTE", 441)]],
        }
        aliases = generate_aliases(lists)
        self.assertEqual(aliases["FlangeFacing"]["RF"][0]["code"], 5)
        self.assertEqual([row["code"] for row in aliases["EndPreparation"]["NPT"]], [331, 441])
        lists["EndPreparation"].pop()
        with self.assertRaisesRegex(ValueError, "missing canonical"):
            generate_aliases(lists)


if __name__ == "__main__":
    unittest.main()
