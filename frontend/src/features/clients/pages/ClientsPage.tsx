import { useEffect, useMemo, useState } from 'react';
import { MapPinOff, Plus, Search } from 'lucide-react';
import { fetchClients, fetchRoutes, type AppClient, type RouteOption } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { ClientTiles, RouteFilter } from '../components/ClientFilters';
import { ClientFormDialog } from '../components/ClientFormDialog';
import { ClientList } from '../components/ClientList';
import { ClientPanel } from '../components/ClientPanel';
import { GeocodeDialog } from '../components/GeocodeDialog';
import { StatusDialog } from '../components/StatusDialog';
import {
  clientCounts,
  groupByRoute,
  isLocated,
  matchesClientFilter,
  matchesClientQuery,
  type ClientFilter,
} from '../lib/clients';

type ClientDialog =
  | { kind: 'create' }
  | { kind: 'edit' | 'status'; clientId: number }
  | { kind: 'geocode'; clientIds: number[] };

export default function ClientsPage() {
  const [clients, setClients] = useState<AppClient[] | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [routeId, setRouteId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<ClientDialog | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClients(), fetchRoutes()])
      .then(([clientData, routeData]) => {
        if (cancelled) return;
        setClients(clientData);
        setRouteOptions(routeData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Nie udało się pobrać listy klientów.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const routes = useMemo(() => groupByRoute(clients ?? []), [clients]);
  const routeSizes = useMemo(
    () => Object.fromEntries(routes.map((route) => [route.routeId, route.clients.length])),
    [routes]
  );
  const visible = useMemo(
    () =>
      (clients ?? []).filter(
        (client) =>
          matchesClientFilter(client, filter) &&
          (routeId === null || client.route === routeId) &&
          matchesClientQuery(client, query)
      ),
    [clients, filter, routeId, query]
  );
  const counts = clientCounts(clients ?? []);
  const findClient = (clientId: number) => clients?.find((client) => client.client_id === clientId) ?? null;
  const selected = selectedId === null ? null : findClient(selectedId);
  const dialogClient = dialog && (dialog.kind === 'edit' || dialog.kind === 'status') ? findClient(dialog.clientId) : null;

  const saveClient = (saved: AppClient) => {
    setClients((current) => {
      if (!current) return current;
      return current.some((client) => client.client_id === saved.client_id)
        ? current.map((client) => (client.client_id === saved.client_id ? saved : client))
        : [...current, saved];
    });
    setVersion((value) => value + 1);
  };

  const locateMissing = () =>
    setDialog({
      kind: 'geocode',
      clientIds: (clients ?? []).filter((client) => !isLocated(client)).map((client) => client.client_id),
    });

  const clearFilters = () => {
    setFilter('all');
    setRouteId(null);
    setQuery('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Klienci</h1>
          <p className="m-0 text-sm text-[#4a4543]">Punkty dostaw, trasy i stałe zamówienia odbiorców.</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'create' })}
          disabled={!clients}
          className="inline-flex items-center gap-2 min-h-11 px-[18px] rounded-xl bg-bakery-dark text-white text-sm font-extrabold disabled:opacity-50"
        >
          <Plus aria-hidden className="w-[18px] h-[18px] text-bakery-accent" strokeWidth={2.6} />
          Dodaj klienta
        </button>
      </div>

      {loadError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {loadError}
        </p>
      )}

      {!clients && !loadError && (
        <div className="flex flex-col gap-4" aria-label="Wczytywanie klientów">
          <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
            ))}
          </div>
          <div className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
        </div>
      )}

      {clients && (
        <>
          <ClientTiles counts={counts} value={filter} onChange={setFilter} />

          {counts.unlocated > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[14px] bg-[#fbe5bd] text-[#5c3300]">
              <span className="flex items-center gap-2.5 text-sm font-bold">
                <MapPinOff aria-hidden className="w-5 h-5 shrink-0" />
                {counts.unlocated === 1 ? '1 klient nie ma' : `${counts.unlocated} klientów nie ma`} lokalizacji – mapa tras w
                Logistyce ich nie pokaże.
              </span>
              <button
                type="button"
                onClick={locateMissing}
                className="min-h-10 px-3.5 rounded-[10px] bg-bakery-dark text-white text-[13px] font-extrabold"
              >
                Ustal z adresów
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex-[1_1_280px] flex items-center gap-2.5 min-h-11 px-3.5 rounded-xl border border-bakery-btnBorder bg-white focus-within:border-bakery-accent">
                <Search aria-hidden className="w-[18px] h-[18px] text-[#5f5a58]" />
                <span className="sr-only">Szukaj klienta</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj po nazwie, adresie, telefonie lub NIP"
                  className="flex-1 min-w-0 border-0 outline-none bg-transparent text-sm font-semibold text-bakery-dark"
                />
              </label>
              <span className="text-[13px] font-bold text-[#4a4543] tabular-nums">
                Pokazano {visible.length} z {clients.length}
              </span>
            </div>
            <RouteFilter routes={routes} value={routeId} onChange={setRouteId} />
          </div>

          {visible.length === 0 ? (
            <div className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-6 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold italic text-[#5f5a58]">Brak klientów pasujących do filtrów.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-10 px-4 rounded-xl border border-bakery-btnBorder bg-white text-[13px] font-extrabold"
              >
                Wyczyść filtry
              </button>
            </div>
          ) : (
            <ClientList clients={visible} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </>
      )}

      {selected && (
        <ClientPanel
          key={selected.client_id}
          client={selected}
          version={version}
          paused={dialog !== null}
          onClose={() => setSelectedId(null)}
          onEdit={() => setDialog({ kind: 'edit', clientId: selected.client_id })}
          onLocate={() => setDialog({ kind: 'geocode', clientIds: [selected.client_id] })}
          onToggleActive={() => setDialog({ kind: 'status', clientId: selected.client_id })}
        />
      )}

      {dialog?.kind === 'create' && (
        <ClientFormDialog
          mode={{ kind: 'create' }}
          routes={routeOptions}
          routeSizes={routeSizes}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            saveClient(saved);
            setSelectedId(saved.client_id);
          }}
        />
      )}
      {dialog?.kind === 'edit' && dialogClient && (
        <ClientFormDialog
          mode={{ kind: 'edit', client: dialogClient }}
          routes={routeOptions}
          routeSizes={routeSizes}
          onClose={() => setDialog(null)}
          onSaved={saveClient}
        />
      )}
      {dialog?.kind === 'status' && dialogClient && (
        <StatusDialog client={dialogClient} onClose={() => setDialog(null)} onSaved={saveClient} />
      )}
      {dialog?.kind === 'geocode' && (
        <GeocodeDialog
          clients={dialog.clientIds.map(findClient).filter((client): client is AppClient => client !== null)}
          onClose={() => setDialog(null)}
          onLocated={saveClient}
          onEdit={(client) => setDialog({ kind: 'edit', clientId: client.client_id })}
        />
      )}
    </div>
  );
}