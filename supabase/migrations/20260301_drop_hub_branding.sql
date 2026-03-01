-- Remove per-hub branding columns (branding is no longer per-hub)
ALTER TABLE client_hubs
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS primary_color,
  DROP COLUMN IF EXISTS accent_color,
  DROP COLUMN IF EXISTS footer_text;
