"""
send_request.py — Send a proposal to a tutor from a Claude skill.

Preferred usage (from an existing open request):
  python -m scripts.commands.send_request \
    --tutor "julia@simplifi.edu" \
    --request-id "<uuid>"

Manual usage (all fields explicit):
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

When --request-id is provided, all student/schedule fields are pulled directly
from the open request record (exactly as the web app does) and any explicit
--student-name / --schedule / etc. flags are ignored.

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

DAY_NAME_TO_NUM = {
    "SUN": 0, "MON": 1, "TUE": 2, "WED": 3,
    "THU": 4, "FRI": 5, "SAT": 6,
}


def get_env(name: str) -> str:
    val = os.environ.get(name, "")
    if not val:
        print(json.dumps({"ok": False, "error": f"Missing environment variable: {name}"}))
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
        print(json.dumps({"ok": False, "error": f"Supabase request failed: {body}"}))
        sys.exit(1)


def lookup_tutor(supabase_url: str, service_role_key: str, email: str) -> dict | None:
    rows = supabase_get(
        supabase_url, service_role_key,
        f"users?email=eq.{urllib.parse.quote(email)}&select=id,name,status,role",
    )
    return rows[0] if rows else None


def lookup_request(supabase_url: str, service_role_key: str, request_id: str) -> dict | None:
    rows = supabase_get(
        supabase_url, service_role_key,
        f"requests?id=eq.{urllib.parse.quote(request_id)}&select=*",
    )
    return rows[0] if rows else None


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


def parse_schedule_flags(schedule_flags: list[str]) -> list[dict]:
    """Convert ['MON:18:00-23:00', ...] to [{day: 1, start: 18, end: 23}, ...]."""
    schedule = []
    for s in schedule_flags:
        try:
            day_str, times = s.split(":", 1)
            start_str, end_str = times.split("-", 1)
            day_num = DAY_NAME_TO_NUM.get(day_str.upper())
            if day_num is None:
                raise ValueError(f"Unknown day {day_str!r}")
            start_h = int(start_str.split(":")[0])
            end_h   = int(end_str.split(":")[0])
            schedule.append({"day": day_num, "start": start_h, "end": end_h})
        except (ValueError, IndexError):
            print(json.dumps({"ok": False, "error": f"Invalid schedule format {s!r}. Expected DAY:HH:MM-HH:MM."}))
            sys.exit(1)
    return schedule


def main():
    parser = argparse.ArgumentParser(description="Send a proposal to a tutor.")
    parser.add_argument("--tutor",         required=True,  help="Tutor email address")
    parser.add_argument("--request-id",    default=None,   help="ID of an existing open request (preferred)")
    parser.add_argument("--student-name",  default=None,   help="Student full name (manual mode)")
    parser.add_argument("--student-email", default=None,   help="Student email address (manual mode)")
    parser.add_argument("--subject",       default=None,   help="Subject (manual mode)")
    parser.add_argument("--schedule",      default=None,   action="append",
                        help="Schedule tuple: DAY:HH:MM-HH:MM (manual mode, repeatable)")
    parser.add_argument("--timezone",      default=None,   help="Student timezone IANA (manual mode)")
    parser.add_argument("--start-date",    default=None,   help="Start date YYYY-MM-DD (optional)")
    parser.add_argument("--notes",         default=None,   help="Free-text notes for the tutor (optional)")
    parser.add_argument("--rate",          default=None,   type=int,
                        help="Offered hourly rate in $: 20, 25, 30, 35, or 40 (optional)")
    args = parser.parse_args()

    supabase_url     = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    app_url          = get_env("SIMPLIFI_APP_URL")
    skill_api_key    = get_env("SKILL_API_KEY")

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

    # Build payload — prefer request record over manual flags
    if args.request_id:
        req_row = lookup_request(supabase_url, service_role_key, args.request_id)
        if req_row is None:
            print(json.dumps({"ok": False, "error": f"No request found with id {args.request_id!r}."}))
            sys.exit(1)
        payload = {
            "tutor_id":           tutor["id"],
            "student_name":       req_row["student_name"],
            "student_email":      req_row["student_email"],
            "subject":            req_row["subject"],
            "requested_schedule": req_row["requested_schedule"],  # pass through as-is
            "timezone":           req_row["timezone"],
            "start_date":         args.start_date or req_row.get("start_date"),
            "notes":              args.notes or req_row.get("notes"),
            "offered_rate":       args.rate or req_row.get("offered_rate"),
            "asana_task_id":      req_row.get("asana_task_id"),
        }
        student_name = req_row["student_name"]
        subject      = req_row["subject"]
    else:
        # Manual mode — require all fields
        missing = [f for f, v in [
            ("--student-name",  args.student_name),
            ("--student-email", args.student_email),
            ("--subject",       args.subject),
            ("--schedule",      args.schedule),
            ("--timezone",      args.timezone),
        ] if not v]
        if missing:
            print(json.dumps({"ok": False, "error": f"Missing required flags: {', '.join(missing)}. Use --request-id to pull from an existing request instead."}))
            sys.exit(1)

        schedule = parse_schedule_flags(args.schedule)
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
        student_name = args.student_name
        subject      = args.subject

    result = create_proposal(app_url, skill_api_key, payload)

    print(json.dumps({
        "ok":           True,
        "proposal_id":  result["id"],
        "tutor_name":   tutor["name"],
        "tutor_email":  args.tutor,
        "student_name": student_name,
        "subject":      subject,
    }))


if __name__ == "__main__":
    main()
