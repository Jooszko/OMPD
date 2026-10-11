import type { ReactNode } from 'react';
import background from '../../../assets/login-background.jpg';

function BreadMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11c0-3.3 3.6-6 8-6s8 2.7 8 6c0 1.4-.9 2-2 2v5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-5c-1.1 0-2-.6-2-2z" />
      <path d="M10 9.5v3" />
      <path d="M14 9.5v3" />
    </svg>
  );
}

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#160e09] font-auth text-[#fff8f0]">
      <img src={background} alt="" className="absolute inset-0 h-full w-full object-cover object-[32%_45%]" />
      <div className="absolute inset-0 bg-linear-to-b from-[rgba(12,8,5,0.35)] via-[rgba(12,8,5,0.6)] to-[rgba(12,8,5,0.92)] lg:bg-linear-to-r lg:from-[rgba(12,8,5,0.55)] lg:via-[rgba(12,8,5,0.15)] lg:to-[rgba(12,8,5,0.45)]" />
      <div className="absolute inset-x-0 bottom-0 hidden h-[560px] bg-linear-to-t from-[rgba(12,8,5,0.9)] to-transparent lg:block" />

      <div className="relative z-10 flex min-h-dvh flex-col p-3 sm:p-6 lg:px-16 lg:py-12">
        <div className="flex items-center gap-3 px-2 pt-2 sm:px-0 sm:pt-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f49f1c] text-[#1c1410] lg:h-11 lg:w-11 lg:rounded-[14px]">
            <BreadMark />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight lg:text-2xl">OMPD</span>
        </div>

        <div className="flex flex-1 flex-col justify-end gap-6 pt-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:pt-0">
          <section className="flex flex-col gap-2 px-3 sm:px-0 lg:max-w-[640px] lg:gap-4 lg:self-end lg:pb-6">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#f7b64f] lg:text-[13px]">
              {eyebrow}
            </span>
            <h2 className="m-0 font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.03em] lg:text-[96px]">
              {title}
            </h2>
            <p className="m-0 hidden max-w-[520px] text-xl leading-relaxed text-[#eadfd4] lg:block">{subtitle}</p>
          </section>

          <main className="w-full shrink-0 rounded-[26px] border border-[rgba(255,236,214,0.12)] bg-[rgba(24,16,11,0.8)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-[18px] sm:mx-auto sm:max-w-[440px] lg:mx-0 lg:w-[440px] lg:rounded-[28px] lg:p-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}