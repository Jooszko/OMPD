import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '../../../services/api';

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'przed chwilą';
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} godz. temu`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} dni temu`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    fetchNotifications()
      .then((data) => {
        setNotifications(data.results);
        setUnreadCount(data.unread_count);
      })
      .catch((err) => console.error('Błąd podczas ładowania powiadomień:', err));
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.top, left: rect.right + 8 });
      loadNotifications();
    }
    setIsOpen((prev) => !prev);
  };

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

  const handleOpenFullPage = () => {
    setIsOpen(false);
    navigate('/notifications');
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

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={`relative w-full h-[40px] min-h-[40px] flex items-center justify-center gap-2 no-underline text-sm font-medium rounded shadow-sm transition-all duration-150 box-border shrink-0 ${
          isOpen
            ? 'bg-bakery-dark text-white border border-bakery-dark'
            : 'bg-bakery-inactive text-bakery-dark border border-bakery-btnBorder hover:bg-[#dcd8d8] active:scale-[0.99]'
        }`}
      >
        <Bell className="w-4 h-4" />
        <span>Powiadomienia</span>
        {unreadCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPos.top, left: panelPos.left }}
          className="fixed w-80 max-h-96 flex flex-col bg-bakery-inactive border border-bakery-border rounded shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-bakery-btnBorder bg-bakery-dark text-white shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider">Powiadomienia</span>
            <button
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-[10px] font-bold text-bakery-accent hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transition"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Oznacz wszystkie
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-bakery-btnBorder">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-xs text-gray-500 font-semibold italic">Brak powiadomień.</p>
            ) : (
              notifications.slice(0, 6).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleMarkOne(n)}
                  className={`w-full text-left p-3 flex flex-col gap-0.5 transition hover:bg-bakery-rowBg ${n.is_read ? 'bg-bakery-inactive' : 'bg-bakery-rowBg'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${n.is_read ? 'text-gray-600' : 'text-bakery-dark'}`}>{n.title}</span>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-gray-500 font-medium leading-snug">{n.message}</p>
                  <span className="text-[10px] text-gray-400 font-semibold mt-0.5">
                    {n.sender_name ? `Od: ${n.sender_name}` : 'System'} · {formatRelativeTime(n.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            onClick={handleOpenFullPage}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-bakery-dark bg-bakery-rowBg hover:bg-[#dcd8d8] border-t border-bakery-btnBorder transition shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Zobacz wszystkie powiadomienia
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
