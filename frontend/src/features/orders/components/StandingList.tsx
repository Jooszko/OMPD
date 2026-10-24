import { ChevronRight, MapPin, Truck } from 'lucide-react';
import type { StandingOrderGroup } from '../../../services/api';
import { WeekStrip } from '../../clients/components/ClientBadges';
import { formatMoney, formatPieces, plural } from '../lib/orders';
import { groupStandingByRoute, weeklyTotals } from '../lib/standing';

const COLUMNS = 'md:grid md:grid-cols-[minmax(240px,1fr)_180px_150px_130px_24px] md:gap-3';

export function StandingList({
  orders,
  onSelect,
}: {
  orders: StandingOrderGroup[];
  onSelect: (order: StandingOrderGroup) => void;
}) {
  return (
    <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden">
      <div
        aria-hidden
        className={`hidden ${COLUMNS} items-center px-5 py-3 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]`}
      >
        <span>Klient i adres</span>
        <span>Dni dostaw</span>
        <span className="text-right">Jedna dostawa</span>
        <span className="text-right">Tygodniowo</span>
        <span />
      </div>

      {groupStandingByRoute(orders).map((group) => (
        <div key={group.routeId} role="group" aria-label={group.routeName}>
          <h2 className="m-0 px-4 md:px-5 py-2.5 bg-[#efebe9] border-t border-[#e2dcda] flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#3d3937]">{group.routeName}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4a4543]">
              <Truck aria-hidden className="w-3.5 h-3.5" />
              {group.driverName ?? 'bez kierowcy'}
            </span>
            <span className="text-xs font-bold text-[#5f5a58]">
              · {group.orders.length} {plural(group.orders.length, 'klient', 'klientów', 'klientów')}
            </span>
          </h2>
          <ul className="m-0 p-0 list-none">
            {group.orders.map((order) => {
              const week = weeklyTotals(order);
              return (
                <li key={order.client_id} className="border-t border-[#e6e1df]">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => onSelect(order)}
                    className={`w-full text-left flex ${COLUMNS} items-center gap-3 px-4 md:px-5 py-3 hover:bg-[#f3efed]`}
                  >
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-[15px] font-extrabold ${order.client_active ? '' : 'text-[#5f5a58]'}`}>
                          {order.client_name}
                        </span>
                        {!order.client_active && (
                          <span className="px-2 py-0.5 rounded-full bg-[#ebe7e7] text-[10px] font-extrabold uppercase text-[#4a4543]">
                            Klient nieaktywny
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5f5a58]">
                        <MapPin aria-hidden className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{order.address}</span>
                      </span>
                      <span className="md:hidden mt-1.5 flex flex-wrap items-center gap-2 text-[13px] font-bold">
                        <WeekStrip days={order.days_ids} />
                        {formatMoney(week.value)} / tydz.
                      </span>
                    </span>
                    <span className="hidden md:block">
                      <WeekStrip days={order.days_ids} />
                    </span>
                    <span className="hidden md:flex flex-col items-end text-sm font-bold tabular-nums">
                      {formatPieces(order.total_quantity)}
                      <span className="text-xs font-semibold text-[#5f5a58]">{formatMoney(order.total_amount)}</span>
                    </span>
                    <span className="hidden md:flex flex-col items-end text-sm font-extrabold tabular-nums">
                      {formatMoney(week.value)}
                      <span className="text-xs font-semibold text-[#5f5a58]">{formatPieces(week.pieces)}</span>
                    </span>
                    <ChevronRight aria-hidden className="w-5 h-5 shrink-0 text-[#8a8482]" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}