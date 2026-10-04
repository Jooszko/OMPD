import { type FormEvent, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { MAX_NOTE_LENGTH } from '../lib/logisticsStatus';
import { Modal } from './Modal';

export function DeliveryNoteDialog({
  subtitle,
  initialNote,
  onSubmit,
  onClose,
}: {
  subtitle: string;
  initialNote: string;
  onSubmit: (note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [submitting, setSubmitting] = useState(false);

  const hasExistingNote = initialNote.length > 0;
  const unchanged = note.trim() === initialNote;

  const save = async (value: string) => {
    setSubmitting(true);
    const ok = await onSubmit(value);
    if (!ok) setSubmitting(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (unchanged || submitting) return;
    save(note.trim());
  };

  return (
    <Modal
      title={hasExistingNote ? 'Edytuj notatkę do dostawy' : 'Notatka do dostawy'}
      subtitle={subtitle}
      icon={<StickyNote className="w-5 h-5 text-bakery-accent" />}
      initialFocusSelector="textarea"
      closeDisabled={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="delivery-note" className="sr-only">
            Notatka do dostawy
          </label>
          <textarea
            id="delivery-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={4}
            placeholder="np. zostawione na zapleczu, odebrała pani Kasia"
            className="w-full border border-bakery-btnBorder bg-bakery-rowBg rounded-lg text-sm p-2 outline-none focus:border-bakery-accent resize-none"
          />
          <p className="m-0 text-[10px] text-gray-400 text-right">
            {note.length} / {MAX_NOTE_LENGTH}
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
          {hasExistingNote && (
            <button
              type="button"
              onClick={() => save('')}
              disabled={submitting}
              className="sm:mr-auto min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-white border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Usuń notatkę
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-white border border-bakery-btnBorder rounded-lg hover:bg-bakery-inactive"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={unchanged || submitting}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </form>
    </Modal>
  );
}