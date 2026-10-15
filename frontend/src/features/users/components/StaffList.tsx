import { ChevronRight } from 'lucide-react';
import type { StaffUser } from '../../../services/api';
import { accountStatus, formatLastLogin, groupByRole, ROLE_LABELS } from '../lib/staff';
import { Avatar, RoleBadge, StatusBadge } from './StaffBadges';

const COLUMNS = 'md:grid md:grid-cols-[minmax(240px,1.6fr)_120px_200px_170px_110px_24px] md:gap-3';

export function StaffList({
  users,
  currentUserId,
  selectedId,
  onSelect,
}: {
  users: StaffUser[];
  currentUserId: number | null;
  selectedId: number | null;
  onSelect: (userId: number) => void;
}) {
  return (
    <section className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden">
      <div
        aria-hidden
        className={`hidden ${COLUMNS} items-center px-5 py-3 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]`}
      >
        <span>Pracownik</span>
        <span>Rola</span>
        <span>Dostęp</span>
        <span>Ostatnie logowanie</span>
        <span>Trasa</span>
        <span />
      </div>

      {groupByRole(users).map((group) => (
        <div key={group.role} role="group" aria-label={group.title}>
          <h2 className="m-0 px-4 md:px-5 py-2.5 bg-[#efebe9] border-t border-[#e2dcda] text-xs font-extrabold uppercase tracking-[0.06em] text-[#3d3937]">
            {group.title} · {group.users.length}
          </h2>
          <ul className="m-0 p-0 list-none">
            {group.users.map((user) => {
              const isMe = user.user_id === currentUserId;
              const status = accountStatus(user);
              return (
                <li key={user.user_id} className="border-t border-[#e6e1df]">
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => onSelect(user.user_id)}
                    className={`w-full text-left flex ${COLUMNS} items-center gap-3 px-4 md:px-5 py-3 transition ${
                      selectedId === user.user_id ? 'bg-[#ebe4e1]' : 'hover:bg-[#f3efed]'
                    }`}
                  >
                    <span className="flex-1 min-w-0 flex items-center gap-3">
                      <Avatar user={user} />
                      <span className="min-w-0 flex flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span
                            className={`text-[15px] font-extrabold ${status === 'blocked' ? 'text-[#5f5a58]' : 'text-bakery-dark'}`}
                          >
                            {user.full_name}
                          </span>
                          {isMe && (
                            <span className="px-1.5 rounded-full bg-bakery-dark text-white text-[10px] font-extrabold uppercase tracking-[0.06em]">
                              to Ty
                            </span>
                          )}
                        </span>
                        <span className="hidden md:block font-mono text-xs text-[#5f5a58] truncate">{user.username}</span>
                        <span className="md:hidden text-xs font-semibold text-[#5f5a58]">
                          {ROLE_LABELS[user.role]} · {formatLastLogin(user.last_login)}
                        </span>
                        {status !== 'active' && (
                          <span className="md:hidden mt-1">
                            <StatusBadge user={user} />
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="hidden md:block">
                      <RoleBadge role={user.role} />
                    </span>
                    <span className="hidden md:block">
                      <StatusBadge user={user} />
                    </span>
                    <span className="hidden md:block text-[13px] font-semibold text-[#3d3937]">
                      {formatLastLogin(user.last_login)}
                    </span>
                    <span className="hidden md:block text-[13px] font-bold text-[#3d3937] truncate">
                      {user.routes.length > 0 ? user.routes.join(', ') : '—'}
                    </span>
                    <ChevronRight aria-hidden className="w-5 h-5 shrink-0 text-[#8a8482]" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}