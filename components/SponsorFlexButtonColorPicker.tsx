"use client";

import { useEffect, useState } from "react";

import {
  SPONSOR_FLEX_BUTTON_COLORS,
  parseSponsorFlexHexColor,
} from "@/lib/sponsor-flex-button-options";

function colorsMatch(a: string, b: string): boolean {
  const pa = parseSponsorFlexHexColor(a);
  const pb = parseSponsorFlexHexColor(b);
  if (pa && pb) return pa === pb;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type SponsorFlexButtonColorPreset = { value: string; labelTh: string };

type SponsorFlexButtonColorPickerProps = {
  idPrefix: string;
  value: string;
  onChange: (hex: string) => void;
  labelClass: string;
  inputClass: string;
  presetColors: ReadonlyArray<SponsorFlexButtonColorPreset>;
  /** หลัง blur / ค่าตัวอย่างสีขณะพิมพ์ */
  normalizeColor: (raw: string) => string;
};

export function SponsorFlexButtonColorPicker({
  idPrefix,
  value,
  onChange,
  labelClass,
  inputClass,
  presetColors,
  normalizeColor,
}: SponsorFlexButtonColorPickerProps) {
  const [hexDraft, setHexDraft] = useState(value);

  useEffect(() => {
    setHexDraft(value);
  }, [value]);

  const previewHex =
    parseSponsorFlexHexColor(hexDraft) ??
    parseSponsorFlexHexColor(value) ??
    presetColors[0]?.value ??
    SPONSOR_FLEX_BUTTON_COLORS[0].value;

  const hexInputId = `${idPrefix}-hex`;
  const groupLabelId = `${idPrefix}-label`;

  return (
    <div className="space-y-2">
      <p id={groupLabelId} className={labelClass}>
        สีปุ่ม
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby={groupLabelId}
      >
        {presetColors.map((o) => {
          const selected = colorsMatch(value, o.value);
          const isNearBlack = o.value.toLowerCase() === "#000000";
          return (
            <button
              key={o.value}
              type="button"
              title={`${o.labelTh} (${o.value})`}
              aria-label={`${o.labelTh} ${o.value}`}
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`relative h-9 w-9 shrink-0 rounded-xl border-2 shadow-sm transition-[box-shadow,transform] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e24aa] focus-visible:ring-offset-2 ${
                selected
                  ? "border-[#8e24aa] ring-2 ring-[#8e24aa]/35 scale-105"
                  : isNearBlack
                    ? "border-[#bdbdbd] hover:border-[#9e9e9e]"
                    : "border-white/90 hover:border-[#ce93d8]/90"
              }`}
            >
              <span
                className="absolute inset-1 rounded-lg"
                style={{ backgroundColor: o.value }}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
        <div
          className="flex h-[2.75rem] w-[2.75rem] shrink-0 items-center justify-center rounded-2xl border-2 border-[#e1bee7] bg-[repeating-linear-gradient(45deg,#f3e5f5_0px,#f3e5f5_4px,#fff_4px,#fff_8px)] shadow-inner"
          title="ตัวอย่างสี"
          aria-hidden
        >
          <span
            className="h-8 w-8 rounded-xl border border-black/10 shadow-sm"
            style={{ backgroundColor: previewHex }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={hexInputId}>
            รหัสสี hex
          </label>
          <input
            id={hexInputId}
            className={inputClass}
            value={hexDraft}
            onChange={(e) => setHexDraft(e.target.value.slice(0, 14))}
            onBlur={() => {
              const next = normalizeColor(hexDraft);
              onChange(next);
              setHexDraft(next);
            }}
            placeholder="#1877F2 หรือ #RGB"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
