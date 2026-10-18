import { ChevronRight, MapPin, Truck } from 'lucide-react';
import type { AppClient } from '../../../services/api';
import { formatDays, formatPhone, groupByRoute, isLocated } from '../lib/clients';
import { ActiveBadge, LocationBadge, WeekStrip } from './ClientBadges';

const COLUMNS = 'md:grid md:grid-cols-[minmax(260px,1.8fr)_150px_180px_140px_110px_24px] md:gap-3';

export function ClientList({
  clients,
  selectedId,
  onSelect,
}: {
  clients: AppClient[];
  selectedId: number | null;
  onSelect: (clientId: number) => void;
}) {
  return (
    <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden">
      <div
        aria-hidden
        className={`hidden ${COLUMNS} items-center px-5 py-3 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]`}
      >
        <span>Klient i adres</span>
        <span>Telefon</span>
        <span>Stałe zamówienia</span>
        <span>Lokalizacja</span>
        <span>Status</span>
        <span />
      </div>

      {groupByRoute(clients).map((group) => (
        <div key={group.routeId} role="group" aria-label={group.name}>
          <h2 className="m-0 px-4 md:px-5 py-2.5 bg-[#efebe9] border-t border-[#e2dcda] flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#3d3937]">{group.name}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4a4543]">
              <Truck aria-hidden className="w-3.5 h-3.5" />
              {group.driver ?? 'bez kierowcy'}
            </span>
            <span className="text-xs font-bold text-[#5f5a58]">· {group.clients.length} pkt</span>
          </h2>
          <ul className="m-0 p-0 list-none">
            {group.clients.map((client) => {
              const located = isLocated(client);
              return (
                <li key={client.client_id} className="border-t border-[#e6e1df]">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => onSelect(client.client_id)}
                    className={`w-full text-left flex ${COLUMNS} items-center gap-3 px-4 md:px-5 py-3 transition ${
                      selectedId === client.client_id ? 'bg-[#ebe4e1]' : 'hover:bg-[#f3efed]'
                    }`}
                  >
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span
                        className={`text-[15px] font-extrabold ${client.is_active ? 'text-bakery-dark' : 'text-[#5f5a58]'}`}
                      >
                        {client.name}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5f5a58]">
                        <MapPin aria-hidden className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{client.address}</span>
                        <span className="md:hidden whitespace-nowrap">· {formatDays(client.standing_days)}</span>
                      </span>
                      {(!client.is_active || !located) && (
                        <span className="md:hidden mt-1 flex flex-wrap gap-1.5">
                          {!client.is_active && <ActiveBadge active={false} />}
                          {!located && <LocationBadge located={false} />}
                        </span>
                      )}
                    </span>
                    <span className="hidden md:block font-mono text-[13px] text-[#3d3937]">{formatPhone(client.phone) || '—'}</span>
                    <span className="hidden md:block">
                      <WeekStrip days={client.standing_days} />
                    </span>
                    <span className="hidden md:block">
                      <LocationBadge located={located} />
                    </span>
                    <span className="hidden md:block">
                      <ActiveBadge active={client.is_active} />
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