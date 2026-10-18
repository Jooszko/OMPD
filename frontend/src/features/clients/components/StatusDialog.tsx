import { useState } from 'react';
import { updateClient, type AppClient } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { ERROR_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';

const LIST_CLASS = 'm-0 pl-5 list-disc flex flex-col gap-1.5 text-sm font-semibold leading-relaxed text-[#3d3937]';

export function StatusDialog({
  client,
  onClose,
  onSaved,
}: {
  client: AppClient;
  onClose: () => void;
  onSaved: (client: AppClient) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pausing = client.is_active;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateClient(client.client_id, { is_active: !pausing }));
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się zmienić statusu klienta.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={pausing ? 'Wstrzymać dostawy?' : 'Wznowić dostawy?'}
      subtitle={client.name}
      closeDisabled={saving}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 font-auth">
        {pausing ? (
          <ul className={LIST_CLASS}>
            <li>Klient zniknie z listy punktów na trasach w Logistyce.</li>
            <li>Jego dane, zamówienia i historia zostają w systemie.</li>
            <li>Stałe zamówienia się nie zmieniają – jeśli dostawy mają ustać na stałe, zmień je w zakładce Zamówienia.</li>
          </ul>
        ) : (
          <p className="m-0 text-sm font-semibold leading-relaxed text-[#3d3937]">
            Klient wróci na listę punktów trasy {client.route_details.route_name}.
          </p>
        )}

        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="button" onClick={confirm} disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? 'Zapisywanie…' : pausing ? 'Wstrzymaj dostawy' : 'Wznów dostawy'}
          </button>
        </div>
      </div>
    </Modal>
  );
}