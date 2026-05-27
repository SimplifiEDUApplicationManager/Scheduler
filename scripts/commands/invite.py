"""
invite.py — Invite a tutor or coordinator to Simplifi EDU.

Usage:
  python -m scripts.commands.invite \
    --email "jane@gmail.com" \
    --name "Jane Doe" \
    --role "TUTOR"          # or COORDINATOR (default: TUTOR)

Exit codes:
  0 — invite sent successfully
  2 — user already exists (prints current status and role)
  3 — permission denied (env vars missing)
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


def supabase_request(method: str, url: str, service_role_key: str, data: dict | None = None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        **({"Prefer": "return=representation"} if method in ("POST", "PATCH") else {}),
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}


def main():
    parser = argparse.ArgumentParser(description="Invite a tutor or coordinator.")
    parser.add_argument("--email", required=True, help="Invitee email address")
    parser.add_argument("--name",  required=True, help="Invitee full name")
    parser.add_argument("--role",  default="TUTOR", choices=["TUTOR", "COORDINATOR"],
                        help="Role to assign (default: TUTOR)")
    args = parser.parse_args()

    supabase_url     = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")

    email = args.email.strip().lower()
    name  = args.name.strip()
    role  = args.role.upper()

    # Check if user already exists in the users table
    status, existing = supabase_request(
        "GET",
        f"{supabase_url}/rest/v1/users?email=eq.{urllib.parse.quote(email)}&select=email,role,status",
        service_role_key,
    )
    if isinstance(existing, list) and existing:
        row = existing[0]
        print(json.dumps({
            "ok": False,
            "duplicate": True,
            "email": row["email"],
            "role": row["role"],
            "status": row["status"],
        }))
        sys.exit(2)

    # Send invite email via the proper Supabase invite endpoint
    status, auth_data = supabase_request(
        "POST",
        f"{supabase_url}/auth/v1/invite",
        service_role_key,
        {
            "email": email,
            "data": {"name": name},
        },
    )

    if status not in (200, 201):
        err = auth_data.get("msg") or auth_data.get("error") or auth_data.get("message") or str(auth_data)
        if status == 422 or "already" in str(err).lower():
            # User already exists in auth — look up their ID
            status2, users_list = supabase_request(
                "GET",
                f"{supabase_url}/auth/v1/admin/users",
                service_role_key,
            )
            auth_id = None
            if isinstance(users_list, dict):
                for u in users_list.get("users", []):
                    if u.get("email", "").lower() == email:
                        auth_id = u["id"]
                        break
            if not auth_id:
                print(json.dumps({"ok": False, "error": f"Auth user exists but could not retrieve ID: {err}"}))
                sys.exit(1)
        else:
            print(json.dumps({"ok": False, "error": f"Failed to send invite: {err}"}))
            sys.exit(1)
    else:
        auth_id = auth_data["id"]

    # Insert users table row
    insert_status, insert_data = supabase_request(
        "POST",
        f"{supabase_url}/rest/v1/users",
        service_role_key,
        {
            "id":               auth_id,
            "email":            email,
            "name":             name,
            "role":             role,
            "status":           "PENDING",
            "max_weekly_hours": 20,
            "min_weekly_hours": 6,
            "min_rate":         20,
        },
    )

    if insert_status not in (200, 201):
        err = (insert_data[0].get("message") if isinstance(insert_data, list) else insert_data.get("message")) or str(insert_data)
        print(json.dumps({"ok": False, "error": f"Failed to create user profile: {err}"}))
        sys.exit(1)

    print(json.dumps({
        "ok":     True,
        "email":  email,
        "name":   name,
        "role":   role,
        "status": "PENDING",
    }))


if __name__ == "__main__":
    main()
