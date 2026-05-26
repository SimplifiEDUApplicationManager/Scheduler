"""
show_availability.py — Show real availability (working hours minus scheduled
calendar events) for all active tutors over the next 7 days.

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


def fetch_weekly_busy(app_url: str, skill_api_key: str, tutor_ids: list, week_offset: int, tz: str) -> dict:
    """Call /api/nylas/weekly-busy. Returns {tutorId: [{day, startH, endH}, ...]}."""
    url = f"{app_url.rstrip('/')}/api/nylas/weekly-busy"
    data = json.dumps({"tutorIds": tutor_ids, "weekOffset": week_offset, "tz": tz}).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {skill_api_key}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read()).get("busySlots", {})
    except urllib.error.HTTPError:
        return {}


def to_app_dow(python_weekday: int) -> int:
    """Convert Python weekday() (Mon=0…Sun=6) to app day-of-week (Sun=0…Sat=6)."""
    return (python_weekday + 1) % 7


def subtract_busy(
    windows: list[tuple[float, float]],
    busy_blocks: list[dict],
) -> list[tuple[float, float]]:
    """Subtract busy blocks from working-hour windows. Returns remaining free slots."""
    result = list(windows)
    for block in busy_blocks:
        bs, be = block["startH"], block["endH"]
        new_result = []
        for ws, we in result:
            if be <= ws or bs >= we:
                new_result.append((ws, we))
            else:
                if ws < bs:
                    new_result.append((ws, bs))
                if be < we:
                    new_result.append((be, we))
        result = new_result
    return result


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


def main():
    parser = argparse.ArgumentParser(
        description="Show real availability (working hours minus events) for all tutors."
    )
    parser.add_argument(
        "--tz",
        default="America/New_York",
        help="Coordinator timezone IANA (default: America/New_York)",
    )
    args = parser.parse_args()

    supabase_url     = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    app_url          = get_env("SIMPLIFI_APP_URL")
    skill_api_key    = get_env("SKILL_API_KEY")

    # All active tutors with their working-hour windows
    tutors = supabase_get(
        supabase_url, service_role_key,
        "users"
        "?role=eq.TUTOR"
        "&status=eq.ACTIVE"
        "&select=id,name,availability"
        "&order=name.asc",
    )

    if not tutors:
        print(json.dumps({
            "ok": True, "range": "", "tz": args.tz, "days": [],
            "note": "No active tutors found.",
        }))
        return

    tutor_ids = [t["id"] for t in tutors]

    # Determine the two calendar weeks that the next 7 days may span.
    tz = ZoneInfo(args.tz)
    today = datetime.now(tz).date()
    next7 = [today + timedelta(days=i) for i in range(7)]

    # Sun=0 in our day-of-week scheme; to_app_dow(Mon=0) = 1, so Mon is 1 day
    # after Sunday → this_sunday = today - days_since_sunday.
    days_since_sunday = to_app_dow(today.weekday())
    this_sunday = today - timedelta(days=days_since_sunday)
    next_sunday = this_sunday + timedelta(days=7)

    # Fetch busy blocks for both potentially-spanned weeks in parallel-ish (serial is fine).
    busy_week = {
        0: fetch_weekly_busy(app_url, skill_api_key, tutor_ids, 0, args.tz),
        1: fetch_weekly_busy(app_url, skill_api_key, tutor_ids, 1, args.tz),
    }

    days_output = []
    for d in next7:
        dow = to_app_dow(d.weekday())
        day_label = f"{DAY_NAMES[dow]}, {MONTH_NAMES[d.month - 1]} {d.day}"
        week_offset = 0 if d < next_sunday else 1

        tutor_entries = []
        for t in tutors:
            avail = t.get("availability") or {}
            windows_raw = avail.get(str(dow), [])
            if not windows_raw:
                continue

            working = [(float(w[0]), float(w[1])) for w in windows_raw]

            # Subtract calendar events for this tutor on this specific day+week
            all_busy = busy_week[week_offset].get(t["id"], [])
            day_busy = [b for b in all_busy if b["day"] == dow]
            free = subtract_busy(working, day_busy)

            if not free:
                continue  # fully booked — omit from output

            tutor_entries.append({
                "name": t["name"],
                "windows": [fmt_window(s, e) for s, e in free],
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
