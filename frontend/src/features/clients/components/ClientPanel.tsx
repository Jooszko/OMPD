import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, MapPinOff, Pencil, Phone, X } from 'lucide-react';
import { fetchClientCard, type AppClient, type ClientCard } from '../../../services/api';
import { useDialogFocus } from '../../dashboard/components/useDialogFocus';
import { formatMoney } from '../../finance/lib/money';
import { AccountHistory } from '../../users/components/AccountHistory';
import { apiErrorMessage, formatJoined } from '../../users/lib/staff';
import { deliveryTone, formatDeliveryDate, formatNip, formatPhone, isLocated, WEEKDAYS, type DeliveryTone } from '../lib/clients';
import { ActiveBadge, WeekStrip } from './ClientBadges';
import { LocationMap } from './LocationMap';

const SECTION_TITLE = 'm-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]';
const BOX = 'rounded-xl bg-white border border-[#e6e1df]';
const ACTION =
  'min-h-12 px-3 flex items-center justify-center gap-2 rounded-xl border border-bakery-btnBorder bg-white text-sm font-extrabold text-bakery-dark no-underline hover:border-bakery-dark';

const DELIVERY_TONES: Record<DeliveryTone, string> = {
  success: 'bg-[#cdebd5] text-[#17532b]',
  danger: 'bg-[#f8cccc] text-[#8f1616]',
  muted: 'bg-[#ebe7e7] text-[#4a4543]',
  info: 'bg-[#dfe8f6] text-[#1d4f91]',
};

interface LoadedCard {
  key: string;
  card: ClientCard | null;
  error: string | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${BOX} p-3 flex flex-col gap-1 min-w-0`}>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]">{label}</span>
      <span className="font-display text-xl font-extrabold tabular-nums truncate">{value}</span>
    </div>
  );
}

export function ClientPanel({
  client,
  version,
  paused,
  onClose,
  onEdit,
  onLocate,
  onToggleActive,
}: {
  client: AppClient;
  version: number;
  paused: boolean;
  onClose: () => void;
  onEdit: () => void;
  onLocate: () => void;
  onToggleActive: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const [loaded, setLoaded] = useState<LoadedCard | null>(null);
  const key = `${client.client_id}|${version}`;
  useDialogFocus(panelRef, onClose, { paused });

  useEffect(() => {
    let cancelled = false;
    fetchClientCard(client.client_id)
      .then((card) => {
        if (!cancelled) setLoaded({ key, card, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoaded({ key, card: null, error: apiErrorMessage(err, 'Nie udało się pobrać karty klienta.') });
      });
    return () => {
      cancelled = true;
    };
  }, [client.client_id, key]);

  const card = loaded?.key === key ? loaded.card : null;
  const error = loaded?.key === key ? loaded.error : null;
  const located = isLocated(client);

  return createPortal(
    <div className="fixed inset-0 z-[1800] flex justify-end bg-black/35" onClick={onClose}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[480px] h-full bg-bakery-card shadow-2xl flex flex-col font-auth text-bakery-dark"
      >
        <div className="px-5 sm:px-6 pt-4 pb-5 bg-bakery-dark text-white flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#cfc8c4]">Karta klienta</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij kartę"
              className="w-11 h-11 -mr-3 flex items-center justify-center text-white"
            >
              <X aria-hidden className="w-[22px] h-[22px]" />
            </button>
          </div>
          <h2 id={titleId} className="m-0 font-display text-[26px] leading-tight font-extrabold break-words">
            {client.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            <ActiveBadge active={client.is_active} pill />
            <span className="px-2.5 py-0.5 rounded-full bg-[#3a3533] text-white text-xs font-extrabold">
              {client.route_details.route_name}
              {client.route_details.driver_name && ` · ${client.route_details.driver_name}`}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={onEdit} className={`${ACTION} ${client.phone ? '' : 'col-span-2'}`}>
              <Pencil aria-hidden className="w-4 h-4" />
              Edytuj dane
            </button>
            {client.phone && (
              <a href={`tel:${client.phone}`} className={ACTION}>
                <Phone aria-hidden className="w-4 h-4" />
                Zadzwoń
              </a>
            )}
          </div>
          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_TITLE}>Adres i lokalizacja</h3>
            <div className={`${BOX} overflow-hidden`}>
              {client.latitude && client.longitude ? (
                <LocationMap latitude={client.latitude} longitude={client.longitude} label={client.address} />
              ) : (
                <div className="py-5 bg-[#f3efed] flex flex-col items-center justify-center gap-1.5 text-[#7a4300]">
                  <MapPinOff aria-hidden className="w-6 h-6" />
                  <span className="text-[13px] font-bold">Brak lokalizacji – klienta nie ma na mapie tras.</span>
                  <button
                    type="button"
                    onClick={onLocate}
                    className="mt-1 min-h-10 px-3.5 inline-flex items-center gap-2 rounded-[10px] bg-bakery-dark text-white text-[13px] font-extrabold"
                  >
                    <MapPin aria-hidden className="w-4 h-4" />
                    Ustal lokalizację z adresu
                  </button>
                </div>
              )}
              <div className="px-3.5 py-3 flex flex-col gap-1">
                <span className="text-[15px] font-extrabold">{client.address}</span>
                {located && client.geocoded_at && (
                  <span className="text-xs font-bold text-[#1f5f33]">Lokalizacja ustalona {formatJoined(client.geocoded_at)}</span>
                )}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_TITLE}>Kontakt</h3>
            <dl className={`${BOX} m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-4 py-3.5 text-sm`}>
              <dt className="font-bold text-[#5f5a58]">Telefon</dt>
              <dd className="m-0 text-right font-mono font-extrabold">
                {client.phone ? (
                  <a href={`tel:${client.phone}`} className="text-bakery-dark">
                    {formatPhone(client.phone)}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="font-bold text-[#5f5a58]">NIP</dt>
              <dd className={`m-0 text-right ${client.nip ? 'font-mono font-extrabold' : 'font-bold text-[#5f5a58]'}`}>
                {client.nip ? formatNip(client.nip) : 'brak (osoba prywatna)'}
              </dd>
            </dl>
          </section>

          {error && <p className="m-0 text-sm font-semibold text-rose-700">{error}</p>}
          {!card && !error && (
            <div aria-label="Wczytywanie karty" className="flex flex-col gap-3">
              <div className="h-24 rounded-xl bg-bakery-inactive animate-pulse" />
              <div className="h-32 rounded-xl bg-bakery-inactive animate-pulse" />
            </div>
          )}

          {card && (
            <>
              <section className="flex flex-col gap-2.5">
                <h3 className={SECTION_TITLE}>Stałe zamówienia</h3>
                <WeekStrip days={client.standing_days} size="md" />
                {card.standing_orders.length > 0 ? (
                  <ul className={`${BOX} m-0 p-0 list-none`}>
                    {card.standing_orders.map((order) => (
                      <li
                        key={order.so_id}
                        className="grid grid-cols-[36px_1fr_auto] gap-2.5 items-center px-3.5 py-2.5 border-t border-[#f0ecea] first:border-t-0"
                      >
                        <span className="text-xs font-extrabold text-[#5f5a58]">{WEEKDAYS[order.day_of_week]}</span>
                        <span className="text-sm font-bold">{order.product_name}</span>
                        <span className="text-[13px] font-bold text-[#3d3937] tabular-nums whitespace-nowrap">
                          {order.quantity} szt. × {formatMoney(order.price, { cents: true })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-sm font-semibold italic text-[#5f5a58]">Brak stałych zamówień.</p>
                )}
                <p className="m-0 text-xs font-semibold text-[#5f5a58]">Harmonogram zmienia się w zakładce Zamówienia.</p>
              </section>

              <section className="flex flex-col gap-2.5">
                <h3 className={SECTION_TITLE}>Ostatnie 30 dni</h3>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Sprzedaż" value={formatMoney(card.last_30_days.sales)} />
                  <Stat
                    label="Dostawy"
                    value={`${card.last_30_days.delivered_days} z ${card.last_30_days.planned_days}`}
                  />
                  <Stat label="Zwroty" value={formatMoney(card.last_30_days.returns)} />
                </div>
                {card.recent_deliveries.length > 0 ? (
                  <ol className={`${BOX} m-0 p-0 list-none`}>
                    {card.recent_deliveries.map((delivery) => {
                      const tone = deliveryTone(delivery.status);
                      return (
                        <li
                          key={delivery.date}
                          className="grid grid-cols-[1fr_auto_auto] gap-2.5 items-center px-3.5 py-2.5 border-t border-[#f0ecea] first:border-t-0"
                        >
                          <span className="text-sm font-bold">{formatDeliveryDate(delivery.date)}</span>
                          <span
                            className={`text-[13px] font-bold tabular-nums ${
                              tone === 'danger' || tone === 'muted' ? 'text-[#8a8482] line-through' : 'text-[#3d3937]'
                            }`}
                          >
                            {formatMoney(delivery.value, { cents: true })}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${DELIVERY_TONES[tone]}`}>
                            {delivery.status_label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="m-0 text-sm font-semibold italic text-[#5f5a58]">Brak zamówień.</p>
                )}
              </section>
            </>
          )}

          <AccountHistory
            objectType="client"
            objectId={client.client_id}
            label={client.name}
            title="Historia zmian"
            version={version}
          />

          <section className="mt-auto p-4 rounded-xl border border-dashed border-bakery-btnBorder flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 flex-[1_1_220px] text-[13px] font-semibold leading-relaxed text-[#4a4543]">
              {client.is_active
                ? 'Wstrzymanie zdejmuje klienta z listy punktów na trasach. Dane i historia zostają.'
                : 'Dostawy są wstrzymane – klienta nie ma na liście punktów tras.'}
            </p>
            <button
              type="button"
              onClick={onToggleActive}
              className="min-h-10 px-3.5 rounded-[10px] border border-bakery-btnBorder bg-white text-[13px] font-extrabold text-bakery-dark hover:border-bakery-dark"
            >
              {client.is_active ? 'Wstrzymaj dostawy' : 'Wznów dostawy'}
            </button>
          </section>

        </div>
      </aside>
    </div>,
    document.body
  );
}