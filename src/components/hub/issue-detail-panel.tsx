"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CommentComposer } from "./comment-composer";
import { LabelEditor } from "./label-editor";
import {
  X,
  Circle,
  CircleDot,
  CircleCheck,
  CircleX,
  CircleDashed,
  AlertTriangle,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Signal,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
  Loader2,
  History,
  ArrowRight,
  Tag,
  Reply,
} from "lucide-react";

type IssueDetail = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string; type: string };
  labels: Array<{ id: string; name: string; color: string }>;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

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

type HistoryEntry = {
  id: string;
  createdAt: string;
  type: "state" | "priority" | "label";
  fromState?: { name: string; color: string; type: string };
  toState?: { name: string; color: string; type: string };
  fromPriority?: number;
  toPriority?: number;
  addedLabels?: Array<{ name: string; color: string }>;
  removedLabels?: Array<{ name: string; color: string }>;
};

export function IssueDetailPanel({
  issueId,
  hubId,
  isViewOnly,
  onClose,
}: {
  issueId: string | null;
  hubId: string;
  isViewOnly?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ parentId: string; authorName: string } | null>(null);
  const [hubLabels, setHubLabels] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track whether panel is being explicitly closed to avoid URL-driven reopen
  const [closing, setClosing] = useState(false);

  // Resolve active issue from prop or URL
  const activeId = closing ? null : (issueId ?? searchParams.get("issue"));

  const handleClose = useCallback(() => {
    setClosing(true);
    setIssue(null);
    setComments([]);
    setHubLabels([]);
    setHistory([]);
    setDescExpanded(false);
    onClose();
    // Remove issue from URL params
    const params = new URLSearchParams(searchParams.toString());
    params.delete("issue");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [onClose, router, searchParams]);

  // Reset closing flag when a new issue is selected via prop
  useEffect(() => {
    if (issueId) setClosing(false);
  }, [issueId]);

  // Fetch issue data
  useEffect(() => {
    if (!activeId) {
      setIssue(null);
      setComments([]);
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchIssue() {
      try {
        const [issueRes, historyRes] = await Promise.all([
          fetch(`/api/hub/${hubId}/issues/${activeId}`),
          fetch(`/api/hub/${hubId}/issues/${activeId}/history`),
        ]);

        if (!cancelled && issueRes.ok) {
          const data = (await issueRes.json()) as {
            issue: IssueDetail;
            comments: Comment[];
            hubLabels: Array<{ id: string; name: string; color: string }>;
          };
          setIssue(data.issue);
          setComments(data.comments);
          setHubLabels(data.hubLabels ?? []);
        }

        if (!cancelled && historyRes.ok) {
          const historyData = (await historyRes.json()) as {
            history: HistoryEntry[];
          };
          setHistory(historyData.history ?? []);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchIssue();
    return () => { cancelled = true; };
  }, [activeId, hubId]);

  // Update URL when issue opens
  useEffect(() => {
    if (!issueId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("issue") !== issueId) {
      params.set("issue", issueId);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [issueId, router, searchParams]);

  // Escape key closes panel
  useEffect(() => {
    if (!activeId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeId, handleClose]);

  // Check description overflow
  useEffect(() => {
    if (descRef.current) {
      setDescOverflows(descRef.current.scrollHeight > 300);
    }
  }, [issue?.description]);

  const isOpen = !!activeId;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed top-0 right-0 h-full z-50 bg-background border-l border-border flex flex-col transition-transform duration-200 ease-out",
          "w-full sm:w-[480px]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {loading && !issue ? (
          <div className="p-6 space-y-4">
            <div className="h-5 w-24 bg-muted/50 rounded animate-pulse" />
            <div className="h-6 w-64 bg-muted/50 rounded animate-pulse" />
            <div className="h-40 bg-muted/50 rounded animate-pulse" />
          </div>
        ) : issue ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-border shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">
                    {issue.identifier}
                  </span>
                  <StatusBadge state={issue.state} />
                  <PriorityIcon priority={issue.priority} />
                </div>
                <h2 className="text-base font-semibold leading-snug">
                  {issue.title}
                </h2>
                {issue.dueDate && (
                  <DueDateBadge dueDate={issue.dueDate} />
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Labels — only show if hub has labels configured for this team */}
              {(issue.labels.length > 0 || hubLabels.length > 0) && (
                <LabelEditor
                  issueLabels={issue.labels}
                  hubLabels={hubLabels}
                  hubId={hubId}
                  issueId={issue.id}
                  isViewOnly={isViewOnly}
                  onLabelsChange={(labels) =>
                    setIssue((prev) => (prev ? { ...prev, labels } : prev))
                  }
                />
              )}

              {/* Description */}
              {issue.description && (
                <div className="px-4 py-4 border-b border-border">
                  <div
                    ref={descRef}
                    className={cn(
                      "relative overflow-hidden",
                      !descExpanded && descOverflows && "max-h-[300px]"
                    )}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-semibold prose-p:text-[13px] prose-p:leading-relaxed prose-code:text-xs prose-pre:text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {issue.description}
                      </ReactMarkdown>
                    </div>
                    {!descExpanded && descOverflows && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
                    )}
                  </div>
                  {descOverflows && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {descExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> Show more
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Comments */}
              <div className="px-4 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold">
                    Comments
                    {comments.length > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({comments.reduce((n, c) => n + 1 + (c.children?.length ?? 0), 0)})
                      </span>
                    )}
                  </h3>
                </div>

                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No comments yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <CommentThread
                        key={comment.id}
                        comment={comment}
                        onReply={isViewOnly ? undefined : (parentId, authorName) => setReplyingTo({ parentId, authorName })}
                      />
                    ))}
                  </div>
                )}

              </div>

              {/* History */}
              {history.length > 0 && (
                <div className="px-4 py-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold">
                      Activity
                      <span className="text-muted-foreground font-normal ml-1">
                        ({history.length})
                      </span>
                    </h3>
                  </div>
                  <div className="space-y-0">
                    {history.map((entry) => (
                      <HistoryItem key={entry.id} entry={entry} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Comment composer — hidden for view_only users */}
            {!isViewOnly && issue && (
              <CommentComposer
                hubId={hubId}
                issueLinearId={issue.id}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                onCommentAdded={(comment) => {
                  if (comment.parentId) {
                    // Insert reply under its parent thread
                    setComments((prev) =>
                      prev.map((c) =>
                        c.linearId === comment.parentId || c.id === comment.parentId
                          ? { ...c, children: [...(c.children ?? []), comment] }
                          : c
                      )
                    );
                  } else {
                    setComments((prev) => [...prev, comment]);
                  }
                }}
              />
            )}
          </>
        ) : null}
      </div>
    </>
  );
}

// -- Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({
  state,
}: {
  state: { name: string; color: string; type: string };
}) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px]">
      <StatusIcon type={state.type} color={state.color} size={12} />
      {state.name}
    </span>
  );
}

function StatusIcon({
  type,
  color,
  size = 14,
}: {
  type: string;
  color: string;
  size?: number;
}) {
  const style = { color: color || "var(--muted-foreground)" };
  const s = { width: size, height: size };

  switch (type) {
    case "triage":
    case "backlog":
      return <CircleDashed style={{ ...style, ...s }} />;
    case "unstarted":
      return <Circle style={{ ...style, ...s }} />;
    case "started":
      return <CircleDot style={{ ...style, ...s }} />;
    case "completed":
      return <CircleCheck style={{ ...style, ...s }} />;
    case "cancelled":
      return <CircleX style={{ ...style, ...s }} />;
    default:
      return <Circle style={{ ...style, ...s }} />;
  }
}

function PriorityIcon({ priority }: { priority: number }) {
  const cls = "w-3.5 h-3.5";
  switch (priority) {
    case 1:
      return <AlertTriangle className={cn(cls, "text-orange-500")} />;
    case 2:
      return <SignalHigh className={cn(cls, "text-orange-400")} />;
    case 3:
      return <SignalMedium className={cn(cls, "text-yellow-500")} />;
    case 4:
      return <SignalLow className={cn(cls, "text-blue-400")} />;
    default:
      return null;
  }
}

function DueDateBadge({ dueDate }: { dueDate: string }) {
  const date = new Date(dueDate);
  const now = new Date();
  const isOverdue = date < now;
  const isDueSoon =
    !isOverdue && date.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 mt-1.5 text-[11px]",
        isOverdue
          ? "text-destructive"
          : isDueSoon
            ? "text-yellow-500"
            : "text-muted-foreground"
      )}
    >
      <Calendar className="w-3 h-3" />
      {isOverdue ? "Overdue: " : "Due: "}
      {date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year:
          date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      })}
    </span>
  );
}

function CommentThread({
  comment,
  onReply,
}: {
  comment: Comment;
  onReply?: (parentId: string, authorName: string) => void;
}) {
  const replies = comment.children ?? [];
  // If this comment is itself a reply (orphaned into root), reply to its real parent.
  // Linear only allows parentId to reference root-level comments.
  const parentLinearId = comment.parentId ?? comment.linearId ?? comment.id;
  return (
    <div>
      <CommentBubble
        comment={comment}
        onReply={onReply ? () => onReply(parentLinearId, comment.user.name) : undefined}
      />
      {replies.length > 0 && (
        <div className="ml-4 mt-1 border-l-2 border-border pl-3 space-y-1">
          {replies.map((reply) => (
            <CommentBubble key={reply.id} comment={reply} compact />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentBubble({
  comment,
  compact,
  onReply,
}: {
  comment: Comment;
  compact?: boolean;
  onReply?: () => void;
}) {
  const isHub = comment.isHubComment;
  const isFailed = comment.push_status === "failed";
  const isPending = comment.push_status === "pending";

  return (
    <div
      className={cn(
        "rounded-lg",
        compact ? "py-1.5" : "p-3",
        !compact && (isHub ? "bg-accent/50 border border-border" : "bg-muted/50"),
        isFailed && !compact && "border-destructive/30"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium">
          {comment.user.name}
        </span>
        {isHub && (
          <span className="text-[9px] font-medium px-1 py-0 rounded bg-primary/10 text-primary">
            Client
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">
          <RelativeTime dateStr={comment.createdAt} />
        </span>
        {isPending && (
          <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
        )}
        {isFailed && (
          <span className="flex items-center gap-0.5 text-[10px] text-destructive" title={comment.push_error ?? "Failed to sync to Linear"}>
            <AlertCircle className="w-3 h-3" />
            Not synced
          </span>
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-[13px] prose-p:leading-relaxed prose-p:my-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {comment.body}
        </ReactMarkdown>
      </div>
      {onReply && (
        <button
          onClick={onReply}
          className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Reply className="w-3 h-3" />
          Reply
        </button>
      )}
    </div>
  );
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex items-start gap-3 py-2 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-0.5 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {entry.type === "state" && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            <span>Status changed</span>
            {entry.fromState && (
              <>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-foreground">
                  <StatusIcon
                    type={entry.fromState.type}
                    color={entry.fromState.color}
                    size={10}
                  />
                  {entry.fromState.name}
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
              </>
            )}
            {entry.toState && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-foreground">
                <StatusIcon
                  type={entry.toState.type}
                  color={entry.toState.color}
                  size={10}
                />
                {entry.toState.name}
              </span>
            )}
          </div>
        )}

        {entry.type === "priority" && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            <span>Priority changed</span>
            {entry.fromPriority != null && (
              <>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-foreground">
                  <PriorityIcon priority={entry.fromPriority} />
                  {PRIORITY_LABELS[entry.fromPriority] ?? `P${entry.fromPriority}`}
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground/60" />
              </>
            )}
            {entry.toPriority != null && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] text-foreground">
                <PriorityIcon priority={entry.toPriority} />
                {PRIORITY_LABELS[entry.toPriority] ?? `P${entry.toPriority}`}
              </span>
            )}
          </div>
        )}

        {entry.type === "label" && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            <Tag className="w-3 h-3" />
            {entry.addedLabels?.map((label) => (
              <span key={label.name} className="inline-flex items-center gap-1">
                <span>Added</span>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-foreground"
                  style={{ backgroundColor: `${label.color}20` }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </span>
              </span>
            ))}
            {entry.removedLabels?.map((label) => (
              <span key={label.name} className="inline-flex items-center gap-1">
                <span>Removed</span>
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-foreground line-through opacity-60"
                  style={{ backgroundColor: `${label.color}20` }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </span>
              </span>
            ))}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
          <RelativeTime dateStr={entry.createdAt} />
        </span>
      </div>
    </div>
  );
}

function RelativeTime({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return <>just now</>;
  if (diffMin < 60) return <>{diffMin}m ago</>;
  if (diffHr < 24) return <>{diffHr}h ago</>;
  if (diffDay < 30) return <>{diffDay}d ago</>;
  return (
    <>
      {date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}
    </>
  );
}
