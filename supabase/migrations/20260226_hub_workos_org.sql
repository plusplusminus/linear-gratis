-- Epic 2, Spec 2.1: PPMLG-60
-- Add WorkOS Organization ID to client_hubs for isolated auth per hub

ALTER TABLE client_hubs
  ADD COLUMN workos_org_id TEXT UNIQUE;

CREATE INDEX idx_client_hubs_workos_org ON client_hubs(workos_org_id)
  WHERE workos_org_id IS NOT NULL;
