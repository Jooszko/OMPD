import type { InputHTMLAttributes, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

export function AuthInput({
  id,
  label,
  icon,
  trailing,
  ...inputProps
}: {
  id: string;
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-bold text-[#f1e6da]">
        {label}
      </label>
      <div className="relative flex">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#b3a597]" aria-hidden>
          {icon}
        </span>
        <input
          id={id}
          {...inputProps}
          className={`h-[52px] w-full rounded-[14px] border-[1.5px] border-[rgba(255,236,214,0.14)] bg-white/[0.07] pl-12 text-base font-semibold text-[#fff8f0] outline-none transition placeholder:text-[#9c8f84] focus:border-[#f49f1c] focus:ring-4 focus:ring-[rgba(244,159,28,0.22)] ${
            trailing ? 'pr-14' : 'pr-4'
          }`}
        />
        {trailing && <span className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
    </div>
  );
}

export function AuthAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 whitespace-pre-line rounded-[14px] bg-[rgba(248,113,113,0.16)] px-3.5 py-3 text-sm font-semibold leading-snug text-[#fecaca]"
    >
      <CircleAlert className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export function AuthSubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-14 items-center justify-center gap-2.5 rounded-[14px] bg-[#f49f1c] text-base font-extrabold text-[#1c1410] transition hover:bg-[#ffad2e] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}