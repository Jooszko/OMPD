import { type FormEvent, useState } from 'react';
import { updateUser, type StaffUser } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { apiErrorMessage, generatePassword } from '../lib/staff';
import { ERROR_CLASS, LABEL_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../lib/formStyles';
import { PasswordHandover, PasswordPicker } from './PasswordTools';

const EFFECTS = [
  'Przy najbliższym logowaniu pracownik ustawi własne hasło.',
  'Zostanie wylogowany ze wszystkich urządzeń.',
  'Zmiana trafi do dziennika zmian (bez samego hasła).',
];

export function PasswordDialog({
  user,
  onClose,
  onSaved,
}: {
  user: StaffUser;
  onClose: () => void;
  onSaved: (user: StaffUser) => void;
}) {
  const [password, setPassword] = useState(() => generatePassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateUser(user.user_id, { password }));
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się ustawić hasła.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Hasło tymczasowe"
      subtitle={`${user.full_name} · ${user.username}`}
      closeDisabled={saving}
      onClose={onClose}
    >
      {done ? (
        <div className="flex flex-col gap-4 font-auth">
          <PasswordHandover title="Hasło zostało ustawione." fullName={user.full_name} password={password} />
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
              Gotowe
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 font-auth">
          <div className={LABEL_CLASS}>
            <label htmlFor="temporary-password">Nowe hasło</label>
            <PasswordPicker id="temporary-password" value={password} onChange={setPassword} />
          </div>

          <ul className="m-0 px-4 py-3 list-disc list-inside rounded-xl bg-bakery-card border border-[#e6e1df] flex flex-col gap-1.5 text-[13px] font-semibold text-[#3d3937]">
            {EFFECTS.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>

          {error && (
            <p role="alert" className={ERROR_CLASS}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
              Anuluj
            </button>
            <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
              {saving ? 'Zapisywanie…' : 'Ustaw hasło'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}