"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentModal } from "./document-modal";

import type { ProjectDocument } from "./project-tabs";

type CycleLink = {
  id: string;
  label: string;
  url: string;
  createdAt: string;
};

type CycleDocumentsLinksProps = {
  documents: ProjectDocument[];
  links: CycleLink[];
};

export function CycleDocumentsLinks({ documents, links }: CycleDocumentsLinksProps) {
  const [openDoc, setOpenDoc] = useState<ProjectDocument | null>(null);

  if (documents.length === 0 && links.length === 0) return null;

  return (
    <div className="px-6 py-4 border-b border-border">
      {documents.length > 0 && (
        <div className={cn(links.length > 0 && "mb-3")}>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Documents
          </p>
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => doc.content ? setOpenDoc(doc) : undefined}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs",
                  doc.content
                    ? "hover:bg-muted/50 hover:border-border/80 transition-colors cursor-pointer"
                    : "opacity-60 cursor-default"
                )}
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {doc.icon && <span className="text-sm shrink-0">{doc.icon}</span>}
                <span className="text-foreground">{doc.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Resources
          </p>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              let hostname = "";
              try {
                hostname = new URL(link.url).hostname.replace(/^www\./, "");
              } catch {
                // invalid URL
              }
              const displayLabel = link.label || hostname || link.url;

              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs hover:bg-muted/50 hover:border-border/80 transition-colors group"
                >
                  <svg
                    className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6.5 3.5H3.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3" />
                    <path d="M9.5 2.5h4v4" />
                    <path d="M13.5 2.5L7.5 8.5" />
                  </svg>
                  <span className="text-foreground">{displayLabel}</span>
                  {hostname && displayLabel !== hostname && (
                    <span className="text-muted-foreground text-[11px]">{hostname}</span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Document modal */}
      {openDoc && (
        <DocumentModal document={openDoc} onClose={() => setOpenDoc(null)} />
      )}
    </div>
  );
}
