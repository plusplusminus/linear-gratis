"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useHub } from "@/contexts/hub-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Loader2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import type { FormField, FormFieldType } from "@/lib/supabase";

type FormData = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  confirmation_message: string;
  error_message: string;
  fields: FormField[];
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function FormModal({
  formId,
  hubId,
  teamId: contextTeamId,
  projectId: contextProjectId,
  onClose,
  onSubmitted,
}: {
  formId: string;
  hubId: string;
  teamId: string | null;
  projectId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { email, firstName, lastName, teams } = useHub();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [attachmentPaths, setAttachmentPaths] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    contextTeamId ?? (teams.length === 1 ? teams[0].id : "")
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>(contextProjectId ?? "");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [responseMessage, setResponseMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || email;

  // Fetch projects for selected team
  useEffect(() => {
    if (!selectedTeamId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    async function loadProjects() {
      try {
        const res = await fetch(`/api/hub/${hubId}/projects`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Array<{ id: string; name: string }>;
        if (!cancelled) setProjects(data);
      } catch {
        // Non-critical
      }
    }
    loadProjects();
    return () => { cancelled = true; };
  }, [hubId, selectedTeamId]);

  // Fetch form data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/hub/${hubId}/forms/${formId}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as FormData;
        if (!cancelled) {
          setForm(data);
          // Initialize default values
          const defaults: Record<string, string> = {};
          for (const field of data.fields) {
            if (field.default_value) {
              defaults[field.field_key] = field.default_value;
            }
            if (field.field_type === "checkbox") {
              defaults[field.field_key] = defaults[field.field_key] || "false";
            }
          }
          setFieldValues(defaults);
        }
      } catch {
        // Will show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [hubId, formId]);

  const setFieldValue = useCallback((key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleFileUpload = useCallback(
    async (field: FormField, file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        setValidationErrors((prev) => new Set(prev).add(field.field_key));
        return;
      }

      setUploadingFields((prev) => new Set(prev).add(field.field_key));

      try {
        const res = await fetch(`/api/hub/${hubId}/submissions/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });
        if (!res.ok) throw new Error("Upload failed");

        const { signedUrl, storagePath } = (await res.json()) as {
          signedUrl: string;
          storagePath: string;
          publicUrl: string;
        };

        await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        setAttachmentPaths((prev) => ({ ...prev, [field.field_key]: storagePath }));
        setFieldValue(field.field_key, file.name);
      } catch {
        setValidationErrors((prev) => new Set(prev).add(field.field_key));
      } finally {
        setUploadingFields((prev) => {
          const next = new Set(prev);
          next.delete(field.field_key);
          return next;
        });
      }
    },
    [hubId, setFieldValue]
  );

  const needsTeamPicker = !contextTeamId && teams.length > 1;

  const validate = useCallback((): boolean => {
    if (!form) return false;
    const errors = new Set<string>();
    if (needsTeamPicker && !selectedTeamId) {
      errors.add("__team__");
    }
    for (const field of form.fields) {
      if (field.is_hidden) continue;
      if (field.is_required) {
        const val = fieldValues[field.field_key]?.trim();
        if (!val || val === "false") {
          errors.add(field.field_key);
        }
      }
    }
    setValidationErrors(errors);
    return errors.size === 0;
  }, [form, fieldValues, needsTeamPicker, selectedTeamId]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setSubmitState("submitting");

    try {
      const res = await fetch(`/api/hub/${hubId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          fieldValues,
          attachmentPaths: Object.values(attachmentPaths),
          teamId: selectedTeamId || null,
          projectId: selectedProjectId && selectedProjectId !== "__none__" ? selectedProjectId : null,
        }),
      });

      const data = (await res.json()) as {
        confirmationMessage?: string;
        errorMessage?: string;
      };

      if (!res.ok) {
        setResponseMessage(data.errorMessage || form?.error_message || "Something went wrong");
        setSubmitState("error");
        return;
      }

      setResponseMessage(data.confirmationMessage || form?.confirmation_message || "Submitted successfully");
      setSubmitState("success");
      onSubmitted();
    } catch {
      setResponseMessage(form?.error_message || "Something went wrong");
      setSubmitState("error");
    }
  }, [validate, hubId, formId, fieldValues, attachmentPaths, form, onSubmitted, selectedTeamId, selectedProjectId]);

  const renderField = (field: FormField) => {
    if (field.is_hidden) return null;

    const hasError = validationErrors.has(field.field_key);
    const value = fieldValues[field.field_key] || "";

    const fieldRenderers: Record<FormFieldType, () => React.ReactNode> = {
      text: () => (
        <Input
          value={value}
          onChange={(e) => setFieldValue(field.field_key, e.target.value)}
          placeholder={field.placeholder || undefined}
          aria-invalid={hasError || undefined}
        />
      ),
      textarea: () => (
        <Textarea
          value={value}
          onChange={(e) => setFieldValue(field.field_key, e.target.value)}
          placeholder={field.placeholder || undefined}
          rows={4}
          className="resize-none"
          aria-invalid={hasError || undefined}
        />
      ),
      url: () => (
        <Input
          type="url"
          value={value}
          onChange={(e) => setFieldValue(field.field_key, e.target.value)}
          placeholder={field.placeholder || "https://..."}
          aria-invalid={hasError || undefined}
        />
      ),
      select: () => (
        <Select value={value} onValueChange={(v) => setFieldValue(field.field_key, v)}>
          <SelectTrigger className="w-full" aria-invalid={hasError || undefined}>
            <SelectValue placeholder={field.placeholder || "Select an option"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
      radio: () => (
        <div className="space-y-2">
          {field.options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 text-sm cursor-pointer"
            >
              <input
                type="radio"
                name={field.field_key}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => setFieldValue(field.field_key, opt.value)}
                className="accent-primary"
              />
              <span className="text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      ),
      checkbox: () => (
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={value === "true"}
            onChange={() =>
              setFieldValue(field.field_key, value === "true" ? "false" : "true")
            }
          />
          {field.description && (
            <span className="text-sm text-foreground">{field.description}</span>
          )}
        </div>
      ),
      file: () => (
        <div>
          <input
            ref={(el) => { fileInputRefs.current[field.field_key] = el; }}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(field, file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRefs.current[field.field_key]?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-input rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors w-full"
          >
            {uploadingFields.has(field.field_key) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {value || "Choose image..."}
          </button>
          {hasError && !value && (
            <p className="text-xs text-destructive mt-1">File is required</p>
          )}
          {hasError && value && (
            <p className="text-xs text-destructive mt-1">File must be under 10MB</p>
          )}
        </div>
      ),
    };

    return (
      <div key={field.id}>
        {field.field_type !== "checkbox" && (
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {field.label}
            {!field.is_required && (
              <span className="text-muted-foreground/60 font-normal ml-1">
                (optional)
              </span>
            )}
          </label>
        )}
        {field.field_type !== "checkbox" && field.description && (
          <p className="text-xs text-muted-foreground/70 mb-1.5">{field.description}</p>
        )}
        {fieldRenderers[field.field_type]()}
        {hasError && field.field_type !== "file" && (
          <p className="text-xs text-destructive mt-1">This field is required</p>
        )}
      </div>
    );
  };

  // Success / Error result screens
  if (submitState === "success" || submitState === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-lg border border-border bg-background shadow-lg mx-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {submitState === "success" ? "Submitted" : "Error"}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
            {submitState === "success" ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : (
              <AlertCircle className="w-8 h-8 text-destructive" />
            )}
            <p className="text-sm text-foreground">{responseMessage}</p>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            {submitState === "error" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSubmitState("idle")}
              >
                Try Again
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-background shadow-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            {loading ? "Loading..." : form?.name || "Submit Form"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : form ? (
          <>
            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Identity */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Submitting as
                </label>
                <div className="text-sm text-foreground">
                  {displayName}
                  {displayName !== email && (
                    <span className="text-muted-foreground ml-1.5">
                      ({email})
                    </span>
                  )}
                </div>
              </div>

              {/* Team — picker if multiple teams, read-only if derived from URL */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Team
                </label>
                {needsTeamPicker ? (
                  <>
                    <Select
                      value={selectedTeamId}
                      onValueChange={(v) => {
                        setSelectedTeamId(v);
                        setSelectedProjectId("");
                      }}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={validationErrors.has("__team__") || undefined}
                      >
                        <SelectValue placeholder="Select a team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {validationErrors.has("__team__") && (
                      <p className="text-xs text-destructive mt-1">Please select a team</p>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-foreground">
                    {teams.find((t) => t.id === selectedTeamId)?.name ?? selectedTeamId}
                  </div>
                )}
              </div>

              {/* Project — optional picker, pre-filled from URL context */}
              {selectedTeamId && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Project
                    <span className="text-muted-foreground/60 font-normal ml-1">(optional)</span>
                  </label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dynamic fields */}
              {form.fields
                .sort((a, b) => a.display_order - b.display_order)
                .map(renderField)}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={submitState === "submitting" || uploadingFields.size > 0}
                onClick={handleSubmit}
              >
                {submitState === "submitting" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Submit
              </Button>
            </div>
          </>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Failed to load form. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}
