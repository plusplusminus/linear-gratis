"use client";

import { use } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { FormBuilder } from "@/components/admin/form-builder";
import { Loader2 } from "lucide-react";
import type { FormTemplate, FormField } from "@/lib/supabase";

type FormWithFields = FormTemplate & { fields: FormField[] };

interface HubTeamMapping {
  linear_team_id: string;
  linear_team_name: string | null;
}

export default function FormDetailPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = use(params);
  const isNew = formId === "new";

  const { data: form, loading, error } = useFetch<FormWithFields>(
    isNew ? null : `/api/admin/forms/${formId}`
  );

  // Fetch hub team mappings when editing a hub-specific form
  const hubId = form?.hub_id ?? null;
  const { data: hubTeams } = useFetch<HubTeamMapping[]>(
    hubId ? `/api/admin/hubs/${hubId}/teams` : null
  );

  if (!isNew && loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading form...
        </div>
      </div>
    );
  }

  if (!isNew && error) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="text-sm text-destructive py-8 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <FormBuilder
        form={isNew ? null : form ?? null}
        hubId={hubId ?? undefined}
        hubTeams={hubTeams ?? undefined}
      />
    </div>
  );
}
