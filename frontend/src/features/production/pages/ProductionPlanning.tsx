import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Factory, Info, Lock, RefreshCw } from 'lucide-react';
import {
  fetchProductionBoard,
  fetchProductionPlan,
  generateProductionPlan,
  type CoverageRow,
  type PlanOrderChange,
  type PlanPreviewDough,
  type ProductionPlanResponse,
} from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { formatDayLabel, formatTime, shiftIsoDate } from '../../dashboard/lib/dateFormat';
import { CoveragePanel } from '../components/CoveragePanel';
import { formatAmount, formatKg } from '../lib/productionStage';

type UserRole = 'admin' | 'baker' | 'driver';

const CARD = 'bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm';
const NAV_BUTTON =
  'inline-flex items-center justify-center w-9 h-9 bg-white border border-bakery-btnBorder text-bakery-dark rounded-lg shadow-xs transition hover:bg-bakery-inactive active:scale-[0.98]';

function DoughCard({ dough }: { dough: PlanPreviewDough }) {
  return (
    <section className={`${CARD} p-4 flex flex-col gap-3`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-lg font-bold">{dough.name}</h2>
        <p className="m-0 text-xs font-semibold text-gray-600">
          Kęsy {formatKg(dough.raw_mass_kg)} + bufor {dough.loss_buffer_pct}% ={' '}
          <span className="text-bakery-dark font-bold">{formatKg(dough.total_mass_kg)}</span>
          {dough.mixer && ` · ${dough.mixer.name} (maks. ${formatKg(dough.mixer.max_capacity_kg)})`}
        </p>
      </header>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider">
            <th className="py-1.5 px-2">Wyrób</th>
            <th className="py-1.5 px-2 text-right">Zamówiono</th>
            <th className="py-1.5 px-2 text-right">Kęs</th>
            <th className="py-1.5 px-2 text-right">Masa kęsów</th>
            <th className="py-1.5 px-2 text-right">Wypiek</th>
          </tr>
        </thead>
        <tbody>
          {dough.products.map((p) => (
            <tr key={p.product_id} className="bg-bakery-rowBg border-b border-bakery-btnBorder">
              <td className="py-1.5 px-2 font-semibold">{p.product_name}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{p.ordered_qty} szt.</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{formatAmount(p.piece_weight_kg, 'kg')}</td>
              <td className="py-1.5 px-2 text-right tabular-nums">{formatKg(p.raw_mass_kg)}</td>
              <td className="py-1.5 px-2 text-right tabular-nums text-xs">
                {p.bake_temp_c} °C · {p.bake_time_min} min
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {dough.notes.map((note) => (
        <p key={note} className="m-0 flex items-start gap-2 bg-white border border-bakery-btnBorder rounded px-3 py-2 text-xs font-semibold text-gray-700">
          <Info className="w-4 h-4 shrink-0" /> {note}
        </p>
      ))}

      {dough.warnings.map((warning) => (
        <p key={warning} className="m-0 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs font-semibold text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {warning}
        </p>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {dough.batches.map((batch) => (
          <div key={batch.sequence} className="bg-white rounded border border-bakery-btnBorder p-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="m-0 text-sm font-bold">
                Dzieża {batch.sequence} z {dough.batches.length}
              </h3>
              <span className="text-sm font-bold tabular-nums">{formatKg(batch.dough_mass_kg)}</span>
            </div>
            <p className="m-0 text-xs text-gray-600 font-semibold">
              {batch.outputs.map((o) => `${o.product_name}: ${o.pieces} szt.`).join(' · ')}
            </p>
            <ul className="m-0 p-0 list-none text-xs grid grid-cols-2 gap-x-3">
              {batch.ingredients.map((i) => (
                <li key={i.ingredient_id} className="flex justify-between gap-2 border-t border-bakery-rowBg py-0.5">
                  <span className="truncate">{i.name}</span>
                  <span className="font-mono">{formatAmount(i.amount, i.unit)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDifference(difference: number) {
  return `${difference > 0 ? '+' : ''}${difference} szt.`;
}

function OrderChangesBanner({
  changes,
  locked,
  canRegenerate,
}: {
  changes: PlanOrderChange[];
  locked: boolean;
  canRegenerate: boolean;
}) {
  return (
    <section className="flex flex-col gap-2 bg-amber-50 border border-amber-300 rounded px-3 py-3 text-amber-900">
      <p className="m-0 flex items-start gap-2 text-sm font-bold">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        Zamówienia zmieniły się od zatwierdzenia planu — poniżej zapisany plan, nie bieżące zamówienia.
      </p>
      <ul className="m-0 pl-6 text-xs font-semibold flex flex-col gap-0.5">
        {changes.map((c) => (
          <li key={c.product_id}>
            {c.product_name}: w planie {c.planned_qty} szt., zamówiono {c.current_qty} szt.{' '}
            <span className={c.difference > 0 ? 'text-red-700' : 'text-emerald-700'}>({formatDifference(c.difference)})</span>
          </li>
        ))}
      </ul>
      <p className="m-0 pl-6 text-xs">
        {locked
          ? 'Produkcja już ruszyła (lub zgłoszono straty), więc planu nie można przeliczyć — różnicę trzeba uzupełnić ręcznie.'
          : canRegenerate
            ? 'Przelicz plan, aby uwzględnić zmiany.'
            : 'Kierownik może przeliczyć plan, aby uwzględnić zmiany.'}
      </p>
    </section>
  );
}

function RegenerateConfirmDialog({
  busy,
  onConfirm,
  onClose,
}: {
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Przeliczyć plan?"
      icon={<RefreshCw className="w-5 h-5" />}
      closeDisabled={busy}
      onClose={onClose}
    >
      <p className="m-0 text-sm">
        Obecne dzieże zostaną usunięte i utworzone od nowa na podstawie bieżących zamówień. Listy odważeń mogą się
        zmienić — jeśli piekarze je wydrukowali, trzeba je rozdać ponownie.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-4 h-10 rounded border border-bakery-btnBorder bg-white text-sm font-bold disabled:opacity-40"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="px-4 h-10 rounded bg-bakery-accent text-black text-sm font-bold shadow-sm active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? 'Przeliczanie…' : 'Przelicz plan'}
        </button>
      </div>
    </Modal>
  );
}

export default function ProductionPlanning() {
  const { currentRole } = useOutletContext<{ currentRole: UserRole }>();
  const [deliveryDate, setDeliveryDate] = useState<string | undefined>(undefined);
  const [data, setData] = useState<ProductionPlanResponse | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProductionPlan(deliveryDate), fetchProductionBoard(deliveryDate)])
      .then(([plan, board]) => {
        if (cancelled) return;
        setData(plan);
        setCoverage(board.coverage);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Nie udało się pobrać planu.');
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryDate, refreshKey]);

  const handleGenerate = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      await generateProductionPlan(data.preview.delivery_date);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wygenerować planu.');
    } finally {
      setGenerating(false);
      setConfirmingRegenerate(false);
    }
  };

  const preview = data?.preview;
  const plan = data?.plan;
  const shortages = preview?.ingredient_totals.filter((t) => t.shortage > 0) ?? [];
  const totalBatches = preview?.doughs.reduce((sum, d) => sum + d.batches.length, 0) ?? 0;
  const totalMass = preview?.doughs.reduce((sum, d) => sum + Number(d.total_mass_kg), 0) ?? 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 md:px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight">Planowanie produkcji</h1>
          <p className="m-0 text-xs text-gray-500 font-medium">
            Zamówienia na dzień dostawy agregowane są w bazy ciasta i dzielone na dzieże. Produkcja odbywa się dzień wcześniej.
          </p>
        </div>
        <Link
          to="/production/board"
          className="inline-flex items-center gap-2 px-4 h-10 rounded bg-bakery-dark text-white text-sm font-bold no-underline shadow-sm hover:bg-[#2e2e2e]"
        >
          <Factory className="w-4 h-4" /> Tablica produkcyjna
        </Link>
      </div>

      <hr className="border-0 border-t border-bakery-border my-0" />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={NAV_BUTTON}
          aria-label="Poprzedni dzień"
          onClick={() => preview && setDeliveryDate(shiftIsoDate(preview.delivery_date, -1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <label className="flex items-center gap-2 text-xs font-bold">
          Dostawa:
          <input
            type="date"
            value={preview?.delivery_date ?? ''}
            onChange={(e) => e.target.value && setDeliveryDate(e.target.value)}
            className="px-2 py-1 text-xs font-semibold bg-white border border-bakery-btnBorder rounded-lg outline-none focus:border-bakery-accent"
          />
        </label>
        <button
          type="button"
          className={NAV_BUTTON}
          aria-label="Następny dzień"
          onClick={() => preview && setDeliveryDate(shiftIsoDate(preview.delivery_date, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {preview && (
          <span className="text-xs font-semibold text-gray-600">
            Produkcja: <span className="text-bakery-dark font-bold">{formatDayLabel(preview.production_date)}</span>
          </span>
        )}
      </div>

      {error && <p className="m-0 text-sm font-semibold text-red-600">{error}</p>}
      {!data && !error && <p className="m-0">Ładowanie danych...</p>}

      {preview && (
        <>
          <div className={`${CARD} p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-500">Ciasta</div>
                <div className="text-xl font-bold">{preview.doughs.length}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-500">Dzieże</div>
                <div className="text-xl font-bold">{totalBatches}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-500">Masa ciasta</div>
                <div className="text-xl font-bold">{formatKg(totalMass)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-500">Status planu</div>
                <div className="text-sm font-bold flex items-center gap-1">
                  {plan ? (
                    <>
                      {plan.locked && <Lock className="w-3.5 h-3.5" />}
                      {plan.locked ? 'W realizacji' : 'Zapisany'} · {plan.created_by?.full_name ?? '—'}, {formatTime(plan.created_at)}
                    </>
                  ) : (
                    'Niezapisany (podgląd)'
                  )}
                </div>
              </div>
            </div>
            {currentRole === 'admin' && (
              <button
                type="button"
                onClick={plan ? () => setConfirmingRegenerate(true) : handleGenerate}
                disabled={generating || Boolean(plan?.locked) || preview.doughs.length === 0}
                title={plan?.locked ? 'Produkcja już ruszyła lub zgłoszono straty — planu nie można przeliczyć.' : undefined}
                className="px-4 h-10 rounded bg-bakery-accent text-black text-sm font-bold shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Generowanie…' : plan ? 'Przelicz plan' : 'Zatwierdź plan i utwórz dzieże'}
              </button>
            )}
          </div>

          {plan && data.order_changes.length > 0 && (
            <OrderChangesBanner
              changes={data.order_changes}
              locked={plan.locked}
              canRegenerate={currentRole === 'admin'}
            />
          )}

          {preview.unassigned_products.length > 0 && (
            <p className="m-0 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs font-semibold text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Wyroby bez przypisanej bazy ciasta (pominięte w planie):{' '}
              {preview.unassigned_products.map((p) => `${p.product_name} (${p.ordered_qty} szt.)`).join(', ')}.{' '}
              {currentRole === 'admin' ? (
                <>
                  Przypisz ciasto i wagę kęsa w{' '}
                  <Link to="/production/settings" className="font-bold text-amber-900 underline">
                    Ustawieniach produkcji
                  </Link>
                  .
                </>
              ) : (
                'Kierownik musi przypisać im ciasto i wagę kęsa w Ustawieniach produkcji.'
              )}
            </p>
          )}

          {preview.doughs.length === 0 && (
            <p className={`${CARD} m-0 p-6 text-center text-sm font-semibold text-gray-500`}>
              Brak zamówień z przypisanym ciastem na {formatDayLabel(preview.delivery_date)}.
            </p>
          )}

          {plan && coverage.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-sm font-bold uppercase tracking-wide">Pokrycie zamówień</h2>
              <CoveragePanel coverage={coverage} />
            </section>
          )}

          {preview.doughs.map((dough) => (
            <DoughCard key={dough.dough_id} dough={dough} />
          ))}

          {preview.ingredient_totals.length > 0 && (
            <section className={`${CARD} p-4 flex flex-col gap-2`}>
              <h2 className="m-0 text-sm font-bold uppercase tracking-wide">
                Zapotrzebowanie na surowce
                {shortages.length > 0 && <span className="ml-2 text-red-600">— braki: {shortages.length}</span>}
              </h2>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-1.5 px-2">Surowiec</th>
                    <th className="py-1.5 px-2 text-right">Potrzeba</th>
                    <th className="py-1.5 px-2 text-right">Stan</th>
                    <th className="py-1.5 px-2 text-right">Brak</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.ingredient_totals.map((t) => (
                    <tr key={t.ingredient_id} className={`border-b border-bakery-btnBorder ${t.shortage > 0 ? 'bg-red-50' : 'bg-bakery-rowBg'}`}>
                      <td className="py-1.5 px-2 font-semibold">{t.name}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{Number(t.amount).toFixed(3)} {t.unit}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{Number(t.current_stock).toFixed(3)} {t.unit}</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-bold ${t.shortage > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {t.shortage > 0 ? `${Number(t.shortage).toFixed(3)} ${t.unit}` : 'OK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {confirmingRegenerate && (
        <RegenerateConfirmDialog
          busy={generating}
          onConfirm={handleGenerate}
          onClose={() => setConfirmingRegenerate(false)}
        />
      )}
    </div>
  );
}
