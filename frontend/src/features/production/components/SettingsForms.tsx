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
import { DANGER_BUTTON, ERROR_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';

const FIELD =
  'px-3.5 rounded-xl border-[1.5px] border-bakery-btnBorder bg-white text-[15px] font-semibold text-bakery-dark outline-none focus:border-bakery-accent';
const INPUT = `${FIELD} w-full h-12`;
const TEXTAREA = `${FIELD} w-full min-h-20 py-2.5`;

/** Liczba z pola formularza w formacie dla API (kropka dziesiętna). */
const decimal = (value: string) => String(parseDecimal(value) ?? '');

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#3d3937]">
      {label}
      {children}
      {hint && <span className="text-xs font-semibold text-[#5f5a58]">{hint}</span>}
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={`${ERROR_CLASS} flex items-start gap-2`}>
      <AlertTriangle className="w-4 h-4 shrink-0" /> {message}
    </p>
  );
}

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2.5 pt-1">
      <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY_BUTTON}>
        Anuluj
      </button>
      <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-auth">
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
        <label className="flex items-center gap-2.5 text-sm font-bold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            className="size-5 accent-bakery-dark cursor-pointer"
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-auth">
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
            className={TEXTAREA}
            value={draft.mixing_instructions}
            onChange={(e) => setDraft({ ...draft, mixing_instructions: e.target.value })}
          />
        </Field>

        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="m-0 text-xs font-extrabold text-[#3d3937]">Receptura na 1 kg ciasta</h3>
            <span className={`text-xs font-bold tabular-nums ${recipeMassLooksWrong(massPerKg) ? 'text-[#a35a00]' : 'text-[#5f5a58]'}`}>
              Suma surowców wagowych: {massPerKg.toLocaleString('pl-PL', { maximumFractionDigits: 3 })} kg
            </span>
          </div>
          {draft.ingredients.map((item, index) => {
            const unit = item.ingredient_id === '' ? '' : unitOf(item.ingredient_id);
            return (
              <div key={index} className="flex gap-2 items-center">
                <select
                  aria-label={`Surowiec ${index + 1}`}
                  className={`${INPUT} cursor-pointer flex-1 min-w-0`}
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
                  className={`${FIELD} h-12 w-28 shrink-0 tabular-nums`}
                  inputMode="decimal"
                  placeholder="np. 0,611"
                  value={item.amount_per_kg}
                  onChange={(e) => setItem(index, { amount_per_kg: e.target.value })}
                />
                <span className="w-8 shrink-0 text-xs font-bold text-[#5f5a58]">{unit}</span>
                <button
                  type="button"
                  aria-label={`Usuń surowiec ${index + 1}`}
                  onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) })}
                  className="shrink-0 grid place-items-center size-12 rounded-xl border-0 bg-transparent text-[#5f5a58] cursor-pointer hover:text-[#b91c1c] hover:bg-[#fdecec]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { ingredient_id: '', amount_per_kg: '' }] })}
            className="self-start inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-bakery-btnBorder bg-white text-[13px] font-extrabold text-bakery-dark cursor-pointer hover:border-bakery-dark"
          >
            <Plus className="w-3.5 h-3.5" /> Dodaj surowiec
          </button>
          {recipeMassLooksWrong(massPerKg) && (
            <p className="m-0 text-xs font-semibold text-[#a35a00]">
              Dla kompletnej receptury suma surowców wagowych wynosi zwykle ok. 1 kg na 1 kg ciasta — sprawdź, czy
              ilości nie są wpisane w gramach.
            </p>
          )}
        </section>

        {dough && dough.products_count > 0 && (
          <p className="m-0 text-xs font-semibold text-[#5f5a58]">
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-auth">
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
      <p className="m-0 text-sm font-semibold leading-relaxed text-[#3d3937] font-auth">{message}</p>
      <FormError message={error} />
      <div className="flex justify-end gap-2.5 font-auth">
        <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
          Anuluj
        </button>
        <button
          type="button"
          onClick={() => submit(null, onConfirm)}
          disabled={saving}
          className={DANGER_BUTTON}
        >
          {saving ? 'Usuwanie…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
