import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Trash2, X } from 'lucide-react';
import {
  deleteStandingOrder,
  fetchClients,
  fetchProducts,
  saveStandingOrder,
  type AppClient,
  type AppProduct,
  type StandingOrderGroup,
} from '../../../services/api';
import { useDialogFocus } from '../../dashboard/components/useDialogFocus';
import { ERROR_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';
import type { FormItem } from '../lib/orderForm';
import { DAY_PRESETS, WEEKDAY_LABELS, itemsFromStanding, standingFormError, toggleDay } from '../lib/standing';
import { ClientPicker } from './ClientPicker';
import { ItemsEditor } from './ItemsEditor';

const CHIP = 'min-h-9 px-3 rounded-full border text-[13px] font-extrabold';

export function StandingPanel({
  orders,
  editing,
  onClose,
  onSaved,
}: {
  orders: StandingOrderGroup[];
  editing: StandingOrderGroup | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [data, setData] = useState<{ clients: AppClient[]; products: AppProduct[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<number | null>(editing?.client_id ?? null);
  const [days, setDays] = useState<number[]>(editing?.days_ids ?? [0, 1, 2, 3, 4, 5]);
  const [items, setItems] = useState<FormItem[]>(editing ? itemsFromStanding(editing) : []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useDialogFocus(panelRef, onClose, { closeDisabled: busy });

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClients(), fetchProducts()])
      .then(([clients, products]) => {
        if (!cancelled) setData({ clients, products });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Nie udało się pobrać klientów i produktów.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const existing = editing ?? orders.find((order) => order.client_id === clientId) ?? null;

  const chooseClient = (id: number) => {
    const order = orders.find((entry) => entry.client_id === id);
    setClientId(id);
    setDays(order?.days_ids ?? [0, 1, 2, 3, 4, 5]);
    setItems(order ? itemsFromStanding(order) : []);
    setError(null);
  };

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      setBusy(false);
    }
  };

  const save = () => {
    const problem = standingFormError(clientId, days, items);
    if (problem) {
      setError(problem);
      return;
    }
    run(
      () =>
        saveStandingOrder({
          client_id: clientId as number,
          days,
          items: items.filter((item) => item.qty > 0).map((item) => ({ product_id: item.product_id, qty: item.qty })),
        }),
      'Nie udało się zapisać zamówienia stałego.'
    );
  };

  const remove = () => {
    if (!existing) return;
    run(() => deleteStandingOrder(existing.client_id), 'Nie udało się usunąć zamówienia stałego.');
  };

  return createPortal(
    <div className="fixed inset-0 z-[1800] flex justify-end bg-black/35" onClick={() => !busy && onClose()}>
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
              {editing ? 'Edycja zamówienia stałego' : 'Nowe zamówienie stałe'}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Zamknij"
              className="w-11 h-11 -mr-3 flex items-center justify-center text-white"
            >
              <X aria-hidden className="w-[22px] h-[22px]" />
            </button>
          </div>
          <h2 id={titleId} className="m-0 font-display text-[24px] leading-tight font-extrabold break-words">
            {editing ? editing.client_name : 'Harmonogram dostaw'}
          </h2>
          <span className="text-sm font-bold text-[#cfc8c4]">Ten sam koszyk w każdym zaznaczonym dniu tygodnia</span>
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
                  badge={(client) => (orders.some((order) => order.client_id === client.client_id) ? 'ma stałe' : null)}
                />
              )}

              {!editing && existing && (
                <p className="m-0 px-3.5 py-2.5 rounded-xl bg-[#fbe5bd] text-[13px] font-bold text-[#5c3300]">
                  Ten klient ma już zamówienie stałe – poniżej jego harmonogram, zapis go zastąpi.
                </p>
              )}

              <section className="flex flex-col gap-2.5">
                <h3 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Dni dostaw</h3>
                <div role="group" aria-label="Dni dostaw" className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const active = days.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDays(toggleDay(days, day))}
                        className={`h-11 rounded-xl border text-[13px] font-extrabold ${
                          active ? 'bg-bakery-dark border-bakery-dark text-white' : 'bg-white border-bakery-btnBorder text-[#5f5a58]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {DAY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDays(preset.days)}
                      className={`${CHIP} bg-white border-bakery-btnBorder hover:border-bakery-dark`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>

              <ItemsEditor items={items} products={data.products} onChange={setItems} />

              <p className="m-0 flex gap-2 px-3.5 py-2.5 rounded-xl bg-[#eaf1fb] text-[13px] font-semibold text-[#1d4f91]">
                <Info aria-hidden className="w-4 h-4 shrink-0 mt-0.5" />
                Zmiana dotyczy dni, na które zamówienia nie zostały jeszcze utworzone. Zamówienia na dziś i jutro zmienisz w
                widoku dnia.
              </p>
            </>
          )}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-[#e2dcda] bg-bakery-card flex flex-col gap-3">
          {error && (
            <p role="alert" className={ERROR_CLASS}>
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {editing ? (
              confirmDelete ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="h-12 px-4 rounded-xl bg-[#b91c1c] text-sm font-extrabold text-white disabled:opacity-60"
                >
                  Na pewno usunąć?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-12 px-4 rounded-xl border border-[#e9b4b4] bg-white text-sm font-extrabold text-[#b91c1c]"
                >
                  <Trash2 aria-hidden className="w-4 h-4" />
                  Usuń
                </button>
              )
            ) : (
              <span />
            )}
            <span className="flex gap-2.5">
              <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON}>
                Anuluj
              </button>
              <button type="button" onClick={save} disabled={busy || !data} className={PRIMARY_BUTTON}>
                {busy ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </span>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}