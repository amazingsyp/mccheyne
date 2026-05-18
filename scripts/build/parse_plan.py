#!/usr/bin/env python3
"""Parse McCheyne plan from Swift source into JSON.

Input: PlanConstants.swift from willswire/mcheyne
Output: data/mccheyne-plan.json with normalized passages
"""
import json
import re
import sys
from pathlib import Path

BOOK_TO_CODE = {
    "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM",
    "Deuteronomy": "DEU", "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT",
    "1 Samuel": "1SA", "2 Samuel": "2SA", "1 Kings": "1KI", "2 Kings": "2KI",
    "1 Chronicles": "1CH", "2 Chronicles": "2CH", "Ezra": "EZR", "Nehemiah": "NEH",
    "Esther": "EST", "Job": "JOB", "Psalm": "PSA", "Psalms": "PSA",
    "Proverbs": "PRO", "Ecclesiastes": "ECC",
    "Song of Solomon": "SNG", "Song of Songs": "SNG",
    "Isaiah": "ISA", "Jeremiah": "JER", "Lamentations": "LAM", "Ezekiel": "EZK",
    "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL", "Amos": "AMO",
    "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM",
    "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC",
    "Malachi": "MAL",
    "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN",
    "Acts": "ACT", "Romans": "ROM",
    "1 Corinthians": "1CO", "2 Corinthians": "2CO",
    "Galatians": "GAL", "Ephesians": "EPH", "Philippians": "PHP",
    "Colossians": "COL",
    "1 Thessalonians": "1TH", "2 Thessalonians": "2TH",
    "1 Timothy": "1TI", "2 Timothy": "2TI",
    "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB", "James": "JAS",
    "1 Peter": "1PE", "2 Peter": "2PE",
    "1 John": "1JN", "2 John": "2JN", "3 John": "3JN",
    "Jude": "JUD", "Revelation": "REV",
}

# Parse forms:
#   "Genesis 1"                — whole chapter
#   "Genesis 9-10"             — chapter range
#   "1 Samuel 5"               — book with numeric prefix
#   "Luke 1:1-38"              — verse range in single chapter
#   "Luke 1:39 - 2:7"          — verse range across chapters (rare)
PASSAGE_RE = re.compile(
    r"^(?:([123])\s+)?([A-Za-z][A-Za-z\s]*?)\s+"
    r"(\d+)(?::(\d+))?"                 # start chapter[:verse]
    r"(?:\s*-\s*(?:(\d+):)?(\d+))?"     # optional end [chapter:]verse-or-chapter
    r"$"
)


def parse_passage(s):
    s = s.strip()
    # Handle non-contiguous chapters like "Jeremiah 36,45"
    if "," in s:
        m_multi = re.match(r"^(?:([123])\s+)?([A-Za-z][A-Za-z\s]*?)\s+(\d+(?:,\d+)+)$", s)
        if m_multi:
            prefix, name, chapters = m_multi.groups()
            book_name = (prefix + " " + name).strip() if prefix else name.strip()
            if book_name not in BOOK_TO_CODE:
                raise ValueError(f"Unknown book: {book_name!r} (from {s!r})")
            chap_list = [int(c) for c in chapters.split(",")]
            return {
                "book": BOOK_TO_CODE[book_name],
                "name": book_name,
                "chapter": chap_list[0],
                "chapters": chap_list,
                "ref": s,
            }
    m = PASSAGE_RE.match(s)
    if not m:
        raise ValueError(f"Cannot parse passage: {s!r}")
    prefix, name, chap_start, verse_start, chap_end_or_none, end_num = m.groups()
    book_name = (prefix + " " + name).strip() if prefix else name.strip()
    if book_name not in BOOK_TO_CODE:
        raise ValueError(f"Unknown book: {book_name!r} (from {s!r})")
    result = {
        "book": BOOK_TO_CODE[book_name],
        "name": book_name,
        "chapter": int(chap_start),
    }
    if verse_start:
        result["verse_start"] = int(verse_start)
    if end_num:
        if chap_end_or_none:
            # "Luke 1:39 - 2:7" → chapter range with verse bounds
            result["chapter_end"] = int(chap_end_or_none)
            result["verse_end"] = int(end_num)
        elif verse_start:
            # "Luke 1:1-38" → verse range within chapter
            result["verse_end"] = int(end_num)
        else:
            # "Genesis 9-10" → chapter range
            result["chapter_end"] = int(end_num)
    result["ref"] = s  # human-readable original
    return result


def parse_swift(swift_path):
    text = Path(swift_path).read_text()
    rows = re.findall(r'\[((?:"[^"]+",?\s*){4})\]', text)
    days = []
    for i, row in enumerate(rows):
        passages = re.findall(r'"([^"]+)"', row)
        if len(passages) != 4:
            raise ValueError(f"Row {i+1} has {len(passages)} passages, expected 4")
        family_ot = parse_passage(passages[0])
        family_nt = parse_passage(passages[1])
        secret_ot = parse_passage(passages[2])
        secret_nt = parse_passage(passages[3])
        days.append({
            "day": i + 1,
            "family_ot": family_ot,
            "family_nt": family_nt,
            "secret_ot": secret_ot,
            "secret_nt": secret_nt,
        })
    return days


def add_dates(days):
    """Map day 1..365 to MM-DD, skipping Feb 29.

    Standard McCheyne plan: starts Jan 1, no entry for Feb 29.
    """
    from datetime import date, timedelta
    base = date(2025, 1, 1)  # non-leap year reference
    for i, entry in enumerate(days):
        d = base + timedelta(days=i)
        entry["date_md"] = f"{d.month:02d}-{d.day:02d}"
    return days


def main():
    if len(sys.argv) < 3:
        print("Usage: parse_plan.py <PlanConstants.swift> <output.json>")
        sys.exit(1)
    days = parse_swift(sys.argv[1])
    if len(days) != 365:
        print(f"WARNING: Got {len(days)} days, expected 365", file=sys.stderr)
    days = add_dates(days)
    Path(sys.argv[2]).write_text(json.dumps(days, ensure_ascii=False, indent=2))
    print(f"Wrote {len(days)} days to {sys.argv[2]}")


if __name__ == "__main__":
    main()
