"use client";

interface StepNameProps {
  value: string;
  onChange: (name: string) => void;
}

export function StepName({ value, onChange }: StepNameProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Name your hub</h2>
      <p className="text-sm text-muted-foreground mb-6">
        This is the client-facing name. A URL slug will be generated automatically.
      </p>

      <div>
        <label htmlFor="hub-name" className="block text-sm font-medium mb-1.5">
          Hub Name
        </label>
        <input
          id="hub-name"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Acme Corp"
          autoFocus
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground/60"
        />
        {value.trim() && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Slug: <span className="font-mono">{value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}</span>
          </p>
        )}
      </div>
    </div>
  );
}
