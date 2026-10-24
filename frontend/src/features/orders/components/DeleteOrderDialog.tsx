import { useState } from 'react';
import { deleteDailyOrder, type OrderDayStop } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { DANGER_BUTTON, ERROR_CLASS, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';
import { formatDayHeading, formatPieces } from '../lib/orders';

export function DeleteOrderDialog({
  stop,
  date,
  onClose,
  onDeleted,
}: {
  stop: OrderDayStop;
  date: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteDailyOrder(stop.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się usunąć zamówienia.'));
      setDeleting(false);
    }
  };

  return (
    <Modal title="Usunąć zamówienie?" subtitle={stop.client_name} closeDisabled={deleting} onClose={onClose}>
      <div className="flex flex-col gap-4 font-auth">
        <p className="m-0 text-sm font-semibold leading-relaxed text-[#3d3937]">
          Zamówienie na {formatDayHeading(date)} ({formatPieces(stop.total_quantity)}) zniknie z produkcji i trasy. Zamówienie
          stałe klienta się nie zmienia.
        </p>

        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={deleting} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="button" onClick={confirm} disabled={deleting} className={DANGER_BUTTON}>
            {deleting ? 'Usuwanie…' : 'Usuń zamówienie'}
          </button>
        </div>
      </div>
    </Modal>
  );
}