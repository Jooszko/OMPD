import { useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  fetchAuditEntries,
  fetchAuditFilterOptions,
  type AuditEntry,
  type AuditFilterOptions,
  type AuditPage,
  type AuditQuery,
} from '../../../services/api';
import { toIsoDate } from '../lib/dateFormat';
import { formatEntryCount, groupEntriesByDay } from '../lib/auditFormat';
import { AuditEntryItem } from '../components/AuditEntryItem';

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 400;

const LABEL_CLASS = 'flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500';
const FIELD_CLASS =
  'px-2 py-1.5 text-xs font-semibold normal-case tracking-normal text-bakery-dark bg-white border border-bakery-btnBorder rounded-lg outline-none focus:border-bakery-accent';
const PAGER_BUTTON_CLASS =
  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-bakery-dark bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive disabled:opacity-40 disabled:pointer-events-none';

interface Filters {
  category: string;
  action: string;
  actor: string;
  dateFrom: string;
  dateTo: string;
}

interface ObjectFilter {
  type: string;
  id: string;
  label: string;
}

interface LoadedPage {
  key: string;
  page: AuditPage | null;
  error: string | null;
}

const EMPTY_FILTERS: Filters = { category: '', action: '', actor: '', dateFrom: '', dateTo: '' };

export default function AuditLogPage() {
  const [options, setOptions] = useState<AuditFilterOptions | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const location = useLocation();
  const [objectFilter, setObjectFilter] = useState<ObjectFilter | null>(
    () => (location.state as { objectFilter?: ObjectFilter } | null)?.objectFilter ?? null
  );
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);

  const today = toIsoDate(new Date());
  const rangeError =
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
      ? 'Data początkowa nie może być późniejsza niż końcowa.'
      : null;

  const query = useMemo<AuditQuery>(
    () => ({
      category: filters.category,
      action: filters.action,
      actor: filters.actor,
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      q: search,
      object_type: objectFilter?.type,
      object_id: objectFilter?.id,
      page: String(page),
    }),
    [filters, search, objectFilter, page]
  );
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    fetchAuditFilterOptions()
      .then(setOptions)
      .catch(() => undefined); // bez list filtrów strona nadal działa, a błąd pokaże pobieranie wpisów
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (rangeError) return;
    let cancelled = false;
    fetchAuditEntries(query)
      .then((result) => {
        if (!cancelled) setLoaded({ key: queryKey, page: result, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key: queryKey, page: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [query, queryKey, rangeError]);

  const changeFilter = (field: keyof Filters, value: string) => {
    setFilters((previous) => ({
      ...previous,
      [field]: value,
      ...(field === 'category' ? { action: '' } : {}),
    }));
    setPage(1);
  };

  const showHistory = (entry: AuditEntry) => {
    setObjectFilter({ type: entry.object_type, id: entry.object_id, label: entry.object_label });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
    setSearch('');
    setObjectFilter(null);
    setPage(1);
  };

  const current = loaded?.key === queryKey ? loaded : null;
  const data = loaded?.page ?? null;
  const isRefetching = !rangeError && !current && data !== null;
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const hasFilters = Object.values(filters).some(Boolean) || searchInput.trim() !== '' || objectFilter !== null;
  const actionOptions =
    options?.actions.filter((action) => !filters.category || action.category === filters.category) ?? [];

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div>
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Dziennik zmian</h1>
        <p className="text-xs text-gray-500 font-medium">
          Kto, kiedy i co zmienił w systemie: konta i logowania, klienci, produkty, zamówienia, finanse i dostawy.
          Wpisów nie można edytować ani usuwać.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL_CLASS}>
          Kategoria
          <select
            value={filters.category}
            onChange={(e) => changeFilter('category', e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">Wszystkie</option>
            {options?.categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Rodzaj zdarzenia
          <select
            value={filters.action}
            onChange={(e) => changeFilter('action', e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">Wszystkie</option>
            {actionOptions.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Osoba
          <select value={filters.actor} onChange={(e) => changeFilter('actor', e.target.value)} className={FIELD_CLASS}>
            <option value="">Wszyscy</option>
            {options?.actors.map((actor) => (
              <option key={actor.id} value={String(actor.id)}>
                {actor.name}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Od
          <input
            type="date"
            value={filters.dateFrom}
            max={today}
            onChange={(e) => changeFilter('dateFrom', e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className={LABEL_CLASS}>
          Do
          <input
            type="date"
            value={filters.dateTo}
            max={today}
            onChange={(e) => changeFilter('dateTo', e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        <label className={`${LABEL_CLASS} flex-1 min-w-[200px]`}>
          Szukaj
          <input
            type="search"
            value={searchInput}
            placeholder="Opis, obiekt lub osoba"
            onChange={(e) => setSearchInput(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs font-bold text-bakery-dark bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive"
          >
            Wyczyść filtry
          </button>
        )}
      </div>

      {objectFilter && (
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="text-gray-500">Historia obiektu:</span>
          <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-bakery-dark text-white rounded-full">
            {objectFilter.label}
            <button
              type="button"
              onClick={() => {
                setObjectFilter(null);
                setPage(1);
              }}
              aria-label="Pokaż wpisy wszystkich obiektów"
              className="p-0.5 rounded-full hover:bg-white/20"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </span>
        </div>
      )}

      <hr className="border-0 border-t border-bakery-border my-1" />

      {rangeError && <p className="m-0 text-sm font-semibold text-rose-700">{rangeError}</p>}
      {!rangeError && current?.error && (
        <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać dziennika: {current.error}</p>
      )}
      {!rangeError && !current && !data && (
        <div className="flex flex-col gap-3" aria-label="Wczytywanie dziennika">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
          ))}
        </div>
      )}

      {!rangeError && data && (
        <div
          className={`flex flex-col gap-4 transition-opacity ${isRefetching ? 'opacity-50' : ''}`}
          aria-busy={isRefetching}
        >
          {data.results.length === 0 ? (
            <p className="m-0 text-sm font-semibold text-gray-500 italic">Brak wpisów dla wybranych filtrów.</p>
          ) : (
            groupEntriesByDay(data.results).map((group) => (
              <section
                key={group.day}
                className="bg-bakery-inactive border border-bakery-btnBorder rounded shadow-sm px-4 py-2"
              >
                <h2 className="m-0 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {group.label}
                </h2>
                <ul className="m-0 p-0 list-none">
                  {group.entries.map((entry) => (
                    <AuditEntryItem key={entry.entry_id} entry={entry} onShowHistory={showHistory} />
                  ))}
                </ul>
              </section>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-gray-500">
            <span>
              {formatEntryCount(data.count)}
              {totalPages > 1 && ` · strona ${page} z ${totalPages}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => value - 1)}
                  disabled={!data.previous || isRefetching}
                  className={PAGER_BUTTON_CLASS}
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                  Nowsze
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => value + 1)}
                  disabled={!data.next || isRefetching}
                  className={PAGER_BUTTON_CLASS}
                >
                  Starsze
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
