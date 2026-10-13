export interface ChartRange {
  min: number;
  max: number;
  ticks: number[];
}

export function niceRange(values: number[], targetTicks = 4): ChartRange {
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  if (low === high) return { min: 0, max: 100, ticks: [0, 50, 100] };

  const rough = (high - low) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10;
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) ticks.push(Math.round(value * 1e6) / 1e6);
  return { min, max, ticks };
}

export function formatAxisMoney(value: number): string {
  if (value === 0) return '0 zł';
  const sign = value < 0 ? '−' : '';
  const size = Math.abs(value);
  if (size >= 1000) return `${sign}${(size / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} tys.`;
  return `${sign}${size.toLocaleString('pl-PL')} zł`;
}