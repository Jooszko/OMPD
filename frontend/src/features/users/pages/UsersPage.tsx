import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { fetchStaff, getCurrentUserId, type StaffUser } from '../../../services/api';
import { BlockDialog, DeleteDialog } from '../components/AccessDialogs';
import { PasswordDialog } from '../components/PasswordDialog';
import { StaffFormDialog } from '../components/StaffFormDialog';
import { StaffList } from '../components/StaffList';
import { StaffPanel } from '../components/StaffPanel';
import { StaffTiles } from '../components/StaffTiles';
import {
  apiErrorMessage,
  filterCounts,
  matchesFilter,
  matchesQuery,
  sortStaff,
  type StaffFilter,
  type StaffSort,
} from '../lib/staff';

type StaffDialog =
  | { kind: 'create'; createdId?: number }
  | { kind: 'edit' | 'password' | 'block' | 'delete'; userId: number };

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StaffFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<StaffSort>('name');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<StaffDialog | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const currentUserId = getCurrentUserId();

  useEffect(() => {
    let cancelled = false;
    fetchStaff()
      .then((data) => {
        if (!cancelled) setUsers(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Nie udało się pobrać listy pracowników.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => sortStaff((users ?? []).filter((user) => matchesFilter(user, filter) && matchesQuery(user, query)), sort),
    [users, filter, query, sort]
  );

  const selected = users?.find((user) => user.user_id === selectedId) ?? null;
  const dialogUser = dialog && dialog.kind !== 'create' ? (users?.find((user) => user.user_id === dialog.userId) ?? null) : null;
  const takenLogins = (users ?? [])
    .filter((user) => user.user_id !== dialogUser?.user_id)
    .map((user) => user.username.toLowerCase());

  const saveUser = (saved: StaffUser) => {
    setUsers((current) => {
      if (!current) return current;
      return current.some((user) => user.user_id === saved.user_id)
        ? current.map((user) => (user.user_id === saved.user_id ? saved : user))
        : [...current, saved];
    });
    setHistoryVersion((value) => value + 1);
  };

  const closeDialog = () => {
    if (dialog?.kind === 'create' && dialog.createdId) setSelectedId(dialog.createdId);
    setDialog(null);
  };

  const removeUser = (userId: number) => {
    setUsers((current) => current && current.filter((user) => user.user_id !== userId));
    setDialog(null);
    setSelectedId(null);
  };

  const clearFilters = () => {
    setFilter('all');
    setQuery('');
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Użytkownicy</h1>
          <p className="m-0 text-sm text-[#4a4543]">Konta pracowników, role i dostęp do systemu.</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ kind: 'create' })}
          className="inline-flex items-center gap-2 min-h-11 px-[18px] rounded-xl bg-bakery-dark text-white text-sm font-extrabold"
        >
          <UserPlus aria-hidden className="w-[18px] h-[18px] text-bakery-accent" />
          Dodaj pracownika
        </button>
      </div>

      {loadError && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fbdcdc] text-sm font-semibold text-[#991b1b]">
          {loadError}
        </p>
      )}

      {!users && !loadError && (
        <div className="flex flex-col gap-4" aria-label="Wczytywanie pracowników">
          <div className="hidden sm:grid grid-cols-3 xl:grid-cols-6 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[104px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
            ))}
          </div>
          <div className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" />
        </div>
      )}

      {users && (
        <>
          <StaffTiles counts={filterCounts(users)} value={filter} onChange={setFilter} />

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex-[1_1_280px] flex items-center gap-2.5 min-h-11 px-3.5 rounded-xl border border-bakery-btnBorder bg-white focus-within:border-bakery-accent">
              <Search aria-hidden className="w-[18px] h-[18px] text-[#5f5a58]" />
              <span className="sr-only">Szukaj pracownika</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj po imieniu, nazwisku lub loginie"
                className="flex-1 min-w-0 border-0 outline-none bg-transparent text-sm font-semibold text-bakery-dark"
              />
            </label>
            <label className="flex items-center gap-2 text-[13px] font-bold text-[#4a4543]">
              Sortuj
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as StaffSort)}
                className="min-h-11 px-3 rounded-xl border border-bakery-btnBorder bg-white text-[13px] font-bold text-bakery-dark"
              >
                <option value="name">alfabetycznie</option>
                <option value="last_login">wg ostatniego logowania</option>
              </select>
            </label>
            <span className="text-[13px] font-bold text-[#4a4543] tabular-nums">
              Pokazano {visible.length} z {users.length}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-6 flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold italic text-[#5f5a58]">Nikt nie pasuje do wyszukiwania.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-10 px-4 rounded-xl border border-bakery-btnBorder bg-white text-[13px] font-extrabold"
              >
                Wyczyść filtry
              </button>
            </div>
          ) : (
            <StaffList users={visible} currentUserId={currentUserId} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </>
      )}

      {selected && (
        <StaffPanel
          key={selected.user_id}
          user={selected}
          isMe={selected.user_id === currentUserId}
          historyVersion={historyVersion}
          paused={dialog !== null}
          onClose={() => setSelectedId(null)}
          onEdit={() => setDialog({ kind: 'edit', userId: selected.user_id })}
          onPassword={() => setDialog({ kind: 'password', userId: selected.user_id })}
          onToggleBlock={() => setDialog({ kind: 'block', userId: selected.user_id })}
          onDelete={() => setDialog({ kind: 'delete', userId: selected.user_id })}
        />
      )}

      {dialog?.kind === 'create' && (
        <StaffFormDialog
          mode={{ kind: 'create' }}
          takenLogins={takenLogins}
          isMe={false}
          onClose={closeDialog}
          onSaved={(saved) => {
            saveUser(saved);
            setDialog({ kind: 'create', createdId: saved.user_id });
          }}
        />
      )}
      {dialog?.kind === 'edit' && dialogUser && (
        <StaffFormDialog
          mode={{ kind: 'edit', user: dialogUser }}
          takenLogins={takenLogins}
          isMe={dialogUser.user_id === currentUserId}
          onClose={closeDialog}
          onSaved={saveUser}
        />
      )}
      {dialog?.kind === 'password' && dialogUser && (
        <PasswordDialog user={dialogUser} onClose={closeDialog} onSaved={saveUser} />
      )}
      {dialog?.kind === 'block' && dialogUser && (
        <BlockDialog user={dialogUser} onClose={closeDialog} onSaved={saveUser} />
      )}
      {dialog?.kind === 'delete' && dialogUser && (
        <DeleteDialog user={dialogUser} onClose={closeDialog} onDeleted={removeUser} />
      )}
    </div>
  );
}