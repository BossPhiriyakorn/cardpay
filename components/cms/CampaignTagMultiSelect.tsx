"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type CampaignTagOption = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
};

type Props = {
  options: CampaignTagOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  variant?: "dark" | "light";
  placeholder?: string;
  id?: string;
};

export function CampaignTagMultiSelect({
  options,
  value,
  onChange,
  variant = "dark",
  placeholder = "เลือกแท็ก…",
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.nameTh.toLowerCase().includes(q) ||
        o.nameEn.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q)
    );
  }, [options, query]);

  const toggle = (tagId: string) => {
    onChange(value.includes(tagId) ? value.filter((x) => x !== tagId) : [...value, tagId]);
  };

  const summary =
    value.length === 0
      ? placeholder
      : value
          .map((tid) => options.find((o) => o.id === tid)?.nameTh ?? tid)
          .join(", ");

  const isDark = variant === "dark";

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={
          isDark
            ? "flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-[#0b1220] px-3 py-2.5 text-left text-sm text-white/90 hover:border-[#8e24aa]/40 focus:outline-none focus:border-[#8e24aa]/50"
            : "flex w-full items-center justify-between gap-2 rounded-xl border border-[#e1bee7] bg-white px-3 py-2.5 text-left text-sm text-[#4a148c] hover:border-[#8e24aa]/40 focus:outline-none focus:border-[#8e24aa]/50"
        }
      >
        <span className="truncate font-medium">{summary}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${
            isDark ? "text-white/45" : "text-[#6a1b9a]/70"
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className={
            isDark
              ? "absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-white/15 bg-[#1a1428] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
              : "absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[#e1bee7] bg-white shadow-[0_16px_40px_rgba(74,20,140,0.12)]"
          }
        >
          <div
            className={
              isDark
                ? "flex items-center gap-2 border-b border-white/10 px-2 py-2"
                : "flex items-center gap-2 border-b border-[#f1dff5] px-2 py-2"
            }
          >
            <Search size={16} className={isDark ? "text-white/35" : "text-[#6a1b9a]/50"} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาแท็ก…"
              className={
                isDark
                  ? "min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                  : "min-w-0 flex-1 bg-transparent text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/45 focus:outline-none"
              }
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.map((tag) => {
              const selected = value.includes(tag.id);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggle(tag.id)}
                    className={
                      isDark
                        ? `flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            selected
                              ? "bg-[#8e24aa]/20 text-[#e1bee7]"
                              : "text-white/85 hover:bg-white/[0.06]"
                          }`
                        : `flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            selected
                              ? "bg-[#f3e5f5] text-[#4a148c]"
                              : "text-[#4a148c] hover:bg-[#faf5fc]"
                          }`
                    }
                  >
                    <span
                      className={
                        isDark
                          ? `flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              selected ? "border-[#8e24aa] bg-[#8e24aa]/40" : "border-white/25"
                            }`
                          : `flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              selected ? "border-[#8e24aa] bg-[#8e24aa]/20" : "border-[#e1bee7]"
                            }`
                      }
                    >
                      <Check
                        size={12}
                        className={
                          selected
                            ? isDark
                              ? "opacity-100 text-[#7ef9ff]"
                              : "opacity-100 text-[#8e24aa]"
                            : "opacity-0"
                        }
                        strokeWidth={3}
                      />
                    </span>
                    <span className="font-semibold">{tag.nameTh}</span>
                    <span className={isDark ? "text-xs text-white/40" : "text-xs text-[#6a1b9a]/60"}>
                      {tag.nameEn}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li
                className={
                  isDark
                    ? "px-3 py-3 text-center text-xs text-white/45"
                    : "px-3 py-3 text-center text-xs text-[#6a1b9a]/55"
                }
              >
                ไม่พบแท็กที่ตรงกับคำค้น
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
