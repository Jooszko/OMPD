import { Link } from 'react-router-dom';
import type { HomeShift, ProductionStage } from '../../../services/api';
import { formatShortDate } from '../lib/home';
import { FlowBoard, type FlowLane, type FlowTone } from './FlowBoard';

const STAGES: { key: ProductionStage; label: string; short: string; tone: FlowTone }[] = [
  { key: 'mixing', label: 'Mieszanie', short: 'Miesz.', tone: 'neutral' },
  { key: 'dividing', label: 'Dzielenie', short: 'Dziel.', tone: 'violet' },
  { key: 'proofing', label: 'Garowanie', short: 'Gar.', tone: 'blue' },
  { key: 'baking', label: 'Wypiek', short: 'Piec', tone: 'amber' },
  { key: 'done', label: 'Gotowe', short: 'Gotowe', tone: 'green' },
];

const FOCUS_ORDER: ProductionStage[] = ['baking', 'proofing', 'dividing', 'mixing', 'done'];

function doughBadge(name: string): string {
  const word = name.replace(/^ciasto\s+/i, '');
  return word.slice(0, 2).toUpperCase();
}

export function DoughFlow({ shift }: { shift: HomeShift }) {
  const lanes: FlowLane[] = STAGES.map((stage) => ({
    ...stage,
    cards: shift.batches
      .filter((batch) => batch.stage === stage.key)
      .map((batch) => ({
        key: String(batch.batch_id),
        badge: doughBadge(batch.dough_name),
        title: batch.dough_name,
        detail: [`dzieża ${batch.sequence}/${batch.batch_count}`, batch.mixer_name].filter(Boolean).join(' · '),
      })),
  }));
  const initialKey = FOCUS_ORDER.find((key) => shift.stages[key] > 0) ?? 'mixing';
  const day = formatShortDate(shift.delivery_date);

  return (
    <>
      <FlowBoard
        title="Droga dzież"
        link={{ to: '/production/board', label: 'Tablica produkcji' }}
        lanes={lanes}
        initialKey={initialKey}
        empty={shift.has_plan ? undefined : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 rounded-[18px] bg-[#fdf3e2] border border-[#f1c983]">
            <span className="text-sm font-extrabold text-[#7a4300]">
              Plan produkcji na {day} jeszcze nie powstał, więc nie ma dzież do pokazania.
            </span>
            <Link
              to="/production"
              className="inline-flex items-center min-h-11 px-4 rounded-xl bg-bakery-dark text-white text-sm font-extrabold no-underline"
            >
              Przygotuj plan
            </Link>
          </div>
        )}
      />

      {shift.products.length > 0 && (
        <section aria-labelledby="oven-title" className="rounded-[18px] bg-bakery-card border border-bakery-btnBorder overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <h2 id="oven-title" className="m-0 text-base font-extrabold">Co wychodzi z pieca na {day}</h2>
            <span className="shrink-0 whitespace-nowrap text-[13px] font-extrabold text-[#5f5a58]">{shift.pieces} szt.</span>
          </div>
          <ul className="m-0 p-0 list-none grid gap-px bg-[#e6e1df] border-t border-[#e6e1df] sm:grid-cols-2 lg:grid-cols-3">
            {shift.products.map((product) => (
              <li key={product.name} className="flex items-center justify-between gap-2.5 px-5 py-3 bg-bakery-card">
                <span className="text-sm font-bold">{product.name}</span>
                <span className="text-[15px] font-extrabold tabular-nums">{product.quantity} szt.</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}