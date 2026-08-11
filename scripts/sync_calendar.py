#!/usr/bin/env python3
"""
Baixa o calendario iCal do Airbnb (URL fica em segredo, nunca neste arquivo)
e publica só as datas ocupadas em assets/availability.json — sem nome de
hóspede, sem telefone, sem link de reserva. So "de X a Y esta ocupado".

A URL vem da variavel de ambiente AIRBNB_ICS_URL (GitHub Actions secret).
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

ICS_URL = os.environ.get("AIRBNB_ICS_URL")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "availability.json")


def fetch_ics(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_date(value: str) -> str:
    # VALUE=DATE fields come as YYYYMMDD
    return f"{value[0:4]}-{value[4:6]}-{value[6:8]}"


def extract_ranges(ics_text: str) -> list[dict]:
    ranges = []
    for block in ics_text.split("BEGIN:VEVENT")[1:]:
        body = block.split("END:VEVENT")[0]
        start_m = re.search(r"DTSTART(?:;VALUE=DATE)?:(\d{8})", body)
        end_m = re.search(r"DTEND(?:;VALUE=DATE)?:(\d{8})", body)
        if start_m and end_m:
            ranges.append({
                "start": parse_date(start_m.group(1)),
                "end": parse_date(end_m.group(1)),
            })
    ranges.sort(key=lambda r: r["start"])
    return ranges


def main():
    if not ICS_URL:
        print("AIRBNB_ICS_URL nao definido — nada a sincronizar.", file=sys.stderr)
        sys.exit(1)

    ics_text = fetch_ics(ICS_URL)
    ranges = extract_ranges(ics_text)

    payload = {
        "last_synced": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "booked_ranges": ranges,
    }

    out_path = os.path.abspath(OUT_PATH)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Salvo {len(ranges)} períodos ocupados em {out_path}")


if __name__ == "__main__":
    main()
