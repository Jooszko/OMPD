import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { KeyRound, Lock, LockOpen, Pencil, Route as RouteIcon, X } from 'lucide-react';
import type { StaffUser } from '../../../services/api';
import { useDialogFocus } from '../../dashboard/components/useDialogFocus';
import { formatJoined, formatLastLogin } from '../lib/staff';
import { AccountHistory } from './AccountHistory';
import { Avatar, RoleBadge, StatusBadge } from './StaffBadges';

const SECTION_TITLE = 'm-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[#5f5a58]';
const ACTION =
  'min-h-12 px-3 flex items-center justify-center gap-2 rounded-xl border text-sm font-extrabold transition';

export function StaffPanel({
  user,
  isMe,
  historyVersion,
  paused,
  onClose,
  onEdit,
  onPassword,
  onToggleBlock,
  onDelete,
}: {
  user: StaffUser;
  isMe: boolean;
  historyVersion: number;
  paused: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPassword: () => void;
  onToggleBlock: () => void;
  onDelete: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  useDialogFocus(panelRef, onClose, { paused });

  return createPortal(
    <div className="fixed inset-0 z-[1800] flex justify-end bg-black/35" onClick={onClose}>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[480px] h-full bg-bakery-card shadow-2xl flex flex-col font-auth text-bakery-dark"
      >
        <div className="px-5 sm:px-6 pt-4 pb-5 bg-bakery-dark text-white flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#cfc8c4]">
              Karta pracownika
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zamknij kartę"
              className="w-11 h-11 -mr-3 flex items-center justify-center text-white"
            >
              <X aria-hidden className="w-[22px] h-[22px]" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <Avatar user={user} size="lg" />
            <div className="min-w-0 flex flex-col gap-1">
              <h2 id={titleId} className="m-0 font-display text-[26px] leading-tight font-extrabold break-words">
                {user.full_name}
              </h2>
              <span className="font-mono text-[13px] text-[#cfc8c4]">{user.username}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RoleBadge role={user.role} />
            <StatusBadge user={user} pill />
            {isMe && (
              <span className="px-2.5 py-0.5 rounded-full bg-white text-bakery-dark text-xs font-extrabold">to Ty</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onEdit}
              className={`${ACTION} ${isMe ? 'col-span-2' : ''} border-bakery-btnBorder bg-white text-bakery-dark hover:border-bakery-dark`}
            >
              <Pencil aria-hidden className="w-4 h-4" />
              Edytuj dane
            </button>
            {!isMe && (
              <>
                <button
                  type="button"
                  onClick={onPassword}
                  className={`${ACTION} border-bakery-btnBorder bg-white text-bakery-dark hover:border-bakery-dark`}
                >
                  <KeyRound aria-hidden className="w-4 h-4" />
                  Hasło tymczasowe
                </button>
                {user.is_active ? (
                  <button
                    type="button"
                    onClick={onToggleBlock}
                    className={`${ACTION} col-span-2 border-[#e3a3a3] bg-[#fdf1f1] text-[#8f1616] hover:border-[#b91c1c]`}
                  >
                    <Lock aria-hidden className="w-4 h-4" />
                    Zablokuj dostęp
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleBlock}
                    className={`${ACTION} col-span-2 border-[#9fd0ad] bg-[#eef8f0] text-[#17532b] hover:border-[#1f7a3a]`}
                  >
                    <LockOpen aria-hidden className="w-4 h-4" />
                    Odblokuj dostęp
                  </button>
                )}
              </>
            )}
          </div>
          <section className="flex flex-col gap-2.5">
            <h3 className={SECTION_TITLE}>Dostęp</h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-4 py-3.5 rounded-xl bg-white border border-[#e6e1df] text-sm">
              <dt className="font-bold text-[#5f5a58]">Ostatnie logowanie</dt>
              <dd className="m-0 font-extrabold text-right">{formatLastLogin(user.last_login)}</dd>
              <dt className="font-bold text-[#5f5a58]">Hasło</dt>
              <dd className="m-0 font-extrabold text-right">
                {user.must_change_password ? 'tymczasowe – czeka na zmianę' : 'ustawione przez pracownika'}
              </dd>
              <dt className="font-bold text-[#5f5a58]">Konto od</dt>
              <dd className="m-0 font-extrabold text-right">{formatJoined(user.date_joined)}</dd>
            </dl>
          </section>

          {(user.role === 'driver' || user.routes.length > 0) && (
            <section className="flex flex-col gap-2.5">
              <h3 className={SECTION_TITLE}>Przypisane trasy</h3>
              {user.routes.length > 0 ? (
                <ul className="m-0 p-0 list-none flex flex-col gap-2">
                  {user.routes.map((route) => (
                    <li
                      key={route}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-[#e6e1df] text-[15px] font-extrabold"
                    >
                      <RouteIcon aria-hidden className="w-5 h-5 text-[#17604c]" />
                      {route}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm font-semibold italic text-[#5f5a58]">Brak przypisanej trasy.</p>
              )}
              <p className="m-0 text-xs font-semibold text-[#5f5a58]">
                Kierowców do tras przypisuje się w zakładce{' '}
                <Link to="/logistics" className="font-extrabold text-bakery-dark">
                  Logistyka
                </Link>
                .
              </p>
            </section>
          )}

          <AccountHistory objectId={user.user_id} label={user.full_name} version={historyVersion} />

          {!isMe && (
            <section className="mt-auto p-4 rounded-xl border border-dashed border-[#d9a3a3] flex flex-col gap-2.5">
              <h3 className="m-0 text-sm font-extrabold text-[#8f1616]">Usunięcie konta</h3>
              <p className="m-0 text-[13px] leading-relaxed font-semibold text-[#4a4543]">
                Nieodwracalne. Jeśli pracownik odchodzi, lepiej zablokować dostęp – dostawy i historia nadal będą
                przypisane do niego.
              </p>
              <button
                type="button"
                onClick={onDelete}
                className="self-start min-h-10 px-3.5 rounded-[10px] border border-[#e3a3a3] text-[13px] font-extrabold text-[#8f1616] hover:bg-[#fdf1f1]"
              >
                Usuń konto na stałe…
              </button>
            </section>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}