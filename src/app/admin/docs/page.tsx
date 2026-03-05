import fs from "fs";
import path from "path";
import Link from "next/link";
import { FileText } from "lucide-react";

const docsDir = path.join(process.cwd(), "docs", "admin");

function getAdminDocs() {
  if (!fs.existsSync(docsDir)) return [];
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md")).sort();
  return files.flatMap((f) => {
    try {
      const content = fs.readFileSync(path.join(docsDir, f), "utf-8");
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const descMatch = content.match(/^#\s+.+\n+(.+)$/m);
      return {
        slug: f.replace(/\.md$/, ""),
        title: titleMatch ? titleMatch[1] : f.replace(/[-_]/g, " ").replace(/\.md$/, ""),
        description: descMatch ? descMatch[1] : "",
      };
    } catch (err) {
      console.error(`Failed to parse doc ${f}:`, err);
      return [];
    }
  });
}

export default function AdminDocsPage() {
  const docs = getAdminDocs();

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-lg font-semibold text-foreground mb-1">
        Documentation
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Guides and reference material for managing the platform.
      </p>

      <div className="space-y-1">
        {docs.map((doc) => (
          <Link
            key={doc.slug}
            href={`/admin/docs/${encodeURIComponent(doc.slug)}`}
            className="flex items-start gap-3 px-3 py-3 rounded-md text-sm transition-colors hover:bg-accent/50 group"
          >
            <FileText className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
            <div className="min-w-0">
              <span className="font-medium text-foreground">{doc.title}</span>
              {doc.description && (
                <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                  {doc.description}
                </p>
              )}
            </div>
          </Link>
        ))}
        {docs.length === 0 && (
          <p className="text-sm text-muted-foreground px-3 py-6">
            No documentation available.
          </p>
        )}
      </div>
    </div>
  );
}
