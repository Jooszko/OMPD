import { Pencil, Plus } from 'lucide-react';
import type { ProductionMixer, ProductionSettings } from '../../../../services/api';
import { formatKg } from '../../lib/productionStage';
import { ADD_BUTTON, CARD, ICON_BUTTON } from './styles';

const ROW_GRID = 'sm:grid-cols-[minmax(0,1fr)_170px_130px_40px]';

export function MixersTab({
  settings,
  canEdit,
  onAdd,
  onEdit,
}: {
  settings: ProductionSettings;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (mixer: ProductionMixer) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-2xl text-[13px] font-semibold text-[#5f5a58]">
          Cięższe ciasto plan dzieli na kilka dzieży. Mieszałek nie usuwa się, bo odwołują się do nich zapisane dzieże.
          Niesprawną mieszałkę wyłącz, a planowanie przestanie jej używać.
        </p>
        {canEdit && (
          <button type="button" onClick={onAdd} className={ADD_BUTTON}>
            <Plus aria-hidden className="size-4" /> Dodaj mieszałkę
          </button>
        )}
      </div>

      <section aria-label="Mieszałki" className={`${CARD} overflow-hidden`}>
        <div
          aria-hidden
          className={`hidden sm:grid ${ROW_GRID} gap-4 px-6 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]`}
        >
          <span>Mieszałka</span>
          <span>Wsad min. – maks.</span>
          <span>Status</span>
          <span />
        </div>
        {settings.mixers.length === 0 ? (
          <p className="m-0 px-6 py-8 border-t border-[#e6e1df] text-center text-sm font-semibold text-[#5f5a58]">
            Brak mieszałek.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {settings.mixers.map((mixer) => (
              <li
                key={mixer.mixer_id}
                className={`grid grid-cols-[1fr_auto] ${ROW_GRID} items-center gap-x-4 gap-y-1 px-4 sm:px-6 py-3 border-t border-[#e6e1df] first:border-t-0 sm:first:border-t`}
              >
                <span className="text-[15px] font-extrabold truncate">{mixer.name}</span>
                <span className="row-start-2 sm:row-start-auto text-sm font-extrabold tabular-nums">
                  {formatKg(Number(mixer.min_capacity_kg))} – {formatKg(Number(mixer.max_capacity_kg))}
                </span>
                <span className="row-start-2 col-start-2 sm:row-start-auto sm:col-start-auto inline-flex items-center gap-1.5 text-xs font-extrabold text-[#3d3937]">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: mixer.is_active ? '#3fb565' : '#e5484d' }} />
                  {mixer.is_active ? 'Sprawna' : 'Wyłączona'}
                </span>
                <span className="row-start-1 col-start-2 sm:row-start-auto sm:col-start-auto flex justify-end">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(mixer)}
                      aria-label={`Edytuj mieszałkę: ${mixer.name}`}
                      title="Edytuj mieszałkę"
                      className={ICON_BUTTON}
                    >
                      <Pencil aria-hidden className="size-4" />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
