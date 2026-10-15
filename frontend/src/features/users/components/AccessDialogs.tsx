import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { deleteUser, updateUser, type StaffUser } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { apiErrorMessage } from '../lib/staff';
import { DANGER_BUTTON, ERROR_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../lib/formStyles';

const LIST_CLASS = 'm-0 pl-5 list-disc flex flex-col gap-1.5 text-sm font-semibold leading-relaxed text-[#3d3937]';

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      setBusy(false);
    }
  };

  return { busy, error, run };
}

export function BlockDialog({
  user,
  onClose,
  onSaved,
}: {
  user: StaffUser;
  onClose: () => void;
  onSaved: (user: StaffUser) => void;
}) {
  const { busy, error, run } = useAction();
  const blocking = user.is_active;

  const confirm = () =>
    run(async () => {
      onSaved(await updateUser(user.user_id, { is_active: !blocking }));
      onClose();
    }, blocking ? 'Nie udało się zablokować konta.' : 'Nie udało się odblokować konta.');

  return (
    <Modal
      title={blocking ? 'Zablokować dostęp?' : 'Odblokować dostęp?'}
      subtitle={`${user.full_name} · ${user.username}`}
      closeDisabled={busy}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 font-auth">
        {blocking ? (
          <ul className={LIST_CLASS}>
            <li>Zostanie od razu wylogowany ze wszystkich urządzeń.</li>
            <li>Nie zaloguje się, dopóki nie odblokujesz konta.</li>
            <li>Jego dostawy, zwroty i historia zostają w systemie.</li>
          </ul>
        ) : (
          <p className="m-0 text-sm font-semibold leading-relaxed text-[#3d3937]">
            Pracownik znowu będzie mógł się zalogować swoim dotychczasowym hasłem.
          </p>
        )}

        {blocking && user.routes.length > 0 && (
          <p className="m-0 flex gap-2.5 px-3.5 py-3 rounded-xl bg-[#fbe5bd] text-[13px] font-bold leading-relaxed text-[#5c3300]">
            <AlertTriangle aria-hidden className="w-[18px] h-[18px] shrink-0 mt-0.5" />
            Kierowca ma przypisane: {user.routes.join(', ')}. Po blokadzie przypisz je komuś innemu w zakładce Logistyka,
            żeby dostawy nie zostały bez kierowcy.
          </p>
        )}

        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="button" onClick={confirm} disabled={busy} className={blocking ? DANGER_BUTTON : PRIMARY_BUTTON}>
            {busy ? 'Zapisywanie…' : blocking ? 'Zablokuj dostęp' : 'Odblokuj dostęp'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DeleteDialog({
  user,
  onClose,
  onDeleted,
}: {
  user: StaffUser;
  onClose: () => void;
  onDeleted: (userId: number) => void;
}) {
  const { busy, error, run } = useAction();

  const confirm = () =>
    run(async () => {
      await deleteUser(user.user_id);
      onDeleted(user.user_id);
    }, 'Nie udało się usunąć konta.');

  return (
    <Modal
      title="Usunąć konto na stałe?"
      subtitle={`${user.full_name} · ${user.username}`}
      closeDisabled={busy}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 font-auth">
        <ul className={LIST_CLASS}>
          <li>Tego nie da się cofnąć.</li>
          <li>Dostawy, zwroty i wydatki zostaną w systemie, ale bez przypisania do tej osoby.</li>
          <li>Jego powiadomienia zostaną usunięte. Dziennik zmian zachowa imię i nazwisko.</li>
        </ul>
        <p className="m-0 text-[13px] font-bold text-[#3d3937]">
          Jeśli pracownik odchodzi, zwykle wystarczy zablokować dostęp.
        </p>

        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="button" onClick={confirm} disabled={busy} className={DANGER_BUTTON}>
            {busy ? 'Usuwanie…' : 'Usuń konto'}
          </button>
        </div>
      </div>
    </Modal>
  );
}