import React, { useCallback, useState, useEffect } from 'react';
import { Search, Plus, Edit, Phone, Mail, MapPin, X, Package, SearchCheck, CheckCircle, XCircle, FileText } from 'lucide-react';
import { ActionToast, type ActionToastData } from '../components/ActionToast';
import { createIngredient, fetchSuppliers, saveSupplier, fetchIngredients, type AppIngredient } from '../../../services/api';
import { DashboardListScrollbar } from '../components/DashboardListScrollbar';

interface SupplierProduct {
    product_id: number;
    name: string;
    unit?: string;
    last_price?: string | null;
    is_assigned?: boolean;
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

type SupplierStatusFilter = 'all' | 'active' | 'inactive';

function formatPhoneNumber(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    return digits.replace(/(\d{3})(?=\d)/g, '$1-');
}

export default function SuppliersPanel() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [globalProducts, setGlobalProducts] = useState<SupplierProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<ActionToastData | null>(null);
    const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>('all');
    const [ingredientSearch, setIngredientSearch] = useState('');
    const [productPrices, setProductPrices] = useState<Record<number, string>>({});
    const [priceDraftSupplierId, setPriceDraftSupplierId] = useState<number | null>(null);

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
    const [newProductUnit, setNewProductUnit] = useState('');
    const [isCreatingProduct, setIsCreatingProduct] = useState(false);

    const closeToast = useCallback(() => setToast(null), []);
    const closeSupplierModal = () => {
        setIsModalOpen(false);
        setProductPrices({});
    };

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
                        name: `${ing.name} (${ing.unit})`,
                        unit: ing.unit,
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
        setEditingSupplierId(null);
        setModalMode('add');
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setNip('');
        setIngredientSearch('');
        setIsActive(true);
        setSupplierProducts([]);
        setProductPrices({});
        setPriceDraftSupplierId(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (supplierId: number) => {
        const supplier = suppliers.find(s => s.supplier_id === supplierId);
        if (supplier) {
            setEditingSupplierId(supplier.supplier_id);
            setModalMode('edit');
            setName(supplier.name);
            setPhone(formatPhoneNumber(supplier.phone));
            setEmail(supplier.email);
            setAddress(supplier.address);
            setNip(supplier.nip || '');
            setIsActive(supplier.is_active);
            setSupplierProducts(supplier.products.filter(product => product.is_assigned !== false));
            const savedUnassignedPrices = Object.fromEntries(
                supplier.products
                    .filter(product => product.is_assigned === false)
                    .map(product => [product.product_id, product.last_price ?? ''])
            );
            if (priceDraftSupplierId !== supplier.supplier_id) {
                setProductPrices(savedUnassignedPrices);
                setPriceDraftSupplierId(supplier.supplier_id);
            } else {
                setProductPrices(current => ({ ...savedUnassignedPrices, ...current }));
            }
            setIsModalOpen(true);
            setIngredientSearch('');
        }
    };

    const handleSaveSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setToast({ text: 'Nazwa kontrahenta jest wymagana.' });
            return;
        }
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits && phoneDigits.length !== 9) {
            setToast({ text: 'Numer telefonu musi zawierać dokładnie 9 cyfr.' });
            return;
        }

        const productsById = new Map<number, SupplierProduct>();
        for (const product of supplierProducts) {
            const rawPrice = product.last_price?.trim();
            if (!rawPrice) {
                setToast({ text: `Podaj cenę większą od zera dla przypisanego surowca ${product.name}.` });
                return;
            }
            const normalizedPrice = rawPrice.replace(',', '.');
            const price = Number(normalizedPrice);
            if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) {
                setToast({ text: `Wprowadź prawidłową cenę dla surowca ${product.name}.` });
                return;
            }
            productsById.set(product.product_id, { ...product, last_price: normalizedPrice, is_assigned: true });
        }

        const previouslyAssignedProductIds = new Set(
            suppliers
                .find(supplier => supplier.supplier_id === editingSupplierId)
                ?.products
                .filter(product => product.is_assigned !== false)
                .map(product => product.product_id) ?? [],
        );

        for (const product of globalProducts) {
            if (!Object.prototype.hasOwnProperty.call(productPrices, product.product_id) || productsById.has(product.product_id)) {
                continue;
            }
            const rawPrice = productPrices[product.product_id].trim();
            const wasPreviouslyAssigned = previouslyAssignedProductIds.has(product.product_id);
            if (!rawPrice) {
                if (!wasPreviouslyAssigned) {
                    continue;
                }
                productsById.set(product.product_id, { ...product, last_price: null, is_assigned: false });
                continue;
            }

            const normalizedPrice = rawPrice.replace(',', '.');
            const price = Number(normalizedPrice);
            if (!Number.isFinite(price) || price <= 0 || price > 99999999.99) {
                setToast({ text: `Wprowadź prawidłową cenę dla surowca ${product.name}.` });
                return;
            }
            productsById.set(product.product_id, { ...product, last_price: normalizedPrice, is_assigned: false });
        }

        const payload = {
            name: name.trim(),
            phone: formatPhoneNumber(phone),
            email: email.trim(),
            address: address.trim(),
            nip: nip.trim() || null, 
            is_active: isActive,
            products: Array.from(productsById.values()),
        };

        try {
            if (modalMode === 'add') {
                const savedData = await saveSupplier(payload, null);
                setSuppliers([savedData, ...suppliers]);
            } else {
                const savedData = await saveSupplier(payload, editingSupplierId);
                setSuppliers(suppliers.map(s => s.supplier_id === editingSupplierId ? savedData : s));
            }
            
            closeSupplierModal();
            setEditingSupplierId(null);
            setToast({ variant: 'success', text: 'Kontrahent został pomyślnie zapisany w bazie danych.' });
        } catch (error: unknown) {
            console.error("Błąd podczas zapisu w komponencie:", error);
            const errorMessage = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.';
            setToast({ text: `Nie udało się zapisać kontrahenta w bazie.\n${errorMessage}` });
        }
    };

    const handleAddProductToSupplier = (productToAdd: SupplierProduct) => {
        if (!supplierProducts.some(p => p.product_id === productToAdd.product_id)) {
            setSupplierProducts(current => [
                ...current,
                { ...productToAdd, last_price: productPrices[productToAdd.product_id] || null, is_assigned: true },
            ]);
        } else {
            setToast({ text: 'Ten produkt jest już przypisany do kontrahenta.' });
        }
    };

    const handleSupplierProductPriceChange = (productId: number, price: string) => {
        setSupplierProducts(current => current.map(product =>
            product.product_id === productId ? { ...product, last_price: price || null } : product
        ));
    };

    const handleRemoveProductFromSupplier = (productIdToRemove: number) => {
        const product = supplierProducts.find(item => item.product_id === productIdToRemove);
        setSupplierProducts(current => current.filter(item => item.product_id !== productIdToRemove));
        if (product) {
            setProductPrices(current => ({
                ...current,
                [productIdToRemove]: product.last_price ?? current[productIdToRemove] ?? '',
            }));
        }
    };

    const handleCreateNewGlobalProduct = async () => {
        const trimmedName = newProductName.trim();
        const trimmedUnit = newProductUnit.trim();
        if (!trimmedName) {
            setToast({ text: 'Nazwa składnika nie może być pusta.' });
            return;
        }
        if (!trimmedUnit) {
            setToast({ text: 'Jednostka miary jest wymagana.' });
            return;
        }
        if (globalProducts.some(p => p.name.toLowerCase() === `${trimmedName} (${trimmedUnit})`.toLowerCase())) {
            setToast({ text: 'Składnik o tej nazwie i jednostce już istnieje w ogólnej bazie.' });
            return;
        }

        setIsCreatingProduct(true);
        try {
            const ingredient = await createIngredient({
                name: trimmedName,
                unit: trimmedUnit,
            });
            setGlobalProducts(current => [
                ...current,
                {
                    product_id: ingredient.ingredient_id,
                    name: `${ingredient.name} (${ingredient.unit})`,
                    unit: ingredient.unit,
                },
            ]);
            setIsNewProductModalOpen(false);
            setNewProductName('');
            setNewProductUnit('');
            setToast({ variant: 'success', text: 'Surowiec dodano do ogólnej bazy. Kliknij „+”, aby przypisać go do dostawcy.' });
        } catch (error: unknown) {
            console.error('Błąd podczas dodawania składnika do bazy:', error);
            const errorMessage = error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd.';
            setToast({ text: `Nie udało się dodać składnika do bazy. ${errorMessage}` });
        } finally {
            setIsCreatingProduct(false);
        }
    };

    const query = searchTerm.toLowerCase().trim();

    const activeCount = suppliers.filter(s => s.is_active).length;
    const inactiveCount = suppliers.length - activeCount;
    const searchedSuppliers = suppliers.filter(s => {
        const matchesName = s.name?.toLowerCase().includes(query) ?? false;
        const matchesNip = s.nip ? s.nip.toLowerCase().includes(query) : false;
        const matchesProducts = s.products?.some(p => p.is_assigned !== false && p.name?.toLowerCase().includes(query)) ?? false;

        return matchesName || matchesNip || matchesProducts;
    });
    const filteredSuppliers = searchedSuppliers.filter(s =>
        statusFilter === 'all' || s.is_active === (statusFilter === 'active')
    );

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">

            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Księga Kontrahentów</h1>
                    <p className="m-0 text-sm text-[#4a4543]">Baza dostawców surowców, zarządzanie danymi kontaktowymi oraz asortymentem surowcowym.</p>
                </div>
            </div>

            <div role="group" aria-label="Filtr statusu kontrahentów">
                <div className="sm:hidden -mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {([
                        { key: 'active', label: 'Aktywni', count: activeCount },
                        { key: 'inactive', label: 'Nieaktywni', count: inactiveCount },
                    ] as const).map((tile) => (
                        <button
                            key={tile.key}
                            type="button"
                            aria-pressed={statusFilter === tile.key}
                            onClick={() => setStatusFilter(statusFilter === tile.key ? 'all' : tile.key)}
                            className={`shrink-0 min-h-10 px-3.5 rounded-full border text-[13px] font-extrabold whitespace-nowrap ${
                                statusFilter === tile.key
                                    ? 'bg-bakery-dark border-bakery-dark text-white'
                                    : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark'
                            }`}
                        >
                            {tile.label} {tile.count}
                        </button>
                    ))}
                </div>

                <div className="hidden sm:flex flex-wrap gap-3">
                    {([
                        { key: 'active', label: 'Aktywni', hint: 'aktywni kontrahenci', count: activeCount, color: 'text-[#1f5f33]' },
                        { key: 'inactive', label: 'Nieaktywni', hint: 'nieaktywni kontrahenci', count: inactiveCount, color: 'text-[#4a4543]' },
                    ] as const).map((tile) => {
                        const selected = statusFilter === tile.key;
                        return (
                            <button
                                key={tile.key}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setStatusFilter(selected ? 'all' : tile.key)}
                                className={`w-fit text-left px-4 py-3.5 rounded-[14px] border shadow-sm flex flex-col gap-1.5 transition ${
                                    selected
                                        ? 'bg-bakery-dark border-bakery-dark text-white'
                                        : 'bg-bakery-card border-bakery-btnBorder text-bakery-dark hover:border-[#8f8a88]'
                                }`}
                            >
                                <span className={`text-[11px] font-extrabold uppercase tracking-[0.08em] ${selected ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>
                                    {tile.label}
                                </span>
                                <span className={`font-display text-[28px] leading-none font-extrabold tabular-nums ${selected ? '' : tile.color}`}>
                                    {tile.count}
                                </span>
                                <span className={`text-xs font-bold ${selected ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>
                                    {tile.hint}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex-[1_1_280px] flex items-center gap-2.5 min-h-11 px-3.5 rounded-xl border border-bakery-btnBorder bg-white focus-within:border-bakery-accent">
                        <Search aria-hidden className="w-[18px] h-[18px] shrink-0 text-[#5f5a58]" />
                        <span className="sr-only">Szukaj kontrahenta po nazwie firmy, NIP lub surowcu</span>
                        <input
                            type="search"
                            aria-label="Szukaj kontrahenta po nazwie firmy, NIP lub surowcu"
                            placeholder="Szukaj po nazwie firmy, NIP lub surowca..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-0 border-0 outline-none bg-transparent text-sm font-semibold text-bakery-dark"
                        />
                    </label>
                    <span className="text-[13px] font-bold text-[#4a4543] tabular-nums">
                        Pokazano {filteredSuppliers.length} z {suppliers.length}
                    </span>
                    <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="inline-flex shrink-0 justify-center items-center gap-2 min-h-11 px-[18px] text-[13px] font-extrabold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-xl transition active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4 text-bakery-accent" /> Dodaj Kontrahenta
                    </button>
                </div>
                {isLoading ? (
                    <div role="status" className="h-[420px] rounded-[14px] border border-bakery-btnBorder bg-bakery-inactive animate-pulse" aria-label="Ładowanie kontrahentów" />
                ) : filteredSuppliers.length === 0 ? (
                    <div className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm p-6 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <SearchCheck aria-hidden className="w-8 h-8 shrink-0 text-[#8a8482]" />
                            <div>
                                <p className="text-sm font-semibold m-0">Brak kontrahentów spełniających kryteria.</p>
                                <p className="text-[13px] m-0 text-[#5f5a58]">Zmień frazę wyszukiwania lub dodaj nowego dostawcę.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <section aria-label="Lista kontrahentów" className="bg-bakery-card border border-bakery-btnBorder rounded-[14px] shadow-sm overflow-hidden">
                        <div
                            aria-hidden
                            className="hidden md:grid md:grid-cols-[minmax(170px,1.25fr)_minmax(150px,1fr)_minmax(130px,1fr)_110px_minmax(150px,1.2fr)_56px] md:gap-3 items-center px-5 py-3 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]"
                        >
                            <span>Kontrahent</span>
                            <span>Dane kontaktowe</span>
                            <span>Lokalizacja</span>
                            <span>Status</span>
                            <span>Surowce</span>
                            <span />
                        </div>
                        <ul className="m-0 p-0 list-none">
                            {filteredSuppliers.map((supplier) => {
                                const assignedProducts = supplier.products?.filter(product => product.is_assigned !== false) ?? [];
                                return (
                                    <li key={supplier.supplier_id} className="border-t border-[#e6e1df]">
                                        <div className="flex flex-wrap items-start md:grid md:grid-cols-[minmax(170px,1.25fr)_minmax(150px,1fr)_minmax(130px,1fr)_110px_minmax(150px,1.2fr)_56px] md:gap-3 md:items-center gap-3 px-4 md:px-5 py-3 transition hover:bg-[#f3efed]">
                                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                <span className="text-[15px] font-extrabold text-bakery-dark">{supplier.name}</span>
                                                <span className="text-xs font-semibold text-[#5f5a58]">
                                                    {supplier.nip ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <FileText aria-hidden className="w-3.5 h-3.5 text-[#8a8482]" />
                                                            NIP: <span className="font-mono">{supplier.nip}</span>
                                                        </span>
                                                    ) : 'Brak NIP'}
                                                </span>
                                                <span className="md:hidden mt-1 flex flex-wrap gap-1.5">
                                                    {supplier.is_active ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">
                                                            <CheckCircle aria-hidden className="w-3 h-3" /> Aktywny
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-700">
                                                            <XCircle aria-hidden className="w-3 h-3" /> Nieaktywny
                                                        </span>
                                                    )}
                                                </span>
                                            </span>
                                            <span className="hidden md:flex min-w-0 flex-col gap-1">
                                                <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#3d3937]">
                                                    <Phone aria-hidden className="w-3.5 h-3.5 shrink-0 text-[#8a8482]" /> {supplier.phone || '—'}
                                                </span>
                                                <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-[#3d3937]">
                                                    <Mail aria-hidden className="w-3.5 h-3.5 shrink-0 text-[#8a8482]" /> {supplier.email || '—'}
                                                </span>
                                            </span>
                                            <span className="hidden md:block truncate text-[13px] font-semibold text-[#3d3937]">
                                                {supplier.address ? (
                                                    <><MapPin aria-hidden className="w-3.5 h-3.5 inline mr-1 text-[#8a8482]" />{supplier.address}</>
                                                ) : '—'}
                                            </span>
                                            <span className="hidden md:block">
                                                {supplier.is_active ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">
                                                        <CheckCircle aria-hidden className="w-3 h-3" /> Aktywny
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-700">
                                                        <XCircle aria-hidden className="w-3 h-3" /> Nieaktywny
                                                    </span>
                                                )}
                                            </span>
                                            <span className="hidden md:flex min-w-0 flex-wrap gap-1">
                                                {assignedProducts.slice(0, 3).map(product => (
                                                    <span key={product.product_id} className="max-w-full truncate rounded-full border border-[#e2dcda] bg-[#efebe9] px-2 py-0.5 text-[11px] font-bold text-[#4a4543]">
                                                        {product.name}
                                                    </span>
                                                ))}
                                                {assignedProducts.length > 3 && (
                                                    <span className="text-[10px] font-semibold italic text-[#5f5a58]">+{assignedProducts.length - 3} więcej</span>
                                                )}
                                                {assignedProducts.length === 0 && (
                                                    <span className="text-[11px] font-semibold italic text-[#5f5a58]">Brak surowców</span>
                                                )}
                                            </span>
                                            <span className="flex shrink-0 justify-end md:justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(supplier.supplier_id)}
                                                    aria-label={`Edytuj kontrahenta ${supplier.name}`}
                                                    title="Edytuj kontrahenta"
                                                    className="inline-flex items-center justify-center size-10 rounded-xl border border-bakery-btnBorder bg-white text-bakery-dark transition hover:border-bakery-dark"
                                                >
                                                    <Edit aria-hidden className="w-4 h-4" />
                                                </button>
                                            </span>
                                            <div className="basis-full md:hidden -mt-1 flex flex-col gap-1.5 text-[13px] font-semibold text-[#4a4543]">
                                                <span className="flex items-center gap-1.5">
                                                    <Phone aria-hidden className="w-3.5 h-3.5 shrink-0 text-[#8a8482]" /> {supplier.phone || 'Brak telefonu'}
                                                </span>
                                                <span className="flex items-center gap-1.5 break-all">
                                                    <Mail aria-hidden className="w-3.5 h-3.5 shrink-0 text-[#8a8482]" /> {supplier.email || 'Brak e-maila'}
                                                </span>
                                                {supplier.address && (
                                                    <span className="flex items-start gap-1.5">
                                                        <MapPin aria-hidden className="w-3.5 h-3.5 shrink-0 text-[#8a8482]" /> {supplier.address}
                                                    </span>
                                                )}
                                                <span className="flex flex-wrap gap-1">
                                                    {assignedProducts.slice(0, 3).map(product => (
                                                        <span key={product.product_id} className="max-w-full truncate rounded-full border border-[#e2dcda] bg-white px-2 py-0.5 text-[11px] font-bold text-[#4a4543]">
                                                            {product.name}
                                                        </span>
                                                    ))}
                                                    {assignedProducts.length > 3 && (
                                                        <span className="text-[10px] font-semibold italic text-[#5f5a58]">+{assignedProducts.length - 3} więcej</span>
                                                    )}
                                                    {assignedProducts.length === 0 && (
                                                        <span className="text-[11px] font-semibold italic text-[#5f5a58]">Brak przypisanych surowców</span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleSaveSupplier} className="bg-bakery-card border border-bakery-btnBorder rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[560px] max-h-[calc(100dvh-2rem)] font-auth">

                        <div className="bg-bakery-dark text-white px-5 py-4 flex justify-between items-center shrink-0">
                            <h2 className="m-0 text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-bakery-accent" />
                                {modalMode === 'add' ? 'Nowa Kartoteka Kontrahenta' : `Edycja firmy: ${suppliers.find(s => s.supplier_id === editingSupplierId)?.name}`}
                            </h2>
                            <button type="button" onClick={closeSupplierModal} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <DashboardListScrollbar
                            className="flex-1 min-h-0"
                            viewportClassName="overscroll-contain"
                            contentClassName="p-5 flex flex-col"
                            thumbTrackPadding={6}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 border-b border-[#e6e1df] pb-4 mb-4">
                                <div>
                                    <label className="text-xs font-extrabold text-[#3d3937] block mb-1.5">Pełna nazwa firmy Dostawcy *</label>
                                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent" required />
                                </div>
                                <div>
                                    <label className="text-xs font-extrabold text-[#3d3937] block mb-1.5">Numer NIP (Opcjonalnie)</label>
                                    <input type="text" value={nip} onChange={(e) => setNip(e.target.value)} placeholder="np. 1234567890" className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent font-mono" />
                                </div>
                                <div>
                                    <label className="text-xs font-extrabold text-[#3d3937] block mb-1.5">Adres siedziby</label>
                                    <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent" />
                                </div>
                                <div>
                                    <label className="text-xs font-extrabold text-[#3d3937] block mb-1.5">Telefon kontaktowy</label>
                                    <input type="tel" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} inputMode="numeric" maxLength={11} placeholder="123-456-789" className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-bold rounded-xl text-sm outline-none focus:border-bakery-accent font-mono" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-extrabold text-[#3d3937] block mb-1.5">Adres e-mail</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pb-4 border-b border-[#e6e1df] mb-4">
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 min-h-0">
                                <div className="border border-bakery-btnBorder rounded-xl bg-white flex flex-col h-56 overflow-hidden">
                                    <div className="p-3 pb-1 border-b border-[#e6e1df] flex flex-col gap-1.5 shrink-0 bg-[#efebe9]">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                Ogólna Baza Surowców
                                            </span>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setNewProductName('');
                                                    setNewProductUnit('');
                                                    setIsNewProductModalOpen(true);
                                                }} 
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
                                        <span className="text-[10px] text-gray-500">
                                            Kliknij „+”, aby przypisać surowiec; cenę ustawisz po prawej stronie.
                                        </span>
                                    </div>

                                    <DashboardListScrollbar
                                        className="flex-1 min-h-0"
                                        viewportClassName="overscroll-contain"
                                        contentClassName="p-2 space-y-1"
                                        thumbTrackPadding={4}
                                    >
                                        {globalProducts
                                            .filter(p => !supplierProducts.some(sp => sp.product_id === p.product_id))
                                            .filter(p => p.name.toLowerCase().includes(ingredientSearch.toLowerCase().trim()))
                                            .map(p => (
                                                <div 
                                                    key={p.product_id} 
                                                    className="p-2 px-2.5 bg-[#f3efed] hover:bg-[#ebe4e1] rounded-lg text-[13px] font-semibold text-bakery-dark flex items-center gap-2 transition"
                                                >
                                                    <span className="truncate flex-1 min-w-0">{p.name}</span>
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
                                    </DashboardListScrollbar>
                                </div>

                                <div className="border border-bakery-btnBorder rounded-xl bg-white flex flex-col h-56 overflow-hidden">
                                    <div className="p-3 border-b border-[#e6e1df] flex items-center justify-between shrink-0 bg-[#efebe9]">
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-bakery-dark" /> Przypisane Surowce</span>
                                        <span className="text-[10px] font-bold font-mono text-gray-500 bg-bakery-rowBg px-1.5 py-0.5 rounded border border-bakery-btnBorder">{supplierProducts.length}</span>
                                    </div>
                                    <DashboardListScrollbar
                                        className="flex-1 min-h-0"
                                        viewportClassName="overscroll-contain"
                                        contentClassName="p-2 space-y-1"
                                        thumbTrackPadding={4}
                                    >
                                        {supplierProducts.length > 0 ? (
                                            supplierProducts.map(p => (
                                                <div key={p.product_id} className="p-2 px-2.5 bg-[#f3efed] rounded-lg text-[13px] font-semibold text-bakery-dark flex items-center gap-2">
                                                    <span className="truncate flex-1 min-w-0">{p.name}</span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={p.last_price ?? ''}
                                                            onChange={(e) => handleSupplierProductPriceChange(p.product_id, e.target.value)}
                                                            aria-label={`Cena ${p.name}`}
                                                            placeholder="Cena"
                                                            className="w-16 h-8 px-1.5 border border-bakery-btnBorder rounded-md text-xs bg-white text-bakery-dark outline-none focus:border-bakery-accent"
                                                        />
                                                        <span className="text-[10px] text-gray-500">zł/{p.unit ?? 'j.'}</span>
                                                    </div>
                                                    <button type="button" onClick={() => handleRemoveProductFromSupplier(p.product_id)} className="text-red-700 p-0.5 hover:bg-red-100 transition rounded shrink-0" title="Usuń powiązanie">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 text-gray-400 text-xs font-semibold italic">Lista asortymentu jest pusta.<br />Dodaj produkty z listy po lewej stronie.</div>
                                        )}
                                    </DashboardListScrollbar>
                                </div>
                            </div>
                        </DashboardListScrollbar>

                        <div className="bg-bakery-card p-3 border-t border-[#e6e1df] flex justify-end gap-2 shrink-0">
                            <button type="submit" className="min-h-10 px-4 text-[13px] font-extrabold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-xl transition">
                                Zapisz Kartotekę
                            </button>
                            <button type="button" onClick={closeSupplierModal} className="min-h-10 px-4 text-[13px] font-extrabold bg-white border border-bakery-btnBorder text-bakery-dark rounded-xl transition hover:bg-[#f3efed]">
                                Anuluj
                            </button>
                        </div>

                    </form>
                </div>
            )}

            {isNewProductModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-bakery-card border border-bakery-btnBorder rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col font-auth">

                        <div className="bg-bakery-dark text-white px-5 py-4 flex justify-between items-center shrink-0">
                            <h2 className="m-0 text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                                <Plus className="w-4 h-4 text-bakery-accent" /> Definicja Nowego Surowca
                            </h2>
                            <button type="button" onClick={() => setIsNewProductModalOpen(false)} className="text-gray-400 hover:text-white transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5">
                            <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#3d3937]">
                                Nazwa składnika *
                                <input type="text" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="np. Zakwas żytni w proszku" maxLength={100} className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent" required />
                            </label>
                            <label className="flex flex-col gap-1.5 text-xs font-extrabold text-[#3d3937]">
                                Jednostka miary *
                                <select value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)} className="w-full h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent" required>
                                    <option value="" disabled>Wybierz jednostkę miary</option>
                                    <option value="kg">kg</option>
                                    <option value="l">l</option>
                                    <option value="szt">szt</option>
                                </select>
                            </label>
                            <span className="text-[10px] text-gray-400 font-medium block">
                                Składnik zostanie zapisany w ogólnej bazie surowców. Cenę ustawisz po przypisaniu go do kontrahenta.
                            </span>
                        </div>

                        <div className="bg-bakery-card p-3 border-t border-[#e6e1df] flex flex-wrap justify-end gap-2 shrink-0">
                            <button type="button" onClick={handleCreateNewGlobalProduct} disabled={isCreatingProduct} className="min-h-10 px-4 text-[13px] font-extrabold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded-xl transition active:scale-[0.98] disabled:opacity-50">
                                {isCreatingProduct ? 'Zapisywanie...' : 'Dodaj składnik do bazy ogólnej'}
                            </button>
                            <button type="button" onClick={() => setIsNewProductModalOpen(false)} disabled={isCreatingProduct} className="min-h-10 px-4 text-[13px] font-extrabold bg-white border border-bakery-btnBorder text-bakery-dark rounded-xl transition hover:bg-[#f3efed] disabled:opacity-50">
                                Anuluj
                            </button>
                        </div>

                    </div>
                </div>
            )}

            <ActionToast toast={toast} onClose={closeToast} onRefresh={closeToast} />
        </div>
    );
}