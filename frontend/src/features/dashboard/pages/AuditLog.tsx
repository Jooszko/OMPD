import { useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import {
  fetchAuditEntries,
  fetchAuditFilterOptions,
  type AuditEntry,
  type AuditFilterOptions,
  type AuditPage,
  type AuditQuery,
} from '../../../services/api';
import { shiftIsoDate, toIsoDate } from '../lib/dateFormat';
import { formatEntryCount, groupEntriesByDay } from '../lib/auditFormat';
import { AuditEntryItem } from '../components/AuditEntryItem';

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 400;

const CHIP = 'min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap';
const CHIP_ACTIVE = 'bg-bakery-dark border-bakery-dark text-white';
const CHIP_IDLE = 'bg-white border-bakery-btnBorder hover:border-[#8f8a88]';
const DATE_FIELD =
  'h-10 px-3 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[14px] font-semibold outline-none focus:border-bakery-accent';
const SELECT =
  'h-11 px-3 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[14px] font-bold outline-none focus:border-bakery-accent';
const PAGER_BUTTON =
  'inline-flex items-center gap-1.5 min-h-10 px-3.5 rounded-xl border border-bakery-btnBorder bg-bakery-card text-[13px] font-extrabold disabled:opacity-40';
const ALERT = 'm-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]';

const RANGE_PRESETS: { label: string; range: (today: string) => { dateFrom: string; dateTo: string } }[] = [
  { label: 'Dziś', range: (today) => ({ dateFrom: today, dateTo: today }) },
  { label: '7 dni', range: (today) => ({ dateFrom: shiftIsoDate(today, -6), dateTo: today }) },
  { label: '30 dni', range: (today) => ({ dateFrom: shiftIsoDate(today, -29), dateTo: today }) },
];
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Dziennik zmian</h1>
        <p className="m-0 text-sm text-[#4a4543]">
          Kto, kiedy i co zmienił w systemie. Wpisów nie można edytować ani usuwać.
        </p>
      </div>

      <section className="flex flex-col gap-3 px-4 py-3.5 rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm">
        <div role="group" aria-label="Kategoria" className="flex flex-wrap gap-2">
          {[{ value: '', label: 'Wszystko' }, ...(options?.categories ?? [])].map((category) => {
            const active = filters.category === category.value;
            return (
              <button
                key={category.value || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => changeFilter('category', category.value)}
                className={`${CHIP} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((preset) => {
            const range = preset.range(today);
            const active = filters.dateFrom === range.dateFrom && filters.dateTo === range.dateTo;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFilters((previous) => ({ ...previous, ...range }));
                  setPage(1);
                }}
                className={`${CHIP} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
              >
                {preset.label}
              </button>
            );
          })}
          <span className="flex items-center gap-2 text-[13px] font-bold">
            <input
              type="date"
              aria-label="Od"
              value={filters.dateFrom}
              max={today}
              onChange={(e) => changeFilter('dateFrom', e.target.value)}
              className={DATE_FIELD}
            />
            –
            <input
              type="date"
              aria-label="Do"
              value={filters.dateTo}
              max={today}
              onChange={(e) => changeFilter('dateTo', e.target.value)}
              className={DATE_FIELD}
            />
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="relative block flex-1 min-w-[220px]">
            <span className="sr-only">Szukaj</span>
            <Search
              aria-hidden
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8a8482]"
            />
            <input
              type="search"
              value={searchInput}
              placeholder="Szukaj w opisie, obiekcie lub osobie…"
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[15px] font-semibold outline-none focus:border-bakery-accent"
            />
          </label>
          <select
            aria-label="Rodzaj zdarzenia"
            value={filters.action}
            onChange={(e) => changeFilter('action', e.target.value)}
            className={SELECT}
          >
            <option value="">Wszystkie zdarzenia</option>
            {actionOptions.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Osoba"
            value={filters.actor}
            onChange={(e) => changeFilter('actor', e.target.value)}
            className={SELECT}
          >
            <option value="">Wszystkie osoby</option>
            {options?.actors.map((actor) => (
              <option key={actor.id} value={String(actor.id)}>
                {actor.name}
              </option>
            ))}
          </select>
        </div>

        {objectFilter && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
            <span className="text-[#5f5a58]">Historia obiektu:</span>
            <span className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-bakery-dark text-white">
              {objectFilter.label}
              <button
                type="button"
                onClick={() => {
                  setObjectFilter(null);
                  setPage(1);
                }}
                aria-label="Pokaż wpisy wszystkich obiektów"
                className="p-1 rounded-full hover:bg-white/20"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-bold text-[#4a4543]">
          <span>{data ? formatEntryCount(data.count) : 'Wczytywanie…'}</span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="underline underline-offset-2 hover:text-bakery-dark"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      </section>

      {rangeError && <p className={ALERT}>{rangeError}</p>}
      {!rangeError && current?.error && <p className={ALERT}>Nie udało się pobrać dziennika: {current.error}</p>}
      {!rangeError && !current && !data && (
        <div
          aria-label="Wczytywanie dziennika"
          className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse"
        />
      )}

      {!rangeError && data && data.results.length === 0 && (
        <p className="m-0 px-5 py-8 rounded-[14px] border border-bakery-btnBorder bg-bakery-card text-center text-sm font-semibold text-[#5f5a58]">
          Brak wpisów dla wybranych filtrów.
        </p>
      )}

      {!rangeError && data && data.results.length > 0 && (
        <section
          aria-busy={isRefetching}
          className={`bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden transition-opacity ${
            isRefetching ? 'opacity-60' : ''
          }`}
        >
          {groupEntriesByDay(data.results).map((group) => (
            <div key={group.day} role="group" aria-label={group.label}>
              <h2 className="m-0 px-4 md:px-5 py-2.5 bg-[#efebe9] border-t border-[#e2dcda] text-xs font-extrabold uppercase tracking-[0.06em] text-[#3d3937]">
                {group.label}
              </h2>
              <ul className="m-0 p-0 list-none">
                {group.entries.map((entry) => (
                  <AuditEntryItem key={entry.entry_id} entry={entry} onShowHistory={showHistory} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!rangeError && data && totalPages > 1 && (
        <nav aria-label="Strony dziennika" className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((value) => value - 1)}
            disabled={!data.previous || isRefetching}
            className={PAGER_BUTTON}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
            Nowsze
          </button>
          <span className="text-[13px] font-bold tabular-nums">
            Strona {page} z {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => value + 1)}
            disabled={!data.next || isRefetching}
            className={PAGER_BUTTON}
          >
            Starsze
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}