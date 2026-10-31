"""Calendar and timeline rules. Mirrors ``src/domain/timeline.js``."""

import datetime as dt
import re

MONTHS = {"month": 1, "quarter": 3, "biannual": 6, "year": 12}
_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def real_date(value: str) -> dt.date | None:
    """Return the calendar date for ``YYYY-MM-DD`` or ``None`` if it does not exist (e.g. 2026-02-30)."""
    match = _DATE.match(value or "")
    if not match:
        return None
    try:
        return dt.date(int(match[1]), int(match[2]), int(match[3]))
    except ValueError:
        return None


def period_starts(granularity: str, start: str, periods: int) -> list[str]:
    """ISO start dates of the generated time segments; the start month's first day anchors the series."""
    months = MONTHS.get(granularity, 3)
    year, month = int(start[0:4]), int(start[5:7])
    out = []
    for index in range(periods):
        total = (month - 1) + index * months
        out.append(f"{year + total // 12:04d}-{total % 12 + 1:02d}-01")
    return out
