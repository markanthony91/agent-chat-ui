"use client";

import React, { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

type FindableTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  searchLabel: string;
  highlightTestId: string;
  disabled?: boolean;
  placeholder?: string;
  minHeightClass?: string;
};

export function FindableTextarea({
  value,
  onChange,
  searchLabel,
  highlightTestId,
  disabled = false,
  placeholder,
  minHeightClass = "min-h-[52vh]",
}: FindableTextareaProps): React.ReactNode {
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return [];
    const source = value.toLocaleLowerCase("pt-BR");
    const found: number[] = [];
    for (
      let position = source.indexOf(needle);
      position >= 0;
      position = source.indexOf(needle, position + needle.length)
    )
      found.push(position);
    return found;
  }, [query, value]);
  const activeMatchIndex =
    matchIndex >= 0 && matchIndex < matches.length ? matchIndex : -1;
  const highlightedValue = useMemo(() => {
    if (!matches.length) return value;
    const length = query.trim().length;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    matches.forEach((start, index) => {
      parts.push(value.slice(cursor, start));
      parts.push(
        <mark
          key={`${start}-${index}`}
          className={
            index === activeMatchIndex
              ? "rounded-sm bg-amber-400 text-inherit"
              : "rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-600"
          }
        >
          {value.slice(start, start + length)}
        </mark>,
      );
      cursor = start + length;
    });
    parts.push(value.slice(cursor));
    return parts;
  }, [activeMatchIndex, matches, query, value]);

  const selectMatch = (nextIndex: number) => {
    if (!matches.length) return;
    const index = (nextIndex + matches.length) % matches.length;
    const start = matches[index];
    setMatchIndex(index);
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      const highlight = highlightRef.current;
      if (!editor || !highlight) return;
      editor.setSelectionRange(start, start + query.trim().length);
      const active = highlight.querySelectorAll<HTMLElement>("mark")[index];
      if (active) {
        editor.scrollTop = Math.max(
          0,
          active.offsetTop - editor.clientHeight / 2 + active.offsetHeight / 2,
        );
      }
      highlight.scrollTop = editor.scrollTop;
      highlight.scrollLeft = editor.scrollLeft;
    });
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-500" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setMatchIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            selectMatch(
              event.shiftKey
                ? activeMatchIndex < 0
                  ? matches.length - 1
                  : activeMatchIndex - 1
                : activeMatchIndex + 1,
            );
          }}
          aria-label={searchLabel}
          placeholder={searchLabel}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <span className="shrink-0 text-xs text-neutral-500">
          {query.trim()
            ? matches.length
              ? activeMatchIndex >= 0
                ? `${activeMatchIndex + 1} de ${matches.length}`
                : `${matches.length} ${matches.length === 1 ? "resultado" : "resultados"}`
              : "0 resultados"
            : ""}
        </span>
        <button
          type="button"
          onClick={() =>
            selectMatch(
              activeMatchIndex < 0 ? matches.length - 1 : activeMatchIndex - 1,
            )
          }
          disabled={!matches.length}
          aria-label={`${searchLabel}: ocorrência anterior`}
          className="rounded p-1 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => selectMatch(activeMatchIndex + 1)}
          disabled={!matches.length}
          aria-label={`${searchLabel}: próxima ocorrência`}
          className="rounded p-1 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="relative mt-3 rounded-xl border bg-neutral-50 dark:bg-neutral-900">
        {matches.length > 0 && (
          <pre
            ref={highlightRef}
            data-testid={highlightTestId}
            aria-hidden="true"
            className={`${minHeightClass} pointer-events-none absolute inset-0 overflow-hidden p-4 font-mono text-sm leading-6 break-words whitespace-pre-wrap`}
            style={{ scrollbarGutter: "stable" }}
          >
            {highlightedValue}
            {value.endsWith("\n") ? " " : null}
          </pre>
        )}
        <textarea
          ref={editorRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setMatchIndex(-1);
          }}
          onScroll={(event) => {
            if (!highlightRef.current) return;
            highlightRef.current.scrollTop = event.currentTarget.scrollTop;
            highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          style={{ scrollbarGutter: "stable" }}
          className={`${minHeightClass} relative w-full resize-y bg-transparent p-4 font-mono text-sm leading-6 outline-none disabled:opacity-50 ${matches.length ? "text-transparent caret-neutral-950 selection:bg-blue-200 dark:caret-white dark:selection:bg-blue-800" : ""}`}
        />
      </div>
    </div>
  );
}
