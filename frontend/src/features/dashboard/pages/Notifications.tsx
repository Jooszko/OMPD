import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, Inbox, PenSquare, User, X } from 'lucide-react';
import { ActionToast, type ActionToastData } from '../components/ActionToast';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  fetchUsers,
  sendMessage,
  getCurrentUserId,
  type AppNotification,
  type AppUser,
} from '../../../services/api';

const CHIP = 'min-h-10 px-4 rounded-full text-[13px] font-extrabold transition-colors';
const ACTION_BUTTON =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-[13px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const FIELD =
  'w-full rounded-xl border border-bakery-btnBorder bg-white px-3 py-2.5 text-sm font-semibold text-bakery-dark outline-none placeholder:text-[#8a8482] focus:border-bakery-accent focus:ring-2 focus:ring-bakery-accent/20';

function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const [users, setUsers] = useState<AppUser[]>([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<number | ''>('');
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<ActionToastData | null>(null);

  const currentUserId = getCurrentUserId();
  const closeToast = useCallback(() => setToast(null), []);

  const load = () => {
    fetchNotifications()
      .then((data) => {
        setNotifications(data.results);
        setUnreadCount(data.unread_count);
      })
      .catch((err) => console.error('Błąd podczas ładowania powiadomień:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkOne = async (notification: AppNotification) => {
    if (notification.is_read) return;
    try {
      await markNotificationRead(notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Błąd podczas oznaczania powiadomienia:', err);
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Błąd podczas oznaczania powiadomień:', err);
    }
  };

  const handleOpenCompose = async () => {
    setIsComposeOpen(true);
    setRecipientId('');
    setMsgTitle('');
    setMsgBody('');
    if (users.length === 0) {
      try {
        const data = await fetchUsers();
        setUsers(data.filter((u) => u.user_id !== currentUserId));
      } catch (err) {
        console.error('Błąd podczas ładowania listy użytkowników:', err);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !msgTitle.trim() || !msgBody.trim()) {
      alert('Wybierz odbiorcę oraz uzupełnij tytuł i treść wiadomości.');
      return;
    }
    setIsSending(true);
    try {
      await sendMessage(recipientId, msgTitle.trim(), msgBody.trim());
      setIsComposeOpen(false);
      setToast({ variant: 'success', text: 'Wiadomość została wysłana.' });
      load();
    } catch (err) {
      console.error('Błąd podczas wysyłania wiadomości:', err);
      alert('Nie udało się wysłać wiadomości.');
    } finally {
      setIsSending(false);
    }
  };

  const visibleNotifications = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em] flex items-center gap-2">
            <Bell aria-hidden className="size-6 text-bakery-accent" /> Powiadomienia
          </h1>
          <p className="m-0 text-sm font-medium text-[#5f5a58]">
            {unreadCount > 0 ? `Nieprzeczytane: ${unreadCount}` : 'Wszystko przeczytane.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtr powiadomień" className="flex gap-0.5 rounded-xl border border-bakery-btnBorder bg-bakery-card p-1 shadow-sm">
            <button
              type="button"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`${CHIP} ${filter === 'all' ? 'bg-bakery-dark text-white shadow-sm' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
            >
              Wszystkie
            </button>
            <button
              type="button"
              aria-pressed={filter === 'unread'}
              onClick={() => setFilter('unread')}
              className={`${CHIP} ${filter === 'unread' ? 'bg-bakery-dark text-white shadow-sm' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
            >
              Nieprzeczytane{unreadCount > 0 && ` (${unreadCount})`}
            </button>
          </div>

          <button
            type="button"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className={`${ACTION_BUTTON} border-bakery-btnBorder bg-bakery-card text-bakery-dark hover:bg-bakery-rowBg`}
          >
            <CheckCheck aria-hidden className="size-4" /> Oznacz wszystkie
          </button>

          <button
            type="button"
            onClick={handleOpenCompose}
            className={`${ACTION_BUTTON} border-bakery-dark bg-bakery-dark text-white hover:bg-[#2e2e2e]`}
          >
            <PenSquare aria-hidden className="size-4 text-bakery-accent" /> Nowa wiadomość
          </button>
        </div>
      </div>

      <section aria-label="Lista powiadomień" className="rounded-[14px] border border-bakery-btnBorder bg-bakery-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-bakery-btnBorder px-4 sm:px-5 py-3">
          <h2 className="m-0 text-sm font-extrabold">Skrzynka odbiorcza</h2>
          <span className="text-xs font-bold text-[#5f5a58]">
            {visibleNotifications.length} {visibleNotifications.length === 1 ? 'powiadomienie' : 'powiadomień'}
          </span>
        </div>
        <div className="flex flex-col divide-y divide-bakery-btnBorder">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-5" aria-label="Ładowanie powiadomień">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-[68px] rounded-xl bg-bakery-inactive animate-pulse" />
              ))}
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-[#5f5a58]">
              <span className="flex size-14 items-center justify-center rounded-full bg-bakery-inactive">
                <Inbox aria-hidden className="size-7 text-[#77716e]" />
              </span>
              <p className="m-0 text-sm font-bold">
                {filter === 'unread' ? 'Brak nieprzeczytanych powiadomień.' : 'Brak powiadomień.'}
              </p>
            </div>
          ) : (
            visibleNotifications.map((n) => (
              <button
                key={n.id}
                type="button"
                aria-label={`${n.is_read ? '' : 'Nieprzeczytane: '}${n.title}. ${n.message}`}
                onClick={() => handleMarkOne(n)}
                className={`w-full text-left px-4 sm:px-5 py-4 flex items-start gap-3 transition-colors hover:bg-bakery-rowBg ${
                  n.is_read ? 'bg-bakery-card' : 'bg-white border-l-[3px] border-l-bakery-accent'
                }`}
              >
                <span className={`mt-1.5 size-2 rounded-full shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-bakery-accent'}`} />
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <span className={`text-sm font-extrabold ${n.is_read ? 'text-[#5f5a58]' : 'text-bakery-dark'}`}>{n.title}</span>
                    <span className="text-[11px] text-[#77716e] font-semibold tabular-nums sm:whitespace-nowrap">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="m-0 text-[13px] text-[#4a4543] font-medium leading-relaxed">{n.message}</p>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#77716e] font-semibold">
                    <User aria-hidden className="size-3.5" /> {n.sender_name ? `Od: ${n.sender_name}` : 'System'}
                  </span>
                </div>
                {!n.is_read && (
                  <span className="mt-0.5 rounded-full bg-[#fbe5bd] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#7a4300] shrink-0">
                    Nowe
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </section>

      {isComposeOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSendMessage} className="bg-bakery-card border border-bakery-btnBorder rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">

            <div className="bg-bakery-dark text-white px-5 py-4 flex justify-between items-center shrink-0">
              <h2 className="m-0 font-display text-lg font-extrabold flex items-center gap-2">
                <PenSquare aria-hidden className="size-5 text-bakery-accent" /> Nowa wiadomość
              </h2>
              <button type="button" aria-label="Zamknij" onClick={() => setIsComposeOpen(false)} className="rounded-lg p-1.5 text-gray-300 hover:bg-white/10 hover:text-white transition">
                <X aria-hidden className="size-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-4">
              <div>
                <label className="text-xs font-extrabold text-[#5f5a58] block mb-1.5">Odbiorca</label>
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(Number(e.target.value))}
                  className={`${FIELD} cursor-pointer`}
                  required
                >
                  <option value="" disabled>Wybierz użytkownika...</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#5f5a58] block mb-1.5">Tytuł</label>
                <input
                  type="text"
                  placeholder="np. Zmiana godzin dostawy"
                  value={msgTitle}
                  onChange={(e) => setMsgTitle(e.target.value)}
                  className={FIELD}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#5f5a58] block mb-1.5">Treść wiadomości</label>
                <textarea
                  rows={4}
                  placeholder="Wpisz treść wiadomości..."
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className={`${FIELD} resize-none`}
                  required
                />
              </div>
            </div>

            <div className="bg-bakery-inactive px-5 py-3.5 border-t border-bakery-btnBorder flex flex-wrap-reverse justify-end gap-2 shrink-0">
              <button type="button" onClick={() => setIsComposeOpen(false)} className={`${ACTION_BUTTON} border-bakery-btnBorder bg-white text-bakery-dark hover:bg-bakery-rowBg`}>
                Anuluj
              </button>
              <button type="submit" disabled={isSending} className={`${ACTION_BUTTON} border-bakery-dark bg-bakery-dark text-white hover:bg-[#2e2e2e]`}>
                {isSending ? 'Wysyłanie...' : 'Wyślij wiadomość'}
              </button>
            </div>

          </form>
        </div>
      )}

      <ActionToast toast={toast} onClose={closeToast} onRefresh={closeToast} />
    </div>
  );
}
