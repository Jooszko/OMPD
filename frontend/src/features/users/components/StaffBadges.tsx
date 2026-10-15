import { Clock, Lock } from 'lucide-react';
import type { StaffUser } from '../../../services/api';
import { accountStatus, initials, ROLE_LABELS, type Role } from '../lib/staff';

const ROLE_TONES: Record<Role, string> = {
  admin: 'bg-[#dfe8f6] text-[#1d4f91]',
  baker: 'bg-[#fbe5bd] text-[#7a4300]',
  driver: 'bg-[#d7ece4] text-[#17604c]',
};

const AVATAR_SIZES = {
  md: 'w-10 h-10 text-[13px]',
  lg: 'w-16 h-16 text-[22px]',
};

export function Avatar({ user, size = 'md' }: { user: StaffUser; size?: keyof typeof AVATAR_SIZES }) {
  const tone = user.is_active ? ROLE_TONES[user.role] : 'bg-[#ebe7e7] text-[#5f5a58]';
  return (
    <span
      aria-hidden
      className={`${AVATAR_SIZES[size]} ${tone} shrink-0 rounded-full flex items-center justify-center font-extrabold`}
    >
      {initials(user.full_name)}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold ${ROLE_TONES[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadge({ user, pill = false }: { user: StaffUser; pill?: boolean }) {
  const status = accountStatus(user);
  if (status === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f8cccc] text-[#8f1616] text-xs font-extrabold">
        <Lock aria-hidden className="w-3.5 h-3.5" strokeWidth={2.6} />
        Zablokowany
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#fbe5bd] text-[#7a4300] text-xs font-extrabold">
        <Clock aria-hidden className="w-3.5 h-3.5" strokeWidth={2.6} />
        Czeka na 1. logowanie
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        pill
          ? 'px-2.5 py-0.5 rounded-full bg-[#cdebd5] text-[#17532b] text-xs font-extrabold'
          : 'text-[13px] font-bold text-[#1f5f33]'
      }`}
    >
      <span aria-hidden className="w-2 h-2 rounded-full bg-[#1f7a3a]" />
      Aktywny
    </span>
  );
}