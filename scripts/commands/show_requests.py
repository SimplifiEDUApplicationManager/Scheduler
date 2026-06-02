"""
show_requests.py — Show the coordinator's open (or all) tutoring requests.

Usage:
  python -m scripts.commands.show_requests [--status open|all]

Exit codes:
  0 — success
  3 — missing environment variables
  1 — any other error
"""

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone


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


def time_ago(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        diff = datetime.now(timezone.utc) - dt
        mins = int(diff.total_seconds() / 60)
        hours = mins // 60
        days = hours // 24
        if mins < 60:
            return f"{mins}m ago"
        if hours < 24:
            return f"{hours}h ago"
        return f"{days}d ago"
    except Exception:
        return iso


DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def fmt_schedule(schedule) -> str:
    if not schedule:
        return "—"
    parts = []
    for t in schedule[:2]:
        day = DAY_NAMES[int(t.get("day", 0))]
        start = int(t.get("start", 0))
        end = int(t.get("end", 0))
        parts.append(f"{day} {start}–{end}")
    if len(schedule) > 2:
        parts.append(f"+{len(schedule) - 2} more")
    return ", ".join(parts)


def main():
    parser = argparse.ArgumentParser(description="Show open requests for the coordinator.")
    parser.add_argument(
        "--status",
        default="open",
        choices=["open", "all"],
        help="Which requests to show (default: open)",
    )
    args = parser.parse_args()

    supabase_url     = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    caller_email     = get_env("SIMPLIFI_CALLER_EMAIL")

    # Look up the coordinator by email.
    users = supabase_get(
        supabase_url, service_role_key,
        f"users?email=eq.{urllib.parse.quote(caller_email)}&select=id,name&limit=1",
    )
    if not users:
        print(json.dumps({"ok": False, "error": f"No coordinator found for {caller_email}"}), file=sys.stderr)
        sys.exit(1)

    coordinator = users[0]
    coordinator_id = coordinator["id"]

    status_filter = "&status=eq.open" if args.status == "open" else ""
    rows = supabase_get(
        supabase_url, service_role_key,
        (
            f"requests"
            f"?coordinator_id=eq.{coordinator_id}"
            f"{status_filter}"
            f"&order=created_at.desc"
            f"&select=id,student_name,student_email,subject,source,status,"
            f"created_at,notes,timezone,start_date,requested_schedule,offered_rate"
        ),
    )

    requests_out = []
    for r in rows:
        requests_out.append({
            "id":         r["id"],
            "student":    r["student_name"],
            "subject":    r.get("subject") or "—",
            "source":     r.get("source", "manual"),
            "status":     r.get("status", "open"),
            "received":   time_ago(r["created_at"]),
            "start_date": r.get("start_date") or "—",
            "timezone":   r.get("timezone") or "—",
            "schedule":   fmt_schedule(r.get("requested_schedule") or []),
            "offered_rate": f"${r['offered_rate']}/hr" if r.get("offered_rate") else "—",
            "notes":      ((r.get("notes") or "")[:120] +
                           ("…" if len(r.get("notes") or "") > 120 else "")),
        })

    print(json.dumps({
        "ok":            True,
        "coordinator":   coordinator["name"],
        "status_filter": args.status,
        "count":         len(requests_out),
        "requests":      requests_out,
    }, indent=2))


if __name__ == "__main__":
    main()
