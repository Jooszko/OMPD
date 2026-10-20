import { donutArcs, ringFontSize } from '../lib/home';

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface RingPart<K extends string> {
  key: K;
  label: string;
  color: string;
}

interface DayRingProps<K extends string> {
  counts: Record<K, number>;
  parts: RingPart<K>[];
  value: string;
  caption: string;
  size?: number;
}

export function DayRing<K extends string>({ counts, parts, value, caption, size = 176 }: DayRingProps<K>) {
  const colors = Object.fromEntries(parts.map((part) => [part.key, part.color])) as Record<K, string>;
  const fontSize = ringFontSize(value);
  const arcs = donutArcs(
    counts,
    parts.map((part) => part.key),
    CIRCUMFERENCE
  );
  const visible = parts.filter((part) => counts[part.key] > 0);
  const description =
    visible.length > 0 ? visible.map((part) => `${part.label} ${counts[part.key]}`).join(', ') : caption;

  return (
    <div className="relative mx-auto sm:mx-0 flex items-center gap-5">
      <svg
        role="img"
        aria-label={`${value} ${caption}. ${description}`}
        width={size}
        height={size}
        viewBox="0 0 176 176"
        className="shrink-0"
      >
        <g transform="rotate(-90 88 88)" fill="none" strokeWidth={16}>
          <circle cx={88} cy={88} r={RADIUS} stroke="#2e2a29" />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={88}
              cy={88}
              r={RADIUS}
              stroke={colors[arc.key]}
              strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </g>
        <text
          x={88}
          y={70 + fontSize * 0.35}
          textAnchor="middle"
          fill="#ffffff"
          className="font-display font-extrabold"
          style={{ fontSize }}
        >
          {value}
        </text>
        <text x={88} y={108} textAnchor="middle" fill="#d9d2cf" className="font-auth text-[12px] font-extrabold">
          {caption}
        </text>
      </svg>
      {visible.length > 0 && (
        <ul className="m-0 p-0 list-none hidden sm:flex flex-col gap-2 text-[13px] font-bold text-[#d9d2cf]">
          {visible.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: part.color }} />
              {part.label} {counts[part.key]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
