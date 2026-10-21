"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies `text` to the clipboard and confirms with a polite live message. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="secondary" onClick={copy} className="shrink-0">
      <span aria-live="polite">{copied ? "Copied!" : label}</span>
    </Button>
  );
}
