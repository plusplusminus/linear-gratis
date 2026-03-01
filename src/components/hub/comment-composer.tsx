"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { Send, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Comment = {
  id: string;
  linearId?: string;
  body: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
  isHubComment?: boolean;
  push_status?: string;
  push_error?: string;
  children?: Comment[];
};

export function CommentComposer({
  hubId,
  issueLinearId,
  replyingTo,
  onCancelReply,
  onCommentAdded,
}: {
  hubId: string;
  issueLinearId: string;
  replyingTo?: { parentId: string; authorName: string } | null;
  onCancelReply?: () => void;
  onCommentAdded: (comment: Comment) => void;
}) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when reply target changes
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  function handleSubmit() {
    if (!body.trim() || isPending) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/hub/${hubId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueLinearId,
            body: body.trim(),
            parentId: replyingTo?.parentId ?? undefined,
          }),
        });

        if (!res.ok) return;

        const data = (await res.json()) as Comment;
        onCommentAdded({
          id: data.id,
          body: data.body ?? body.trim(),
          parentId: replyingTo?.parentId ?? undefined,
          createdAt: data.createdAt ?? new Date().toISOString(),
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          user: data.user,
          isHubComment: true,
          push_status: data.push_status,
          push_error: data.push_error,
        });
        setBody("");
        onCancelReply?.();

        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } catch {
        // silently fail — the comment wasn't saved
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && replyingTo) {
      onCancelReply?.();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="border-t border-border p-4 shrink-0">
      {replyingTo && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
          <span>
            Replying to{" "}
            <span className="font-medium text-foreground">
              {replyingTo.authorName}
            </span>
          </span>
          <button
            onClick={onCancelReply}
            className="ml-auto p-0.5 rounded hover:bg-muted transition-colors"
            title="Cancel reply"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            replyingTo ? "Write a reply..." : "Add a comment..."
          }
          rows={1}
          className={cn(
            "flex-1 resize-none px-3 py-2 text-sm border border-border rounded-md bg-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "placeholder:text-muted-foreground/60"
          )}
          disabled={isPending}
        />
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || isPending}
          className={cn(
            "px-3 py-2 rounded-md transition-colors shrink-0 self-end",
            body.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
          title="Submit (Cmd+Enter)"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5">
        Markdown supported. Cmd+Enter to submit.
      </p>
    </div>
  );
}
