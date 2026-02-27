-- Drop legacy tables that are no longer used after hub convergence.
-- The hub system replaces all public views, forms, and roadmaps.

-- Drop dependent objects first
DROP TABLE IF EXISTS roadmap_comments CASCADE;
DROP TABLE IF EXISTS roadmap_votes CASCADE;
DROP TABLE IF EXISTS roadmaps CASCADE;
DROP TABLE IF EXISTS customer_request_forms CASCADE;
DROP TABLE IF EXISTS public_views CASCADE;
DROP TABLE IF EXISTS branding_settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Update custom_domains target_type constraint to only allow 'hub'
ALTER TABLE custom_domains DROP CONSTRAINT IF EXISTS custom_domains_target_type_check;
ALTER TABLE custom_domains ADD CONSTRAINT custom_domains_target_type_check
  CHECK (target_type IN ('hub'));
