import type { FinanceTopClient } from '../../../services/api';
import { changeVsPrevious, formatMoney, formatShare, type Change } from '../lib/money';
import { ChangeBadge } from './ChangeBadge';

const TH_CLASS = 'py-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]';

function clientChange(client: FinanceTopClient): Change {
  if (client.previous_revenue === null) return { label: 'nowy w okresie', tone: 'neutral' };
  return changeVsPrevious(client.revenue, client.previous_revenue, 'income');
}

export function TopClients({
  clients,
  others,
  revenue,
  comparison,
}: {
  clients: FinanceTopClient[];
  others: { clients: number; revenue: string };
  revenue: string;
  comparison: string;
}) {
  const topRevenue = clients.reduce((sum, client) => sum + Number(client.revenue), 0);
  const leader = Math.max(1, ...clients.map((client) => Number(client.revenue)));

  return (
    <section className="flex-[999_1_560px] min-w-0 bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-lg font-extrabold">Najwięksi klienci</h2>
          <p className="m-0 text-[13px] text-[#5f5a58]">Przychód netto po zwrotach. Zmiana {comparison}.</p>
        </div>
        {clients.length > 0 && (
          <span className="text-[13px] font-bold text-[#4a4543] tabular-nums">
            {clients.length} {clients.length === 1 ? 'klient' : 'klientów'} = {formatShare(topRevenue, revenue)} przychodu
          </span>
        )}
      </div>

      {clients.length === 0 ? (
        <p className="m-0 text-sm font-semibold text-[#5f5a58] italic">Brak sprzedaży w tym okresie.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH_CLASS} pl-0 w-7`}>#</th>
                <th scope="col" className={TH_CLASS}>Klient</th>
                <th scope="col" className={`${TH_CLASS} w-[34%]`}>Udział w przychodzie</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Przychód</th>
                <th scope="col" className={`${TH_CLASS} text-right`}>Dostawy</th>
                <th scope="col" className={`${TH_CLASS} pr-0 text-right`}>Zmiana</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr key={client.client_id} className="border-t border-[#e6e1df]">
                  <td className="py-3.5 pr-2 text-[13px] font-extrabold text-[#5f5a58] tabular-nums">{index + 1}</td>
                  <th scope="row" className="py-3.5 px-2 text-sm font-extrabold">
                    {client.name}
                  </th>
                  <td className="py-3.5 px-2">
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden className="flex-1 h-2 rounded bg-bakery-rowBg">
                        <span
                          className="block h-full rounded bg-[#2a78d6]"
                          style={{ width: `${Math.max(0, (Number(client.revenue) / leader) * 100)}%` }}
                        />
                      </span>
                      <span className="w-11 text-right text-[13px] font-bold text-[#4a4543] tabular-nums">
                        {formatShare(client.revenue, revenue)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-2 text-right text-sm font-extrabold tabular-nums">{formatMoney(client.revenue)}</td>
                  <td className="py-3.5 px-2 text-right text-[13px] font-semibold text-[#4a4543] tabular-nums">
                    {client.deliveries}
                  </td>
                  <td className="py-3.5 pl-2 text-right">
                    <ChangeBadge change={clientChange(client)} />
                  </td>
                </tr>
              ))}
              {others.clients > 0 && (
                <tr className="border-t border-bakery-btnBorder">
                  <td />
                  <th scope="row" className="py-3.5 px-2 text-[13px] font-bold text-[#4a4543]">
                    Pozostali ({others.clients})
                  </th>
                  <td className="py-3.5 px-2 text-[13px] font-bold text-[#4a4543] tabular-nums">
                    {formatShare(others.revenue, revenue)}
                  </td>
                  <td className="py-3.5 px-2 text-right text-sm font-bold text-[#4a4543] tabular-nums">
                    {formatMoney(others.revenue)}
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}