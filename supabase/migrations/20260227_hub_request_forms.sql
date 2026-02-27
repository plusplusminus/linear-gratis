-- Add request_forms_enabled to client_hubs
ALTER TABLE client_hubs
  ADD COLUMN IF NOT EXISTS request_forms_enabled BOOLEAN NOT NULL DEFAULT false;
