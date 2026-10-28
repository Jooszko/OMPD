import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  fetchStockHistory,
  fetchWarehouse,
  type StockAdjustmentKind,
  type StockHistory,
  type WarehouseRow,
} from '../../../services/api';
import { ActionToast, type ActionToastData } from '../../dashboard/components/ActionToast';
import { apiErrorMessage } from '../../users/lib/staff';
import { IngredientDialog } from '../components/IngredientDialog';
import { StockDetail } from '../components/StockDetail';
import { StockDialog } from '../components/StockDialog';
import { StockList } from '../components/StockList';
import { WarehouseHero } from '../components/WarehouseHero';
import { byUrgency, formatQty, toStockItem, type Period, type StockItem } from '../lib/warehouse';

type LayoutRole = 'admin' | 'baker' | 'driver';

type Dialog =
  | { type: 'stock'; id: number; kind: StockAdjustmentKind }
  | { type: 'ingredient'; item: StockItem | null }
  | null;

const SAVED_TEXT: Record<StockAdjustmentKind, string> = {
  delivery: 'Przyjęto dostawę',
  loss: 'Zapisano rozchód',
  count: 'Zapisano inwentaryzację',
};

export default function WarehousePage() {
  const { currentRole } = useOutletContext<{ currentRole: LayoutRole }>();
  const canManage = currentRole === 'admin';
  const [rows, setRows] = useState<WarehouseRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosenId, setSelectedId] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>(90);
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<ActionToastData | null>(null);

  const load = useCallback(() => {
    fetchWarehouse()
      .then((result) => {
        setRows(result);
        setLoadError(null);
      })
      .catch((err: unknown) => setLoadError(apiErrorMessage(err, 'Nie udało się pobrać stanów magazynu.')));
  }, []);

  useEffect(load, [load]);

  const items = useMemo(() => (rows ?? []).map(toStockItem), [rows]);
  const selectedId = chosenId ?? ([...items].sort(byUrgency)[0]?.ingredient_id ?? null);
  const selected = items.find((item) => item.ingredient_id === selectedId) ?? null;
  const historyKey = `${selectedId}:${period}:${historyVersion}`;
  const historyLoading = loadedKey !== historyKey;

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    fetchStockHistory(selectedId, period)
      .then((result) => {
        if (cancelled) return;
        setHistory(result);
        setHistoryError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setHistoryError(apiErrorMessage(err, 'Nie udało się pobrać historii stanu.'));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(historyKey);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, period, historyKey]);

  const upsert = (row: WarehouseRow) =>
    setRows((current) => {
      const list = current ?? [];
      return list.some((r) => r.ingredient_id === row.ingredient_id)
        ? list.map((r) => (r.ingredient_id === row.ingredient_id ? row : r))
        : [...list, row];
    });

  const select = (id: number) => {
    setSelectedId(id);
    document.getElementById('stock-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onStockSaved = (row: WarehouseRow, kind: StockAdjustmentKind) => {
    upsert(row);
    setSelectedId(row.ingredient_id);
    setHistoryVersion((value) => value + 1);
    setToast({
      variant: 'success',
      text: `${SAVED_TEXT[kind]}: ${row.name}. Stan ${formatQty(Number(row.current_stock), row.unit)}.`,
    });
  };

  const onIngredientSaved = (row: WarehouseRow, created: boolean) => {
    upsert(row);
    setSelectedId(row.ingredient_id);
    setHistoryVersion((value) => value + 1);
    setToast({ variant: 'success', text: created ? `Dodano składnik ${row.name}.` : `Zapisano zmiany: ${row.name}.` });
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 font-auth text-bakery-dark">
      {rows ? (
        <>
          <WarehouseHero
            items={items}
            canManage={canManage}
            onReceive={() => selectedId !== null && setDialog({ type: 'stock', id: selectedId, kind: 'delivery' })}
            onCreate={() => setDialog({ type: 'ingredient', item: null })}
            onSelect={select}
          />
          {selected && (
            <div id="stock-detail" className="scroll-mt-4">
              <StockDetail
                item={selected}
                items={[...items].sort((a, b) => a.name.localeCompare(b.name, 'pl'))}
                history={history}
                loading={historyLoading}
                error={historyError}
                period={period}
                onPeriod={setPeriod}
                onSelect={setSelectedId}
                onAdjust={() => setDialog({ type: 'stock', id: selected.ingredient_id, kind: 'delivery' })}
              />
            </div>
          )}
          <StockList
            items={items}
            selectedId={selectedId}
            canManage={canManage}
            onSelect={select}
            onAdjust={(item) => setDialog({ type: 'stock', id: item.ingredient_id, kind: 'delivery' })}
            onEdit={(item) => setDialog({ type: 'ingredient', item })}
          />
        </>
      ) : loadError ? (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fdecec] text-[#8f1616] text-sm font-bold">
          {loadError}
        </p>
      ) : (
        <div role="status" aria-label="Ładowanie magazynu" className="h-[280px] rounded-[24px] bg-bakery-dark/90 animate-pulse" />
      )}

      {dialog?.type === 'stock' && (
        <StockDialog
          items={[...items].sort((a, b) => a.name.localeCompare(b.name, 'pl'))}
          initialId={dialog.id}
          initialKind={dialog.kind}
          onClose={() => setDialog(null)}
          onSaved={onStockSaved}
        />
      )}
      {dialog?.type === 'ingredient' && (
        <IngredientDialog item={dialog.item} onClose={() => setDialog(null)} onSaved={onIngredientSaved} />
      )}

      <ActionToast toast={toast} onClose={() => setToast(null)} onRefresh={load} />
    </div>
  );
}
