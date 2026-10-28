import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Factory, Lock, RefreshCw } from 'lucide-react';
import {
  fetchPlanCalendar,
  fetchProductionBoard,
  fetchProductionPlan,
  generateProductionPlan,
  type CoverageRow,
  type PlanCalendarDay,
  type ProductionPlanResponse,
} from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { formatDayLabel, formatTime, shiftIsoDate, toIsoDate } from '../../dashboard/lib/dateFormat';
import { plural } from '../../home/lib/home';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { CoverageBars } from '../components/planning/CoverageBars';
import { DoughDetail } from '../components/planning/DoughDetail';
import { DoughTiles } from '../components/planning/DoughTiles';
import { IngredientNeeds } from '../components/planning/IngredientNeeds';
import { OrderChanges, SkippedProducts } from '../components/planning/PlanNotices';
import { WeekStrip } from '../components/planning/WeekStrip';
import { CALENDAR_COLORS, CALENDAR_LABELS, formatPieces, totals } from '../lib/planning';
import { formatKg } from '../lib/productionStage';

type UserRole = 'admin' | 'baker' | 'driver';

const CALENDAR_LEAD_DAYS = 3;

function RegenerateConfirmDialog({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title="Przeliczyć plan?" icon={<RefreshCw className="w-5 h-5" />} closeDisabled={busy} onClose={onClose}>
      <div className="flex flex-col gap-4 font-auth">
        <p className="m-0 text-sm font-semibold leading-relaxed text-[#3d3937]">
          Obecne dzieże zostaną usunięte i utworzone od nowa na podstawie bieżących zamówień. Listy odważeń mogą się
          zmienić. Jeśli piekarze je wydrukowali, trzeba je rozdać ponownie.
        </p>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? 'Przeliczanie…' : 'Przelicz plan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function ProductionPlanning() {
  const { currentRole } = useOutletContext<{ currentRole: UserRole }>();
  const isAdmin = currentRole === 'admin';
  const [deliveryDate, setDeliveryDate] = useState<string | undefined>(undefined);
  const [calendarStart, setCalendarStart] = useState<string | undefined>(undefined);
  const [data, setData] = useState<ProductionPlanResponse | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [calendar, setCalendar] = useState<PlanCalendarDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chosenDough, setChosenDough] = useState<number | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const planKey = `${deliveryDate}:${refreshKey}`;
  const planLoading = loadedKey !== planKey;

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
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(planKey);
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryDate, planKey]);

  useEffect(() => {
    let cancelled = false;
    fetchPlanCalendar(calendarStart)
      .then((days) => {
        if (!cancelled) setCalendar(days);
      })
      .catch(() => {
        if (!cancelled) setCalendar([]);
      });
    return () => {
      cancelled = true;
    };
  }, [calendarStart, refreshKey]);

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
  const selectedDate = deliveryDate ?? preview?.delivery_date ?? '';
  const calendarDay = calendar.find((day) => day.delivery_date === preview?.delivery_date);
  const status = calendarDay?.status ?? (plan ? (plan.locked ? 'in_progress' : 'saved') : 'none');
  const dough = preview?.doughs.find((d) => d.dough_id === chosenDough) ?? preview?.doughs[0] ?? null;
  const sums = preview ? totals(preview) : null;

  const jumpTo = (date: string) => {
    setDeliveryDate(date);
    setCalendarStart(shiftIsoDate(date, -CALENDAR_LEAD_DAYS));
  };

  const shiftWeek = (days: number) => {
    if (calendar.length === 0) return;
    setCalendarStart(shiftIsoDate(calendar[0].delivery_date, days));
    if (selectedDate) setDeliveryDate(shiftIsoDate(selectedDate, days));
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="m-0 font-display text-[32px] sm:text-[40px] leading-[1] font-extrabold tracking-[-0.02em]">
            Planowanie produkcji
          </h1>
          {preview && sums && (
            <p className="m-0 text-sm font-semibold text-[#5f5a58]">
              Dostawa <strong className="text-bakery-dark">{formatDayLabel(preview.delivery_date)}</strong> · zmiana{' '}
              {formatDayLabel(preview.production_date)}
              {preview.doughs.length > 0 && (
                <>
                  {' · '}
                  {preview.doughs.length} {plural(preview.doughs.length, 'ciasto', 'ciasta', 'ciast')}, {sums.batches}{' '}
                  {plural(sums.batches, 'dzieża', 'dzieże', 'dzieży')}, {formatKg(sums.massKg)}, {formatPieces(sums.pieces)}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preview && (
            <span className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl bg-bakery-card border border-bakery-btnBorder text-[13px] font-extrabold">
              {plan?.locked ? (
                <Lock aria-hidden className="size-3.5" />
              ) : (
                <span aria-hidden className="size-2 rounded-full" style={{ background: CALENDAR_COLORS[status] }} />
              )}
              {plan ? (
                <span>
                  {CALENDAR_LABELS[status]}
                  <span className="font-semibold text-[#5f5a58]">
                    {' '}
                    · {plan.created_by?.full_name ?? '—'}, {formatTime(plan.created_at)}
                  </span>
                </span>
              ) : (
                'Podgląd – plan niezapisany'
              )}
            </span>
          )}
          <Link
            to="/production/board"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-bakery-btnBorder bg-white text-bakery-dark text-sm font-extrabold no-underline transition hover:border-bakery-dark"
          >
            <Factory aria-hidden className="size-4" /> Tablica produkcji
          </Link>
          {isAdmin && preview && (
            <button
              type="button"
              onClick={plan ? () => setConfirmingRegenerate(true) : handleGenerate}
              disabled={generating || Boolean(plan?.locked) || preview.doughs.length === 0}
              title={plan?.locked ? 'Produkcja już ruszyła lub zgłoszono straty – planu nie można przeliczyć.' : undefined}
              className="inline-flex items-center gap-2 h-11 px-[18px] rounded-xl border-0 bg-bakery-accent text-bakery-dark text-sm font-extrabold cursor-pointer transition hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {plan && <RefreshCw aria-hidden className="size-4" />}
              {generating ? 'Generowanie…' : plan ? 'Przelicz plan' : 'Zatwierdź plan i utwórz dzieże'}
            </button>
          )}
        </div>
      </header>

      {calendar.length > 0 && selectedDate && (
        <WeekStrip
          days={calendar}
          selected={selectedDate}
          today={toIsoDate(new Date())}
          loading={planLoading && data !== null}
          onSelect={setDeliveryDate}
          onShift={shiftWeek}
          onJump={jumpTo}
        />
      )}

      {error && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fdecec] text-[#8f1616] text-sm font-bold">
          {error}
        </p>
      )}
      {!data && !error && <div role="status" aria-label="Ładowanie planu" className="h-[320px] rounded-[18px] bg-bakery-card animate-pulse" />}

      {preview && (
        <div className={`flex flex-col gap-5 transition-opacity ${planLoading ? 'opacity-60' : ''}`}>
          {plan && data.order_changes.length > 0 && (
            <OrderChanges changes={data.order_changes} locked={plan.locked} canRegenerate={isAdmin} />
          )}
          {preview.unassigned_products.length > 0 && (
            <SkippedProducts products={preview.unassigned_products} canEdit={isAdmin} />
          )}

          {preview.doughs.length === 0 ? (
            <p className="m-0 px-6 py-10 rounded-[18px] bg-bakery-card border border-bakery-btnBorder text-center text-sm font-semibold text-[#5f5a58]">
              Brak zamówień z przypisanym ciastem na {formatDayLabel(preview.delivery_date)}.
            </p>
          ) : (
            <>
              <DoughTiles doughs={preview.doughs} selectedId={dough?.dough_id ?? null} onSelect={setChosenDough} />
              {dough && <DoughDetail dough={dough} />}
            </>
          )}

          {(preview.ingredient_totals.length > 0 || (plan && coverage.length > 0)) && (
            <div className="flex flex-wrap gap-5 items-start">
              {preview.ingredient_totals.length > 0 && <IngredientNeeds rows={preview.ingredient_totals} />}
              {plan && coverage.length > 0 && <CoverageBars coverage={coverage} />}
            </div>
          )}
        </div>
      )}

      {confirmingRegenerate && (
        <RegenerateConfirmDialog busy={generating} onConfirm={handleGenerate} onClose={() => setConfirmingRegenerate(false)} />
      )}
    </div>
  );
}
