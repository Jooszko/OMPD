import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { setIngredientPrice, type MissingIngredientPrice } from '../../../services/api';

function PriceForm({
  offerId,
  supplier,
  unit,
  onSaved,
}: {
  offerId: number;
  supplier: string;
  unit: string;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `price-${offerId}`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await setIngredientPrice(offerId, price.trim());
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać ceny.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs font-bold">
        {supplier}
      </label>
      <div className="flex items-center gap-2">
        <span className="relative flex-1 flex">
          <input
            id={inputId}
            required
            inputMode="decimal"
            placeholder="0,00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full h-10 pl-3 pr-14 rounded-[10px] border-[1.5px] border-[#e9c27a] bg-white text-sm font-extrabold tabular-nums text-bakery-dark outline-none focus:border-bakery-accent"
          />
          <span aria-hidden className="absolute right-3 top-2.5 text-xs font-bold text-[#7a5a22]">
            zł/{unit}
          </span>
        </span>
        <button
          type="submit"
          disabled={saving}
          className="h-10 px-3.5 rounded-[10px] bg-[#5c3b06] text-white text-[13px] font-extrabold disabled:opacity-60"
        >
          {saving ? '…' : 'Zapisz'}
        </button>
      </div>
      {error && (
        <span role="alert" className="text-xs font-bold text-[#991b1b]">
          {error}
        </span>
      )}
    </form>
  );
}

export function MissingPrices({ items, onSaved }: { items: MissingIngredientPrice[]; onSaved: () => void }) {
  if (items.length === 0) return null;

  return (
    <section className="p-5 rounded-[14px] bg-[#fdecc8] border border-[#f3c56f] text-[#5c3b06] flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 flex items-center gap-2 text-base font-extrabold">
          <span aria-hidden>⚠</span>
          Brakujące ceny składników
        </h2>
        <p className="m-0 text-[13px] font-semibold">
          Bez nich koszt produktu jest zaniżony, a marża wygląda lepiej niż w rzeczywistości. Wpisz ostatnią cenę zakupu.
        </p>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.ingredient_id} className="px-3.5 py-3 rounded-xl bg-[#fff8e8] flex flex-col gap-2.5">
            <span className="flex flex-col gap-0.5">
              <strong className="text-sm">{item.name}</strong>
              <span className="text-xs font-semibold">Używają: {item.products.join(', ')}</span>
            </span>
            {item.suppliers.length > 0 ? (
              item.suppliers.map((offer) => (
                <PriceForm
                  key={offer.supplier_ingredient_id}
                  offerId={offer.supplier_ingredient_id}
                  supplier={offer.supplier}
                  unit={item.unit}
                  onSaved={onSaved}
                />
              ))
            ) : (
              <span className="text-xs font-semibold">
                Żaden dostawca nie ma tego składnika w asortymencie.{' '}
                <Link to="/contractors" className="font-extrabold text-[#5c3b06]">
                  Dodaj go u dostawcy →
                </Link>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}