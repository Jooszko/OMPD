import React, { useState } from 'react';
import { Edit, Trash2, UserPlus, Shield, CheckCircle, XCircle, Key, X } from 'lucide-react';

interface User {
    user_id: number;
    username: string;
    password_hash: string;
    role: 'admin' | 'baker' | 'driver';
    full_name: string;
    is_active: boolean;
}

const MOCK_USERS: User[] = [
    { user_id: 1, username: 'mklukowski', password_hash: 'haslo123', role: 'admin', full_name: 'Mikołaj Klukowski', is_active: true },
    { user_id: 2, username: 'anowak', password_hash: 'piekarz2026', role: 'baker', full_name: 'Arkadiusz Nowak', is_active: true },
    { user_id: 3, username: 'jkrasinski', password_hash: 'kierowca1', role: 'driver', full_name: 'Jan Krasiński', is_active: true },
    { user_id: 4, username: 'kowalski_test', password_hash: 'start123', role: 'baker', full_name: 'Tomasz Kowalski', is_active: false },
];

export default function UsersPanel() {
    const [users, setUsers] = useState<User[]>(MOCK_USERS);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'baker' | 'driver'>('baker');
    const [fullName, setFullName] = useState('');
    const [isActive, setIsActive] = useState(true);

    const getRoleLabel = (roleStr: 'admin' | 'baker' | 'driver') => {
        const labels = {
            admin: 'Administrator',
            baker: 'Piekarz',
            driver: 'Kierowca'
        };
        return labels[roleStr] ?? roleStr;
    };

    const handleOpenAdd = () => {
        setModalMode('add');
        setUsername('');
        setPassword('');
        setRole('baker');
        setFullName('');
        setIsActive(true);
        setIsModalOpen(true);
    };

    const handleOpenEdit = () => {
        const user = users.find(u => u.user_id === selectedUserId);
        if (user) {
            setModalMode('edit');
            setUsername(user.username);
            setPassword(user.password_hash);
            setRole(user.role);
            setFullName(user.full_name);
            setIsActive(user.is_active);
            setIsModalOpen(true);
        }
    };

    const handleSaveUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim() || !fullName.trim()) {
            alert('Wszystkie pola formularza muszą zostać uzupełnione.');
            return;
        }

        if (modalMode === 'add') {
            if (users.some(u => u.username.toLowerCase() === username.trim().toLowerCase())) {
                alert('Użytkownik o takim loginie (username) już istnieje w systemie.');
                return;
            }
            const newUser: User = {
                user_id: Date.now(),
                username: username.trim(),
                password_hash: password,
                role,
                full_name: fullName.trim(),
                is_active: isActive
            };
            setUsers([...users, newUser]);
        } else {
            setUsers(users.map(u => u.user_id === selectedUserId ? {
                ...u,
                username: username.trim(),
                password_hash: password,
                role,
                full_name: fullName.trim(),
                is_active: isActive
            } : u));
        }
        setIsModalOpen(false);
        setSelectedUserId(null);
    };

    const handleDeleteUser = () => {
        if (confirm('Czy na pewno chcesz bezpowrotnie usunąć tego użytkownika z systemu ERP?')) {
            setUsers(users.filter(u => u.user_id !== selectedUserId));
            setSelectedUserId(null);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Zarządzanie Personelem</h1>
                    <p className="text-xs text-gray-500 font-medium">Zakładanie kont pracowników, przydział ról systemowych oraz aktywacja dostępów.</p>
                </div>
            </div>

            <hr className="border-0 border-t border-bakery-border my-1" />

            <div className="flex flex-col gap-4 w-full">
                <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[400px] flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-2">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-bakery-inactive z-10">
                                <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                                    <th className="py-2 px-3 w-12 text-center h-8">Wybór</th>
                                    <th className="py-2 px-3 h-8">Imię i Nazwisko</th>
                                    <th className="py-2 px-3 h-8">Nazwa użytkownika</th>
                                    <th className="py-2 px-3 h-8 text-center">Rola systemowa</th>
                                    <th className="py-2 px-3 h-8 text-center">Dostęp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bakery-btnBorder text-sm">
                                {users.map((user) => (
                                    <tr key={user.user_id} className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedUserId === user.user_id ? 'bg-[#c9c3c3]' : ''}`}>
                                        <td className="py-2 px-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedUserId === user.user_id}
                                                onChange={() => setSelectedUserId(selectedUserId === user.user_id ? null : user.user_id)}
                                                className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                                            />
                                        </td>
                                        <td className="py-2 px-3 font-bold text-bakery-dark">{user.full_name}</td>
                                        <td className="py-2 px-3 font-semibold text-gray-600 font-mono text-xs">{user.username}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${user.role === 'admin' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                    user.role === 'baker' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                        'bg-gray-200 text-gray-700 border-gray-300'
                                                }`}>
                                                {getRoleLabel(user.role)}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {user.is_active ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                        <CheckCircle className="w-3 h-3" /> Aktywny
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                                        <XCircle className="w-3 h-3" /> Zablokowany
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex gap-2 items-center bg-bakery-inactive p-3 rounded border border-bakery-btnBorder shadow-sm">
                    <button
                        onClick={handleOpenAdd}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98]"
                    >
                        <UserPlus className="w-4 h-4 text-bakery-accent" /> Utwórz Użytkownika
                    </button>

                    <button
                        onClick={handleOpenEdit}
                        disabled={!selectedUserId}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded shadow-2xs hover:bg-[#dcd8d8] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
                    >
                        <Edit className="w-4 h-4" /> Edytuj
                    </button>

                    <button
                        onClick={handleDeleteUser}
                        disabled={!selectedUserId}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-50 border border-red-200 text-red-700 rounded shadow-2xs hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
                    >
                        <Trash2 className="w-4 h-4" /> Usuń konto
                    </button>

                    {!selectedUserId && (
                        <span className="text-[10px] text-gray-500 font-semibold ml-2 italic">Zaznacz pracownika z listy powyżej, aby zmodyfikować jego uprawnienia lub zablokować dostęp do systemu.</span>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
                    <form onSubmit={handleSaveUser} className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col">

                        <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
                            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4 text-bakery-accent" />
                                {modalMode === 'add' ? 'Rejestracja Nowego Pracownika' : 'Modyfikacja Profilu Użytkownika'}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Imię i Nazwisko</label>
                                <input
                                    type="text"
                                    placeholder="np. Jan Kowalski"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Identyfikator logowania</label>
                                <input
                                    type="text"
                                    placeholder="np. jkowalski"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent font-mono"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Hasło startowe</label>
                                <input
                                    type="text"
                                    placeholder="Wpisz hasło tymczasowe"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-bold font-mono rounded text-xs p-2 outline-none focus:border-bakery-accent"
                                />
                                <span className="text-[9px] text-gray-400 font-medium block mt-1 flex items-center gap-1"><Key className="w-2.5 h-2.5" /> Pracownik otrzyma nakaz zmiany hasła przy pierwszym uwierzytelnieniu.</span>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Poziom uprawnień</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as 'admin' | 'baker' | 'driver')}
                                    className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none cursor-pointer focus:border-bakery-accent"
                                >
                                    <option value="admin">Administrator (Właściciel / Manager)</option>
                                    <option value="baker">Piekarz (Obsługa produkcji i receptur)</option>
                                    <option value="driver">Kierowca (Moduł logistyki i dostaw)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isActiveCheckbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                                />
                                <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-bakery-dark cursor-pointer select-none">
                                    Konto aktywne (Zezwól na logowanie do platformy)
                                </label>
                            </div>
                        </div>

                        <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2 shrink-0">
                            <button type="submit" className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition">
                                Zapisz zmiany w bazie
                            </button>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition">
                                Anuluj
                            </button>
                        </div>

                    </form>
                </div>
            )}

        </div>
    );
}