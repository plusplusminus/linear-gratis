-- Add button customization fields to form_templates
ALTER TABLE form_templates ADD COLUMN button_label text;
ALTER TABLE form_templates ADD COLUMN button_icon text;
