import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Inbox, PenSquare, User, X } from 'lucide-react';
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

  const currentUserId = getCurrentUserId();

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
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark flex items-center gap-2">
            <Bell className="w-5 h-5 text-bakery-accent" /> Powiadomienia
          </h1>
          <p className="text-xs text-gray-500 font-medium">
            {unreadCount > 0 ? `Masz ${unreadCount} nieprzeczytane powiadomienie${unreadCount === 1 ? '' : 'a'}.` : 'Wszystko przeczytane.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-bakery-inactive p-1 rounded border border-bakery-btnBorder shadow-sm">
            <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${filter === 'all' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}>
              Wszystkie
            </button>
            <button onClick={() => setFilter('unread')} className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${filter === 'unread' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}>
              Nieprzeczytane {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          <button
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded shadow-2xs hover:bg-[#dcd8d8] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
          >
            <CheckCheck className="w-4 h-4" /> Oznacz wszystkie
          </button>

          <button
            onClick={handleOpenCompose}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98]"
          >
            <PenSquare className="w-4 h-4 text-bakery-accent" /> Nowa wiadomość
          </button>
        </div>
      </div>

      <hr className="border-0 border-t border-bakery-border my-1" />

      <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto divide-y divide-bakery-btnBorder">
          {isLoading ? (
            <p className="p-8 text-center text-xs text-gray-500 font-semibold">Ładowanie danych z bazy...</p>
          ) : visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <Inbox className="w-10 h-10" />
              <p className="text-sm font-semibold m-0">
                {filter === 'unread' ? 'Brak nieprzeczytanych powiadomień.' : 'Brak powiadomień.'}
              </p>
            </div>
          ) : (
            visibleNotifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleMarkOne(n)}
                className={`w-full text-left px-5 py-3.5 flex items-start gap-3 transition hover:bg-bakery-rowBg ${n.is_read ? 'bg-bakery-inactive' : 'bg-bakery-rowBg'}`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-red-600'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-bold ${n.is_read ? 'text-gray-600' : 'text-bakery-dark'}`}>{n.title}</span>
                    <span className="text-[11px] text-gray-400 font-semibold font-mono whitespace-nowrap">{formatDateTime(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-gray-400 font-semibold mt-1 flex items-center gap-1">
                    <User className="w-3 h-3" /> {n.sender_name ? `Od: ${n.sender_name}` : 'System'}
                  </span>
                </div>
                {!n.is_read && (
                  <span className="text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded shrink-0">
                    Nowe
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {isComposeOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <form onSubmit={handleSendMessage} className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col">

            <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <PenSquare className="w-4 h-4 text-bakery-accent" /> Nowa wiadomość
              </h2>
              <button type="button" onClick={() => setIsComposeOpen(false)} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Odbiorca</label>
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(Number(e.target.value))}
                  className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none cursor-pointer focus:border-bakery-accent"
                  required
                >
                  <option value="" disabled>Wybierz użytkownika...</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Tytuł</label>
                <input
                  type="text"
                  placeholder="np. Zmiana godzin dostawy"
                  value={msgTitle}
                  onChange={(e) => setMsgTitle(e.target.value)}
                  className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Treść wiadomości</label>
                <textarea
                  rows={4}
                  placeholder="Wpisz treść wiadomości..."
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent resize-none"
                  required
                />
              </div>
            </div>

            <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2 shrink-0">
              <button type="submit" disabled={isSending} className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed">
                {isSending ? 'Wysyłanie...' : 'Wyślij wiadomość'}
              </button>
              <button type="button" onClick={() => setIsComposeOpen(false)} className="px-4 py-2 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition">
                Anuluj
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
