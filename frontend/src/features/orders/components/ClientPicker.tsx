import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, Search } from 'lucide-react';
import type { AppClient } from '../../../services/api';
import { DashboardListScrollbar } from '../../dashboard/components/DashboardListScrollbar';
import { pickableClients } from '../lib/clientPicker';

export function ClientPicker({
  clients,
  value,
  onChange,
  badge,
}: {
  clients: AppClient[];
  value: number | null;
  onChange: (clientId: number) => void;
  badge?: (client: AppClient) => string | null;
}) {
  const listId = useId();
  const [open, setOpen] = useState(value === null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const groups = useMemo(() => pickableClients(clients, query), [clients, query]);
  const options = groups.flatMap((group) => group.clients);
  const selected = clients.find((client) => client.client_id === value) ?? null;

  const choose = (client: AppClient) => {
    onChange(client.client_id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => Math.min(Math.max(index + step, 0), options.length - 1));
    } else if (event.key === 'Enter' && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === 'Escape' && selected) {
      event.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold text-[#3d3937]">Klient</span>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-left hover:border-[#8f8a88]"
        >
          {selected ? (
            <span className="min-w-0 flex flex-col">
              <span className="text-[15px] font-extrabold truncate">{selected.name}</span>
              <span className="text-[13px] font-semibold text-[#5f5a58] truncate">
                {selected.address} · {selected.route_details.route_name}
              </span>
            </span>
          ) : (
            <span className="text-[15px] font-semibold text-[#8a8482]">Wybierz klienta…</span>
          )}
          <span className="shrink-0 text-[13px] font-extrabold text-[#5f5a58] inline-flex items-center gap-1">
            Zmień
            <ChevronDown aria-hidden className="w-4 h-4" />
          </span>
        </button>
      )}

      {open && (
        <div className="rounded-xl border-[1.5px] border-bakery-accent bg-white overflow-hidden">
          <div className="relative border-b border-[#eee9e7]">
            <Search aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8482]" />
            <input
              type="search"
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={options[active] ? `${listId}-${options[active].client_id}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Szukaj klienta lub adresu…"
              className="w-full h-12 pl-11 pr-4 text-[15px] font-semibold outline-none"
            />
          </div>
          <DashboardListScrollbar className="h-[320px] max-h-[40vh] shrink-0" contentClassName="p-1">
            <ul id={listId} role="listbox" aria-label="Klienci" className="m-0 list-none">
              {options.length === 0 && (
                <li className="px-3 py-3 text-[13px] font-semibold text-[#5f5a58]">Żaden aktywny klient nie pasuje.</li>
              )}
              {groups.map((group) => (
                <li key={group.routeName} role="presentation">
                  <span className="block px-3 pt-2.5 pb-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]">
                    {group.routeName}
                  </span>
                  <ul role="presentation" className="m-0 p-0 list-none">
                    {group.clients.map((client) => {
                      const index = options.indexOf(client);
                      const note = badge?.(client) ?? null;
                      return (
                        <li
                          key={client.client_id}
                          id={`${listId}-${client.client_id}`}
                          role="option"
                          aria-selected={client.client_id === value}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => choose(client)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                            index === active ? 'bg-[#f3efed]' : ''
                          }`}
                        >
                          <span className="flex-1 min-w-0 flex flex-col">
                            <span className="text-[14px] font-extrabold truncate">{client.name}</span>
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#5f5a58]">
                              <MapPin aria-hidden className="w-3 h-3 shrink-0" />
                              <span className="truncate">{client.address}</span>
                            </span>
                          </span>
                          {note && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#fbe5bd] text-[11px] font-extrabold text-[#7a4300]">
                              {note}
                            </span>
                          )}
                          {client.client_id === value && <Check aria-hidden className="w-4 h-4 shrink-0" />}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </DashboardListScrollbar>
        </div>
      )}
    </div>
  );
}