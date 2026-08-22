"use client";

import * as React from "react";
import { Send } from "lucide-react";
import type { RideMessage } from "@trylo/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/sheet";
import { Button } from "../components/button";
import { Input } from "../components/input";
import { cn } from "../lib/cn";

export interface RideChatSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: RideMessage[];
  /** Which side is viewing the chat - own messages align right, the other party's align left. */
  currentRole: "customer" | "driver";
  /** Shown in the header, e.g. the driver's name on the customer app, or "Rider" on the driver app. */
  otherPartyLabel: string;
  onSend: (body: string) => void;
  isLoading?: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Simple ride-scoped chat - plain text only, no attachments/read-receipts. Backed by apps/api's `ride:message` socket event. */
export function RideChatSheet({
  open,
  onOpenChange,
  messages,
  currentRole,
  otherPartyLabel,
  onSend,
  isLoading,
}: RideChatSheetProps) {
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open]);

  function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-[75vh]">
        <SheetHeader>
          <SheetTitle>Chat with {otherPartyLabel}</SheetTitle>
          <p className="text-sm text-muted-foreground">Only visible to you and {otherPartyLabel.toLowerCase()} for this ride.</p>
        </SheetHeader>

        <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-2">
          {isLoading && <p className="text-center text-sm text-muted-foreground">Loading messages...</p>}
          {!isLoading && messages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages yet - say hello.</p>
          )}
          {messages.map((message) => {
            const isOwn = message.senderRole === currentRole;
            return (
              <div key={message.id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                    isOwn
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-muted/50 text-foreground"
                  )}
                >
                  {message.body}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{formatTime(message.createdAt)}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex shrink-0 items-center gap-2 border-t border-border pt-3">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="h-11"
            maxLength={1000}
          />
          <Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSend} disabled={!draft.trim()} aria-label="Send message">
            <Send size={16} />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
