"""
csv_security.py
===============
Security utilities for CSV / Spreadsheet Formula Injection (CWE-1236) prevention.

Spreadsheet Formula Injection occurs when untrusted user input contains characters
that spreadsheet software (Microsoft Excel, LibreOffice Calc, Google Sheets, Apple Numbers)
interprets as formula commands upon opening a CSV file:
- '=' : Standard formula initiator
- '+' : Arithmetic / formula initiator
- '-' : Arithmetic / formula initiator (can trigger external links or DDE in Excel)
- '@' : Function call initiator (e.g. @SUM, @cmd)
- '\t' (Tab) : Field separator / formula bypass
- '\r' (Carriage Return) : Field separator / formula bypass
- '|' (Pipe) : Formula chaining / shell pipe in certain spreadsheet macros

Defense-in-depth Strategy:
1. `validate_import_field`: At import time, validate that fields match expected business rules.
   Rejects malicious formula prefixes on critical business identifiers (codes, names, SKUs)
   OR neutralizes them without destroying data integrity.
2. `sanitize_for_spreadsheet`: At export / spreadsheet serialization boundaries, prefix any
   cell starting with dangerous characters (or whitespace leading to dangerous characters)
   with a single apostrophe `'`. In CSV syntax, RFC-4180 double-quoting alone does NOT prevent
   formula execution; the apostrophe explicitly forces spreadsheet parsers to treat the cell
   as plain literal text.
3. `generate_safe_csv`: Utility to export rectangular tabular data to CSV with safe cell
   serialization.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any, Iterable, List, Sequence, Union

# Characters that trigger formula execution in Excel / Calc / Sheets
DANGEROUS_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

# Regex to detect dangerous formula triggers even when preceded by whitespace or control chars
_DANGEROUS_PATTERN = re.compile(r"^[\s\t\r\n]*[=+@\-\t\r\|]")


def is_formula_injection(value: Any) -> bool:
    """
    Check if a string or string representation begins with a formula trigger,
    accounting for leading spaces, tabs, carriage returns, or control characters.
    """
    if value is None:
        return False
    val_str = str(value)
    if not val_str:
        return False
    return bool(_DANGEROUS_PATTERN.match(val_str))


def sanitize_cell_for_export(value: Any) -> str:
    """
    Sanitize an individual value for safe CSV/spreadsheet export.
    If the value starts with dangerous formula characters (even after whitespace),
    prepend a single apostrophe (') to neutralize formula execution in spreadsheet software.
    Also strips null bytes.
    """
    if value is None:
        return ""
    val_str = str(value).replace("\x00", "")
    
    # If it starts with dangerous formula chars (or whitespace + dangerous chars), prepend apostrophe
    if _DANGEROUS_PATTERN.match(val_str):
        # If it doesn't already have an apostrophe guard
        if not val_str.startswith("'"):
            return f"'{val_str}"
    return val_str


def validate_and_sanitize_import_field(
    value: Any,
    field_name: str,
    allow_neutralization: bool = True
) -> str:
    """
    Validate and sanitize text incoming from CSV imports.
    If allow_neutralization is True, prepends single quote to neutralize formula injection.
    Strips dangerous unprintable control characters.
    """
    if value is None:
        return ""
    val_str = str(value).strip().replace("\x00", "")
    
    if is_formula_injection(val_str):
        if allow_neutralization:
            if not val_str.startswith("'"):
                return f"'{val_str}"
            return val_str
        else:
            raise ValueError(f"Security validation failed: Field '{field_name}' contains illegal formula expression.")
            
    return val_str


def export_csv_secure(
    headers: Sequence[str],
    rows: Iterable[Sequence[Any]]
) -> str:
    """
    Generate an RFC-4180 compliant CSV string where all text cells are
    sanitized against formula injection.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    
    # Write sanitized headers
    writer.writerow([sanitize_cell_for_export(h) for h in headers])
    
    # Write sanitized rows
    for row in rows:
        sanitized_row = [sanitize_cell_for_export(cell) for cell in row]
        writer.writerow(sanitized_row)
        
    return output.getvalue()
