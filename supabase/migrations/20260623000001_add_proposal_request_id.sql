-- Add request_id to proposals so expired proposals can reopen their linked request.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES public.requests(id);

CREATE INDEX IF NOT EXISTS proposals_request_id_idx ON public.proposals (request_id)
  WHERE request_id IS NOT NULL;
