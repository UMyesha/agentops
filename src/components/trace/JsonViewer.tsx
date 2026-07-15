"use client";

import * as React from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Json = unknown;

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Colored leaf value. */
function Primitive({ value }: { value: Json }) {
  if (value === null)
    return <span className="text-muted-foreground">null</span>;
  switch (typeof value) {
    case "string":
      return (
        <span className="break-all text-emerald-600 dark:text-emerald-400">
          &quot;{value}&quot;
        </span>
      );
    case "number":
      return <span className="text-amber-600 dark:text-amber-400">{value}</span>;
    case "boolean":
      return (
        <span className="text-purple-600 dark:text-purple-400">
          {String(value)}
        </span>
      );
    default:
      return <span className="text-muted-foreground">{String(value)}</span>;
  }
}

function Node({
  name,
  value,
  depth,
  defaultOpen,
}: {
  name?: string;
  value: Json;
  depth: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const container = isObject(value) || Array.isArray(value);

  const key = name != null && (
    <span className="text-sky-700 dark:text-sky-300">{name}</span>
  );

  if (!container) {
    return (
      <div className="flex gap-1.5" style={{ paddingLeft: depth * 12 }}>
        {key}
        {name != null && <span className="text-muted-foreground">:</span>}
        <Primitive value={value} />
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, Json>);

  const bracket = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  const summary = Array.isArray(value)
    ? `${entries.length} ${entries.length === 1 ? "item" : "items"}`
    : `${entries.length} ${entries.length === 1 ? "key" : "keys"}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded hover:bg-muted/60"
        style={{ paddingLeft: depth * 12 }}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        {key}
        {name != null && <span className="text-muted-foreground">:</span>}
        <span className="text-muted-foreground">{bracket[0]}</span>
        {!open && (
          <span className="text-xs text-muted-foreground/70">{summary}</span>
        )}
        {!open && <span className="text-muted-foreground">{bracket[1]}</span>}
      </button>
      {open && (
        <div>
          {entries.map(([k, v]) => (
            <Node
              key={k}
              name={Array.isArray(value) ? undefined : k}
              value={v}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
          <div
            className="text-muted-foreground"
            style={{ paddingLeft: depth * 12 + 16 }}
          >
            {bracket[1]}
          </div>
        </div>
      )}
    </div>
  );
}

export function JsonViewer({
  data,
  className,
  defaultOpen = true,
}: {
  data: Json;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const pretty = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  // Empty / null blobs get a compact placeholder instead of an empty tree.
  const isEmpty =
    data == null ||
    (isObject(data) && Object.keys(data).length === 0) ||
    (Array.isArray(data) && data.length === 0);

  return (
    <div
      className={cn(
        "group relative rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed",
        className
      )}
    >
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 hidden rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:block"
        aria-label="Copy JSON"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      {isEmpty ? (
        <span className="text-muted-foreground">
          {data == null ? "null" : Array.isArray(data) ? "[]" : "{}"}
        </span>
      ) : (
        <Node value={data} depth={0} defaultOpen={defaultOpen} />
      )}
    </div>
  );
}
