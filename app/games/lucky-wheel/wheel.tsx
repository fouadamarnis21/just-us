"use client";

import { useId } from "react";
import type { WheelSegment } from "./types";

type Props = {
  segments: WheelSegment[];
  rotation: number;
  spinning: boolean;
  animate: boolean;
  canSpin?: boolean;
  busy?: boolean;
  onSpin?: () => void;
};

const C = 220;
const R = 177;
const DEG = Math.PI / 180;

// Normalize SVG coordinates so server and browser render identical attributes.
// Tiny floating-point differences can otherwise trigger a hydration warning.
function polar(degrees: number, radius: number) {
  return {
    x: Number((C + Math.cos(degrees * DEG) * radius).toFixed(3)),
    y: Number((C + Math.sin(degrees * DEG) * radius).toFixed(3)),
  };
}

function wedge(start: number, end: number) {
  const a = polar(start, R);
  const b = polar(end, R);
  return `M ${C} ${C} L ${a.x.toFixed(3)} ${a.y.toFixed(3)} A ${R} ${R} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x.toFixed(3)} ${b.y.toFixed(3)} Z`;
}

// Keep labels inside the segment, including long Arabic titles.
function splitTitle(title: string, count: number) {
  const clean = title.trim();
  const max = count >= 7 ? 10 : 13;
  if (clean.length <= max) return [clean];
  const words = clean.split(/\s+/);
  if (words.length === 1) return [clean.slice(0, max - 1) + "…"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current || `${current} ${word}`.length <= max) {
      current = current ? `${current} ${word}` : word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines[1].slice(0, max - 1)}…`];
}

export function Wheel({
  segments,
  rotation,
  spinning,
  animate,
  canSpin = false,
  busy = false,
  onSpin,
}: Props) {
  const id = useId().replace(/:/g, "");
  const count = segments.length;
  const step = count ? 360 / count : 0;
  const lights = Array.from({ length: 28 }, (_, i) => i);
  const stars = [
    { x: 34, y: 73, size: 2.5 },
    { x: 400, y: 85, size: 3 },
    { x: 51, y: 343, size: 2 },
    { x: 387, y: 345, size: 2.5 },
  ];

  return (
    <div className={`lw-wheel-wrap lw-wheel-premium${spinning ? " lw-wheel-is-spinning" : ""}`}>
      <div className="lw-wheel-halo" aria-hidden="true" />
      <div className="lw-wheel-orbit lw-wheel-orbit-one" aria-hidden="true" />
      <div className="lw-wheel-orbit lw-wheel-orbit-two" aria-hidden="true" />

      <svg
        className="lw-wheel-svg"
        viewBox="0 0 440 440"
        role="img"
        aria-label={`عجلة الحظ فيها ${count} خانات: ${segments.map((s) => s.title).join("، ")}`}
      >
        <defs>
          <radialGradient id={`${id}-shell`} cx="45%" cy="37%" r="73%">
            <stop offset="0%" stopColor="#4d204d" />
            <stop offset="65%" stopColor="#19091f" />
            <stop offset="100%" stopColor="#07040d" />
          </radialGradient>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff1fa" />
            <stop offset="18%" stopColor="#ff91d4" />
            <stop offset="42%" stopColor="#76265f" />
            <stop offset="66%" stopColor="#ff78c7" />
            <stop offset="100%" stopColor="#ffdeef" />
          </linearGradient>
          <radialGradient id={`${id}-glass`} cx="35%" cy="20%" r="84%">
            <stop offset="0%" stopColor="#fff" stopOpacity=".17" />
            <stop offset="42%" stopColor="#fff" stopOpacity=".035" />
            <stop offset="100%" stopColor="#0a0314" stopOpacity=".32" />
          </radialGradient>
          <radialGradient id={`${id}-hub`} cx="35%" cy="25%" r="82%">
            <stop offset="0%" stopColor="#60234e" />
            <stop offset="48%" stopColor="#230c2a" />
            <stop offset="100%" stopColor="#08050f" />
          </radialGradient>
          <filter id={`${id}-pink-glow`} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id={`${id}-pointer-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ff2baf" floodOpacity=".95" />
          </filter>
          {segments.map((s, i) => (
            <radialGradient key={`gradient-${s.id}`} id={`${id}-segment-${i}`} cx="50%" cy="40%" r="83%">
              <stop offset="0%" stopColor={s.color} stopOpacity=".85" />
              <stop offset="47%" stopColor={s.color} stopOpacity=".65" />
              <stop offset="100%" stopColor="#18081f" stopOpacity=".98" />
            </radialGradient>
          ))}
        </defs>

        {/* Stationary illuminated chrome rim */}
        <circle cx={C} cy={C} r="207" fill="none" stroke="#f647b7" strokeOpacity=".28" strokeWidth="2" filter={`url(#${id}-pink-glow)`} />
        <circle cx={C} cy={C} r="206" fill="#0b0612" stroke={`url(#${id}-metal)`} strokeWidth="3.5" />
        <circle cx={C} cy={C} r="197" fill={`url(#${id}-shell)`} stroke="#ff70ca" strokeWidth="2" />
        <circle cx={C} cy={C} r="190" fill="none" stroke="#ffaadf" strokeOpacity=".75" strokeWidth="1.5" />
        <circle cx={C} cy={C} r="184" fill="none" stroke="#fb56b7" strokeOpacity=".45" strokeWidth="2.5" />

        {/* Rotating colored wedges: animation remains identical to existing multiplayer behavior */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transition: animate ? "transform 4.8s cubic-bezier(.12,.77,.09,1)" : "none",
          }}
        >
          {segments.map((segment, index) => {
            const start = -90 + index * step;
            const end = start + step;
            const mid = start + step / 2;
            const icon = polar(mid, count >= 7 ? 108 : 112);
            const label = polar(mid, count >= 7 ? 151 : 148);
            const lines = splitTitle(segment.title, count);
            const fontSize = count >= 7 ? 13.2 : 14.4;
            const labelWidth = Math.min(112, Math.max(62, Math.max(...lines.map((line) => line.length)) * (count >= 7 ? 7.8 : 8.4) + 16));
            const labelHeight = lines.length === 1 ? 25 : 41;
            // Counter-rotate labels with the exact same easing as the wheel.
            // This keeps Arabic text upright and readable after every spin.
            const uprightTransition = animate
              ? "transform 4.8s cubic-bezier(.12,.77,.09,1)"
              : "none";
            return (
              <g key={segment.id}>
                <path
                  d={wedge(start, end)}
                  fill={`url(#${id}-segment-${index})`}
                  stroke="#ffc0e7"
                  strokeOpacity=".77"
                  strokeWidth="1.65"
                />
                <path d={wedge(start, end)} fill="none" stroke={segment.color} strokeOpacity=".26" strokeWidth="4" />
                <g
                  style={{
                    transform: `rotate(${-rotation}deg)`,
                    transformOrigin: `${icon.x}px ${icon.y}px`,
                    transition: uprightTransition,
                  }}
                >
                  <text
                    x={icon.x}
                    y={icon.y + 9}
                    textAnchor="middle"
                    fontSize={count >= 7 ? 27 : 31}
                    style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,.55))" }}
                  >
                    {segment.emoji}
                  </text>
                </g>
                <g
                  style={{
                    transform: `rotate(${-rotation}deg)`,
                    transformOrigin: `${label.x}px ${label.y}px`,
                    transition: uprightTransition,
                  }}
                >
                  <rect
                    x={label.x - labelWidth / 2}
                    y={label.y - labelHeight / 2}
                    width={labelWidth}
                    height={labelHeight}
                    rx="10"
                    fill="#120819"
                    fillOpacity=".66"
                    stroke="#ffe0f4"
                    strokeOpacity=".23"
                    strokeWidth=".7"
                  />
                  <text
                    x={label.x}
                    y={label.y - (lines.length - 1) * 8 + 4}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="900"
                    fill="#fff9fd"
                    stroke="#21071b"
                    strokeWidth="2.4"
                    paintOrder="stroke"
                    style={{ fontFamily: "var(--font-cairo), Arial, sans-serif" }}
                  >
                    {lines.map((line, j) => (
                      <tspan key={j} x={label.x} dy={j === 0 ? 0 : 16}>{line}</tspan>
                    ))}
                  </text>
                </g>
              </g>
            );
          })}
          <circle cx={C} cy={C} r={R} fill={`url(#${id}-glass)`} pointerEvents="none" />
          <circle cx={C} cy={C} r={R} fill="none" stroke="#fff4fc" strokeOpacity=".6" strokeWidth="2" />
        </g>

        {/* Fixed bulbs: premium arcade wheel effect */}
        {lights.map((i) => {
          const p = polar(-90 + (360 / lights.length) * i, 200);
          return (
            <g key={`light-${i}`}>
              <circle cx={p.x} cy={p.y} r="5.3" fill="#ff5dbd" opacity=".35" filter={`url(#${id}-pink-glow)`} />
              <circle cx={p.x} cy={p.y} r={i % 2 === 0 ? 3.5 : 2.5} fill={i % 2 === 0 ? "#fff0fc" : "#ff86d4"} />
            </g>
          );
        })}
        {stars.map((s, i) => (
          <path
            key={`star-${i}`}
            d={`M ${s.x} ${s.y - s.size * 2} L ${s.x + s.size / 2} ${s.y - s.size / 2} L ${s.x + s.size * 2} ${s.y} L ${s.x + s.size / 2} ${s.y + s.size / 2} L ${s.x} ${s.y + s.size * 2} L ${s.x - s.size / 2} ${s.y + s.size / 2} L ${s.x - s.size * 2} ${s.y} L ${s.x - s.size / 2} ${s.y - s.size / 2} Z`}
            fill="#ffb6e8"
            opacity=".75"
          />
        ))}

        {/* Fixed center hub */}
        <circle cx={C} cy={C} r="51" fill="#ff4fb9" opacity=".5" filter={`url(#${id}-pink-glow)`} />
        <circle cx={C} cy={C} r="51" fill="#110716" stroke={`url(#${id}-metal)`} strokeWidth="5" />
        <circle cx={C} cy={C} r="43" fill={`url(#${id}-hub)`} stroke="#f762ba" strokeOpacity=".75" strokeWidth="1.6" />
        <circle cx={C} cy={C} r="35" fill="none" stroke="#ffb4e0" strokeOpacity=".22" strokeWidth="1" />

        {/* Top heart-shaped pointer. Tip points exactly at the winning segment. */}
        <g filter={`url(#${id}-pointer-glow)`}>
          {/* Compact pointer above the wheel: tip at y=47, safely clear of the top label. */}
          <path d="M 220 17 C 215 10 204 10 204 20 C 204 28 214 35 220 42 C 226 35 236 28 236 20 C 236 10 225 10 220 17 Z" fill="#ff60c4" stroke="#fff0fc" strokeWidth="2" />
          <path d="M 220 47 L 215 35 L 225 35 Z" fill="#ffe3f5" />
          <path d="M 209 18 Q 213 15 217 20" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      </svg>

      {/* Real clickable center control, not a decorative fake button. */}
      <button
        type="button"
        className={`lw-wheel-hub-button${canSpin && !busy && !spinning ? " lw-wheel-hub-ready" : ""}`}
        disabled={!canSpin || busy || spinning || !onSpin}
        onClick={onSpin}
        aria-label={spinning ? "العجلة كتدور" : canSpin ? "دَوّر العجلة" : "العجلة كتسنى الدور"}
        title={canSpin ? "دَوّر العجلة" : "كنتسناو الدور"}
      >
        <span className="lw-wheel-hub-heart" aria-hidden="true">💗</span>
        <span className="lw-wheel-hub-label">{spinning ? "WAIT" : "SPIN"}</span>
      </button>
      <div className="lw-wheel-sparkle lw-wheel-sparkle-one" aria-hidden="true">✦</div>
      <div className="lw-wheel-sparkle lw-wheel-sparkle-two" aria-hidden="true">✧</div>
    </div>
  );
}

export function getWheelRotation(index: number, count: number, previous: number) {
  if (!count || index < 0) return previous;
  const base = (360 - ((index + 0.5) * 360) / count + 360) % 360;
  return base + 360 * Math.ceil((previous + 5 * 360 - base) / 360);
}
