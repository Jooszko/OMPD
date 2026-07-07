import React, { useState } from 'react';
import { Plus, Edit, UserPlus, CheckCircle, XCircle, MapPin, X, FileText } from 'lucide-react';

interface Client {
    client_id: number;
    name: string;
    address: string;
    nip: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const MOCK_CLIENTS: Client[] = [
    { client_id: 101, name: 'Sklep Spożywczy "U Gosi"', address: 'Górki Wielkie, Główna 12', nip: '5482345678', is_active: true, created_at: '2026-05-10 08:30:00', updated_at: '2026-07-06 14:22:10' },
    { client_id: 102, name: 'Restauracja Pod Jelenie', address: 'Bielsko-Biała, Rynek 4', nip: '9371234567', is_active: true, created_at: '2026-05-12 11:15:00', updated_at: '2026-07-05 09:45:30' },
    { client_id: 103, name: 'Społem Ustroń', address: 'Ustroń, Rynek 2', nip: '5480001122', is_active: true, created_at: '2026-06-01 07:00:00', updated_at: '2026-07-06 19:10:00' },
    { client_id: 104, name: 'Prywatne - Jan Kowalski', address: 'Bielsko-Biała, Szeroka 5', nip: '', is_active: false, created_at: '2026-06-15 16:40:00', updated_at: '2026-06-30 12:00:00' },
];

export default function ClientsPanel() {
    const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [nip, setNip] = useState('');
    const [isActive, setIsActive] = useState(true);

    const handleOpenAdd = () => {
        setModalMode('add');
        setName('');
        setAddress('');
        setNip('');
        setIsActive(true);
        setIsModalOpen(true);
    };

    const handleOpenEdit = () => {
        const client = clients.find(c => c.client_id === selectedClientId);
        if (client) {
            setModalMode('edit');
            setName(client.name);
            setAddress(client.address);
            setNip(client.nip || '');
            setIsActive(client.is_active);
            setIsModalOpen(true);
        }
    };

    const handleSaveClient = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !address.trim()) {
            alert('Pola Nazwa i Adres są wymagane.');
            return;
        }

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

        if (modalMode === 'add') {
            const newClient: Client = {
                client_id: Date.now(),
                name: name.trim(),
                address: address.trim(),
                nip: nip.trim(),
                is_active: isActive,
                created_at: nowStr,
                updated_at: nowStr
            };
            setClients([...clients, newClient]);
        } else {
            setClients(clients.map(c => c.client_id === selectedClientId ? {
                ...c,
                name: name.trim(),
                address: address.trim(),
                nip: nip.trim(),
                is_active: isActive,
                updated_at: nowStr
            } : c));
        }
        setIsModalOpen(false);
        setSelectedClientId(null);
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Baza Odbiorców i Klientów</h1>
                    <p className="text-xs text-gray-500 font-medium">Zarządzanie punktami dostaw, danymi rejestrowymi firm (NIP) oraz statusami aktywności.</p>
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
                                    <th className="py-2 px-3 h-8">Nazwa Kontrahenta / Odbiorcy</th>
                                    <th className="py-2 px-3 h-8">NIP</th>
                                    <th className="py-2 px-3 h-8">Adres Dostaw</th>
                                    <th className="py-2 px-3 h-8 text-center">Status relacji</th>
                                    <th className="py-2 px-3 h-8">Utworzono</th>
                                    <th className="py-2 px-3 h-8">Aktualizacja</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bakery-btnBorder text-sm">
                                {clients.map((client) => (
                                    <tr key={client.client_id} className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedClientId === client.client_id ? 'bg-[#c9c3c3]' : ''}`}>
                                        <td className="py-2 px-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedClientId === client.client_id}
                                                onChange={() => setSelectedClientId(selectedClientId === client.client_id ? null : client.client_id)}
                                                className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                                            />
                                        </td>
                                        <td className="py-2 px-3 font-bold text-bakery-dark">{client.name}</td>
                                        <td className="py-2 px-3 font-mono text-xs text-gray-700 font-semibold">{client.nip || <span className="text-gray-400 italic font-sans text-[11px] font-normal">Brak (Osobisty)</span>}</td>
                                        <td className="py-2 px-3 font-semibold text-gray-600 flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {client.address}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {client.is_active ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                        <CheckCircle className="w-3 h-3" /> Aktywny
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                                        <XCircle className="w-3 h-3" /> Nieaktywny
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 font-mono text-xs text-gray-500">{client.created_at}</td>
                                        <td className="py-2 px-3 font-mono text-xs text-gray-500">{client.updated_at}</td>
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
                        <UserPlus className="w-4 h-4 text-bakery-accent" /> Dodaj Odbiorcę
                    </button>

                    <button
                        onClick={handleOpenEdit}
                        disabled={!selectedClientId}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded shadow-2xs hover:bg-[#dcd8d8] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
                    >
                        <Edit className="w-4 h-4" /> Edytuj dane / status
                    </button>

                    {!selectedClientId && (
                        <span className="text-[10px] text-gray-500 font-semibold ml-2 italic">Zaznacz klienta z listy powyżej, aby dokonać korekty adresowej lub zmienić status aktywności.</span>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
                    <form onSubmit={handleSaveClient} className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col">

                        <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
                            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Plus className="w-4 h-4 text-bakery-accent" />
                                {modalMode === 'add' ? 'Rejestracja Nowego Odbiorcy' : 'Edycja Kartoteki Klienta'}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Pełna nazwa firmy / Klienta</label>
                                <input
                                    type="text"
                                    placeholder="np. PSS Społem Skoczów"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Numer NIP (opcjonalnie)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={10}
                                        placeholder="np. 5481234567"
                                        value={nip}
                                        onChange={(e) => setNip(e.target.value.replace(/\D/g, ''))}
                                        className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-bold font-mono rounded text-xs p-2 pl-8 outline-none focus:border-bakery-accent"
                                    />
                                    <FileText className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Adres fizyczny dostaw</label>
                                <input
                                    type="text"
                                    placeholder="np. Skoczów, Rynek 15"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isActiveClientCheckbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                                />
                                <label htmlFor="isActiveClientCheckbox" className="text-xs font-bold text-bakery-dark cursor-pointer select-none">
                                    Klient aktywny (Zezwól na składanie i generowanie zamówień)
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