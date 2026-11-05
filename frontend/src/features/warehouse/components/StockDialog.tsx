import { ArrowDownLeft, ArrowUpRight, ClipboardCheck } from 'lucide-react';
import { type ComponentType, type FormEvent, useState } from 'react';
import { adjustStock, type StockAdjustmentKind, type WarehouseRow } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';
import { formatMoney } from '../../finance/lib/money';
import {
  formatQty,
  parsePrice,
  parseQuantity,
  STATUS_LABELS,
  stockStatus,
  type StockItem,
  weightedPrice,
} from '../lib/warehouse';

const KINDS: {
  kind: StockAdjustmentKind;
  label: string;
  field: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { kind: 'delivery', label: 'Przyjęcie', field: 'Przyjęta ilość', hint: 'Dodaje dostawę do stanu.', icon: ArrowDownLeft },
  { kind: 'loss', label: 'Rozchód', field: 'Wydana ilość', hint: 'Strata, zepsuty towar albo wydanie poza produkcją.', icon: ArrowUpRight },
  { kind: 'count', label: 'Inwentaryzacja', field: 'Policzony stan', hint: 'Ustawia stan na tyle, ile jest faktycznie na półce.', icon: ClipboardCheck },
];

export function StockDialog({
  items,
  initialId,
  initialKind = 'delivery',
  onClose,
  onSaved,
}: {
  items: StockItem[];
  initialId: number;
  initialKind?: StockAdjustmentKind;
  onClose: () => void;
  onSaved: (row: WarehouseRow, kind: StockAdjustmentKind) => void;
}) {
  const [ingredientId, setIngredientId] = useState(initialId);
  const [kind, setKind] = useState<StockAdjustmentKind>(initialKind);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<number | 'own' | null>(null);
  const [priceText, setPriceText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = items.find((option) => option.ingredient_id === ingredientId) ?? items[0];
  const config = KINDS.find((option) => option.kind === kind)!;
  const amount = parseQuantity(quantity);
  const after = amount === null ? null : kind === 'delivery' ? item.current + amount : kind === 'loss' ? item.current - amount : amount;
  const tooMuch = kind === 'loss' && amount !== null && amount > item.current;
  const offers = item.suppliers;
  const delivery = kind === 'delivery';
  const selected = offers.length === 0 ? 'own' : source;
  const own = delivery && selected === 'own';
  const offer = offers.find((option) => option.supplier_id === selected && option.price !== null) ?? null;
  const ownPrice = parsePrice(priceText);
  const unitPrice = offer ? Number(offer.price) : own ? ownPrice : null;
  const currentPrice = item.current_price === null ? null : Number(item.current_price);
  const newPrice =
    delivery && unitPrice !== null && amount !== null && amount > 0
      ? weightedPrice(item.current, currentPrice, amount, unitPrice)
      : null;
  const invalid =
    amount === null || (kind !== 'count' && amount <= 0) || tooMuch || (delivery && unitPrice === null);

  const changeIngredient = (id: number) => {
    setIngredientId(id);
    setSource(null);
    setPriceText('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const row = await adjustStock(item.ingredient_id, {
        kind,
        quantity: String(amount),
        note: note.trim(),
        supplier_id: delivery && offer ? offer.supplier_id : null,
        unit_price: own && ownPrice !== null ? ownPrice.toFixed(2) : null,
      });
      onSaved(row, kind);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się zapisać zmiany stanu.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Zmiana stanu magazynu"
      subtitle={config.hint}
      closeDisabled={saving}
      customScrollbar
      onClose={onClose}
      initialFocusSelector="#stock-quantity"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 font-auth">
        <div role="radiogroup" aria-label="Rodzaj zmiany" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#ece7e5]">
          {KINDS.map((option) => {
            const Icon = option.icon;
            const active = option.kind === kind;
            return (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(option.kind)}
                className={`h-11 inline-flex items-center justify-center gap-1.5 rounded-[9px] border-0 text-[13px] font-extrabold cursor-pointer transition ${
                  active ? 'bg-white text-bakery-dark shadow-sm' : 'bg-transparent text-[#5f5a58] hover:text-bakery-dark'
                }`}
              >
                <Icon aria-hidden className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        <label className={LABEL_CLASS}>
          Surowiec
          <select
            value={item.ingredient_id}
            onChange={(event) => changeIngredient(Number(event.target.value))}
            className={FIELD_CLASS}
          >
            {items.map((option) => (
              <option key={option.ingredient_id} value={option.ingredient_id}>
                {option.name} ({formatQty(option.current, option.unit)})
              </option>
            ))}
          </select>
        </label>

        {delivery && (
          <label className={LABEL_CLASS}>
            Dostawca
            <select
              value={selected ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setSource(value === 'own' ? 'own' : value ? Number(value) : null);
              }}
              className={FIELD_CLASS}
            >
              {offers.length > 0 && <option value="">Wybierz dostawcę</option>}
              {offers.map((option) => (
                <option key={option.supplier_id} value={option.supplier_id} disabled={option.price === null}>
                  {option.name} –{' '}
                  {option.price === null ? 'brak ceny' : `${formatMoney(option.price, { cents: true })}/${item.unit}`}
                </option>
              ))}
              <option value="own">Dostawa własna – cena ręcznie</option>
            </select>
            {offers.length === 0 && (
              <span className="text-xs font-semibold text-[#5f5a58]">
                Surowiec nie ma aktywnego dostawcy, więc przyjmujesz go jako dostawę własną.
              </span>
            )}
          </label>
        )}
        {own && (
          <label className={LABEL_CLASS}>
            Cena za 1 {item.unit}
            <span className="relative">
              <input
                inputMode="decimal"
                autoComplete="off"
                value={priceText}
                onChange={(event) => setPriceText(event.target.value)}
                placeholder="0,00"
                aria-invalid={priceText !== '' && ownPrice === null}
                className={`${FIELD_CLASS} pr-14 tabular-nums`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[#5f5a58]">zł</span>
            </span>
          </label>
        )}
        {own && priceText !== '' && ownPrice === null && (
          <p className={ERROR_CLASS}>Wpisz cenę większą od zera, np. 4,50 (najwyżej 2 miejsca po przecinku).</p>
        )}

        <label className={LABEL_CLASS}>
          {config.field}
          <span className="relative">
            <input
              id="stock-quantity"
              inputMode="decimal"
              autoComplete="off"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={kind === 'count' ? String(item.current).replace('.', ',') : '0'}
              aria-invalid={quantity !== '' && invalid}
              className={`${FIELD_CLASS} pr-14 tabular-nums`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[#5f5a58]">{item.unit}</span>
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#f6f2f0] text-sm font-bold">
          <span className="text-[#5f5a58]">
            Teraz <span className="text-bakery-dark tabular-nums">{formatQty(item.current, item.unit)}</span>
          </span>
          <span aria-hidden className="text-[#8a8381]">→</span>
          <span className="text-[#5f5a58]" aria-live="polite">
            Po zmianie{' '}
            <span className="text-bakery-dark font-extrabold tabular-nums">
              {after === null || tooMuch ? '—' : formatQty(after, item.unit)}
            </span>
            {after !== null && !tooMuch && item.minimum > 0 && (
              <span className="block text-right text-xs font-semibold">{STATUS_LABELS[stockStatus(after, item.minimum)]}</span>
            )}
          </span>
        </div>

        {delivery && newPrice !== null && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#f6f2f0] text-sm font-bold">
            <span className="text-[#5f5a58]">
              Cena{' '}
              <span className="text-bakery-dark tabular-nums">
                {currentPrice === null ? '—' : `${formatMoney(currentPrice, { cents: true })}/${item.unit}`}
              </span>
            </span>
            <span aria-hidden className="text-[#8a8381]">→</span>
            <span className="text-[#5f5a58]" aria-live="polite">
              Po dostawie{' '}
              <span className="text-bakery-dark font-extrabold tabular-nums">
                {formatMoney(newPrice, { cents: true })}/{item.unit}
              </span>
            </span>
          </div>
        )}

        {quantity !== '' && amount === null && (
          <p className={ERROR_CLASS}>Wpisz liczbę, np. 12,5 (najwyżej 3 miejsca po przecinku).</p>
        )}
        {tooMuch && (
          <p className={ERROR_CLASS}>
            Na stanie jest tylko {formatQty(item.current, item.unit)}. Jeśli faktycznie jest inaczej, wybierz inwentaryzację.
          </p>
        )}

        <label className={LABEL_CLASS}>
          Notatka (opcjonalnie)
          <input
            value={note}
            maxLength={200}
            onChange={(event) => setNote(event.target.value)}
            placeholder={kind === 'delivery' ? 'np. nr faktury lub dostawca' : kind === 'loss' ? 'np. zawilgocony worek' : 'np. inwentaryzacja miesięczna'}
            className={FIELD_CLASS}
          />
        </label>

        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="submit" disabled={saving || invalid} className={PRIMARY_BUTTON}>
            {saving ? 'Zapisywanie…' : kind === 'delivery' ? 'Przyjmij' : kind === 'loss' ? 'Wydaj' : 'Zapisz stan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
