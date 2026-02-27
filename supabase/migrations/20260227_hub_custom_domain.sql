-- Add 'hub' to the custom_domains target_type CHECK constraint
ALTER TABLE custom_domains
  DROP CONSTRAINT IF EXISTS custom_domains_target_type_check;

ALTER TABLE custom_domains
  ADD CONSTRAINT custom_domains_target_type_check
  CHECK (target_type IN ('form', 'view', 'roadmap', 'hub'));
