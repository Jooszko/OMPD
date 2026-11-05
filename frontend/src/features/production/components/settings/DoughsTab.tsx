import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ProductionDough, ProductionSettings } from '../../../../services/api';
import { plural } from '../../../home/lib/home';
import { formatAmount } from '../../lib/productionStage';
import { ADD_BUTTON, CARD, ICON_BUTTON, ICON_DANGER } from './styles';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e6e1df] text-xs font-extrabold">
      <span className="font-semibold text-[#5f5a58]">{label}</span>
      {value}
    </span>
  );
}

function DoughCard({
  dough,
  settings,
  canEdit,
  onEdit,
  onDelete,
}: {
  dough: ProductionDough;
  settings: ProductionSettings;
  canEdit: boolean;
  onEdit: (dough: ProductionDough) => void;
  onDelete: (dough: ProductionDough) => void;
}) {
  const mixer =
    dough.mixer_id === null
      ? 'mieszałka dobierana automatycznie'
      : settings.mixers.find((m) => m.mixer_id === dough.mixer_id)?.name ?? 'mieszałka —';
  const products = settings.products.filter((row) => row.spec?.dough_id === dough.dough_id);

  return (
    <section aria-label={dough.name} className={`${CARD} flex flex-col gap-4 p-4 sm:p-6`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 className="m-0 font-display text-[22px] leading-tight font-extrabold">{dough.name}</h2>
          <span className="text-xs font-semibold text-[#5f5a58]">
            {dough.products_count} {plural(dough.products_count, 'wyrób', 'wyroby', 'wyrobów')} · {mixer}
          </span>
        </div>
        {canEdit && (
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(dough)}
              aria-label={`Edytuj ciasto: ${dough.name}`}
              title="Edytuj ciasto"
              className={ICON_BUTTON}
            >
              <Pencil aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(dough)}
              disabled={dough.products_count > 0}
              aria-label={`Usuń ciasto: ${dough.name}`}
              title={dough.products_count > 0 ? 'Ciasto jest przypisane do wyrobów.' : 'Usuń ciasto'}
              className={ICON_DANGER}
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Fact label="Bufor strat" value={`${Number(dough.loss_buffer_pct)}%`} />
        <Fact label="Mieszanie" value={`${dough.mixing_time_min} min`} />
        <Fact label="Ciasto" value={`${Number(dough.target_dough_temp_c)} °C`} />
        <Fact label="Garowanie" value={`${dough.proofing_time_min} min`} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="m-0 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]">
          Receptura na 1 kg ciasta
          {dough.is_locked && (
            <span
              title="Ciasto było używane w produkcji — skład jest zablokowany."
              className="inline-flex items-center gap-1 rounded-full bg-[#fff6e5] px-2 py-0.5 normal-case tracking-normal text-[#7a4a00]"
            >
              <Lock aria-hidden className="size-3" /> zablokowana
            </span>
          )}
        </h3>
        <ul className="m-0 p-0 list-none grid sm:grid-cols-2 gap-x-6 px-4 py-1.5 rounded-[14px] bg-white border border-[#e6e1df]">
          {dough.ingredients.map((item) => (
            <li key={item.ingredient_id} className="flex justify-between gap-3 py-1.5 border-b border-[#f0ece9] text-[13px]">
              <span className="min-w-0 font-semibold text-[#3d3937] truncate">{item.name}</span>
              <span className="shrink-0 font-extrabold tabular-nums">{formatAmount(Number(item.amount_per_kg), item.unit)}</span>
            </li>
          ))}
        </ul>
      </div>

      {dough.mixing_instructions && (
        <p className="m-0 text-[13px] font-semibold text-[#3d3937] leading-relaxed whitespace-pre-line">
          {dough.mixing_instructions}
        </p>
      )}

      {products.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5">
          {products.map((row) => (
            <li key={row.product_id} className="px-2.5 py-1 rounded-full bg-[#ece7e5] text-xs font-bold">
              {row.product_name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DoughsTab({
  settings,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
}: {
  settings: ProductionSettings;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (dough: ProductionDough) => void;
  onDelete: (dough: ProductionDough) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-2xl text-[13px] font-semibold text-[#5f5a58]">
          Receptura podaje surowce na 1 kg gotowego ciasta. Plan mnoży ją przez masę kęsów powiększoną o bufor strat. Ciasta
          przypisanego do wyrobów nie można usunąć.
        </p>
        {canEdit && (
          <button type="button" onClick={onAdd} className={ADD_BUTTON}>
            <Plus aria-hidden className="size-4" /> Dodaj ciasto
          </button>
        )}
      </div>
      {settings.doughs.length === 0 ? (
        <p className={`${CARD} m-0 px-6 py-10 text-center text-sm font-semibold text-[#5f5a58]`}>Brak zdefiniowanych ciast.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {settings.doughs.map((dough) => (
            <DoughCard
              key={dough.dough_id}
              dough={dough}
              settings={settings}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
