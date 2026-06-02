"""
invite.py — Invite a tutor or coordinator to Simplifi EDU.

Uses Supabase admin generate_link (no Supabase email sent) + Nylas to send
the invite email, bypassing Supabase's rate-limited email delivery.

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
import ssl
import sys
import urllib.request
import urllib.error
import urllib.parse

import certifi


def get_env(name: str) -> str:
    val = os.environ.get(name, "")
    if not val:
        print(json.dumps({"ok": False, "error": f"Missing environment variable: {name}"}))
        sys.exit(3)
    return val


def _ssl_ctx() -> ssl.SSLContext:
    return ssl.create_default_context(cafile=certifi.where())


def supabase_request(method: str, url: str, service_role_key: str, data: dict | None = None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        **({"Prefer": "return=representation"} if method in ("POST", "PATCH") else {}),
    })
    try:
        with urllib.request.urlopen(req, context=_ssl_ctx()) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}


def resend_send_invite(api_key: str, recipient_email: str, recipient_name: str, action_link: str) -> None:
    """Send the invite email via Resend. Exits with code 1 on failure."""
    html_body = f"""<html>
<body style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:8px">Welcome to Simplifi EDU</h2>
  <p>Hi {recipient_name},</p>
  <p>You've been invited to join Simplifi EDU. Click the button below to set up your account:</p>
  <p style="margin:32px 0">
    <a href="{action_link}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      Accept invitation
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    This link expires in 24 hours. If you didn't expect this invitation, you can ignore this email.
  </p>
  <p style="color:#666;font-size:13px">— The Simplifi EDU team</p>
</body>
</html>"""

    payload = json.dumps({
        "from": "Simplifi EDU <info@simplifiedu.com>",
        "to": [{"name": recipient_name, "email": recipient_email}],
        "subject": "You're invited to Simplifi EDU",
        "html": html_body,
    }).encode()

    req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST", headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, context=_ssl_ctx()) as resp:
            if resp.status not in (200, 201):
                print(json.dumps({"ok": False, "error": f"Resend returned status {resp.status}"}))
                sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(json.dumps({"ok": False, "error": f"Resend email failed: {body[:200]}"}))
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Invite a tutor or coordinator.")
    parser.add_argument("--email", required=True, help="Invitee email address")
    parser.add_argument("--name",  required=True, help="Invitee full name")
    parser.add_argument("--role",  default="TUTOR", choices=["TUTOR", "COORDINATOR"],
                        help="Role to assign (default: TUTOR)")
    args = parser.parse_args()

    supabase_url     = get_env("NEXT_PUBLIC_SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    resend_api_key   = get_env("RESEND_API_KEY")
    site_url         = get_env("SIMPLIFI_APP_URL").rstrip("/")

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

    # Generate the magic link without triggering Supabase's email delivery.
    # redirectTo routes through /auth/callback so the PKCE code is exchanged
    # before landing at /onboarding — avoids an unnecessary redirect hop.
    redirect_to = f"{site_url}/auth/callback?next=/onboarding" if site_url else ""
    status, auth_data = supabase_request(
        "POST",
        f"{supabase_url}/auth/v1/admin/generate_link",
        service_role_key,
        {
            "type": "invite",
            "email": email,
            "data": {"name": name},
            **({"redirect_to": redirect_to} if redirect_to else {}),
        },
    )

    if status not in (200, 201):
        err = auth_data.get("msg") or auth_data.get("error") or auth_data.get("message") or str(auth_data)
        if status == 422 or "already" in str(err).lower():
            # User already exists in auth — look up their ID to continue with
            # profile row creation, then re-generate a link for them.
            status2, users_list = supabase_request(
                "GET",
                f"{supabase_url}/auth/v1/admin/users",
                service_role_key,
            )
            auth_id = None
            action_link = None
            if isinstance(users_list, dict):
                for u in users_list.get("users", []):
                    if u.get("email", "").lower() == email:
                        auth_id = u["id"]
                        break
            if not auth_id:
                print(json.dumps({"ok": False, "error": f"Auth user exists but could not retrieve ID: {err}"}))
                sys.exit(1)
            # Generate a magic link for the existing user
            status3, link_data = supabase_request(
                "POST",
                f"{supabase_url}/auth/v1/admin/generate_link",
                service_role_key,
                {
                    "type": "magiclink",
                    "email": email,
                    **({"redirect_to": redirect_to} if redirect_to else {}),
                },
            )
            if status3 in (200, 201):
                action_link = link_data.get("action_link") or (link_data.get("properties") or {}).get("action_link")
        else:
            print(json.dumps({"ok": False, "error": f"Failed to generate invite link: {err}"}))
            sys.exit(1)
    else:
        # GoTrue REST API returns action_link at the top level.
        # The JS SDK adds the "properties" wrapper — do not rely on it here.
        action_link = auth_data.get("action_link") or (auth_data.get("properties") or {}).get("action_link")
        user_obj = auth_data.get("user") or {}
        auth_id = user_obj.get("id") or auth_data.get("id")

    if not auth_id:
        print(json.dumps({"ok": False, "error": "Could not determine auth user ID"}))
        sys.exit(1)

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

    # Send invite email via Resend
    if not action_link:
        print(json.dumps({"ok": False, "error": "action_link missing from generate_link response"}))
        sys.exit(1)
    resend_send_invite(resend_api_key, email, name, action_link)

    print(json.dumps({
        "ok":     True,
        "email":  email,
        "name":   name,
        "role":   role,
        "status": "PENDING",
    }))


if __name__ == "__main__":
    main()
