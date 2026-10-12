import { useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type {
  BakeSpecValues,
  DoughInput,
  MixerInput,
  ProductBakeSpecRow,
  ProductionDough,
  ProductionMixer,
  ProductionSettings,
} from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import {
  parseDecimal,
  recipeMassLooksWrong,
  recipeMassPerKg,
  validateBakeSpec,
  validateDough,
  validateMixer,
  type BakeSpecDraft,
  type DoughDraft,
  type MixerDraft,
} from '../lib/productionSettings';

const INPUT =
  'w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent';
const PRIMARY =
  'px-4 h-9 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition disabled:opacity-40';
const SECONDARY =
  'px-4 h-9 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition disabled:opacity-40';

/** Liczba z pola formularza w formacie dla API (kropka dziesiętna). */
const decimal = (value: string) => String(parseDecimal(value) ?? '');

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-gray-500 font-medium">{hint}</span>}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="m-0 flex items-start gap-2 bg-red-50 border border-red-300 rounded px-3 py-2 text-xs font-semibold text-red-800">
      <AlertTriangle className="w-4 h-4 shrink-0" /> {message}
    </p>
  );
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY}>
        Anuluj
      </button>
      <button type="submit" disabled={saving} className={PRIMARY}>
        {saving ? 'Zapisywanie…' : 'Zapisz'}
      </button>
    </div>
  );
}

/** Wspólna obsługa zapisu: walidacja lokalna, potem API; błąd serwera zostaje w formularzu. */
function useSubmit(onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (validationError: string | null, save: () => Promise<unknown>) => {
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać zmian.');
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, submit };
}

export function MixerForm({
  mixer,
  onSave,
  onSaved,
  onClose,
}: {
  mixer: ProductionMixer | null;
  onSave: (payload: MixerInput) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<MixerDraft & { is_active: boolean }>({
    name: mixer?.name ?? '',
    min_capacity_kg: mixer ? String(Number(mixer.min_capacity_kg)) : '0',
    max_capacity_kg: mixer ? String(Number(mixer.max_capacity_kg)) : '',
    is_active: mixer?.is_active ?? true,
  });
  const { saving, error, submit } = useSubmit(onSaved);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(validateMixer(draft), () =>
      onSave({
        name: draft.name.trim(),
        min_capacity_kg: decimal(draft.min_capacity_kg),
        max_capacity_kg: decimal(draft.max_capacity_kg),
        is_active: draft.is_active,
      })
    );
  };

  return (
    <Modal title={mixer ? 'Edycja mieszałki' : 'Nowa mieszałka'} closeDisabled={saving} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nazwa">
          <input className={INPUT} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="np. Mieszałka spiralna duża" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimalny wsad [kg]" hint="Mniejsza dzieża wymiesza się źle.">
            <input className={INPUT} inputMode="decimal" value={draft.min_capacity_kg} onChange={(e) => setDraft({ ...draft, min_capacity_kg: e.target.value })} />
          </Field>
          <Field label="Maksymalny wsad [kg]" hint="Cięższe ciasto zostanie podzielone na dzieże.">
            <input className={INPUT} inputMode="decimal" value={draft.max_capacity_kg} onChange={(e) => setDraft({ ...draft, max_capacity_kg: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            className="w-4 h-4 accent-bakery-dark cursor-pointer"
          />
          Mieszałka sprawna (bierze udział w planowaniu)
        </label>
        <FormError message={error} />
        <FormActions saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  );
}

export function DoughForm({
  dough,
  settings,
  onSave,
  onSaved,
  onClose,
}: {
  dough: ProductionDough | null;
  settings: ProductionSettings;
  onSave: (payload: DoughInput) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DoughDraft & { mixer_id: number | ''; mixing_instructions: string }>({
    name: dough?.name ?? '',
    mixer_id: dough?.mixer_id ?? '',
    loss_buffer_pct: dough ? String(Number(dough.loss_buffer_pct)) : '3',
    mixing_time_min: String(dough?.mixing_time_min ?? 10),
    target_dough_temp_c: dough ? String(Number(dough.target_dough_temp_c)) : '26',
    proofing_time_min: String(dough?.proofing_time_min ?? 45),
    mixing_instructions: dough?.mixing_instructions ?? '',
    ingredients: dough
      ? dough.ingredients.map((i) => ({ ingredient_id: i.ingredient_id, amount_per_kg: String(Number(i.amount_per_kg)) }))
      : [{ ingredient_id: '', amount_per_kg: '' }],
  });
  const { saving, error, submit } = useSubmit(onSaved);

  const unitOf = (id: number) => settings.ingredients.find((i) => i.ingredient_id === id)?.unit;
  const massPerKg = recipeMassPerKg(draft.ingredients, unitOf);
  const setItem = (index: number, patch: Partial<DoughDraft['ingredients'][number]>) =>
    setDraft({ ...draft, ingredients: draft.ingredients.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(validateDough(draft), () =>
      onSave({
        name: draft.name.trim(),
        mixer_id: draft.mixer_id === '' ? null : draft.mixer_id,
        loss_buffer_pct: decimal(draft.loss_buffer_pct),
        mixing_time_min: Number(draft.mixing_time_min),
        target_dough_temp_c: decimal(draft.target_dough_temp_c),
        proofing_time_min: Number(draft.proofing_time_min),
        mixing_instructions: draft.mixing_instructions.trim(),
        ingredients: draft.ingredients.map((item) => ({
          ingredient_id: Number(item.ingredient_id),
          amount_per_kg: decimal(item.amount_per_kg),
        })),
      })
    );
  };

  return (
    <Modal size="xl" title={dough ? `Edycja ciasta: ${dough.name}` : 'Nowe ciasto'} closeDisabled={saving} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nazwa">
            <input className={INPUT} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="np. Ciasto pszenne" />
          </Field>
          <Field label="Domyślna mieszałka" hint="System może wybrać inną, jeśli da mniej dzieży.">
            <select
              className={`${INPUT} cursor-pointer`}
              value={draft.mixer_id}
              onChange={(e) => setDraft({ ...draft, mixer_id: e.target.value === '' ? '' : Number(e.target.value) })}
            >
              <option value="">Dowolna (dobierana automatycznie)</option>
              {settings.mixers.map((m) => (
                <option key={m.mixer_id} value={m.mixer_id}>
                  {m.name}
                  {m.is_active ? '' : ' (wyłączona)'}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Bufor strat [%]">
            <input className={INPUT} inputMode="decimal" value={draft.loss_buffer_pct} onChange={(e) => setDraft({ ...draft, loss_buffer_pct: e.target.value })} />
          </Field>
          <Field label="Mieszanie [min]">
            <input className={INPUT} inputMode="numeric" value={draft.mixing_time_min} onChange={(e) => setDraft({ ...draft, mixing_time_min: e.target.value })} />
          </Field>
          <Field label="Temp. ciasta [°C]">
            <input className={INPUT} inputMode="decimal" value={draft.target_dough_temp_c} onChange={(e) => setDraft({ ...draft, target_dough_temp_c: e.target.value })} />
          </Field>
          <Field label="Garowanie [min]">
            <input className={INPUT} inputMode="numeric" value={draft.proofing_time_min} onChange={(e) => setDraft({ ...draft, proofing_time_min: e.target.value })} />
          </Field>
        </div>
        <Field label="Instrukcja mieszania (widoczna na tablicy produkcji)">
          <textarea
            className={`${INPUT} min-h-16`}
            value={draft.mixing_instructions}
            onChange={(e) => setDraft({ ...draft, mixing_instructions: e.target.value })}
          />
        </Field>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="m-0 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Receptura na 1 kg ciasta</h3>
            <span className={`text-[11px] font-bold ${recipeMassLooksWrong(massPerKg) ? 'text-amber-700' : 'text-gray-600'}`}>
              Suma surowców wagowych: {massPerKg.toLocaleString('pl-PL', { maximumFractionDigits: 3 })} kg
            </span>
          </div>
          {draft.ingredients.map((item, index) => {
            const unit = item.ingredient_id === '' ? '' : unitOf(item.ingredient_id);
            return (
              <div key={index} className="flex gap-2 items-center">
                <select
                  aria-label={`Surowiec ${index + 1}`}
                  className={`${INPUT} cursor-pointer flex-1`}
                  value={item.ingredient_id}
                  onChange={(e) => setItem(index, { ingredient_id: e.target.value === '' ? '' : Number(e.target.value) })}
                >
                  <option value="">Wybierz surowiec…</option>
                  {settings.ingredients.map((i) => (
                    <option key={i.ingredient_id} value={i.ingredient_id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Ilość surowca ${index + 1} na 1 kg ciasta`}
                  className={`${INPUT} w-28 font-mono`}
                  inputMode="decimal"
                  placeholder="np. 0,611"
                  value={item.amount_per_kg}
                  onChange={(e) => setItem(index, { amount_per_kg: e.target.value })}
                />
                <span className="w-10 text-xs font-semibold text-gray-600">{unit}</span>
                <button
                  type="button"
                  aria-label={`Usuń surowiec ${index + 1}`}
                  onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) })}
                  className="p-2 rounded text-gray-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { ingredient_id: '', amount_per_kg: '' }] })}
            className="self-start flex items-center gap-1 px-3 h-8 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder rounded"
          >
            <Plus className="w-3.5 h-3.5" /> Dodaj surowiec
          </button>
          {recipeMassLooksWrong(massPerKg) && (
            <p className="m-0 text-[11px] font-semibold text-amber-800">
              Dla kompletnej receptury suma surowców wagowych wynosi zwykle ok. 1 kg na 1 kg ciasta — sprawdź, czy
              ilości nie są wpisane w gramach.
            </p>
          )}
        </section>

        {dough && dough.products_count > 0 && (
          <p className="m-0 text-[11px] text-gray-600 font-medium">
            Zmiany obejmą przyszłe plany. Zapisane plany zachowują swoje listy odważeń.
          </p>
        )}
        <FormError message={error} />
        <FormActions saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  );
}

export function BakeSpecForm({
  row,
  settings,
  onSave,
  onSaved,
  onClose,
}: {
  row: ProductBakeSpecRow;
  settings: ProductionSettings;
  onSave: (payload: BakeSpecValues) => Promise<unknown>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BakeSpecDraft>({
    dough_id: row.spec?.dough_id ?? '',
    piece_weight_kg: row.spec ? String(Number(row.spec.piece_weight_kg)) : '',
    bake_temp_c: String(row.spec?.bake_temp_c ?? 230),
    bake_time_min: String(row.spec?.bake_time_min ?? 30),
  });
  const { saving, error, submit } = useSubmit(onSaved);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(validateBakeSpec(draft), () =>
      onSave({
        dough_id: Number(draft.dough_id),
        piece_weight_kg: decimal(draft.piece_weight_kg),
        bake_temp_c: Number(draft.bake_temp_c),
        bake_time_min: Number(draft.bake_time_min),
      })
    );
  };

  return (
    <Modal title={`Parametry: ${row.product_name}`} closeDisabled={saving} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Ciasto">
          <select
            className={`${INPUT} cursor-pointer`}
            value={draft.dough_id}
            onChange={(e) => setDraft({ ...draft, dough_id: e.target.value === '' ? '' : Number(e.target.value) })}
          >
            <option value="">Wybierz ciasto…</option>
            {settings.doughs.map((d) => (
              <option key={d.dough_id} value={d.dough_id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Waga surowego kęsa [kg]" hint="Ciasto przed wypiekiem, np. 0,58 dla bochenka 500 g.">
          <input className={INPUT} inputMode="decimal" value={draft.piece_weight_kg} onChange={(e) => setDraft({ ...draft, piece_weight_kg: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Temperatura wypieku [°C]">
            <input className={INPUT} inputMode="numeric" value={draft.bake_temp_c} onChange={(e) => setDraft({ ...draft, bake_temp_c: e.target.value })} />
          </Field>
          <Field label="Czas wypieku [min]">
            <input className={INPUT} inputMode="numeric" value={draft.bake_time_min} onChange={(e) => setDraft({ ...draft, bake_time_min: e.target.value })} />
          </Field>
        </div>
        <FormError message={error} />
        <FormActions saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { saving, error, submit } = useSubmit(onClose);

  return (
    <Modal title={title} closeDisabled={saving} onClose={onClose}>
      <p className="m-0 text-sm">{message}</p>
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className={SECONDARY}>
          Anuluj
        </button>
        <button
          type="button"
          onClick={() => submit(null, onConfirm)}
          disabled={saving}
          className="px-4 h-9 text-xs font-bold bg-red-700 hover:bg-red-800 text-white rounded shadow-xs transition disabled:opacity-40"
        >
          {saving ? 'Usuwanie…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
