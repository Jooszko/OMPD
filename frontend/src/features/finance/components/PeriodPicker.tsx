import { useState } from 'react';
import { toIsoDate } from '../../dashboard/lib/dateFormat';
import { PERIOD_PRESETS, presetPeriod, type FinancePeriod } from '../lib/period';

const SEGMENT_CLASS =
  'h-9 flex-1 sm:flex-none px-2 sm:px-3.5 rounded-[9px] text-[13px] font-bold whitespace-nowrap transition';
const DATE_CLASS =
  'h-9 px-2.5 text-[13px] font-semibold bg-white border border-bakery-btnBorder rounded-lg outline-none focus:border-bakery-accent';

export function PeriodPicker({ value, onChange }: { value: FinancePeriod; onChange: (period: FinancePeriod) => void }) {
  const [draft, setDraft] = useState({ start: value.start, end: value.end });
  const today = toIsoDate(new Date());
  const isCustom = value.preset === 'custom';
  const draftError = draft.start > draft.end ? 'Data początkowa nie może być późniejsza niż końcowa.' : null;

  const changeDraft = (field: 'start' | 'end', date: string) => {
    if (!date) return;
    const next = { ...draft, [field]: date };
    setDraft(next);
    if (next.start <= next.end) onChange({ preset: 'custom', ...next });
  };

  return (
    <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Okres"
        className="w-full sm:w-auto flex gap-0.5 p-[3px] bg-bakery-card border border-bakery-btnBorder rounded-xl"
      >
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={value.preset === preset.id}
            onClick={() => onChange(presetPeriod(preset.id))}
            className={`${SEGMENT_CLASS} ${
              value.preset === preset.id ? 'bg-bakery-dark text-white' : 'text-[#3d3937] hover:bg-bakery-rowBg'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => {
            setDraft({ start: value.start, end: value.end });
            onChange({ ...value, preset: 'custom' });
          }}
          className={`${SEGMENT_CLASS} ${isCustom ? 'bg-bakery-dark text-white' : 'text-[#3d3937] hover:bg-bakery-rowBg'}`}
        >
          Własny zakres
        </button>
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#4a4543]">
            od
            <input
              type="date"
              value={draft.start}
              max={today}
              onChange={(e) => changeDraft('start', e.target.value)}
              className={DATE_CLASS}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#4a4543]">
            do
            <input
              type="date"
              value={draft.end}
              max={today}
              onChange={(e) => changeDraft('end', e.target.value)}
              className={DATE_CLASS}
            />
          </label>
          {draftError && <span className="text-xs font-semibold text-rose-700">{draftError}</span>}
        </div>
      )}
    </div>
  );
}