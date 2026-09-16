"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RangeSliderProps = {
  label: string;
  minLabel?: string;
  maxLabel?: string;
  min: number;
  max: number;
  step?: number;
  from: number | "";
  to: number | "";
  prefix?: string;
  suffix?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  onChange: (next: { from: number | ""; to: number | "" }) => void;
  defaultValueHint?: [number, number];
};

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

function formatNumber(value: number, prefix?: string, suffix?: string) {
  const base = value.toLocaleString("en-IN");
  return `${prefix ?? ""}${base}${suffix ?? ""}`;
}

export default function RangeSlider({
  label,
  min,
  max,
  step = 1,
  from,
  to,
  prefix,
  suffix,
  fromPlaceholder = "Min",
  toPlaceholder = "Max",
  onChange,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"from" | "to" | null>(null);

  const stepFrom = (delta: number) => {
    const base = typeof from === "number" ? from : min;
    const cappedTo = typeof to === "number" ? to : max;
    const next = clamp(base + delta * step, min, clamp(cappedTo, min, max));
    onChange({ from: next, to });
  };

  const stepTo = (delta: number) => {
    const base = typeof to === "number" ? to : max;
    const cappedFrom = typeof from === "number" ? from : min;
    const next = clamp(base + delta * step, clamp(cappedFrom, min, max), max);
    onChange({ from, to: next });
  };

  const fromNum = typeof from === "number" ? from : min;
  const toNum = typeof to === "number" ? to : max;

  const leftPct = ((clamp(fromNum, min, max) - min) / (max - min)) * 100;
  const rightPct = ((clamp(toNum, min, max) - min) / (max - min)) * 100;

  const updateFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + Math.round((ratio * (max - min)) / step) * step;
      const clamped = clamp(raw, min, clamp(typeof to === "number" ? to : max, min, max));
      onChange({ from: clamped, to });
    },
    [min, max, step, to, onChange],
  );

  const updateToPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + Math.round((ratio * (max - min)) / step) * step;
      const clamped = clamp(raw, clamp(typeof from === "number" ? from : min, min, max), max);
      onChange({ from, to: clamped });
    },
    [min, max, step, from, onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      if (dragging === "from") updateFromPointer(event.clientX);
      else updateToPointer(event.clientX);
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, updateFromPointer, updateToPointer]);

  return (
    <div className="range-slider" aria-label={label}>
      <div className="range-slider-head">
        <span className="range-slider-label">{label}</span>
        <div className="range-slider-values">
          <span className="range-slider-value">
            {typeof from === "number" ? formatNumber(from, prefix, suffix) : fromPlaceholder}
          </span>
          <span className="range-slider-sep">–</span>
          <span className="range-slider-value">
            {typeof to === "number" ? formatNumber(to, prefix, suffix) : toPlaceholder}
          </span>
        </div>
      </div>

      <div className="range-slider-scale">
        <span>{formatNumber(min, prefix, suffix)}</span>
        <span>{formatNumber(max, prefix, suffix)}</span>
      </div>

      <div className="range-slider-track" ref={trackRef}>
        <div className="range-slider-track-fill" style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }} />
        <div
          role="slider"
          className="range-slider-handle is-from"
          style={{ left: `${leftPct}%` }}
          aria-label={`${label} minimum`}
          aria-valuemin={min}
          aria-valuemax={clamp(typeof to === "number" ? to : max, min, max)}
          aria-valuenow={fromNum}
          tabIndex={0}
          onPointerDown={(event) => {
            (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
            setDragging("from");
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              stepFrom(-1);
            } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              stepFrom(1);
            } else if (event.key === "Home") {
              event.preventDefault();
              onChange({ from: min, to });
            } else if (event.key === "End") {
              event.preventDefault();
              stepFrom(max - (typeof from === "number" ? from : min));
            } else if (event.key === "PageDown") {
              event.preventDefault();
              stepFrom(-10);
            } else if (event.key === "PageUp") {
              event.preventDefault();
              stepFrom(10);
            }
          }}
        />
        <div
          role="slider"
          className="range-slider-handle is-to"
          style={{ left: `${rightPct}%` }}
          aria-label={`${label} maximum`}
          aria-valuemin={clamp(typeof from === "number" ? from : min, min, max)}
          aria-valuemax={max}
          aria-valuenow={toNum}
          tabIndex={0}
          onPointerDown={(event) => {
            (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
            setDragging("to");
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              stepTo(-1);
            } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
              event.preventDefault();
              stepTo(1);
            } else if (event.key === "Home") {
              event.preventDefault();
              onChange({ from, to: clamp(typeof from === "number" ? from : min, min, max) });
            } else if (event.key === "End") {
              event.preventDefault();
              onChange({ from, to: max });
            } else if (event.key === "PageDown") {
              event.preventDefault();
              stepTo(-10);
            } else if (event.key === "PageUp") {
              event.preventDefault();
              stepTo(10);
            }
          }}
        />
      </div>

      <div className="range-slider-inputs">
        <label>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={from}
            placeholder={fromPlaceholder}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") {
                onChange({ from: "", to });
                return;
              }
              const parsed = Number(raw);
              if (Number.isNaN(parsed)) return;
              const bound = clamp(parsed, min, clamp(typeof to === "number" ? to : max, min, max));
              onChange({ from: bound, to });
            }}
          />
        </label>
        <label>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={to}
            placeholder={toPlaceholder}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") {
                onChange({ from, to: "" });
                return;
              }
              const parsed = Number(raw);
              if (Number.isNaN(parsed)) return;
              const bound = clamp(parsed, clamp(typeof from === "number" ? from : min, min, max), max);
              onChange({ from, to: bound });
            }}
          />
        </label>
      </div>
    </div>
  );
}
