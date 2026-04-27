-- Migration: fix_auth_role_search_path
-- Add SET search_path = public to auth_role() to prevent search-path hijacking.
-- A SECURITY DEFINER function without a fixed search_path is vulnerable to
-- schema-shadowing attacks where a fake public.users table returns arbitrary roles.

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid()
$$;
