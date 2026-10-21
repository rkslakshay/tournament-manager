"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  label: string;
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

/** WAI-ARIA tabs: arrow keys, Home and End move between tabs; only the active tab is in the tab order. */
export function Tabs({ label, tabs, active, onChange }: Props) {
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );

  function onKeyDown(event: KeyboardEvent) {
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? activeIndex === last
          ? 0
          : activeIndex + 1
        : event.key === "ArrowLeft"
          ? activeIndex === 0
            ? last
            : activeIndex - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange((tabs[next] as TabItem).id);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-slate-200 dark:border-slate-800"
      >
        {tabs.map((tab, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${selected ? "border-accent-600 text-accent-700 dark:text-accent-500" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={i !== activeIndex}
          tabIndex={0}
          className="pt-4 focus-visible:outline-none"
        >
          {i === activeIndex && tab.content}
        </div>
      ))}
    </div>
  );
}
