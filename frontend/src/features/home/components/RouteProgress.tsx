import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { HomeRoute, HomeRouteStop } from '../../../services/api';
import { formatClock, progressStops, routeLabel } from '../lib/home';

const PILL: Record<HomeRoute['state'], string> = {
  done: 'bg-[#cdebd5] text-[#17532b]',
  on_road: 'bg-[#dfe8f6] text-[#1d4f91]',
  waiting: 'bg-[#e6e1df] text-[#3d3937]',
};

const DOT: Record<HomeRouteStop['status'], string> = {
  delivered: 'bg-[#1f7a3a] border-[#1f7a3a]',
  failed: 'bg-[#b91c1c] border-[#b91c1c]',
  in_delivery: 'bg-[#2f6fbf] border-[#2f6fbf] ring-4 ring-[#2f6fbf]/20',
  waiting: 'bg-white border-[#b4aeae]',
};

const STATUS_LABEL: Record<HomeRouteStop['status'], string> = {
  delivered: 'dostarczono',
  failed: 'nieudana dostawa',
  in_delivery: 'w drodze',
  waiting: 'czeka',
};

function stopText(stop: HomeRouteStop): string {
  const time = stop.status === 'delivered' && stop.delivered_at ? ` ${formatClock(stop.delivered_at)}` : '';
  return `${stop.client_name} – ${STATUS_LABEL[stop.status]}${time}`;
}

function finished(stop: HomeRouteStop): boolean {
  return stop.status === 'delivered' || stop.status === 'failed';
}

function StopTrack({ stops }: { stops: HomeRouteStop[] }) {
  const ordered = progressStops(stops);
  return (
    <ol className="m-0 p-0 list-none flex items-center min-w-0">
      {ordered.map((stop, index) => (
        <Fragment key={stop.client_id}>
          {index > 0 && (
            <li aria-hidden className={`flex-1 min-w-3 max-w-16 h-1 ${finished(ordered[index - 1]) ? 'bg-[#1f7a3a]' : 'bg-[#d6d0cd]'}`} />
          )}
          <li
            title={stopText(stop)}
            aria-label={stopText(stop)}
            className={`shrink-0 size-5 rounded-full border-[3px] flex items-center justify-center ${DOT[stop.status]}`}
          >
            {stop.status === 'failed' && <X aria-hidden className="size-3 text-white" strokeWidth={3.5} />}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}

export function RouteProgress({ routes }: { routes: HomeRoute[] }) {
  return (
    <section aria-labelledby="routes-title" className="flex-[999_1_560px] min-w-0 flex flex-col rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 id="routes-title" className="m-0 text-base font-extrabold">Trasy dziś</h2>
        <Link to="/logistics" className="shrink-0 text-[13px] font-extrabold text-bakery-dark">Mapa w Logistyce</Link>
      </div>

      {routes.length === 0 ? (
        <p className="m-0 mx-5 mb-5 px-4 py-8 rounded-xl bg-[#ece7e4] text-center text-sm font-semibold text-[#5f5a58]">
          Na dziś nie ma tras z dostawami.
        </p>
      ) : (
        <>
          <ul className="m-0 p-0 list-none">
            {routes.map((route) => (
              <li
                key={route.route_id}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[170px_1fr_auto] items-center gap-x-4 gap-y-2.5 px-5 py-3.5 border-t border-[#e6e1df]"
              >
                <span className="min-w-0 flex flex-col">
                  <span className="text-sm font-extrabold">{route.route_name}</span>
                  <span className="text-xs font-semibold text-[#5f5a58] truncate">{route.driver_name || 'bez kierowcy'}</span>
                </span>
                <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto min-w-0">
                  <StopTrack stops={route.stops} />
                </span>
                <span className={`col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto justify-self-end whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${PILL[route.state]}`}>
                  {routeLabel(route)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-x-[18px] gap-y-1.5 px-5 py-3 border-t border-[#e6e1df] text-[13px] font-bold text-[#3d3937]">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-[#1f7a3a]" />dostarczono</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-[#2f6fbf]" />w drodze</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-white border-2 border-[#b4aeae]" />czeka</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-3 rounded-full bg-[#b91c1c]" />nieudana</span>
          </div>
        </>
      )}
    </section>
  );
}