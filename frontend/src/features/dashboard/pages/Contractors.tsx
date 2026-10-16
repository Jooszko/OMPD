import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Phone, Mail, MapPin, X, Package, SearchCheck, CheckCircle, XCircle, FileText } from 'lucide-react';
import { DashboardListScrollbar } from '../components/DashboardListScrollbar';
import { fetchSuppliers, saveSupplier, fetchIngredients, type AppIngredient } from '../../../services/api';

interface SupplierProduct {
    product_id: number;
    name: string;
}

interface Supplier {
    supplier_id: number;
    name: string;
    phone: string;
    email: string;
    address: string;
    nip: string; 
    is_active: boolean;
    products: SupplierProduct[];
}

export default function SuppliersPanel() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [globalProducts, setGlobalProducts] = useState<SupplierProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [ingredientSearch, setIngredientSearch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [nip, setNip] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);

    const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
    const [newProductName, setNewProductName] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            try {
                setIsLoading(true);
                const [suppliersData, ingredientsData] = await Promise.all([
                    fetchSuppliers(),
                    fetchIngredients()
                ]);

                if (isMounted) {
                    setSuppliers(suppliersData);
                    const mappedProducts: SupplierProduct[] = ingredientsData.map((ing: AppIngredient) => ({
                        product_id: ing.ingredient_id,
                        name: `${ing.name} (${ing.unit})`
                    }));
                    setGlobalProducts(mappedProducts);
                }
            } catch (error: unknown) {
                console.error("Błąd podczas ładowania kontrahentów i surowców:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleOpenAdd = () => {
        setModalMode('add');
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setNip('');
        setIngredientSearch('');
        setIsActive(true);
        setSupplierProducts([]);
        setIsModalOpen(true);
    };

    const handleOpenEdit = () => {
        const supplier = suppliers.find(s => s.supplier_id === selectedSupplierId);
        if (supplier) {
            setModalMode('edit');
            setName(supplier.name);
            setPhone(supplier.phone);
            setEmail(supplier.email);
            setAddress(supplier.address);
            setNip(supplier.nip || '');
            setIsActive(supplier.is_active);
            setSupplierProducts([...supplier.products]);
            setIsModalOpen(true);
            setIngredientSearch('');
        }
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Nazwa kontrahenta jest wymagana.');
            return;
        }

        const payload = {
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            address: address.trim(),
            nip: nip.trim() || null, 
            is_active: isActive,
            products: supplierProducts
        };

        try {
            if (modalMode === 'add') {
                const savedData = await saveSupplier(payload, null);
                setSuppliers([savedData, ...suppliers]);
            } else {
                const savedData = await saveSupplier(payload, selectedSupplierId);
                setSuppliers(suppliers.map(s => s.supplier_id === selectedSupplierId ? savedData : s));
            }
            
            setIsModalOpen(false);
            setSelectedSupplierId(null);
            alert('Kontrahent został pomyślnie zapisany w bazie danych.');
        } catch (error: unknown) {
            console.error("Błąd podczas zapisu w komponencie:", error);
            const errorMessage = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.';
            alert(`Nie udało się zapisać kontrahenta w bazie. ${errorMessage}`);
        }
    };

    const handleAddProductToSupplier = (productToAdd: SupplierProduct) => {
        if (!supplierProducts.some(p => p.product_id === productToAdd.product_id)) {
            setSupplierProducts([...supplierProducts, productToAdd]);
        } else {
            alert('Ten produkt jest już przypisany do kontrahenta.');
        }
    };

    const handleRemoveProductFromSupplier = (productIdToRemove: number) => {
        setSupplierProducts(supplierProducts.filter(p => p.product_id !== productIdToRemove));
    };

    const handleCreateNewGlobalProduct = () => {
        if (!newProductName.trim()) {
            alert('Nazwa produktu nie może być pusta.');
            return;
        }
        if (globalProducts.some(p => p.name.toLowerCase() === newProductName.trim().toLowerCase())) {
            alert('Produkt o tej nazwie już istnieje w ogólnej bazie.');
            return;
        }
        const newProduct: SupplierProduct = {
            product_id: Date.now(),
            name: newProductName.trim(),
        };
        setGlobalProducts([...globalProducts, newProduct]);
        setIsNewProductModalOpen(false);
        setNewProductName('');
    };

    const query = searchTerm.toLowerCase().trim();

    const filteredSuppliers = suppliers.filter(s => {
        const matchesName = s.name?.toLowerCase().includes(query) ?? false;
        const matchesNip = s.nip ? s.nip.toLowerCase().includes(query) : false;
        const matchesProducts = s.products?.some(p => p.name?.toLowerCase().includes(query)) ?? false;

        return matchesName || matchesNip || matchesProducts;
    });

    return (
        <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Księga Kontrahentów</h1>
                    <p className="text-xs text-gray-500 font-medium">Baza dostawców surowców, zarządzanie danymi kontaktowymi oraz asortymentem surowcowym.</p>
                </div>
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-bakery-border w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Szukaj po nazwie firmy, NIP lub surowca..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 border border-bakery-btnBorder rounded text-xs bg-bakery-rowBg focus:bg-white text-bakery-dark font-medium outline-none focus:border-bakery-accent"
                    />
                </div>
            </div>

            <hr className="border-0 border-t border-bakery-border my-1" />

            <div className="flex flex-col gap-4 w-full">
                <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[400px] flex flex-col overflow-hidden">
                    <DashboardListScrollbar className="flex-1 min-h-0">
                        {isLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-semibold">Ładowanie danych z bazy...</div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-bakery-inactive z-10">
                                    <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                                        <th className="py-2 px-3 w-12 text-center h-8">Wybór</th>
                                        <th className="py-2 px-3 h-8">Nazwa Firmy</th>
                                        <th className="py-2 px-3 h-8">Identyfikatory</th>
                                        <th className="py-2 px-3 h-8">Dane Kontaktowe</th>
                                        <th className="py-2 px-3 h-8">Lokalizacja</th>
                                        <th className="py-2 px-3 h-8 text-center">Status relacji</th>
                                        <th className="py-2 px-3 h-8">Produkty dostawcy</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bakery-btnBorder text-sm">
                                    {filteredSuppliers.map((supplier) => (
                                        <tr key={supplier.supplier_id} className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedSupplierId === supplier.supplier_id ? 'bg-[#c9c3c3]' : ''}`}>
                                            <td className="py-2 px-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSupplierId === supplier.supplier_id}
                                                    onChange={() => setSelectedSupplierId(selectedSupplierId === supplier.supplier_id ? null : supplier.supplier_id)}
                                                    className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-2 px-3 font-bold text-bakery-dark">{supplier.name}</td>
                                            <td className="py-2 px-3 text-xs font-semibold text-gray-600">
                                                {supplier.nip ? (
                                                    <div className="flex items-center gap-1">
                                                        <FileText className="w-3.5 h-3.5 text-gray-400" /> NIP: <span className="font-mono font-bold">{supplier.nip}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Brak NIP</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 space-y-0.5">
                                                <div className="flex items-center gap-1.5 text-gray-600 font-semibold text-xs"><Phone className="w-3.5 h-3.5" /> {supplier.phone}</div>
                                                <div className="flex items-center gap-1.5 text-gray-600 font-semibold text-xs"><Mail className="w-3.5 h-3.5" /> {supplier.email}</div>
                                            </td>
                                            <td className="py-2 px-3 text-xs font-semibold text-gray-600"><MapPin className="w-3.5 h-3.5 inline mr-1 text-gray-400" /> {supplier.address}</td>
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {supplier.is_active ? (
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
                                            <td className="py-2 px-3 text-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {supplier.products && supplier.products.slice(0, 3).map(p => (
                                                        <span key={p.product_id} className="bg-bakery-inactive border border-bakery-btnBorder px-2 py-0.5 rounded text-gray-700 font-semibold text-[10px]">{p.name}</span>
                                                    ))}
                                                    {supplier.products && supplier.products.length > 3 && (
                                                        <span className="text-[10px] text-gray-500 font-semibold italic">+{supplier.products.length - 3} więcej</span>
                                                    )}
                                                    {(!supplier.products || supplier.products.length === 0) && (
                                                        <span className="text-[10px] text-gray-400 font-medium italic">Nie przypisano produktów</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!isLoading && filteredSuppliers.length === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-gray-400 p-8">
                                <SearchCheck className="w-12 h-12 mb-4" />
                                <p className="text-sm font-semibold m-0">Brak kontrahentów spełniających kryteria.</p>
                                <p className="text-xs m-0">Zmień frazę wyszukiwania lub dodaj nowego dostawcę.</p>
                            </div>
                        )}
                    </DashboardListScrollbar>
                </div>

                <div className="flex flex-col min-[1016px]:flex-row min-[1016px]:items-center gap-2 bg-bakery-inactive p-3 rounded border border-bakery-btnBorder shadow-sm">
                    <div className="flex flex-wrap justify-center min-[1016px]:justify-start items-center gap-2">
                        <button
                            onClick={handleOpenAdd}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98]"
                        >
                            <Plus className="w-4 h-4 text-bakery-accent" /> Dodaj Kontrahenta
                        </button>
                        <button
                            onClick={handleOpenEdit}
                            disabled={!selectedSupplierId}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded shadow-2xs hover:bg-[#dcd8d8] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
                        >
                            <Edit className="w-4 h-4" /> Edytuj dane / status
                        </button>
                    </div>
                    {!selectedSupplierId && (
                        <span className="text-[10px] text-gray-500 font-semibold text-center min-[1016px]:text-left min-[1016px]:ml-2 italic">Zaznacz firmę w tabeli powyżej, aby dokonać zmian w kartotece lub zmienić status aktywności. Usuwanie zostało zablokowane.</span>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
                    <form onSubmit={handleSaveSupplier} className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-4xl overflow-hidden flex flex-col h-[560px]">

                        <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
                            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-bakery-accent" />
                                {modalMode === 'add' ? 'Nowa Kartoteka Kontrahenta' : `Edycja firmy: ${suppliers.find(s => s.supplier_id === selectedSupplierId)?.name}`}
                            </h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto flex flex-col min-h-0">
                            <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-bakery-btnBorder pb-4 mb-4">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Pełna nazwa firmy Dostawcy *</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent" required />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Numer NIP (Opcjonalnie)</label>
                                    <input type="text" value={nip} onChange={(e) => setNip(e.target.value)} placeholder="np. 1234567890" className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent font-mono" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Adres siedziby</label>
                                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Telefon kontaktowy</label>
                                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-bold rounded text-xs p-2 outline-none focus:border-bakery-accent font-mono" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Adres e-mail</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pb-4 border-b border-bakery-btnBorder mb-4">
                                <input
                                    type="checkbox"
                                    id="supplierActiveCheckbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                                />
                                <label htmlFor="supplierActiveCheckbox" className="text-xs font-bold text-bakery-dark cursor-pointer select-none">
                                    Kontrahent aktywny (Zezwól na rejestrację dostaw i zamówień surowcowych)
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-5 min-h-0">
                                <div className="border border-bakery-btnBorder rounded bg-bakery-rowBg flex flex-col h-56 overflow-hidden">
                                    <div className="p-2 border-b border-bakery-btnBorder flex flex-col gap-1.5 shrink-0 bg-bakery-inactive">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                Ogólna Baza Surowców
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => setIsNewProductModalOpen(true)} 
                                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs active:scale-[0.98]"
                                            >
                                                <Plus className="w-3 h-3 text-bakery-accent" /> Zdefiniuj
                                            </button>
                                        </div>

                                        <div className="relative w-full">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                                            <input
                                                type="text"
                                                value={ingredientSearch}
                                                onChange={(e) => setIngredientSearch(e.target.value)}
                                                placeholder="Filtruj surowce..."
                                                className="w-full pl-6 pr-6 py-1 border border-bakery-btnBorder rounded text-[11px] bg-white text-bakery-dark font-medium outline-none focus:border-bakery-accent"
                                            />
                                            {ingredientSearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIngredientSearch('')}
                                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {globalProducts
                                            .filter(p => !supplierProducts.some(sp => sp.product_id === p.product_id))
                                            .filter(p => p.name.toLowerCase().includes(ingredientSearch.toLowerCase().trim()))
                                            .map(p => (
                                                <div 
                                                    key={p.product_id} 
                                                    className="p-1.5 px-2 bg-bakery-inactive hover:bg-[#c9c3c3] rounded text-xs font-semibold text-bakery-dark flex justify-between items-center transition"
                                                >
                                                    <span className="truncate pr-2">{p.name}</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleAddProductToSupplier(p)} 
                                                        className="text-bakery-dark p-0.5 hover:text-blue-700 transition shrink-0" 
                                                        title="Dodaj do kontrahenta"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}

                                        {globalProducts
                                            .filter(p => !supplierProducts.some(sp => sp.product_id === p.product_id))
                                            .filter(p => p.name.toLowerCase().includes(ingredientSearch.toLowerCase().trim())).length === 0 && (
                                            <div className="text-center py-8 text-gray-400 text-xs italic">
                                                {ingredientSearch ? 'Nie znaleziono pasującego surowca.' : 'Wszystkie surowce zostały przypisane.'}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border border-bakery-btnBorder rounded bg-bakery-rowBg flex flex-col h-56 overflow-hidden">
                                    <div className="p-2.5 px-3 border-b border-bakery-btnBorder flex items-center justify-between shrink-0 bg-bakery-inactive">
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-bakery-dark" /> Przypisane Surowce</span>
                                        <span className="text-[10px] font-bold font-mono text-gray-500 bg-bakery-rowBg px-1.5 py-0.5 rounded border border-bakery-btnBorder">{supplierProducts.length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {supplierProducts.length > 0 ? (
                                            supplierProducts.map(p => (
                                                <div key={p.product_id} className="p-1.5 px-2 bg-bakery-inactive rounded text-xs font-semibold text-bakery-dark flex justify-between items-center">
                                                    <span className="truncate pr-2">{p.name}</span>
                                                    <button type="button" onClick={() => handleRemoveProductFromSupplier(p.product_id)} className="text-red-700 p-0.5 hover:bg-red-100 transition rounded shrink-0" title="Usuń powiązanie">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 text-gray-400 text-xs font-semibold italic">Lista asortymentu jest pusta.<br />Dodaj produkty z listy po lewej stronie.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2 shrink-0">
                            <button type="submit" className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition">
                                Zapisz Kartotekę
                            </button>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition">
                                Anuluj
                            </button>
                        </div>

                    </form>
                </div>
            )}

            {isNewProductModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[60]">
                    <div className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-sm overflow-hidden flex flex-col">

                        <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
                            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                                <Plus className="w-4 h-4 text-bakery-accent" /> Definicja Nowego Surowca
                            </h2>
                            <button type="button" onClick={() => setIsNewProductModalOpen(false)} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nazwa handlowa surowca *</label>
                                <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="np. Zakwas żytni w proszku" className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent" required />
                                <span className="text-[10px] text-gray-400 font-medium block mt-1">Definicja zostanie zapisana na stałe w bazie surowców.</span>
                            </div>
                        </div>

                        <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2 shrink-0">
                            <button type="button" onClick={handleCreateNewGlobalProduct} className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition active:scale-[0.98]">
                                Dodaj surowiec do bazy ogólnej
                            </button>
                            <button type="button" onClick={() => setIsNewProductModalOpen(false)} className="px-4 py-2 text-xs font-bold bg-bakery-inactive border border-bakery-btnBorder text-bakery-dark rounded transition">
                                Anuluj
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}