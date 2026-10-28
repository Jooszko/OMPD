import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanOrderChange, PlanPreview } from '../../../../services/api';
import { plural } from '../../../home/lib/home';
import { formatPieces } from '../../lib/planning';

const CARD = 'rounded-[18px] border overflow-hidden';

export function SkippedProducts({ products, canEdit }: { products: PlanPreview['unassigned_products']; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const pieces = products.reduce((sum, product) => sum + product.ordered_qty, 0);
  return (
    <section className={`${CARD} bg-[#fff8eb] border-[#f3d9a4]`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-0 bg-transparent text-left cursor-pointer text-[#6b4300]"
      >
        <span className="inline-flex items-start gap-2.5 text-sm font-extrabold">
          <AlertTriangle aria-hidden className="size-4 shrink-0 mt-0.5" />
          <span>
            {products.length} {plural(products.length, 'wyrób pominięty', 'wyroby pominięte', 'wyrobów pominiętych')} w planie
            <span className="font-semibold"> · {formatPieces(pieces)} bez przypisanego ciasta</span>
          </span>
        </span>
        <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 sm:px-6 pb-4">
          <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
            {products.map((product) => (
              <li key={product.product_id} className="px-2.5 py-1 rounded-full bg-white border border-[#f3d9a4] text-xs font-bold text-[#3d3937]">
                {product.product_name} <span className="tabular-nums">{product.ordered_qty} szt.</span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-[13px] font-semibold text-[#6b4300]">
            {canEdit ? (
              <>
                Przypisz im ciasto i wagę kęsa w{' '}
                <Link to="/production/settings" className="font-extrabold text-[#6b4300]">
                  Ustawieniach produkcji
                </Link>
                , żeby trafiły do planu.
              </>
            ) : (
              'Kierownik musi przypisać im ciasto i wagę kęsa w Ustawieniach produkcji.'
            )}
          </p>
        </div>
      )}
    </section>
  );
}

export function OrderChanges({
  changes,
  locked,
  canRegenerate,
}: {
  changes: PlanOrderChange[];
  locked: boolean;
  canRegenerate: boolean;
}) {
  return (
    <section className={`${CARD} bg-[#fff8eb] border-[#f3d9a4] px-4 sm:px-6 py-4 flex flex-col gap-3 text-[#6b4300]`}>
      <p className="m-0 flex items-start gap-2.5 text-sm font-extrabold">
        <AlertTriangle aria-hidden className="size-4 shrink-0 mt-0.5" />
        Zamówienia zmieniły się od zatwierdzenia planu. Poniżej zapisany plan, nie bieżące zamówienia.
      </p>
      <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
        {changes.map((change) => (
          <li key={change.product_id} className="px-2.5 py-1 rounded-full bg-white border border-[#f3d9a4] text-xs font-bold text-[#3d3937]">
            {change.product_name}: {change.planned_qty} → {change.current_qty}{' '}
            <span className={change.difference > 0 ? 'text-[#a32a2a]' : 'text-[#1f7a3a]'}>
              ({change.difference > 0 ? '+' : ''}
              {change.difference})
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 text-[13px] font-semibold">
        {locked
          ? 'Produkcja już ruszyła (albo zgłoszono straty), więc planu nie można przeliczyć. Różnicę trzeba uzupełnić ręcznie.'
          : canRegenerate
            ? 'Przelicz plan, żeby uwzględnić zmiany.'
            : 'Kierownik może przeliczyć plan, żeby uwzględnić zmiany.'}
      </p>
    </section>
  );
}
