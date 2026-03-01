import { FormBuilder } from "@/components/admin/form-builder";

export default async function NewHubFormPage({
  params,
}: {
  params: Promise<{ hubId: string }>;
}) {
  const { hubId } = await params;

  return (
    <div className="p-6">
      <FormBuilder hubId={hubId} form={null} />
    </div>
  );
}
