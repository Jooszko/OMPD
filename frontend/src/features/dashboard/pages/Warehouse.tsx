import { useDashboard } from '../hooks/useDashboard';
import { WarehouseStockChart } from '../components/WarehouseStockChart';
import { computeStockStatus, STOCK_STATUS_COLORS, STOCK_STATUS_LABELS } from '../lib/warehouseStock';

export default function Warehouse() {
  const { data, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-8 py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Magazyn i Surowce</h1>
        <p>Ładowanie danych...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-8 py-6 text-bakery-dark">
        <h1 className="text-2xl font-bold mb-2">Magazyn i Surowce</h1>
        <p className="text-red-600">Błąd połączenia z serwerem: {error}</p>
      </div>
    );
  }

  const warehouseStock = data?.warehouse_stock ?? [];

  const tableRows = warehouseStock
    .map((item) => {
      const currentStock = parseFloat(item.current_stock);
      const minStockLevel = parseFloat(item.min_stock_level);
      const { pct, status } = computeStockStatus(currentStock, minStockLevel);
      return { ...item, currentStock, minStockLevel, pct, status };
    })
    .sort((a, b) => a.pct - b.pct);

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div>
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Magazyn i Surowce</h1>
        <p className="text-xs text-gray-500 font-medium">
          Stany magazynowe składników — podgląd wizualny i szczegółowa lista z progami minimalnymi.
        </p>
      </div>

      <hr className="border-0 border-t border-bakery-border my-1" />

      <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-4">
        <WarehouseStockChart items={warehouseStock} />
      </div>

      <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[400px] flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-2">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-bakery-inactive z-10">
              <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                <th className="py-2 px-3 h-8">Nazwa</th>
                <th className="py-2 px-3 h-8">Jednostka</th>
                <th className="py-2 px-3 h-8 text-right">Stan obecny</th>
                <th className="py-2 px-3 h-8 text-right">Próg minimalny</th>
                <th className="py-2 px-3 h-8 text-right">% minimum</th>
                <th className="py-2 px-3 h-8 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bakery-btnBorder text-sm">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500 text-xs font-semibold italic">
                    Brak danych magazynowych.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr
                    key={row.name}
                    className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder"
                  >
                    <td className="py-2 px-3 font-semibold text-bakery-dark">{row.name}</td>
                    <td className="py-2 px-3 text-xs font-semibold text-gray-600">{row.unit}</td>
                    <td className="py-2 px-3 text-right font-mono text-bakery-dark">{row.currentStock.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right font-mono text-bakery-dark">{row.minStockLevel.toFixed(3)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-bakery-dark">
                      {Number.isFinite(row.pct) ? `${row.pct.toFixed(0)}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{
                          color: STOCK_STATUS_COLORS[row.status],
                          backgroundColor: `${STOCK_STATUS_COLORS[row.status]}1a`,
                          border: `1px solid ${STOCK_STATUS_COLORS[row.status]}40`,
                        }}
                      >
                        {STOCK_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
