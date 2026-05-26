"""
show_availability.py — List working-hour availability for all active tutors
over the next 7 days.

Usage:
  python -m scripts.commands.show_availability [--tz "America/New_York"]

Exit codes:
  0 — success
  3 — missing environment variables
  1 — any other error
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def get_env(name: str) -> str:
    val = os.environ.get(name, "")
    if not val:
        print(json.dumps({"ok": False, "error": f"Missing environment variable: {name}"}), file=sys.stderr)
        sys.exit(3)
    return val


def supabase_get(supabase_url: str, service_role_key: str, path: str) -> list:
    url = f"{supabase_url}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(json.dumps({"ok": False, "error": f"Supabase error: {body}"}), file=sys.stderr)
        sys.exit(1)


def fmt_hour(h: float) -> str:
    """9 → '9 AM', 9.5 → '9:30 AM', 13 → '1 PM'"""
    total_mins = round(h * 60)
    hrs = total_mins // 60
    mins = total_mins % 60
    period = "AM" if hrs < 12 else "PM"
    h12 = hrs % 12 or 12
    return f"{h12}:{mins:02d} {period}" if mins else f"{h12} {period}"


def fmt_window(start: float, end: float) -> str:
    return f"{fmt_hour(start)}–{fmt_hour(end)}"


def to_app_dow(python_weekday: int) -> int:
    """Convert Python weekday() (Mon=0…Sun=6) to app day-of-week (Sun=0…Sat=6)."""
    return (python_weekday + 1) % 7


def main():
    parser = argparse.ArgumentParser(
        description="Show working-hour availability for all active tutors over the next 7 days."
    )
    parser.add_argument(
        "--tz",
        default="America/New_York",
        help="Coordinator timezone IANA (default: America/New_York)",
    )
    args = parser.parse_args()

    supabase_url     = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")

    tutors = supabase_get(
        supabase_url, service_role_key,
        "users"
        "?role=eq.TUTOR"
        "&status=eq.ACTIVE"
        "&select=id,name,availability,max_weekly_hours"
        "&order=name.asc",
    )

    if not tutors:
        print(json.dumps({
            "ok": True,
            "range": "",
            "tz": args.tz,
            "days": [],
            "note": "No active tutors found.",
        }))
        return

    tz = ZoneInfo(args.tz)
    today = datetime.now(tz).date()
    next7 = [today + timedelta(days=i) for i in range(7)]

    days_output = []
    for d in next7:
        dow = to_app_dow(d.weekday())
        day_label = f"{DAY_NAMES[dow]}, {MONTH_NAMES[d.month - 1]} {d.day}"

        tutor_entries = []
        for t in tutors:
            avail = t.get("availability") or {}
            windows_raw = avail.get(str(dow), [])
            if not windows_raw:
                continue
            windows = [fmt_window(float(w[0]), float(w[1])) for w in windows_raw]
            tutor_entries.append({
                "name": t["name"],
                "windows": windows,
            })

        days_output.append({
            "date": str(d),
            "label": day_label,
            "tutors": tutor_entries,
        })

    range_label = (
        f"{MONTH_NAMES[next7[0].month - 1]} {next7[0].day}"
        f" – {MONTH_NAMES[next7[-1].month - 1]} {next7[-1].day}, {next7[-1].year}"
    )

    print(json.dumps({
        "ok":   True,
        "range": range_label,
        "tz":   args.tz,
        "days": days_output,
    }, indent=2))


if __name__ == "__main__":
    main()
