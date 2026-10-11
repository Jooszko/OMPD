import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Lock } from 'lucide-react';
import {
  changeInitialPassword,
  fetchCurrentUser,
  logoutUser,
  revokeSession,
  type AppUser,
} from '../../../services/api';
import { AuthLayout } from '../components/AuthLayout';
import { AuthAlert, AuthInput, AuthSubmitButton } from '../components/AuthControls';
import { passwordRules, passwordStrength } from '../lib/passwordRules';

const STRENGTH_LEVELS = [
  { label: '', color: 'rgba(255,236,214,0.14)' },
  { label: 'Słabe', color: '#fb923c' },
  { label: 'Średnie', color: '#fbbf24' },
  { label: 'Dobre', color: '#a3e635' },
  { label: 'Bardzo dobre', color: '#4ade80' },
];

const ROLE_LABELS: Record<AppUser['role'], string> = {
  admin: 'Kierownik',
  baker: 'Piekarz',
  driver: 'Kierowca',
};

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function SetPassword() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((current) => {
        if (!current.must_change_password) navigate('/', { replace: true });
        else setUser(current);
      })
      .catch(() => setError('Nie udało się pobrać danych konta. Odśwież stronę.'));
  }, [navigate]);

  const rules = passwordRules(password, repeat, user?.username ?? '');
  const allRulesMet = rules.every((rule) => rule.ok);
  const strength = passwordStrength(password);
  const level = STRENGTH_LEVELS[strength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allRulesMet || saving) return;
    setSaving(true);
    setError(null);
    try {
      await changeInitialPassword(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać hasła.');
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await revokeSession();
    logoutUser();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout
      eyebrow="Pierwsze logowanie"
      title="Witaj w zespole."
      subtitle="Jeszcze jeden krok – ustaw hasło, którego będziesz używać na co dzień."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        {user && (
          <div className="flex items-center gap-2.5 self-start rounded-full bg-white/[0.07] py-1 pl-1 pr-3.5">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#f49f1c] text-xs font-extrabold text-[#1c1410]">
              {initials(user.full_name)}
            </span>
            <span className="text-[13px] font-bold">{user.full_name}</span>
            <span className="text-[13px] font-semibold text-[#c9bcb0]">· {ROLE_LABELS[user.role]}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.025em] lg:text-[32px]">
            Ustaw własne hasło
          </h1>
          <p className="m-0 text-sm leading-relaxed text-[#c9bcb0]">
            Hasło od kierownika było tymczasowe. Nowe znasz tylko Ty.
          </p>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <div className="flex flex-col gap-2">
          <AuthInput
            id="new-password"
            label="Nowe hasło"
            icon={<Lock className="h-5 w-5" />}
            type="password"
            autoComplete="new-password"
            placeholder="Co najmniej 8 znaków"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={saving}
          />
          <div className="flex items-center gap-2.5" aria-live="polite">
            <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-[5px] rounded-full transition-colors"
                  style={{ background: i < strength ? level.color : STRENGTH_LEVELS[0].color }}
                />
              ))}
            </div>
            <span className="w-[88px] text-right text-xs font-bold" style={{ color: level.color }}>
              {level.label && `Siła: ${level.label}`}
            </span>
          </div>
        </div>

        <AuthInput
          id="repeat-password"
          label="Powtórz nowe hasło"
          icon={<Check className="h-5 w-5" />}
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          disabled={saving}
        />

        <ul aria-label="Wymagania hasła" className="m-0 grid list-none grid-cols-2 gap-x-3.5 gap-y-2 p-0 text-[13px]">
          {rules.map((rule) => (
            <li
              key={rule.label}
              className={`flex items-center gap-2 ${rule.ok ? 'font-bold text-[#bbf7d0]' : 'font-semibold text-[#c9bcb0]'}`}
            >
              {rule.ok ? (
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#4ade80]">
                  <Check className="h-[11px] w-[11px] text-[#10230f]" strokeWidth={3.5} aria-hidden />
                </span>
              ) : (
                <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2 border-[rgba(255,236,214,0.28)]" aria-hidden />
              )}
              {rule.label}
              <span className="sr-only">{rule.ok ? '– spełnione' : '– niespełnione'}</span>
            </li>
          ))}
        </ul>

        <AuthSubmitButton disabled={!allRulesMet || saving}>
          {saving ? 'Zapisywanie…' : 'Zapisz i zacznij pracę'}
          {!saving && <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />}
        </AuthSubmitButton>

        <button
          type="button"
          onClick={handleLogout}
          disabled={saving}
          className="-mt-1.5 min-h-11 self-center px-3 text-[13px] font-bold text-[#c9bcb0] transition hover:text-[#fff8f0]"
        >
          To nie moje konto – wyloguj
        </button>
      </form>
    </AuthLayout>
  );
}