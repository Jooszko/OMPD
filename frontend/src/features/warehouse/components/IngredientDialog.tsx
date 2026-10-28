import { type FormEvent, useId, useState } from 'react';
import { createIngredient, updateIngredient, type WarehouseRow } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';
import { parseQuantity, UNIT_SUGGESTIONS, type StockItem } from '../lib/warehouse';

export function IngredientDialog({
  item,
  onClose,
  onSaved,
}: {
  item: StockItem | null;
  onClose: () => void;
  onSaved: (row: WarehouseRow, created: boolean) => void;
}) {
  const unitsId = useId();
  const [name, setName] = useState(item?.name ?? '');
  const [unit, setUnit] = useState(item?.unit ?? 'kg');
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialValue = initial.trim() === '' ? 0 : parseQuantity(initial);
  const fieldError = !item && initialValue === null ? 'Stan wpisz jako liczbę, np. 12,5.' : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (fieldError || !name.trim() || !unit.trim()) return;
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), unit: unit.trim() };
    try {
      const row = item
        ? await updateIngredient(item.ingredient_id, payload)
        : await createIngredient({ ...payload, current_stock: String(initialValue) });
      onSaved(row, !item);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się zapisać składnika.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={item ? 'Edycja składnika' : 'Nowy składnik'}
      subtitle={
        item
          ? 'Stan zmienisz przyciskiem „Zmień stan”, żeby został ślad w historii.'
          : 'Pojawi się w magazynie, recepturach i katalogu dostawców.'
      }
      closeDisabled={saving}
      onClose={onClose}
      initialFocusSelector="#ingredient-name"
    >
      <form onSubmit={submit} className="flex flex-col gap-4 font-auth">
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <label className={LABEL_CLASS}>
            Nazwa
            <input
              id="ingredient-name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="np. Mąka orkiszowa"
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            Jednostka
            <input
              value={unit}
              maxLength={10}
              list={unitsId}
              onChange={(event) => setUnit(event.target.value)}
              className={FIELD_CLASS}
            />
            <datalist id={unitsId}>
              {UNIT_SUGGESTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>
        </div>

        {!item && (
          <label className={LABEL_CLASS}>
            Stan początkowy
            <span className="relative">
              <input
                inputMode="decimal"
                value={initial}
                onChange={(event) => setInitial(event.target.value)}
                placeholder="0"
                className={`${FIELD_CLASS} pr-12 tabular-nums`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[#5f5a58]">{unit}</span>
            </span>
          </label>
        )}

        <p className="m-0 px-3.5 py-2.5 rounded-xl bg-[#f6f2f0] text-[13px] font-semibold leading-relaxed text-[#3d3937]">
          Próg minimalny liczy się sam: to zużycie surowca w produkcji z ostatnich 7 dni, czyli zapas na tydzień.
          {!item && ' Dopóki składnik nie trafi do produkcji, próg wynosi 0.'}
        </p>

        {fieldError && <p className={ERROR_CLASS}>{fieldError}</p>}
        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button
            type="submit"
            disabled={saving || Boolean(fieldError) || !name.trim() || !unit.trim()}
            className={PRIMARY_BUTTON}
          >
            {saving ? 'Zapisywanie…' : item ? 'Zapisz zmiany' : 'Dodaj składnik'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
