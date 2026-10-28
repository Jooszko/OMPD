import { type KeyboardEvent, type PointerEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { StockDay } from '../../../services/api';
import { chartGeometry, formatDate, formatQty, nearestIndex } from '../lib/warehouse';

const HEIGHT = 240;
const AXIS_WIDTH = 56;
const PAD_TOP = 14;
const PAD_RIGHT = 12;
const LINE_COLOR = '#c26f00';
const AREA_COLOR = '#f49f1c';
const MINIMUM_COLOR = '#e5484d';
const DELIVERY_COLOR = '#2a78d6';
const GRID_COLOR = '#e6e1df';
const X_LABELS = 5;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function TooltipRow({ label, value, keyColor }: { label: string; value: string; keyColor?: string }) {
  return (
    <span className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-[#bdb5b2]">
        {keyColor && <span aria-hidden className="w-2.5 h-0.5 rounded-full" style={{ background: keyColor }} />}
        {label}
      </span>
      <span className="font-extrabold text-white tabular-nums">{value}</span>
    </span>
  );
}

export function StockChart({
  series,
  minimum,
  unit,
  name,
  loading,
}: {
  series: StockDay[];
  minimum: number;
  unit: string;
  name: string;
  loading: boolean;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ series: StockDay[]; index: number } | null>(null);
  const active = hover?.series === series ? hover.index : null;
  const setActive = (index: number | null) => setHover(index === null ? null : { series, index });
  const gradientId = useId();
  const plotWidth = Math.max(0, width - AXIS_WIDTH - PAD_RIGHT);
  const plotHeight = HEIGHT - PAD_TOP;

  const geometry = useMemo(
    () => chartGeometry(series, minimum, plotWidth, plotHeight),
    [series, minimum, plotWidth, plotHeight]
  );
  const { points } = geometry;
  const point = active !== null ? points[active] : null;

  const xLabels = useMemo(() => {
    if (points.length < 2) return points;
    const count = plotWidth < 360 ? 3 : X_LABELS;
    const indexes = new Set(
      Array.from({ length: count }, (_, i) => Math.round((i * (points.length - 1)) / (count - 1)))
    );
    return [...indexes].map((index) => points[index]);
  }, [points, plotWidth]);

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setActive(nearestIndex(points, event.clientX - box.left));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (points.length === 0) return;
    const last = points.length - 1;
    const current = active ?? last;
    const next = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(last, current + 1),
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  };

  const first = points[0];
  const latest = points[points.length - 1];
  const low = points.reduce<typeof first | undefined>((lowest, p) => (!lowest || p.balance < lowest.balance ? p : lowest), undefined);
  const description = latest
    ? `Stan surowca ${name} w ostatnich ${points.length} dniach: od ${formatQty(first.balance, unit)} do ${formatQty(latest.balance, unit)}, najniżej ${formatQty(low!.balance, unit)} (${formatDate(low!.day.date)}). Minimum ${formatQty(minimum, unit)}.`
    : `Brak historii surowca ${name}.`;
  const tooltipLeft = point ? AXIS_WIDTH + point.x : 0;
  const flip = point ? point.x > plotWidth * 0.62 : false;
  const deliveries = points.filter((p) => p.received > 0);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={ref}
        tabIndex={0}
        role="group"
        aria-label={`Wykres stanu: ${name}. Strzałki w lewo i w prawo przesuwają dzień.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive(active ?? points.length - 1)}
        onBlur={() => setActive(null)}
        className={`relative w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-bakery-accent transition-opacity ${
          loading ? 'opacity-50' : ''
        }`}
        style={{ height: HEIGHT + 26 }}
      >
        {width > 0 && points.length > 0 && (
          <svg role="img" aria-label={description} width={width} height={HEIGHT + 26} className="block overflow-visible">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={AREA_COLOR} stopOpacity={0.38} />
                <stop offset="100%" stopColor={AREA_COLOR} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <g transform={`translate(0 ${PAD_TOP})`}>
              {geometry.ticks.map((tick) => (
                <g key={tick.value}>
                  <line x1={AXIS_WIDTH} x2={AXIS_WIDTH + plotWidth} y1={tick.y} y2={tick.y} stroke={GRID_COLOR} strokeWidth={1} />
                  <text
                    x={AXIS_WIDTH - 8}
                    y={tick.y}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-[#5f5a58] text-[11px] font-semibold tabular-nums"
                  >
                    {formatQty(tick.value)}
                  </text>
                </g>
              ))}

              <g transform={`translate(${AXIS_WIDTH} 0)`}>
                <path d={geometry.area} fill={`url(#${gradientId})`} />
                {geometry.minimumY !== null && (
                  <g>
                    <line
                      x1={0}
                      x2={plotWidth}
                      y1={geometry.minimumY}
                      y2={geometry.minimumY}
                      stroke={MINIMUM_COLOR}
                      strokeWidth={1.5}
                    />
                    <text
                      x={6}
                      y={geometry.minimumY - 6}
                      textAnchor="start"
                      className="fill-[#5f5a58] text-[11px] font-extrabold"
                      paintOrder="stroke"
                      stroke="#faf8f7"
                      strokeWidth={4}
                    >
                      minimum {formatQty(minimum, unit)}
                    </text>
                  </g>
                )}
                <path d={geometry.line} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {points.length === 1 && <circle cx={points[0].x} cy={points[0].y} r={5} fill={LINE_COLOR} />}

                {deliveries.map((p) => (
                  <circle key={p.day.date} cx={p.x} cy={p.y} r={4.5} fill={DELIVERY_COLOR} stroke="#faf8f7" strokeWidth={2} />
                ))}

                {point && (
                  <g pointerEvents="none">
                    <line x1={point.x} x2={point.x} y1={0} y2={plotHeight} stroke="#1a1a1a" strokeOpacity={0.35} strokeWidth={1} />
                    <circle cx={point.x} cy={point.y} r={6} fill={LINE_COLOR} stroke="#faf8f7" strokeWidth={2.5} />
                  </g>
                )}

                <rect
                  x={0}
                  y={0}
                  width={plotWidth}
                  height={plotHeight}
                  fill="transparent"
                  onPointerMove={onPointerMove}
                  onPointerDown={onPointerMove}
                  onPointerLeave={() => setActive(null)}
                  style={{ touchAction: 'pan-y' }}
                />
              </g>

              {xLabels.map((p) => (
                <text
                  key={p.day.date}
                  x={AXIS_WIDTH + p.x}
                  y={plotHeight + 18}
                  textAnchor={p === points[0] ? 'start' : p === latest ? 'end' : 'middle'}
                  className="fill-[#5f5a58] text-[11px] font-semibold"
                >
                  {formatDate(p.day.date)}
                </text>
              ))}
            </g>
          </svg>
        )}

        {point && (
          <div
            role="status"
            className="absolute z-10 pointer-events-none min-w-[188px] flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-bakery-dark text-[12px] font-semibold shadow-lg"
            style={{
              top: 6,
              left: tooltipLeft,
              transform: flip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)',
            }}
          >
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-bakery-accent">
              {formatDate(point.day.date, true)}
            </span>
            <span className="font-display text-[22px] leading-tight font-extrabold text-white tabular-nums">
              {formatQty(point.balance, unit)}
            </span>
            <TooltipRow label="Zużyto" value={formatQty(point.used, unit)} keyColor={LINE_COLOR} />
            {point.received > 0 && <TooltipRow label="Dostawa" value={`+${formatQty(point.received, unit)}`} keyColor={DELIVERY_COLOR} />}
            {point.corrected !== 0 && (
              <TooltipRow
                label="Korekta"
                value={`${point.corrected > 0 ? '+' : ''}${formatQty(point.corrected, unit)}`}
              />
            )}
            {minimum > 0 && point.balance < minimum && (
              <span className="mt-0.5 text-[11px] font-extrabold text-[#ffb3b3]">Poniżej minimum</span>
            )}
          </div>
        )}

        {width > 0 && points.length === 0 && !loading && (
          <p className="absolute inset-0 m-0 flex items-center justify-center text-sm font-semibold text-[#5f5a58]">
            Brak ruchów w tym okresie.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 pl-[56px] text-xs font-semibold text-[#3d3937]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-4 h-[3px] rounded-full" style={{ background: LINE_COLOR }} />
          Stan na koniec dnia
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: DELIVERY_COLOR }} />
          Dostawa
        </span>
        {minimum > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-4 h-[2px] rounded-full" style={{ background: MINIMUM_COLOR }} />
            Minimum (zużycie z 7 dni)
          </span>
        )}
      </div>
    </div>
  );
}
