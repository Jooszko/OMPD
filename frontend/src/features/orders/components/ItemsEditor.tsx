import { useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import type { AppProduct } from '../../../services/api';
import { addProduct, itemsTotals, removeProduct, searchProducts, setQuantity, type FormItem } from '../lib/orderForm';
import { formatMoney, formatPieces } from '../lib/orders';

const STEP = 'size-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-bakery-btnBorder bg-white';

export function ItemsEditor({
  items,
  products,
  onChange,
}: {
  items: FormItem[];
  products: AppProduct[];
  onChange: (items: FormItem[]) => void;
}) {
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchProducts(products, query, items) : [];
  const totals = itemsTotals(items);

  const add = (product: AppProduct) => {
    onChange(addProduct(items, product));
    setQuery('');
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Produkty</h3>

      <div className="relative">
        <Search aria-hidden className="absolute left-3.5 top-3.5 w-[18px] h-[18px] text-[#8a8482]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && results.length > 0) {
              event.preventDefault();
              add(results[0]);
            }
          }}
          placeholder="Dodaj produkt – wpisz nazwę…"
          aria-label="Dodaj produkt"
          className="w-full h-12 pl-11 pr-4 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[15px] font-semibold outline-none focus:border-bakery-accent"
        />
        {query.trim() && (
          <ul className="m-0 mt-1.5 p-1 list-none rounded-xl border border-bakery-btnBorder bg-white shadow-lg">
            {results.length === 0 && <li className="px-3 py-2.5 text-[13px] font-semibold text-[#5f5a58]">Brak pasujących produktów.</li>}
            {results.map((product) => (
              <li key={product.product_id}>
                <button
                  type="button"
                  onClick={() => add(product)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-[14px] font-bold hover:bg-[#f3efed]"
                >
                  <span className="truncate">{product.name}</span>
                  <span className="inline-flex items-center gap-2 text-[13px] text-[#5f5a58] whitespace-nowrap">
                    {formatMoney(Number(product.base_price))}
                    <Plus aria-hidden className="w-4 h-4 text-bakery-dark" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length === 0 ? (
        <p className="m-0 px-4 py-6 rounded-xl border border-dashed border-bakery-btnBorder text-center text-[13px] font-semibold text-[#5f5a58]">
          Zamówienie jest puste. Wyszukaj produkt powyżej.
        </p>
      ) : (
        <ul className="m-0 p-0 list-none rounded-xl border border-[#e2dcda] bg-white divide-y divide-[#eee9e7]">
          {items.map((item) => (
            <li key={item.product_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
              <span className="flex-1 min-w-[140px] flex flex-col">
                <span className="text-[14px] font-extrabold">{item.product_name}</span>
                <span className="text-[12px] font-semibold text-[#5f5a58]">{formatMoney(item.price)} / szt.</span>
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Mniej: ${item.product_name}`}
                  onClick={() => onChange(setQuantity(items, item.product_id, item.qty - 1))}
                  className={STEP}
                >
                  <Minus aria-hidden className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`Ilość: ${item.product_name}`}
                  value={item.qty}
                  onChange={(event) => onChange(setQuantity(items, item.product_id, Number(event.target.value)))}
                  className="w-16 h-9 rounded-lg border border-bakery-btnBorder text-center text-[14px] font-extrabold tabular-nums outline-none focus:border-bakery-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label={`Więcej: ${item.product_name}`}
                  onClick={() => onChange(setQuantity(items, item.product_id, item.qty + 1))}
                  className={STEP}
                >
                  <Plus aria-hidden className="w-4 h-4" />
                </button>
              </span>
              <span className="w-[86px] text-right text-[14px] font-extrabold tabular-nums">{formatMoney(item.qty * item.price)}</span>
              <button
                type="button"
                aria-label={`Usuń: ${item.product_name}`}
                onClick={() => onChange(removeProduct(items, item.product_id))}
                className="size-9 shrink-0 inline-flex items-center justify-center rounded-lg text-[#b91c1c] hover:bg-[#fbdcdc]"
              >
                <X aria-hidden className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <p className="m-0 flex justify-between text-sm font-extrabold">
          <span>Razem: {formatPieces(totals.pieces)}</span>
          <span className="tabular-nums">{formatMoney(totals.value)}</span>
        </p>
      )}
    </section>
  );
}