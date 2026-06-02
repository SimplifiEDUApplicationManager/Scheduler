-- Stores feedback left by coordinators via the MCP skill tools.
create table if not exists skill_feedback (
  id               uuid default gen_random_uuid() primary key,
  message          text not null,
  context          text,               -- which skill/tool was being used
  coordinator_name text,               -- display name of the coordinator
  created_at       timestamptz default now()
);
