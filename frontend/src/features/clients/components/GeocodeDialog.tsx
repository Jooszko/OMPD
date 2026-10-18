import { useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { GeocodeError, geocodeClient, type AppClient } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';

type Outcome = 'working' | 'found' | 'not_found' | 'failed';

const SECONDS_PER_ADDRESS = 1.1;

export function GeocodeDialog({
  clients,
  onClose,
  onLocated,
  onEdit,
}: {
  clients: AppClient[];
  onClose: () => void;
  onLocated: (client: AppClient) => void;
  onEdit: (client: AppClient) => void;
}) {
  const [queue] = useState(clients);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [running, setRunning] = useState(false);
  const stopped = useRef(false);

  const done = Object.values(outcomes).filter((outcome) => outcome !== 'working').length;
  const found = Object.values(outcomes).filter((outcome) => outcome === 'found').length;
  const finished = !running && done > 0;
  const seconds = Math.ceil(queue.length * SECONDS_PER_ADDRESS);

  const start = async () => {
    stopped.current = false;
    setRunning(true);
    for (const client of queue) {
      if (stopped.current) break;
      if (outcomes[client.client_id] === 'found') continue;
      setOutcomes((current) => ({ ...current, [client.client_id]: 'working' }));
      let outcome: Outcome = 'found';
      try {
        onLocated(await geocodeClient(client.client_id));
      } catch (err) {
        outcome = err instanceof GeocodeError && err.code === 'not_found' ? 'not_found' : 'failed';
      }
      setOutcomes((current) => ({ ...current, [client.client_id]: outcome }));
    }
    setRunning(false);
  };

  const close = () => {
    stopped.current = true;
    onClose();
  };

  const edit = (client: AppClient) => {
    stopped.current = true;
    onEdit(client);
  };

  return (
    <Modal
      title="Ustalanie lokalizacji z adresów"
      subtitle={
        queue.length === 1
          ? queue[0].name
          : `${queue.length} klientów bez lokalizacji · ok. ${seconds} s (OpenStreetMap pozwala na 1 adres na sekundę)`
      }
      onClose={close}
    >
      <div className="flex flex-col gap-4 font-auth">
        {(running || finished) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px] font-extrabold tabular-nums">
              <span>
                {done} z {queue.length} sprawdzonych
              </span>
              <span className="text-[#1f5f33]">znaleziono {found}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Postęp"
              aria-valuemin={0}
              aria-valuemax={queue.length}
              aria-valuenow={done}
              className="h-2.5 rounded-full bg-bakery-rowBg overflow-hidden"
            >
              <div className="h-full rounded-full bg-bakery-dark transition-all" style={{ width: `${(done / queue.length) * 100}%` }} />
            </div>
          </div>
        )}

        <ul className="m-0 p-0 list-none max-h-[320px] overflow-y-auto rounded-xl border border-[#e6e1df]">
          {queue.map((client) => {
            const outcome = outcomes[client.client_id];
            return (
              <li
                key={client.client_id}
                className="grid grid-cols-[20px_1fr_auto] gap-2.5 items-center px-3.5 py-2.5 border-t border-[#f0ecea] first:border-t-0"
              >
                <span aria-hidden>
                  {outcome === 'working' && <Loader2 className="w-4 h-4 animate-spin text-[#5f5a58]" />}
                  {outcome === 'found' && <Check className="w-4 h-4 text-[#1f7a3a]" strokeWidth={3} />}
                  {(outcome === 'not_found' || outcome === 'failed') && <AlertTriangle className="w-4 h-4 text-[#b45309]" />}
                </span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-sm font-bold truncate">{client.name}</span>
                  <span className="text-xs font-semibold text-[#5f5a58] truncate">{client.address}</span>
                </span>
                <span className="text-xs font-extrabold whitespace-nowrap">
                  {outcome === 'found' && <span className="text-[#1f5f33]">znaleziono</span>}
                  {outcome === 'working' && <span className="text-[#5f5a58]">sprawdzanie…</span>}
                  {outcome === 'failed' && <span className="text-[#7a4300]">serwis nie odpowiada</span>}
                  {outcome === 'not_found' && (
                    <button type="button" onClick={() => edit(client)} className="underline underline-offset-2 text-bakery-dark">
                      Popraw adres
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {finished && found < queue.length && (
          <p className="m-0 text-[13px] font-semibold text-[#3d3937]">
            Adresów, których nie znaleziono, nie da się zaznaczyć na mapie. Popraw je (np. dopisz miejscowość) i spróbuj
            ponownie.
          </p>
        )}

        <div className="flex justify-end gap-2.5">
          {running ? (
            <button
              type="button"
              onClick={() => {
                stopped.current = true;
              }}
              className={SECONDARY_BUTTON}
            >
              Przerwij
            </button>
          ) : (
            <>
              <button type="button" onClick={close} className={SECONDARY_BUTTON}>
                {finished ? 'Zamknij' : 'Anuluj'}
              </button>
              {(!finished || found < queue.length) && (
                <button type="button" onClick={start} className={PRIMARY_BUTTON}>
                  {finished ? 'Spróbuj ponownie' : queue.length === 1 ? 'Ustal lokalizację' : 'Ustal lokalizacje'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}