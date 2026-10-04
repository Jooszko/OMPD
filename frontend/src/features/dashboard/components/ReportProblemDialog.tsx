import { type FormEvent, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { FailureReason } from '../../../services/api';
import { FAILURE_REASON_LABELS, MAX_NOTE_LENGTH } from '../lib/logisticsStatus';
import { Modal } from './Modal';

export type ProblemTarget = { kind: 'stop'; clientId: number } | { kind: 'order'; orderId: number };

const REASONS = Object.keys(FAILURE_REASON_LABELS) as FailureReason[];

export function ReportProblemDialog({
  title,
  subtitle,
  onSubmit,
  onClose,
}: {
  title: string;
  subtitle: string;
  onSubmit: (reason: FailureReason, note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<FailureReason | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const noteRequired = reason === 'other';
  const canSubmit = reason !== null && (!noteRequired || note.trim().length > 0) && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason || !canSubmit) return;
    setSubmitting(true);
    const ok = await onSubmit(reason, note.trim());
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
      initialFocusSelector='input[type="radio"]'
      closeDisabled={submitting}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
          <legend className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Powód</legend>
          {REASONS.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-2.5 min-h-[44px] px-3 rounded-lg border cursor-pointer text-sm font-semibold transition ${
                reason === r
                  ? 'border-rose-400 bg-rose-50'
                  : 'border-bakery-btnBorder bg-bakery-rowBg hover:bg-bakery-inactive'
              }`}
            >
              <input
                type="radio"
                name="failure-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="w-4 h-4 accent-rose-600"
              />
              {FAILURE_REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>

        <div>
          <label
            htmlFor="failure-note"
            className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1"
          >
            Notatka {noteRequired ? '(wymagana)' : '(opcjonalnie)'}
          </label>
          <textarea
            id="failure-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="np. sklep zamknięty do 10:00, zostawiłem informację"
            className="w-full border border-bakery-btnBorder bg-bakery-rowBg rounded-lg text-sm p-2 outline-none focus:border-bakery-accent resize-none"
          />
          <p className="m-0 text-[10px] text-gray-400 text-right">
            {note.length} / {MAX_NOTE_LENGTH}
          </p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
            disabled={!canSubmit}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Wysyłanie...' : 'Zgłoś problem'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
