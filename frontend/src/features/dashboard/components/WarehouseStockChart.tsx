import React, { useMemo, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { WarehouseItem } from '../../../services/api';
import {
  computeStockStatus,
  STOCK_STATUS_COLORS,
  STOCK_STATUS_LABELS,
  type StockStatus,
} from '../lib/warehouseStock';

interface ChartRow {
  name: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  pct: number;
  status: StockStatus;
}

const CHART_MAX_PCT = 200;
const ROW_HEIGHT = 36;
const BAR_HEIGHT = 22;
const BAR_RADIUS = 4;
const GRIDLINE_POSITIONS = [0, 50, 100, 150, 200];

const STATUS_ICONS: Record<StockStatus, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  critical: XCircle,
  warning: AlertTriangle,
  good: CheckCircle,
};

function roundedBarPath(width: number, height: number, radius: number): string {
  if (width <= 0) return '';
  const r = Math.min(radius, height / 2, width);
  return `M0,0 H${width - r} Q${width},0 ${width},${r} V${height - r} Q${width},${height} ${width - r},${height} H0 Z`;
}

interface WarehouseStockChartProps {
  items: WarehouseItem[];
}

export const WarehouseStockChart: React.FC<WarehouseStockChartProps> = ({ items }) => {
  const [activeRow, setActiveRow] = useState<string | null>(null);

  const rows = useMemo<ChartRow[]>(() => {
    return items
      .map((item) => {
        const currentStock = parseFloat(item.current_stock);
        const minStockLevel = parseFloat(item.min_stock_level);
        const { pct, status } = computeStockStatus(currentStock, minStockLevel);
        return { name: item.name, unit: item.unit, currentStock, minStockLevel, pct, status };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [items]);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-500 font-medium">
        Brak danych magazynowych.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-5 text-xs font-semibold text-bakery-dark">
        {(Object.keys(STOCK_STATUS_LABELS) as StockStatus[]).map((status) => {
          const Icon = STATUS_ICONS[status];
          return (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: STOCK_STATUS_COLORS[status] }}
                aria-hidden="true"
              />
              <Icon className="w-3.5 h-3.5" style={{ color: STOCK_STATUS_COLORS[status] }} />
              <span>{STOCK_STATUS_LABELS[status]}</span>
            </div>
          );
        })}
      </div>

      <div className="h-[420px] overflow-y-auto pr-1">
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: '160px 1fr 150px', gridAutoRows: ROW_HEIGHT }}
        >
          <div
            className="relative pointer-events-none"
            style={{ gridColumn: 2, gridRow: `1 / ${rows.length + 1}` }}
            aria-hidden="true"
          >
            {GRIDLINE_POSITIONS.map((pos) => (
              <div
                key={pos}
                className={`absolute top-0 bottom-0 ${
                  pos === 100 ? 'border-l-2 border-dashed border-red-400' : 'border-l border-bakery-border/50'
                }`}
                style={{ left: `${(pos / CHART_MAX_PCT) * 100}%` }}
              >
                {pos === 100 && (
                  <span className="absolute -top-5 left-1 text-[9px] font-bold uppercase tracking-wide text-red-500 whitespace-nowrap">
                    próg minimalny
                  </span>
                )}
              </div>
            ))}
          </div>

          {rows.map((row, idx) => {
            const barWidthPct = (Math.min(row.pct, CHART_MAX_PCT) / CHART_MAX_PCT) * 100;
            const isOverflow = row.pct > CHART_MAX_PCT;
            const Icon = STATUS_ICONS[row.status];
            const isActive = activeRow === row.name;

            return (
              <React.Fragment key={row.name}>
                <span
                  style={{ gridColumn: 1, gridRow: idx + 1 }}
                  className="text-xs font-semibold text-bakery-dark truncate pr-2"
                  title={row.name}
                >
                  {row.name}
                </span>

                <div
                  style={{ gridColumn: 2, gridRow: idx + 1 }}
                  className="relative h-full flex items-center outline-none"
                  tabIndex={0}
                  onMouseEnter={() => setActiveRow(row.name)}
                  onMouseLeave={() => setActiveRow((current) => (current === row.name ? null : current))}
                  onFocus={() => setActiveRow(row.name)}
                  onBlur={() => setActiveRow((current) => (current === row.name ? null : current))}
                >
                  <svg
                    viewBox={`0 0 100 ${BAR_HEIGHT}`}
                    preserveAspectRatio="none"
                    className="w-full"
                    style={{ height: BAR_HEIGHT, opacity: isActive ? 0.8 : 1 }}
                    aria-hidden="true"
                  >
                    <path d={roundedBarPath(barWidthPct, BAR_HEIGHT, BAR_RADIUS)} fill={STOCK_STATUS_COLORS[row.status]} />
                  </svg>
                  {isOverflow && (
                    <span className="absolute right-0.5 text-[10px] font-black text-bakery-dark">»</span>
                  )}

                  {isActive && (
                    <div className="absolute z-20 top-full mt-1 left-0 flex flex-col gap-0.5 bg-bakery-dark text-white text-[10px] font-semibold px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3" style={{ color: STOCK_STATUS_COLORS[row.status] }} />
                        <span>{STOCK_STATUS_LABELS[row.status]}</span>
                      </div>
                      <span>
                        Stan: {row.currentStock.toFixed(3)} {row.unit}
                      </span>
                      <span>
                        Próg minimalny: {row.minStockLevel.toFixed(3)} {row.unit}
                      </span>
                    </div>
                  )}
                </div>

                <span
                  style={{ gridColumn: 3, gridRow: idx + 1 }}
                  className="text-[11px] font-mono font-bold text-right text-bakery-dark whitespace-nowrap pl-2"
                >
                  {row.currentStock.toFixed(2)} / {row.minStockLevel.toFixed(2)} {row.unit} (
                  {Number.isFinite(row.pct) ? `${row.pct.toFixed(0)}%` : '—'})
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WarehouseStockChart;
