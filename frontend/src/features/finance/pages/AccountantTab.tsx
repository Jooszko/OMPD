import { useEffect, useState } from 'react';
import { downloadFinanceExport, fetchStatement, type ReportPeriodKind, type Statement } from '../../../services/api';
import { toIsoDate } from '../../dashboard/lib/dateFormat';
import { PrintStatement } from '../components/PrintStatement';
import { ReportPeriodNav } from '../components/ReportPeriodNav';
import { formatMoney } from '../lib/money';
import { printDocument } from '../lib/print';

const CSV_EXPORTS = [
  {
    kind: 'statement',
    name: 'Rachunek zysków i strat',
    hint: 'Sprzedaż, zwroty, surowce i każda kategoria kosztów – obok kwoty z poprzedniego okresu.',
  },
  { kind: 'expenses', name: 'Wydatki', hint: 'Każdy wydatek osobno: data, kategoria, opis, kwota i kto go dodał.' },
  { kind: 'clients', name: 'Sprzedaż wg klientów', hint: 'Dla każdego klienta sprzedaż, zwroty, przychód netto i liczba dostaw.' },
  { kind: 'closings', name: 'Zamknięcia dni', hint: 'Kwoty dzień po dniu z informacją, czy dzień jest zamknięty i przez kogo.' },
];

const TILE = 'flex flex-col gap-3 min-h-[170px] p-5 rounded-[14px] text-left shadow-sm disabled:opacity-60';
const BADGE = 'w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xs font-extrabold';

interface LoadedStatement {
  key: string;
  statement: Statement | null;
  error: string | null;
}

export default function AccountantTab() {
  const today = toIsoDate(new Date());
  const [kind, setKind] = useState<ReportPeriodKind>('month');
  const [anchor, setAnchor] = useState(today);
  const [loaded, setLoaded] = useState<LoadedStatement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const key = `${kind}|${anchor}`;

  useEffect(() => {
    let cancelled = false;
    fetchStatement(kind, anchor)
      .then((statement) => {
        if (!cancelled) setLoaded({ key, statement, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ key, statement: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, anchor, key]);

  const download = async (exportKind: string) => {
    setBusy(exportKind);
    setDownloadError(null);
    try {
      await downloadFinanceExport(exportKind, kind, anchor);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Nie udało się pobrać pliku.');
    } finally {
      setBusy(null);
    }
  };

  const current = loaded?.key === key ? loaded : null;
  const statement = loaded?.statement ?? null;
  const isRefetching = !current && statement !== null;
  const costs = statement ? Number(statement.totals.cogs) + Number(statement.totals.operating_expenses) : 0;
  const profit = statement ? Math.round(Number(statement.totals.net_profit)) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportPeriodNav
          kind={kind}
          anchor={anchor}
          today={today}
          label={statement?.period.label ?? null}
          onKindChange={setKind}
          onAnchorChange={setAnchor}
        />
        {statement && !statement.period.is_complete && (
          <span className="text-[13px] font-bold text-[#4a4543]">Okres trwa – pliki pokażą stan na dziś</span>
        )}
      </div>

      {current?.error && <p className="m-0 text-sm font-semibold text-rose-700">Nie udało się pobrać danych okresu: {current.error}</p>}
      {downloadError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {downloadError}
        </p>
      )}

      <div className={`flex flex-col gap-5 transition-opacity ${isRefetching ? 'opacity-60' : ''}`} aria-busy={isRefetching}>
        {statement && (
          <dl className="m-0 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5">
            <div className="flex flex-col gap-1">
              <dt className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Przychód netto</dt>
              <dd className="m-0 font-display text-2xl font-extrabold tabular-nums">{formatMoney(statement.totals.revenue)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Koszty razem</dt>
              <dd className="m-0 font-display text-2xl font-extrabold tabular-nums">{formatMoney(costs)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Zysk netto</dt>
              <dd
                className={`m-0 font-display text-2xl font-extrabold tabular-nums ${
                  profit > 0 ? 'text-[#1f7a3a]' : profit < 0 ? 'text-[#b91c1c]' : ''
                }`}
              >
                {formatMoney(statement.totals.net_profit)}
              </dd>
            </div>
          </dl>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <button
            type="button"
            disabled={!statement}
            onClick={() => statement && printDocument(`Rachunek zysków i strat – ${statement.period.label}`)}
            className={`${TILE} sm:col-span-2 xl:col-span-1 xl:row-span-2 bg-bakery-dark text-white`}
          >
            <span className="flex items-center gap-3">
              <span aria-hidden className={`${BADGE} bg-white/15`}>
                PDF
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-extrabold">Rachunek zysków i strat</span>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#cfc8c4]">Do druku lub PDF</span>
              </span>
            </span>
            <span className="text-[13px] font-semibold leading-relaxed text-[#e6e1df]">
              Gotowy dokument z porównaniem do poprzedniego okresu. W oknie drukowania wybierz „Zapisz jako PDF”.
            </span>
            <span className="mt-auto text-sm font-extrabold text-bakery-accent">Otwórz podgląd wydruku →</span>
          </button>

          {CSV_EXPORTS.map((item) => (
            <button
              key={item.kind}
              type="button"
              disabled={busy !== null}
              onClick={() => download(item.kind)}
              className={`${TILE} bg-bakery-card border border-bakery-btnBorder text-bakery-dark hover:border-bakery-dark`}
            >
              <span className="flex items-center gap-3">
                <span aria-hidden className={`${BADGE} bg-[#e3f0e6] text-[#1f7a3a]`}>
                  CSV
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-extrabold">{item.name}</span>
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">Arkusz do Excela</span>
                </span>
              </span>
              <span className="text-[13px] font-semibold leading-relaxed text-[#4a4543]">{item.hint}</span>
              <span className="mt-auto text-sm font-extrabold">{busy === item.kind ? 'Pobieranie…' : 'Pobierz plik ↓'}</span>
            </button>
          ))}
        </div>

        <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 flex flex-col gap-2">
          <h2 className="m-0 text-base font-extrabold">O plikach CSV</h2>
          <p className="m-0 text-[13px] leading-relaxed text-[#3d3937]">
            Pliki otwierają się w Excelu dwuklikiem, z polskimi znakami. Kolumny są rozdzielone średnikiem, kwoty mają
            przecinek dziesiętny, a daty format DD.MM.RRRR. Zakres plików to zawsze okres wybrany powyżej.
          </p>
        </section>
      </div>

      {statement && <PrintStatement statement={statement} />}
    </div>
  );
}