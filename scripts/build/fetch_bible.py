#!/usr/bin/env python3
"""Fetch 4 Bible translations for chapters referenced in McCheyne plan.

Sources:
  - KJV, NLT:        bolls.life (JSON)
  - NKRV, NKSV:      bskorea.or.kr (HTML scraping)

Output format:
  data/bible/{translation}/{BOOK}.json
  {
    "translation": "nkrv",
    "name": "개역개정",
    "book": "GEN",
    "book_name_ko": "창세기",
    "chapters": {
      "1": { "1": "...", "2": "...", ... },
      "2": { ... }
    }
  }
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "bible"

# Map our SBL codes ↔ bolls book numbers (1=Gen, 40=Mat, etc.)
SBL_TO_BOLLS = {
    "GEN": 1, "EXO": 2, "LEV": 3, "NUM": 4, "DEU": 5, "JOS": 6, "JDG": 7,
    "RUT": 8, "1SA": 9, "2SA": 10, "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14,
    "EZR": 15, "NEH": 16, "EST": 17, "JOB": 18, "PSA": 19, "PRO": 20, "ECC": 21,
    "SNG": 22, "ISA": 23, "JER": 24, "LAM": 25, "EZK": 26, "DAN": 27, "HOS": 28,
    "JOL": 29, "AMO": 30, "OBA": 31, "JON": 32, "MIC": 33, "NAM": 34, "HAB": 35,
    "ZEP": 36, "HAG": 37, "ZEC": 38, "MAL": 39,
    "MAT": 40, "MRK": 41, "LUK": 42, "JHN": 43, "ACT": 44, "ROM": 45,
    "1CO": 46, "2CO": 47, "GAL": 48, "EPH": 49, "PHP": 50, "COL": 51,
    "1TH": 52, "2TH": 53, "1TI": 54, "2TI": 55, "TIT": 56, "PHM": 57,
    "HEB": 58, "JAS": 59, "1PE": 60, "2PE": 61, "1JN": 62, "2JN": 63,
    "3JN": 64, "JUD": 65, "REV": 66,
}

# Map our SBL codes → bskorea 3-letter codes (lowercase)
SBL_TO_BSKOREA = {
    "GEN": "gen", "EXO": "exo", "LEV": "lev", "NUM": "num", "DEU": "deu",
    "JOS": "jos", "JDG": "jdg", "RUT": "rut", "1SA": "1sa", "2SA": "2sa",
    "1KI": "1ki", "2KI": "2ki", "1CH": "1ch", "2CH": "2ch", "EZR": "ezr",
    "NEH": "neh", "EST": "est", "JOB": "job", "PSA": "psa", "PRO": "pro",
    "ECC": "ecc", "SNG": "sng", "ISA": "isa", "JER": "jer", "LAM": "lam",
    "EZK": "ezk", "DAN": "dan", "HOS": "hos", "JOL": "jol", "AMO": "amo",
    "OBA": "oba", "JON": "jnh", "MIC": "mic", "NAM": "nam", "HAB": "hab",
    "ZEP": "zep", "HAG": "hag", "ZEC": "zec", "MAL": "mal",
    "MAT": "mat", "MRK": "mrk", "LUK": "luk", "JHN": "jhn", "ACT": "act",
    "ROM": "rom", "1CO": "1co", "2CO": "2co", "GAL": "gal", "EPH": "eph",
    "PHP": "php", "COL": "col", "1TH": "1th", "2TH": "2th", "1TI": "1ti",
    "2TI": "2ti", "TIT": "tit", "PHM": "phm", "HEB": "heb", "JAS": "jas",
    "1PE": "1pe", "2PE": "2pe", "1JN": "1jn", "2JN": "2jn", "3JN": "3jn",
    "JUD": "jud", "REV": "rev",
}

BOOK_KO = {
    "GEN": "창세기", "EXO": "출애굽기", "LEV": "레위기", "NUM": "민수기",
    "DEU": "신명기", "JOS": "여호수아", "JDG": "사사기", "RUT": "룻기",
    "1SA": "사무엘상", "2SA": "사무엘하", "1KI": "열왕기상", "2KI": "열왕기하",
    "1CH": "역대상", "2CH": "역대하", "EZR": "에스라", "NEH": "느헤미야",
    "EST": "에스더", "JOB": "욥기", "PSA": "시편", "PRO": "잠언",
    "ECC": "전도서", "SNG": "아가", "ISA": "이사야", "JER": "예레미야",
    "LAM": "예레미야애가", "EZK": "에스겔", "DAN": "다니엘", "HOS": "호세아",
    "JOL": "요엘", "AMO": "아모스", "OBA": "오바댜", "JON": "요나",
    "MIC": "미가", "NAM": "나훔", "HAB": "하박국", "ZEP": "스바냐",
    "HAG": "학개", "ZEC": "스가랴", "MAL": "말라기",
    "MAT": "마태복음", "MRK": "마가복음", "LUK": "누가복음", "JHN": "요한복음",
    "ACT": "사도행전", "ROM": "로마서", "1CO": "고린도전서", "2CO": "고린도후서",
    "GAL": "갈라디아서", "EPH": "에베소서", "PHP": "빌립보서", "COL": "골로새서",
    "1TH": "데살로니가전서", "2TH": "데살로니가후서", "1TI": "디모데전서",
    "2TI": "디모데후서", "TIT": "디도서", "PHM": "빌레몬서", "HEB": "히브리서",
    "JAS": "야고보서", "1PE": "베드로전서", "2PE": "베드로후서",
    "1JN": "요한일서", "2JN": "요한이서", "3JN": "요한삼서",
    "JUD": "유다서", "REV": "요한계시록",
}

TRANSLATIONS = {
    "kjv": {"name": "KJV", "source": "bolls", "bolls_code": "KJV"},
    "nlt": {"name": "NLT", "source": "bolls", "bolls_code": "NLT"},
    "nkrv": {"name": "개역개정", "source": "bskorea", "bskorea_code": "GAE"},
    "nksv": {"name": "새번역", "source": "bskorea", "bskorea_code": "SAENEW"},
}


def http_get(url, timeout=30, retries=3):
    last_err = None
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": "mccheyne-app/0.1 (research)"})
            with urlopen(req, timeout=timeout) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (URLError, HTTPError, TimeoutError) as e:
            last_err = e
            if attempt < retries - 1:
                time.sleep(1.5 ** attempt)
    raise last_err


def fetch_bolls_chapter(translation, book_sbl, chapter):
    bolls_code = TRANSLATIONS[translation]["bolls_code"]
    bolls_book = SBL_TO_BOLLS[book_sbl]
    url = f"https://bolls.life/get-text/{bolls_code}/{bolls_book}/{chapter}/"
    raw = http_get(url)
    data = json.loads(raw)
    # Normalize → {verse_num_str: text}
    verses = {}
    for entry in data:
        v = entry.get("verse")
        t = entry.get("text", "")
        if v is None:
            continue
        # Strip Strong's number spans before plain tag-strip (KJV has <S>1234</S>)
        t = re.sub(r"<S>\d+</S>", "", t)
        # Strip footnote/cross-ref tags
        t = re.sub(r"<[^>]+>", "", t)
        # KJV bolls inlines Strong's as bare digits (e.g., "beginning7225") — strip them
        if translation == "kjv":
            t = re.sub(r"(?<=[A-Za-z])\d+", "", t)
        t = re.sub(r"\s+", " ", t).strip()
        verses[str(v)] = t
    return verses


VERSE_SPAN_RE = re.compile(
    r'<span class="number">(\d+)(?:&nbsp;)*</span>(.*?)(?=<span class="number">|<br\s*/?>(?:\s*<br\s*/?>)+|</td>|<font class="smallTitle">)',
    re.DOTALL,
)


def fetch_bskorea_chapter(translation, book_sbl, chapter):
    bskorea_code = TRANSLATIONS[translation]["bskorea_code"]
    bskorea_book = SBL_TO_BSKOREA[book_sbl]
    url = f"https://www.bskorea.or.kr/bible/korbibReadpage.php?version={bskorea_code}&book={bskorea_book}&chap={chapter}"
    html = http_get(url)
    verses = {}
    for m in VERSE_SPAN_RE.finditer(html):
        vnum = m.group(1)
        raw = m.group(2)
        # Strip footnote anchors and their popup divs
        raw = re.sub(r"<a\b[^>]*>.*?</a>", "", raw, flags=re.DOTALL)
        raw = re.sub(r"<div\b[^>]*>.*?</div>", "", raw, flags=re.DOTALL)
        raw = re.sub(r"<font[^>]*>", "", raw)
        raw = re.sub(r"</font>", "", raw)
        raw = re.sub(r"<[^>]+>", " ", raw)
        raw = re.sub(r"\d+\)", "", raw)  # footnote tokens like "1)"
        raw = re.sub(r"&nbsp;", " ", raw)
        raw = re.sub(r"\s+", " ", raw).strip()
        if raw and vnum not in verses:
            verses[vnum] = raw
    return verses


def fetch_chapter(translation, book_sbl, chapter):
    src = TRANSLATIONS[translation]["source"]
    if src == "bolls":
        return fetch_bolls_chapter(translation, book_sbl, chapter)
    elif src == "bskorea":
        return fetch_bskorea_chapter(translation, book_sbl, chapter)
    else:
        raise ValueError(f"Unknown source: {src}")


def needed_chapters_from_plan(plan, day_limit=None):
    """Return dict: book_sbl → sorted set of chapter ints."""
    needed = {}
    days = plan if day_limit is None else plan[:day_limit]
    for entry in days:
        for slot_key in ("family_ot", "family_nt", "secret_ot", "secret_nt"):
            slot = entry[slot_key]
            book = slot["book"]
            needed.setdefault(book, set())
            if "chapters" in slot:
                for c in slot["chapters"]:
                    needed[book].add(c)
            else:
                start = slot["chapter"]
                end = slot.get("chapter_end", start)
                for c in range(start, end + 1):
                    needed[book].add(c)
    return {b: sorted(cs) for b, cs in needed.items()}


def load_existing_book(translation, book_sbl):
    path = DATA_DIR / translation / f"{book_sbl}.json"
    if path.exists():
        return json.loads(path.read_text())
    return {
        "translation": translation,
        "name": TRANSLATIONS[translation]["name"],
        "book": book_sbl,
        "book_name_ko": BOOK_KO.get(book_sbl, ""),
        "chapters": {},
    }


def save_book(translation, book_sbl, data):
    path = DATA_DIR / translation / f"{book_sbl}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--plan", default=str(ROOT / "data/mccheyne-plan.json"))
    p.add_argument("--translations", default=",".join(TRANSLATIONS),
                   help="Comma-separated: kjv,nlt,nkrv,nksv")
    p.add_argument("--days", type=int, default=None, help="Limit to first N days (for testing)")
    p.add_argument("--delay", type=float, default=0.3, help="Seconds between requests")
    p.add_argument("--skip-existing", action="store_true",
                   help="Skip chapters already saved")
    args = p.parse_args()

    plan = json.loads(Path(args.plan).read_text())
    translations = [t.strip() for t in args.translations.split(",") if t.strip()]
    for t in translations:
        if t not in TRANSLATIONS:
            print(f"Unknown translation: {t}", file=sys.stderr)
            sys.exit(1)

    needed = needed_chapters_from_plan(plan, day_limit=args.days)
    total_units = sum(len(cs) for cs in needed.values()) * len(translations)
    print(f"Plan range: {len(plan if args.days is None else plan[:args.days])} days")
    print(f"Unique books: {len(needed)}, unique chapter-loads per translation: {sum(len(cs) for cs in needed.values())}")
    print(f"Translations: {translations}")
    print(f"Total fetches: ~{total_units} ({total_units * 0.5 / 60:.1f} min @ 0.5s/req)")
    print()

    completed = 0
    for translation in translations:
        for book in sorted(needed):
            book_data = load_existing_book(translation, book)
            changed = False
            for chap in needed[book]:
                chap_key = str(chap)
                if args.skip_existing and chap_key in book_data["chapters"]:
                    completed += 1
                    continue
                try:
                    verses = fetch_chapter(translation, book, chap)
                    if not verses:
                        print(f"  [{translation}] {book} {chap}: 0 verses (skipping)", file=sys.stderr)
                        completed += 1
                        continue
                    book_data["chapters"][chap_key] = verses
                    changed = True
                    completed += 1
                    print(f"[{completed}/{total_units}] {translation}/{book}/{chap}: {len(verses)} verses")
                except Exception as e:
                    print(f"  [{translation}] {book} {chap}: FAIL {e}", file=sys.stderr)
                    completed += 1
                time.sleep(args.delay)
            if changed:
                # Sort chapters numerically
                book_data["chapters"] = {
                    k: book_data["chapters"][k]
                    for k in sorted(book_data["chapters"], key=int)
                }
                save_book(translation, book, book_data)
                print(f"  → saved {translation}/{book}.json ({len(book_data['chapters'])} chapters)")

    print(f"\nDone. {completed}/{total_units} fetches attempted.")


if __name__ == "__main__":
    main()
