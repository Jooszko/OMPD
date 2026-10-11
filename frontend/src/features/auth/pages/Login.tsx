import { type FormEvent, type KeyboardEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUp, Eye, EyeOff, KeyRound, Lock, User } from 'lucide-react';
import { LoginError, SESSION_EXPIRED_KEY, loginUser, type AppUser } from '../../../services/api';
import { AuthLayout } from '../components/AuthLayout';
import { AuthAlert, AuthInput, AuthSubmitButton } from '../components/AuthControls';

const ROLE_HOME: Record<AppUser['role'], string> = {
  admin: '/',
  baker: '/',
  driver: '/logistics',
};

interface Notice {
  tone: 'error' | 'warn' | 'info';
  text: string;
}

function initialNotice(): Notice | null {
  try {
    if (sessionStorage.getItem(SESSION_EXPIRED_KEY)) {
      return { tone: 'info', text: 'Sesja wygasła. Zaloguj się ponownie, aby wrócić do pracy.' };
    }
  } catch {
    // brak dostępu do sessionStorage
  }
  return null;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(initialNotice);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    } catch {
      // brak dostępu do sessionStorage
    }
  }, []);

  const returnTo = (location.state as { from?: string } | null)?.from;

  const detectCapsLock = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setNotice(null);
    try {
      const data = await loginUser(username.trim(), password);
      if (data.must_change_password) navigate('/set-password', { replace: true });
      else navigate(returnTo ?? ROLE_HOME[data.role], { replace: true });
    } catch (err) {
      const isNetwork = err instanceof LoginError && err.code === 'network';
      setNotice({
        tone: isNetwork ? 'warn' : 'error',
        text: err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd logowania.',
      });
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Panel pracowników piekarni"
      title="Dzień dobry."
      subtitle="Zamówienia, produkcja, dostawy i finanse – wszystko w jednym miejscu."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-[22px]">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[28px] font-extrabold leading-none tracking-[-0.025em] lg:text-[36px]">
            Zaloguj się
          </h1>
          <p className="m-0 text-sm leading-relaxed text-[#c9bcb0] lg:text-[15px]">Użyj loginu i hasła od kierownika.</p>
        </div>

        {notice && <AuthAlert tone={notice.tone}>{notice.text}</AuthAlert>}

        <div className="flex flex-col gap-3.5">
          <AuthInput
            id="login-username"
            label="Login"
            icon={<User className="h-5 w-5" />}
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="np. jkowalski"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />

          <div className="flex flex-col gap-2">
            <AuthInput
              id="login-password"
              label="Hasło"
              icon={<Lock className="h-5 w-5" />}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Twoje hasło"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={detectCapsLock}
              onKeyUp={detectCapsLock}
              onBlur={() => setCapsLock(false)}
              disabled={loading}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                  aria-pressed={showPassword}
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#c9bcb0] transition hover:text-[#fff8f0]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            />
            {capsLock && (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[rgba(244,159,28,0.16)] px-2.5 py-1 text-xs font-bold text-[#fcd9a5]">
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                Caps Lock jest włączony
              </span>
            )}
          </div>
        </div>

        <AuthSubmitButton disabled={loading}>
          {loading ? 'Logowanie…' : 'Zaloguj się'}
          {!loading && <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />}
        </AuthSubmitButton>

        <p className="m-0 flex items-center gap-2.5 border-t border-[rgba(255,236,214,0.1)] pt-[18px] text-[13px] leading-snug text-[#c9bcb0]">
          <KeyRound className="h-[18px] w-[18px] shrink-0 text-[#f7b64f]" aria-hidden />
          <span>
            <strong className="text-[#fff8f0]">Nie pamiętasz hasła?</strong> Poproś kierownika o reset.
          </span>
        </p>
      </form>
    </AuthLayout>
  );
}