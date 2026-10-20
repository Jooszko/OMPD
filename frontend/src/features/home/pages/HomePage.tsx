import { useEffect, useState } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { fetchHome, type HomeData } from '../../../services/api';
import { apiErrorMessage } from '../../users/lib/staff';
import { DoughFlow } from '../components/DoughFlow';
import { HomeHero, type HomeView } from '../components/HomeHero';
import { OrderFlow } from '../components/OrderFlow';
import { RouteProgress } from '../components/RouteProgress';
import { RecentChanges, TomorrowCard } from '../components/SideCards';

const REFRESH_MS = 120_000;

type LayoutRole = 'admin' | 'baker' | 'driver';

export default function HomePage() {
  const { currentRole } = useOutletContext<{ currentRole: LayoutRole }>();
  const [data, setData] = useState<HomeData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setVersion((value) => value + 1), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentRole === 'driver') return;
    let cancelled = false;
    fetchHome()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Nie udało się pobrać podsumowania dnia.'));
      });
    return () => {
      cancelled = true;
    };
  }, [version, currentRole]);

  if (currentRole === 'driver') return <Navigate to="/logistics" replace />;

  const view: HomeView = data?.viewer.role === 'admin' && currentRole === 'admin' ? 'admin' : 'baker';

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-6 font-auth text-bakery-dark">
      {data ? (
        <>
          <HomeHero data={data} view={view} />
          {view === 'admin' ? (
            <>
              <OrderFlow orders={data.orders} />
              <div className="flex flex-wrap gap-5 items-stretch">
                <RouteProgress routes={data.routes} />
                <div className="flex-[1_1_320px] min-w-0 flex flex-col gap-5">
                  <TomorrowCard shift={data.production} today={data.today} />
                  <RecentChanges changes={data.recent_changes} today={data.today} />
                </div>
              </div>
            </>
          ) : (
            <DoughFlow shift={data.production} />
          )}
        </>
      ) : loadError ? (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fdecec] text-[#8f1616] text-sm font-bold">
          {loadError}
        </p>
      ) : (
        <div role="status" aria-label="Ładowanie podsumowania dnia" className="h-[280px] rounded-[24px] bg-bakery-dark/90 animate-pulse" />
      )}
    </div>
  );
}