import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Repeat, X } from 'lucide-react';
import {
  fetchClients,
  fetchProducts,
  fetchStandingOrders,
  saveDailyOrder,
  type AppClient,
  type AppProduct,
  type OrderDayStop,
} from '../../../services/api';
import { useDialogFocus } from '../../dashboard/components/useDialogFocus';
import { ERROR_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';
import {
  isoWeekday,
  itemsFromStop,
  orderFormError,
  standingItemsFor,
  type FormItem,
  type StandingGroup,
} from '../lib/orderForm';
import { formatDayHeading } from '../lib/orders';
import { ItemsEditor } from './ItemsEditor';
import { ClientPicker } from './ClientPicker';

interface FormData {
  clients: AppClient[];
  products: AppProduct[];
  standing: StandingGroup[];
}

export function OrderPanel({
  date,
  stops,
  editing,
  onClose,
  onSaved,
}: {
  date: string;
  stops: OrderDayStop[];
  editing: OrderDayStop | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [data, setData] = useState<FormData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(editing?.client_id ?? null);
  const [items, setItems] = useState<FormItem[]>(editing ? itemsFromStop(editing) : []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useDialogFocus(panelRef, onClose, { closeDisabled: saving });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClients(), fetchProducts(), fetchStandingOrders()])
      .then(([clients, products, standing]) => {
        if (!cancelled) setData({ clients, products, standing: standing as StandingGroup[] });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Nie udało się pobrać klientów i produktów.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const existing = editing ?? stops.find((stop) => stop.client_id === clientId) ?? null;
  const standingItems = data && clientId !== null ? standingItemsFor(data.standing, clientId, isoWeekday(date)) : [];

  const chooseClient = (id: number) => {
    const stop = stops.find((entry) => entry.client_id === id);
    setClientId(id);
    setItems(stop && !stop.locked ? itemsFromStop(stop) : []);
    setError(null);
  };

  const save = async () => {
    const problem = existing?.locked
      ? 'Zamówienie tego klienta jest już w dostawie albo dostarczone – nie można go zmienić.'
      : orderFormError(clientId, items);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDailyOrder({
        client_id: clientId as number,
        order_date: date,
        items: items.filter((item) => item.qty > 0).map((item) => ({ product_id: item.product_id, qty: item.qty })),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się zapisać zamówienia.'));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1800] flex justify-end bg-black/35" onClick={() => !saving && onClose()}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[540px] h-full bg-bakery-card shadow-2xl flex flex-col font-auth text-bakery-dark"
      >
        <div className="px-5 sm:px-6 pt-4 pb-5 bg-bakery-dark text-white flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#cfc8c4]">
              {editing ? 'Edycja zamówienia' : 'Nowe zamówienie'}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Zamknij"
              className="w-11 h-11 -mr-3 flex items-center justify-center text-white"
            >
              <X aria-hidden className="w-[22px] h-[22px]" />
            </button>
          </div>
          <h2 id={titleId} className="m-0 font-display text-[24px] leading-tight font-extrabold break-words">
            {editing ? editing.client_name : 'Zamówienie jednorazowe'}
          </h2>
          <span className="text-sm font-bold text-[#cfc8c4] first-letter:uppercase">Na {formatDayHeading(date)}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-5">
          {loadError && (
            <p role="alert" className={ERROR_CLASS}>
              {loadError}
            </p>
          )}
          {!data && !loadError && <div className="h-40 rounded-xl bg-bakery-inactive animate-pulse" />}

          {data && (
            <>
              {!editing && (
                <ClientPicker
                  clients={data.clients}
                  value={clientId}
                  onChange={chooseClient}
                  badge={(client) => (stops.some((stop) => stop.client_id === client.client_id) ? 'ma zamówienie' : null)}
                />
              )}

              {!editing && existing && (
                <p
                  className={`m-0 px-3.5 py-2.5 rounded-xl text-[13px] font-bold ${
                    existing.locked ? 'bg-[#fbdcdc] text-[#991b1b]' : 'bg-[#fbe5bd] text-[#5c3300]'
                  }`}
                >
                  {existing.locked
                    ? 'Ten klient ma już zamówienie w dostawie albo dostarczone – nie można go zmienić.'
                    : 'Ten klient ma już zamówienie na ten dzień – poniżej jego skład, zapis go zaktualizuje.'}
                </p>
              )}

              {standingItems.length > 0 && !existing?.locked && (
                <button
                  type="button"
                  onClick={() => setItems(standingItems)}
                  className="self-start inline-flex items-center gap-2 min-h-10 px-3.5 rounded-[10px] border border-bakery-btnBorder bg-white text-[13px] font-extrabold hover:border-bakery-dark"
                >
                  <Repeat aria-hidden className="w-4 h-4" />
                  Wczytaj zamówienie stałe ({standingItems.length} poz.)
                </button>
              )}

              <ItemsEditor items={items} products={data.products} onChange={setItems} />
            </>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-[#e2dcda] bg-bakery-card flex flex-col gap-3">
          {error && (
            <p role="alert" className={ERROR_CLASS}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
              Anuluj
            </button>
            <button type="button" onClick={save} disabled={saving || !data} className={PRIMARY_BUTTON}>
              {saving ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Dodaj zamówienie'}
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}