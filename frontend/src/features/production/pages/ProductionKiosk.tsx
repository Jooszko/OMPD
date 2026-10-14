import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Maximize, Minimize, RefreshCw } from 'lucide-react';
import {
  ApiError,
  advanceBatchStage,
  fetchProductionBoard,
  recordBatchWaste,
  startBatchStage,
  type BatchActionResult,
  type ProductionBatch,
  type ProductionBoard,
  type ProductionStage,
  type WasteReason,
} from '../../../services/api';
import { formatDayLabel, shiftIsoDate, toIsoDate } from '../../dashboard/lib/dateFormat';
import { BatchTile } from '../components/BatchTile';
import { BatchDetailDialog } from '../components/BatchDetailDialog';
import { CoveragePanel } from '../components/CoveragePanel';
import { WasteDialog } from '../components/WasteDialog';
import { STAGE_ORDER, STAGE_SHORT_LABELS, countByStage, getBatchAction, sortBatchesForBoard } from '../lib/productionStage';

const REFRESH_MS = 20_000;
const CLOCK_MS = 30_000;

type StageFilter = 'all' | ProductionStage;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { isFullscreen, toggle };
}

const BIG_NAV =
  'inline-flex items-center justify-center w-14 h-14 rounded-xl bg-white border-2 border-bakery-dark text-bakery-dark active:scale-[0.97]';

export default function ProductionKiosk() {
  const [deliveryDate, setDeliveryDate] = useState<string | undefined>(undefined);
  const [board, setBoard] = useState<ProductionBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<StageFilter>('all');
  const [busyBatchId, setBusyBatchId] = useState<number | null>(null);
  const [openBatchId, setOpenBatchId] = useState<number | null>(null);
  const [wasteBatchId, setWasteBatchId] = useState<number | null>(null);
  const now = useNow(CLOCK_MS);
  const currentDeliveryDate = shiftIsoDate(toIsoDate(new Date(now)), 1);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const [refreshKey, setRefreshKey] = useState(0);
  const load = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchProductionBoard(deliveryDate)
      .then((result) => {
        if (cancelled) return;
        setBoard(result);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Nie udało się pobrać tablicy.');
      });
    return () => {
      cancelled = true;
    };
  }, [deliveryDate, refreshKey]);

  useEffect(() => {
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const applyResult = (result: BatchActionResult) =>
    setBoard((prev) =>
      prev && {
        ...prev,
        coverage: result.coverage,
        batches: prev.batches.map((b) => (b.batch_id === result.batch.batch_id ? result.batch : b)),
      }
    );

  const runAction = async (batch: ProductionBatch, request: () => Promise<BatchActionResult>, success: string) => {
    setBusyBatchId(batch.batch_id);
    try {
      const result = await request();
      applyResult(result);
      setNotice({ tone: 'ok', text: success });
      return result;
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : 'Nie udało się zapisać.' });
      if (err instanceof ApiError && err.status === 409) load();
      return null;
    } finally {
      setBusyBatchId(null);
    }
  };

  const handleStageAction = (batch: ProductionBatch) => {
    const action = getBatchAction(batch);
    if (action.kind === 'start') {
      runAction(batch, () => startBatchStage(batch.batch_id, batch.stage), `${batch.dough_name} #${batch.sequence}: rozpoczęto etap.`);
    } else if (action.kind === 'advance') {
      runAction(batch, () => advanceBatchStage(batch.batch_id, batch.stage), `${batch.dough_name} #${batch.sequence}: ${action.label.toLowerCase()}.`);
    }
  };

  const handleWaste = async (batch: ProductionBatch, payload: { product_id: number; quantity: number; reason: WasteReason }) => {
    const result = await runAction(batch, () => recordBatchWaste(batch.batch_id, payload), 'Strata zapisana.');
    if (!result) return;
    setWasteBatchId(null);
    if (result.shortfall) {
      setNotice({ tone: 'error', text: `Strata zapisana. Zamówienie niepokryte — brakuje ${result.shortfall} szt. Kierownik został powiadomiony.` });
    }
  };

  const batches = board ? sortBatchesForBoard(board.batches) : [];
  const counts = countByStage(batches);
  const visible = filter === 'all' ? batches : batches.filter((b) => b.stage === filter);
  const openBatch = board?.batches.find((b) => b.batch_id === openBatchId) ?? null;
  const wasteBatch = board?.batches.find((b) => b.batch_id === wasteBatchId) ?? null;

  return (
    <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-4 text-bakery-dark pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bakery-dark text-white p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={BIG_NAV}
            onClick={() => board && setDeliveryDate(shiftIsoDate(board.delivery_date, -1))}
            aria-label="Poprzednia zmiana"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-widest text-bakery-accent">Tablica produkcyjna</p>
            <h1 className="m-0 text-2xl font-extrabold leading-tight">
              {board ? `Zmiana ${formatDayLabel(board.production_date)}` : 'Ładowanie…'}
            </h1>
            {board && (
              <p className="m-0 text-sm font-semibold text-gray-300">Na dostawę: {formatDayLabel(board.delivery_date)}</p>
            )}
          </div>
          <button
            type="button"
            className={BIG_NAV}
            onClick={() => board && setDeliveryDate(shiftIsoDate(board.delivery_date, 1))}
            aria-label="Następna zmiana"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {deliveryDate && deliveryDate !== currentDeliveryDate && (
            <button
              type="button"
              onClick={() => setDeliveryDate(undefined)}
              className="min-h-14 px-4 rounded-xl bg-bakery-accent text-black text-base font-extrabold active:scale-[0.97]"
            >
              Bieżąca zmiana
            </button>
          )}
          <button type="button" onClick={load} className={BIG_NAV} aria-label="Odśwież">
            <RefreshCw className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className={BIG_NAV}
            aria-label={isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
          >
            {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-lg font-bold ${
            notice.tone === 'ok' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {notice.text}
        </div>
      )}

      {error && <p className="m-0 rounded-xl bg-red-100 border-2 border-red-700 px-4 py-3 text-lg font-bold text-red-800">{error}</p>}

      {board && !board.plan && (
        <div className="rounded-2xl bg-white border-4 border-dashed border-bakery-border p-8 text-center">
          <p className="m-0 text-2xl font-extrabold">Brak planu produkcji na tę zmianę.</p>
          <p className="m-0 mt-2 text-lg text-gray-600">
            Plan generuje kierownik w widoku{' '}
            <Link to="/production" className="font-bold text-bakery-dark underline">
              Planowanie produkcji
            </Link>
            .
          </p>
        </div>
      )}

      {board?.plan && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <CoveragePanel coverage={board.coverage} compact />
          </div>

          <nav className="grid grid-cols-3 sm:grid-cols-6 gap-2" aria-label="Filtr etapów">
            {(['all', ...STAGE_ORDER] as StageFilter[]).map((stage) => {
              const active = filter === stage;
              const count = stage === 'all' ? batches.length : counts[stage];
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setFilter(stage)}
                  aria-pressed={active}
                  className={`min-h-16 rounded-xl border-2 px-2 text-base font-extrabold active:scale-[0.98] ${
                    active ? 'bg-bakery-dark text-white border-bakery-dark' : 'bg-white text-bakery-dark border-bakery-btnBorder'
                  }`}
                >
                  {stage === 'all' ? 'Wszystkie' : STAGE_SHORT_LABELS[stage]}
                  <span className="block text-2xl tabular-nums">{count}</span>
                </button>
              );
            })}
          </nav>

          {visible.length === 0 ? (
            <p className="m-0 rounded-2xl bg-white p-8 text-center text-xl font-bold text-gray-500">
              Brak dzieży na tym etapie.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
              {visible.map((batch) => (
                <BatchTile
                  key={batch.batch_id}
                  batch={batch}
                  now={now}
                  busy={busyBatchId === batch.batch_id}
                  onAction={() => handleStageAction(batch)}
                  onWaste={() => setWasteBatchId(batch.batch_id)}
                  onOpen={() => setOpenBatchId(batch.batch_id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {openBatch && !wasteBatch && (
        <BatchDetailDialog
          batch={openBatch}
          now={now}
          busy={busyBatchId === openBatch.batch_id}
          onAction={() => handleStageAction(openBatch)}
          onWaste={() => setWasteBatchId(openBatch.batch_id)}
          onClose={() => setOpenBatchId(null)}
        />
      )}

      {wasteBatch && board && (
        <WasteDialog
          batch={wasteBatch}
          reasons={board.waste_reasons}
          busy={busyBatchId === wasteBatch.batch_id}
          onSubmit={(payload) => handleWaste(wasteBatch, payload)}
          onClose={() => setWasteBatchId(null)}
        />
      )}
    </div>
  );
}
