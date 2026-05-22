"""
send_request.py — Send a proposal to a tutor from a Claude skill.

Usage:
  python -m scripts.commands.send_request \
    --tutor "julia@simplifi.edu" \
    --student-name "Ava Rodriguez" \
    --student-email "ava@example.com" \
    --subject "AP Calculus BC" \
    --schedule "TUE:16:00-17:00" \
    --schedule "THU:16:00-17:00" \
    --timezone "America/New_York" \
    [--start-date "2026-06-01"] \
    [--notes "Prefers structured review sessions."] \
    [--rate 30]

Exit codes:
  0 — proposal created successfully
  2 — tutor not found, not active, or not a tutor
  3 — permission denied (SKILL_API_KEY / SKILL_COORDINATOR_ID not configured)
  1 — any other error
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse


def get_env(name: str) -> str:
    val = os.environ.get(name, "")
    if not val:
        print(json.dumps({"ok": False, "error": f"Missing environment variable: {name}"}))
        sys.exit(3)
    return val


def lookup_tutor(supabase_url: str, service_role_key: str, email: str) -> dict | None:
    """Look up a tutor by email using the Supabase REST API."""
    url = (
        f"{supabase_url}/rest/v1/users"
        f"?email=eq.{urllib.parse.quote(email)}"
        f"&select=id,name,status,role"
    )
    req = urllib.request.Request(url, headers={
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            rows = json.loads(resp.read())
            return rows[0] if rows else None
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(json.dumps({"ok": False, "error": f"Supabase lookup failed: {body}"}))
        sys.exit(1)


def create_proposal(app_url: str, skill_api_key: str, payload: dict) -> dict:
    """POST /api/proposals using the skill bearer token."""
    url = f"{app_url.rstrip('/')}/api/proposals"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {skill_api_key}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
        except Exception:
            err = {"error": body}
        status = e.code
        if status in (401, 403):
            print(json.dumps({"ok": False, "error": err.get("error", "Permission denied")}))
            sys.exit(3)
        print(json.dumps({"ok": False, "error": err.get("error", f"HTTP {status}")}))
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Send a proposal to a tutor.")
    parser.add_argument("--tutor",         required=True,  help="Tutor email address")
    parser.add_argument("--student-name",  required=True,  help="Student full name")
    parser.add_argument("--student-email", required=True,  help="Student email address")
    parser.add_argument("--subject",       required=True,  help="Subject (e.g. 'AP Calculus BC')")
    parser.add_argument("--schedule",      required=True,  action="append",
                        help="Schedule tuple: DAY:HH:MM-HH:MM (repeatable, e.g. TUE:16:00-17:00)")
    parser.add_argument("--timezone",      required=True,  help="Student timezone (IANA, e.g. America/New_York)")
    parser.add_argument("--start-date",    default=None,   help="Start date YYYY-MM-DD (optional)")
    parser.add_argument("--notes",         default=None,   help="Free-text notes for the tutor (optional)")
    parser.add_argument("--rate",          default=None,   type=int,
                        help="Offered hourly rate in $: 20, 25, 30, 35, or 40 (optional)")
    args = parser.parse_args()

    supabase_url      = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key  = get_env("SUPABASE_SERVICE_ROLE_KEY")
    app_url           = get_env("SIMPLIFI_APP_URL")
    skill_api_key     = get_env("SKILL_API_KEY")

    # Validate rate
    if args.rate is not None and args.rate not in (20, 25, 30, 35, 40):
        print(json.dumps({"ok": False, "error": "Rate must be 20, 25, 30, 35, or 40."}))
        sys.exit(1)

    # Look up tutor
    tutor = lookup_tutor(supabase_url, service_role_key, args.tutor)
    if tutor is None:
        print(json.dumps({"ok": False, "error": f"No user found with email {args.tutor!r}."}))
        sys.exit(2)
    if tutor["role"] != "TUTOR":
        print(json.dumps({"ok": False, "error": f"{args.tutor!r} is a {tutor['role']}, not a TUTOR."}))
        sys.exit(2)
    if tutor["status"] != "ACTIVE":
        print(json.dumps({"ok": False, "error": f"Tutor {args.tutor!r} is {tutor['status']}, not ACTIVE."}))
        sys.exit(2)

    # Build schedule payload
    schedule = []
    for s in args.schedule:
        try:
            day, times = s.split(":", 1)
            start, end = times.split("-", 1)
            schedule.append({"day": day.upper(), "start": start, "end": end})
        except ValueError:
            print(json.dumps({"ok": False, "error": f"Invalid schedule format {s!r}. Expected DAY:HH:MM-HH:MM."}))
            sys.exit(1)

    payload = {
        "tutor_id":           tutor["id"],
        "student_name":       args.student_name,
        "student_email":      args.student_email,
        "subject":            args.subject,
        "requested_schedule": schedule,
        "timezone":           args.timezone,
        "start_date":         args.start_date,
        "notes":              args.notes,
        "offered_rate":       args.rate,
    }

    result = create_proposal(app_url, skill_api_key, payload)

    print(json.dumps({
        "ok":           True,
        "proposal_id":  result["id"],
        "tutor_name":   tutor["name"],
        "tutor_email":  args.tutor,
        "student_name": args.student_name,
        "subject":      args.subject,
    }))


if __name__ == "__main__":
    main()
