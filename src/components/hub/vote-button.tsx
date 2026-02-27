"use client";

import { useState, useRef } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface HubVoteButtonProps {
  hubId: string;
  issueLinearId: string;
  initialCount: number;
  initialVoted: boolean;
}

export function HubVoteButton({
  hubId,
  issueLinearId,
  initialCount,
  initialVoted,
}: HubVoteButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [hasVoted, setHasVoted] = useState(initialVoted);
  const [isAnimating, setIsAnimating] = useState(false);
  const pendingRequest = useRef<AbortController | null>(null);

  const handleVote = async () => {
    if (pendingRequest.current) {
      pendingRequest.current.abort();
    }

    const willVote = !hasVoted;
    const previousCount = count;
    const previousVoted = hasVoted;

    // Optimistic update
    setCount(willVote ? count + 1 : count - 1);
    setHasVoted(willVote);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    const controller = new AbortController();
    pendingRequest.current = controller;

    try {
      const response = await fetch(`/api/hubs/${hubId}/votes`, {
        method: willVote ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueLinearId }),
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 409) {
        setCount(previousCount);
        setHasVoted(previousVoted);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setCount(previousCount);
      setHasVoted(previousVoted);
    } finally {
      pendingRequest.current = null;
    }
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleVote();
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md",
        "text-xs font-medium transition-all duration-150",
        "border cursor-pointer active:scale-95",
        hasVoted
          ? "bg-primary/10 text-primary border-primary/30"
          : "bg-transparent text-muted-foreground border-transparent hover:bg-muted hover:border-border"
      )}
      title={hasVoted ? "Remove vote" : "Upvote this item"}
    >
      <ChevronUp
        className={cn(
          "h-3.5 w-3.5 transition-transform duration-150",
          hasVoted && "text-primary",
          isAnimating && hasVoted && "scale-125"
        )}
      />
      <span
        className={cn(
          "tabular-nums text-[10px] leading-none transition-transform duration-150",
          hasVoted && "text-primary",
          isAnimating && "scale-110"
        )}
      >
        {count}
      </span>
    </button>
  );
}
