import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { generatePassword } from '../lib/staff';
import { FIELD_CLASS } from '../lib/formStyles';

const PASSWORD_BOX =
  'flex-1 min-w-0 h-12 px-3.5 flex items-center rounded-xl bg-bakery-dark text-white font-mono text-lg font-bold tracking-wide overflow-x-auto whitespace-nowrap';

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="h-12 px-4 shrink-0 inline-flex items-center gap-2 rounded-xl border border-bakery-btnBorder bg-white text-sm font-extrabold text-bakery-dark"
    >
      {state === 'copied' ? (
        <Check aria-hidden className="w-4 h-4 text-[#1f7a3a]" />
      ) : (
        <Copy aria-hidden className="w-4 h-4" />
      )}
      <span aria-live="polite">{state === 'copied' ? 'Skopiowano' : state === 'failed' ? 'Zaznacz ręcznie' : 'Kopiuj'}</span>
    </button>
  );
}

export function PasswordPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (password: string) => void;
}) {
  const [custom, setCustom] = useState(false);

  const toggle = () => {
    onChange(custom ? generatePassword() : '');
    setCustom(!custom);
  };

  return (
    <div className="flex flex-col gap-2">
      {custom ? (
        <input
          id={id}
          type="text"
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="co najmniej 8 znaków, nie same cyfry"
          className={`${FIELD_CLASS} font-mono`}
        />
      ) : (
        <div className="flex gap-2">
          <output id={id} className={PASSWORD_BOX}>
            {value}
          </output>
          <button
            type="button"
            aria-label="Wygeneruj inne hasło"
            onClick={() => onChange(generatePassword())}
            className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl border border-bakery-btnBorder bg-white text-bakery-dark"
          >
            <RefreshCw aria-hidden className="w-[18px] h-[18px]" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="self-start text-[13px] font-extrabold text-bakery-dark underline underline-offset-2"
      >
        {custom ? 'Wygeneruj automatycznie' : 'Wpisz własne hasło'}
      </button>
    </div>
  );
}

export function PasswordHandover({ title, fullName, password }: { title: string; fullName: string; password: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 px-3.5 py-2.5 rounded-xl bg-[#cdebd5] text-sm font-extrabold text-[#17532b]">{title}</p>
      <p className="m-0 text-sm font-semibold text-[#3d3937]">
        Przekaż hasło pracownikowi <strong className="text-bakery-dark">{fullName}</strong>. Po zamknięciu okna nie będzie
        już widoczne.
      </p>
      <div className="flex gap-2">
        <output className={PASSWORD_BOX}>{password}</output>
        <CopyButton text={password} />
      </div>
      <p className="m-0 text-xs font-semibold text-[#5f5a58]">Przy najbliższym logowaniu pracownik ustawi własne hasło.</p>
    </div>
  );
}