-- Form system: admin-configurable form templates, submission storage, file uploads
-- Replaces the minimal request_forms_enabled flag with a full form builder

-- ============================================================
-- form_templates — Global and per-hub form definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS form_templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id               uuid REFERENCES client_hubs(id) ON DELETE CASCADE, -- NULL = global
  type                 text NOT NULL CHECK (type IN ('bug', 'feature', 'custom')),
  name                 text NOT NULL,
  description          text,
  is_active            boolean NOT NULL DEFAULT true,
  -- Linear routing defaults (admin pre-sets)
  target_team_id       text,
  target_project_id    text,
  target_cycle_id      text,
  target_label_ids     text[] DEFAULT '{}',
  target_priority      int,
  -- Messaging
  confirmation_message text NOT NULL DEFAULT 'Your request has been submitted successfully.',
  error_message        text NOT NULL DEFAULT 'Something went wrong submitting your request. Please try again.',
  display_order        int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- form_fields — Fields belonging to a form template
-- ============================================================
CREATE TABLE IF NOT EXISTS form_fields (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         uuid NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  field_key       text NOT NULL,
  field_type      text NOT NULL CHECK (field_type IN ('text', 'textarea', 'select', 'radio', 'checkbox', 'file', 'url')),
  label           text NOT NULL,
  description     text,
  placeholder     text,
  is_required     boolean NOT NULL DEFAULT false,
  is_removable    boolean NOT NULL DEFAULT true,
  is_hidden       boolean NOT NULL DEFAULT false,
  linear_field    text CHECK (linear_field IN ('title', 'description', 'priority', 'label_ids', 'project_id', 'cycle_id')),
  options         jsonb DEFAULT '[]',
  default_value   text,
  display_order   int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(form_id, field_key)
);

-- ============================================================
-- hub_form_config — Per-hub overrides for global forms
-- ============================================================
CREATE TABLE IF NOT EXISTS hub_form_config (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id               uuid NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  form_id              uuid NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  is_enabled           boolean NOT NULL DEFAULT true,
  target_team_id       text,
  target_project_id    text,
  target_cycle_id      text,
  target_label_ids     text[],
  target_priority      int,
  confirmation_message text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hub_id, form_id)
);

-- ============================================================
-- form_submissions — Local record of every submission
-- ============================================================
CREATE TABLE IF NOT EXISTS form_submissions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id                  uuid NOT NULL REFERENCES form_templates(id),
  hub_id                   uuid NOT NULL REFERENCES client_hubs(id),
  submitter_user_id        text NOT NULL,
  submitter_email          text NOT NULL,
  submitter_name           text,
  field_values             jsonb NOT NULL DEFAULT '{}',
  derived_title            text NOT NULL,
  sync_status              text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  linear_issue_id          text,
  linear_issue_identifier  text,
  sync_error               text,
  sync_attempted_at        timestamptz,
  attachment_paths         text[] DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(form_id, display_order);
CREATE INDEX IF NOT EXISTS idx_hub_form_config_hub ON hub_form_config(hub_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_hub ON form_submissions(hub_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitter ON form_submissions(hub_id, submitter_user_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_sync ON form_submissions(sync_status) WHERE sync_status != 'synced';
CREATE INDEX IF NOT EXISTS idx_form_templates_global ON form_templates(is_active) WHERE hub_id IS NULL;

-- ============================================================
-- Seed: Bug Report global template
-- ============================================================
DO $$
DECLARE
  bug_form_id uuid;
  feature_form_id uuid;
BEGIN
  INSERT INTO form_templates (type, name, description, display_order)
  VALUES ('bug', 'Bug Report', 'Report a bug or issue you''ve encountered.', 0)
  RETURNING id INTO bug_form_id;

  INSERT INTO form_fields (form_id, field_key, field_type, label, placeholder, is_required, is_removable, linear_field, display_order) VALUES
    (bug_form_id, 'title',              'text',     'Title',               'Brief summary of the bug',        true,  false, 'title',       0),
    (bug_form_id, 'description',        'textarea', 'Description',         'Describe the bug in detail...',   true,  false, 'description', 1),
    (bug_form_id, 'steps_to_reproduce', 'textarea', 'Steps to Reproduce',  '1. Go to...\n2. Click...',       false, true,  NULL,          2),
    (bug_form_id, 'expected_behavior',  'textarea', 'Expected Behavior',   'What should have happened?',      false, true,  NULL,          3),
    (bug_form_id, 'screenshots',        'file',     'Screenshots',         NULL,                              false, true,  NULL,          4),
    (bug_form_id, 'video_url',          'url',      'Video URL',           'https://...',                     false, true,  NULL,          5);

  -- ============================================================
  -- Seed: Feature Request global template
  -- ============================================================
  INSERT INTO form_templates (type, name, description, display_order)
  VALUES ('feature', 'Feature Request', 'Suggest a new feature or improvement.', 1)
  RETURNING id INTO feature_form_id;

  INSERT INTO form_fields (form_id, field_key, field_type, label, placeholder, is_required, is_removable, linear_field, display_order) VALUES
    (feature_form_id, 'title',       'text',     'Title',       'Brief summary of the feature',      true,  false, 'title',       0),
    (feature_form_id, 'description', 'textarea', 'Description', 'Describe the feature you''d like...', true,  false, 'description', 1),
    (feature_form_id, 'use_case',    'textarea', 'Use Case',    'Why do you need this feature?',     false, true,  NULL,          2),
    (feature_form_id, 'screenshots', 'file',     'Screenshots', NULL,                                false, true,  NULL,          3);
END $$;

-- ============================================================
-- Supabase Storage bucket for form attachments
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-attachments', 'form-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated reads (public bucket)
CREATE POLICY "form_attachments_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'form-attachments');

-- Allow authenticated uploads via signed URLs (service role handles signing)
CREATE POLICY "form_attachments_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'form-attachments');
