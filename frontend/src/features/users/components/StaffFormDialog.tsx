import { type FormEvent, useState } from 'react';
import { createUser, updateUser, type StaffUser } from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { apiErrorMessage, generatePassword, ROLE_LABELS, suggestLogin, type Role } from '../lib/staff';
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../lib/formStyles';
import { PasswordHandover, PasswordPicker } from './PasswordTools';

export type StaffFormMode = { kind: 'create' } | { kind: 'edit'; user: StaffUser };

const ROLE_OPTIONS: { role: Role; hint: string; dot: string }[] = [
  { role: 'admin', hint: 'Pełny dostęp: finanse, użytkownicy, dziennik zmian, wszystkie moduły.', dot: 'bg-[#2a78d6]' },
  { role: 'baker', hint: 'Produkcja, zamówienia, produkty i receptury.', dot: 'bg-[#c98a0c]' },
  { role: 'driver', hint: 'Własne trasy, dostawy, zwroty i zgłaszanie problemów.', dot: 'bg-[#1b8a6b]' },
];

export function StaffFormDialog({
  mode,
  takenLogins,
  isMe,
  onClose,
  onSaved,
}: {
  mode: StaffFormMode;
  takenLogins: string[];
  isMe: boolean;
  onClose: () => void;
  onSaved: (user: StaffUser) => void;
}) {
  const editing = mode.kind === 'edit' ? mode.user : null;
  const [fullName, setFullName] = useState(editing?.full_name ?? '');
  const [username, setUsername] = useState(editing?.username ?? '');
  const [loginTouched, setLoginTouched] = useState(editing !== null);
  const [role, setRole] = useState<Role>(editing?.role ?? 'baker');
  const [password, setPassword] = useState(() => generatePassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<StaffUser | null>(null);

  const login = username.trim().toLowerCase();
  const loginTaken = login !== '' && takenLogins.includes(login);

  const changeFullName = (value: string) => {
    setFullName(value);
    if (!loginTouched) setUsername(suggestLogin(value, takenLogins));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !login) {
      setError('Uzupełnij imię i nazwisko oraz login.');
      return;
    }
    if (!editing && password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fields = { full_name: fullName.trim(), username: login, role };
      if (editing) {
        onSaved(await updateUser(editing.user_id, fields));
        onClose();
      } else {
        const user = await createUser({ ...fields, password });
        onSaved(user);
        setCreated(user);
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się zapisać konta.'));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Modal title="Konto utworzone" subtitle={`${created.full_name} · ${created.username}`} onClose={onClose}>
        <div className="flex flex-col gap-4 font-auth">
          <PasswordHandover title="Konto jest aktywne." fullName={created.full_name} password={password} />
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
              Gotowe
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={editing ? 'Edycja danych' : 'Nowy pracownik'}
      subtitle={editing ? editing.full_name : 'Konto będzie aktywne od razu.'}
      closeDisabled={saving}
      initialFocusSelector="#staff-full-name"
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4 font-auth">
        <label className={LABEL_CLASS}>
          Imię i nazwisko
          <input
            id="staff-full-name"
            type="text"
            autoComplete="off"
            value={fullName}
            onChange={(e) => changeFullName(e.target.value)}
            placeholder="np. Jan Kowalski"
            className={FIELD_CLASS}
          />
        </label>

        <label className={LABEL_CLASS}>
          Login
          <input
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => {
              setLoginTouched(true);
              setUsername(e.target.value);
            }}
            placeholder="np. jkowalski"
            aria-invalid={loginTaken}
            className={`${FIELD_CLASS} font-mono ${loginTaken ? 'border-[#b91c1c]' : ''}`}
          />
          <span className={`font-semibold ${loginTaken ? 'text-[#991b1b]' : 'text-[#5f5a58]'}`}>
            {loginTaken
              ? 'Ten login jest już zajęty.'
              : loginTouched
                ? 'Tym loginem pracownik będzie się logował.'
                : 'Podpowiedziany z imienia i nazwiska – można zmienić.'}
          </span>
        </label>

        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2" disabled={isMe}>
          <legend className="mb-2 text-xs font-extrabold text-[#3d3937]">Rola</legend>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.role}
              className={`flex items-start gap-3 px-3.5 py-3 rounded-xl bg-white cursor-pointer ${
                role === option.role ? 'border-2 border-bakery-dark' : 'border border-bakery-btnBorder'
              } ${isMe ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="staff-role"
                value={option.role}
                checked={role === option.role}
                onChange={() => setRole(option.role)}
                className="mt-0.5 w-[18px] h-[18px] accent-bakery-dark"
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-extrabold">
                  <span aria-hidden className={`w-2.5 h-2.5 rounded-full ${option.dot}`} />
                  {ROLE_LABELS[option.role]}
                </span>
                <span className="text-xs font-semibold text-[#5f5a58]">{option.hint}</span>
              </span>
            </label>
          ))}
          {isMe && <span className="text-xs font-semibold text-[#5f5a58]">Nie możesz zmienić własnej roli.</span>}
        </fieldset>

        {!editing && (
          <div className={LABEL_CLASS}>
            <label htmlFor="staff-password">Hasło startowe</label>
            <PasswordPicker id="staff-password" value={password} onChange={setPassword} />
          </div>
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
          <button type="submit" disabled={saving || loginTaken} className={PRIMARY_BUTTON}>
            {saving ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Utwórz konto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}