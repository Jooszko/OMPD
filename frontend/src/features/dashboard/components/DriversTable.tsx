import type { DeliveryStatsDriver } from '../../../services/api';
import { formatMinutes, formatPercent } from '../lib/statsFormat';

const RATE_FILL = '#047857';
const RATE_TRACK = '#d1fae5';

export function DriversTable({ drivers }: { drivers: DeliveryStatsDriver[] }) {
  if (drivers.length === 0) {
    return <p className="m-0 text-xs text-gray-500 italic">Brak obsłużonych przystanków w tym okresie.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-xs tabular-nums">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-gray-500">
            <th scope="col" className="py-2 pr-3 font-bold">
              Kierowca
            </th>
            <th scope="col" className="py-2 pr-3 font-bold text-right">
              Dostarczone
            </th>
            <th scope="col" className="py-2 pr-3 font-bold text-right">
              Nieudane
            </th>
            <th scope="col" className="py-2 pr-3 font-bold">
              Skuteczność
            </th>
            <th scope="col" className="py-2 pr-3 font-bold text-right">
              Dni w trasie
            </th>
            <th scope="col" className="py-2 pr-3 font-bold text-right">
              Przystanków / dzień
            </th>
            <th scope="col" className="py-2 font-bold text-right">
              Czas w trasie
            </th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.driver_id ?? 'none'} className="border-t border-bakery-btnBorder">
              <th
                scope="row"
                className={`py-2 pr-3 font-semibold ${
                  driver.driver_id === null ? 'italic text-gray-500' : 'text-bakery-dark'
                }`}
              >
                {driver.full_name}
              </th>
              <td className="py-2 pr-3 text-right">{driver.delivered}</td>
              <td className="py-2 pr-3 text-right">{driver.failed}</td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <span className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: RATE_TRACK }} aria-hidden>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${driver.success_rate ?? 0}%`, background: RATE_FILL }}
                    />
                  </span>
                  <span className="w-12 text-right font-semibold text-bakery-dark">
                    {formatPercent(driver.success_rate)}
                  </span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right">{driver.days_on_route}</td>
              <td className="py-2 pr-3 text-right">
                {driver.avg_stops_per_day.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}
              </td>
              <td className="py-2 text-right">{formatMinutes(driver.avg_route_minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}