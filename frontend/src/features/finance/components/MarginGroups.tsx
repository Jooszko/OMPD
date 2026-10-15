import type { ProfitabilityProduct } from '../../../services/api';
import { formatMoney } from '../lib/money';
import type { MarginGroup, MarginLevel } from '../lib/profitability';

const LEVEL_STYLE: Record<MarginLevel, { accent: string; bar: string }> = {
  high: { accent: '#2a78d6', bar: '#2a78d6' },
  medium: { accent: '#8fb6ea', bar: '#2a78d6' },
  low: { accent: '#eb6834', bar: '#eb6834' },
  incomplete: { accent: '#eda100', bar: '#b8b2af' },
  no_recipe: { accent: '#b8b2af', bar: '#b8b2af' },
};

const CHIP_BASE = 'inline-flex items-center px-2.5 py-1 rounded-lg text-[13px] font-bold whitespace-nowrap';
const CHIP = `${CHIP_BASE} bg-[#f3efed] text-[#3d3937]`;

function ProductRow({ product, bar }: { product: ProfitabilityProduct; bar: string }) {
  const hasCost = product.unit_cost !== null && product.unit_margin !== null;
  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-3 py-3.5 border-t border-bakery-rowBg first:border-t-0">
      <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-2">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-extrabold">{product.name}</span>
          <span className="text-[13px] font-semibold text-[#5f5a58] tabular-nums">
            {product.sold.toLocaleString('pl-PL')} szt. sprzedanych
          </span>
        </span>
        {hasCost ? (
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold text-[#5f5a58] tabular-nums">
            <span className={CHIP}>cena {formatMoney(product.price, { cents: true })}</span>−
            <span className={CHIP}>surowce {formatMoney(product.unit_cost!, { cents: true })}</span>=
            <span className={`${CHIP_BASE} bg-bakery-dark text-white`}>
              {formatMoney(product.unit_margin!, { cents: true })} na sztuce
            </span>
          </span>
        ) : (
          <span className="text-[13px] font-semibold text-[#5f5a58]">Cena {formatMoney(product.price, { cents: true })} · brak receptury</span>
        )}
        {product.missing_prices.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#9a3412]">
            <span aria-hidden>⚠</span>
            Brak ceny: {product.missing_prices.join(', ')} – koszt zaniżony
          </span>
        )}
      </div>

      {product.margin_pct !== null && (
        <div className="flex-[0_1_200px] min-w-[150px] flex flex-col gap-1.5">
          <span className="flex justify-between text-xs font-bold text-[#5f5a58] tabular-nums">
            Marża
            <span className="text-lg font-extrabold text-bakery-dark">{Math.round(product.margin_pct)}%</span>
          </span>
          <span aria-hidden className="h-2 rounded bg-bakery-rowBg">
            <span
              className="block h-full rounded"
              style={{ width: `${Math.min(100, Math.max(0, product.margin_pct))}%`, background: bar }}
            />
          </span>
        </div>
      )}

      <div className="flex-[0_0_140px] ml-auto flex flex-col items-end gap-0.5">
        <span className="text-xs font-bold text-[#5f5a58]">Marża w okresie</span>
        <span className="font-display text-[22px] font-extrabold tabular-nums">
          {product.period_margin !== null ? formatMoney(product.period_margin) : '—'}
        </span>
      </div>
    </li>
  );
}

export function MarginGroups({ groups }: { groups: MarginGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section
          key={group.level}
          className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm px-5 sm:px-6 py-5 flex flex-col gap-1 border-t-4"
          style={{ borderTopColor: LEVEL_STYLE[group.level].accent }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5">
            <h2 className="m-0 text-[17px] font-extrabold">{group.title}</h2>
            <span className="text-[13px] font-semibold text-[#5f5a58]">{group.hint}</span>
          </div>
          <ul className="m-0 p-0 list-none">
            {group.items.map((product) => (
              <ProductRow key={product.product_id} product={product} bar={LEVEL_STYLE[group.level].bar} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}