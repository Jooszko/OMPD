import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
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

interface NotificationBellProps {
  variant?: 'sidebar' | 'header';
  collapsed?: boolean;
}

export function NotificationBell({ variant = 'sidebar', collapsed = false }: NotificationBellProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 320 });
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
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
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
      const width = Math.min(320, window.innerWidth - 16);
      const maxLeft = window.innerWidth - width - 8;
      if (variant === 'header') {
        setPanelPos({ top: rect.bottom + 8, left: Math.max(8, Math.min(rect.right - width, maxLeft)), width });
      } else {
        setPanelPos({ top: rect.top, left: Math.max(8, Math.min(rect.right + 8, maxLeft)), width });
      }
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

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);
  const label = unreadCount > 0 ? `Powiadomienia, nieprzeczytane: ${unreadCount}` : 'Powiadomienia';
  const highlighted = isOpen || pathname === '/notifications';

  return (
    <>
      {variant === 'header' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          aria-label={label}
          aria-expanded={isOpen}
          className="relative size-11 flex items-center justify-center rounded-xl text-white transition hover:bg-white/10"
        >
          <Bell aria-hidden className="size-[22px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-extrabold leading-none">
              {badge}
            </span>
          )}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          aria-label={label}
          aria-expanded={isOpen}
          title={collapsed ? label : undefined}
          className={`relative w-full min-h-[38px] flex items-center gap-3 px-3 rounded-[11px] text-sm transition ${collapsed ? 'justify-center' : ''} ${
            highlighted
              ? 'bg-bakery-accent text-bakery-dark font-extrabold'
              : 'text-[#d9d2cf] font-bold hover:bg-[#262221] hover:text-white'
          }`}
        >
          <Bell aria-hidden className={`size-5 shrink-0 ${highlighted ? 'text-bakery-dark' : 'text-[#bdb5b2]'}`} />
          {!collapsed && <span className="flex-1 text-left">Powiadomienia</span>}
          {unreadCount > 0 && (
            <span
              className={`min-w-[18px] h-[18px] px-[5px] flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-extrabold leading-none ${
                collapsed ? 'absolute top-1.5 right-2' : ''
              }`}
            >
              {badge}
            </span>
          )}
        </button>
      )}

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
            className="fixed max-h-96 flex flex-col bg-bakery-card border border-bakery-btnBorder rounded-2xl shadow-xl z-50 overflow-hidden font-auth text-bakery-dark"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#3d3937] bg-bakery-dark text-white shrink-0">
              <span className="text-sm font-extrabold uppercase tracking-wide">Powiadomienia</span>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-1.5 min-h-8 px-2 rounded-lg text-[11px] font-extrabold text-bakery-accent hover:bg-white/10 hover:text-white disabled:text-gray-500 disabled:hover:bg-transparent disabled:cursor-not-allowed transition"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Oznacz wszystkie
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#e6e1df]">
              {notifications.length === 0 ? (
                <p className="m-0 p-5 text-center text-sm text-[#5f5a58] font-semibold">Brak powiadomień.</p>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleMarkOne(n)}
                    className={`w-full text-left p-4 flex flex-col gap-1 transition hover:bg-bakery-rowBg ${
                      n.is_read ? 'bg-bakery-card' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[13px] font-extrabold ${n.is_read ? 'text-[#5f5a58]' : 'text-bakery-dark'}`}>
                        {n.title}
                      </span>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />}
                    </div>
                    <p className="m-0 text-xs text-[#4a4543] font-medium leading-snug">{n.message}</p>
                    <span className="text-[11px] text-[#77716e] font-semibold mt-0.5">
                      {n.sender_name ? `Od: ${n.sender_name}` : 'System'} · {formatRelativeTime(n.created_at)}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={handleOpenFullPage}
              className="flex items-center justify-center gap-2 min-h-11 px-3 text-xs font-extrabold text-bakery-dark bg-bakery-card hover:bg-[#efebe9] border-t border-bakery-btnBorder transition shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Zobacz wszystkie powiadomienia
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
