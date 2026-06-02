# Simplifi EDU — MCP Server

Exposes Simplifi coordinator skills as MCP tools so they can be called from Claude Cowork (claude.ai) or any other MCP-compatible client.

## Tools

| Tool | Description |
|---|---|
| `show_requests` | List the coordinator's open (or all) tutoring requests |
| `list_tutors` | List active tutors with name + email |
| `send_proposal` | Send a tutoring proposal to a tutor |
| `create_request` | Log a new tutoring request from intake |
| `show_availability` | Show tutor working hours and busy blocks for this week and next |

## Setup

### 1. Environment variables

Create a `.env` file (or set these in your hosting environment):

```
SIMPLIFI_APP_URL=https://simplifi-scheduler.vercel.app
SKILL_API_KEY=<your skill API key>
NEXT_PUBLIC_SUPABASE_URL=https://moqrnqwlxaddiifajvqv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
PORT=3001
```

### 2. Run locally

```bash
npm install
npm run dev
```

The server starts at `http://localhost:3001`. Test with:

```bash
curl http://localhost:3001/
# → {"ok":true,"server":"simplifi-edu-mcp"}
```

### 3. Deploy to Railway / Render / Fly.io

Any Node.js host works. Build with `npm run build`, start with `npm start`.

For Railway: connect this directory, set the env vars, and Railway auto-detects the start script.

### 4. Connect to Claude Cowork

1. Go to **claude.ai → Settings → Integrations** (or your team's Claude for Work admin panel)
2. Add a new MCP integration with the URL of your deployed server (e.g. `https://simplifi-mcp.railway.app`)
3. Once connected, tools appear automatically in any Claude conversation

### Usage in Claude Cowork

Natural language works — no slash commands needed:

```
Show me my open requests
Send the Physics request for Maksim's Son to Austin Rubinger
Who's available next week?
Log this intake: [paste transcript]
```

## Architecture

The MCP server is a thin HTTP wrapper:
- **Read operations** (`show_requests`, `list_tutors`, `show_availability`) query Supabase directly via the service role key
- **Write operations** (`send_proposal`, `create_request`) call the Next.js app's API routes with `SKILL_API_KEY` auth

Credentials never leave the server — Claude Cowork only sees the tool results.
