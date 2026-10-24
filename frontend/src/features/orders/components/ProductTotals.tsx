import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OrderDay } from '../../../services/api';
import { formatPieces, plural } from '../lib/orders';

export function ProductTotals({ products }: { products: OrderDay['products'] }) {
  const [open, setOpen] = useState(false);
  const total = products.reduce((sum, product) => sum + product.quantity, 0);
  const largest = products[0]?.quantity ?? 0;

  if (products.length === 0) return null;

  return (
    <section className="rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#f3efed]"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Produkty na ten dzień</span>
          <span className="text-sm font-extrabold">
            {products.length} {plural(products.length, 'produkt', 'produkty', 'produktów')} · {formatPieces(total)}
          </span>
        </span>
        <ChevronDown aria-hidden className={`w-5 h-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul className="m-0 px-4 pb-4 pt-1 list-none grid gap-x-8 gap-y-2.5 md:grid-cols-2">
          {products.map((product) => (
            <li key={product.product_id} className="flex flex-col gap-1">
              <span className="flex justify-between gap-3 text-[13px] font-bold">
                <span className="truncate">{product.product_name}</span>
                <span className="tabular-nums whitespace-nowrap">{formatPieces(product.quantity)}</span>
              </span>
              <span aria-hidden className="h-1.5 rounded-full bg-[#e6e1df] overflow-hidden">
                <span
                  className="block h-full rounded-full bg-bakery-accent"
                  style={{ width: `${(product.quantity / largest) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}