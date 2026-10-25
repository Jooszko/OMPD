import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Edit, Trash2, Tag, BookOpen, X, AlertTriangle } from 'lucide-react';
import { DashboardListScrollbar } from '../components/DashboardListScrollbar';
import { ActionToast, type ActionToastData } from '../components/ActionToast';
import { Modal } from '../components/Modal';
import {
  fetchProducts,
  fetchIngredients,
  fetchRecipes,
  createRecipe,
  updateRecipe,
  deleteProduct,
  updateProductPrice,
  type AppProduct,
  type AppIngredient,
  type AppRecipe,
} from '../../../services/api';

const CATEGORY_LABELS: Record<string, string> = {
  bread: 'Chleby',
  buns: 'Bułki/Drożdżówki',
  pastry: 'Wyroby cukiernicze',
  other: 'Inne',
};

interface DraftItem {
  ingredient_id: number;
  amount: number;
}

export default function ProductsPanel() {
  const { currentRole } = useOutletContext<{ currentRole: 'admin' | 'baker' | 'driver' }>();
  const [activeTab, setActiveTab] = useState<'ceny' | 'receptury'>('ceny');
  const visibleTab = currentRole === 'baker' ? 'receptury' : activeTab;

  const [products, setProducts] = useState<AppProduct[]>([]);
  const [ingredients, setIngredients] = useState<AppIngredient[]>([]);
  const [recipes, setRecipes] = useState<AppRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ActionToastData | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeModalMode, setRecipeModalMode] = useState<'add' | 'edit'>('add');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productPendingDeletion, setProductPendingDeletion] = useState<AppProduct | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  const [recipeProductName, setRecipeProductName] = useState<string>('');
  const [recipeProductCategory, setRecipeProductCategory] = useState<string>('bread');

  const [recipeItems, setRecipeItems] = useState<DraftItem[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [ingredientAmount, setIngredientAmount] = useState<string>('');

  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [productsData, ingredientsData, recipesData] = await Promise.all([
          fetchProducts(),
          fetchIngredients(),
          fetchRecipes(),
        ]);
        setProducts(productsData);
        setIngredients(ingredientsData);
        setRecipes(recipesData);
        if (ingredientsData.length > 0) {
          setSelectedIngredientId(ingredientsData[0].ingredient_id);
        }
      } catch (error) {
        console.error('Błąd podczas ładowania danych produktowych:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStartEditPrice = (productId: number) => {
    const prod = products.find(p => p.product_id === productId);
    if (prod) {
      setSelectedProductId(productId);
      setNewPrice(parseFloat(prod.base_price).toFixed(2));
      setIsEditingPrice(true);
    }
  };

  const handleSavePrice = async () => {
    const parsedPrice = parseFloat(newPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || !selectedProductId) {
      setToast({ text: 'Cena musi być większa od zera.' });
      return;
    }
    try {
      const updated = await updateProductPrice(selectedProductId, parsedPrice);
      setProducts(products.map(p => p.product_id === selectedProductId ? updated : p));
      setIsEditingPrice(false);
      setSelectedProductId(null);
      setToast({ variant: 'success', text: 'Cena produktu została zaktualizowana.' });
    } catch (error) {
      console.error('Błąd podczas aktualizacji ceny:', error);
      setToast({ text: 'Nie udało się zapisać nowej ceny.' });
    }
  };

  const handleOpenAddRecipe = () => {
    setRecipeModalMode('add');
    setRecipeProductName('');
    setRecipeProductCategory('bread');
    setRecipeItems([]);
    setIsRecipeModalOpen(true);
  };

  const handleOpenEditRecipe = (recipe: AppRecipe) => {
    setRecipeModalMode('edit');
    setEditingProductId(recipe.product_id);
    setRecipeProductName(recipe.name);
    setRecipeProductCategory(recipe.category);
    setRecipeItems(recipe.items.map(i => ({ ingredient_id: i.ingredient_id, amount: parseFloat(i.amount) })));
    setIsRecipeModalOpen(true);
  };

  const handleAddItemToRecipe = () => {
    const amt = parseFloat(ingredientAmount);
    if (isNaN(amt) || amt <= 0 || !selectedIngredientId) {
      setToast({ text: 'Wpisz poprawną ilość surowca.' });
      return;
    }
    if (recipeItems.some(item => item.ingredient_id === selectedIngredientId)) {
      setToast({ text: 'Ten składnik znajduje się już na liście. Usuń go najpierw, aby zmienić ilość.' });
      return;
    }
    setRecipeItems([...recipeItems, { ingredient_id: selectedIngredientId, amount: amt }]);
    setIngredientAmount('');
  };

  const handleRemoveItemFromRecipe = (id: number) => {
    setRecipeItems(recipeItems.filter(item => item.ingredient_id !== id));
  };

  const handleSaveRecipe = async () => {
    if (recipeModalMode === 'add' && (!recipeProductName.trim() || !recipeProductCategory.trim())) {
      setToast({ text: 'Nazwa produktu oraz kategoria nie mogą być puste.' });
      return;
    }

    if (recipeItems.length === 0) {
      setToast({ text: 'Receptura musi zawierać co najmniej jeden składnik.' });
      return;
    }

    try {
      if (recipeModalMode === 'add') {
        const newRecipe = await createRecipe({
          name: recipeProductName.trim(),
          category: recipeProductCategory,
          items: recipeItems,
        });
        setRecipes([...recipes, newRecipe]);
        const [productsData] = await Promise.all([fetchProducts()]);
        setProducts(productsData);
      } else if (editingProductId) {
        const updated = await updateRecipe(editingProductId, recipeItems);
        setRecipes(recipes.map(r => r.product_id === editingProductId ? updated : r));
      }
      setIsRecipeModalOpen(false);
      setToast({ variant: 'success', text: 'Receptura została zapisana.' });
    } catch (error) {
      console.error('Błąd podczas zapisu receptury:', error);
      setToast({ text: 'Nie udało się zapisać receptury.' });
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productPendingDeletion) return;

    try {
      await deleteProduct(productPendingDeletion.product_id);
      setProducts(current => current.filter(product => product.product_id !== productPendingDeletion.product_id));
      setRecipes(current => current.filter(recipe => recipe.product_id !== productPendingDeletion.product_id));
      setSelectedProductId(null);
      setIsEditingPrice(false);
      setProductPendingDeletion(null);
      setToast({ variant: 'success', text: 'Produkt i jego receptura zostały usunięte.' });
    } catch (error) {
      console.error('Błąd podczas usuwania produktu:', error);
      const message = error instanceof Error ? error.message : 'Nie udało się usunąć produktu.';
      setToast({ text: message });
    } finally {
      setIsDeletingProduct(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5 font-auth text-bakery-dark">

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[34px] leading-none font-extrabold tracking-[-0.02em]">Zarządzanie produktami</h1>
          <p className="m-0 text-sm text-[#4a4543]">
            {currentRole === 'baker'
              ? 'Zarządzanie recepturami technologicznymi.'
              : 'Ustalanie cennika bazowego oraz zarządzanie recepturami technologicznymi.'}
          </p>
        </div>

        <div role="tablist" aria-label="Widok produktów" className="flex gap-1 p-1 rounded-xl border border-bakery-btnBorder bg-bakery-card">
          {currentRole !== 'baker' && (
            <button
              type="button"
              role="tab"
              aria-selected={visibleTab === 'ceny'}
              onClick={() => setActiveTab('ceny')}
              className={`inline-flex items-center gap-2 min-h-10 px-3.5 rounded-[10px] text-[13px] font-extrabold transition-colors ${visibleTab === 'ceny' ? 'bg-bakery-dark text-white' : 'text-bakery-dark hover:bg-[#efebe9]'}`}
            >
              <Tag aria-hidden className={`w-4 h-4 ${visibleTab === 'ceny' ? 'text-bakery-accent' : ''}`} /> Cennik bazowy
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={visibleTab === 'receptury'}
            onClick={() => setActiveTab('receptury')}
            className={`inline-flex items-center gap-2 min-h-10 px-3.5 rounded-[10px] text-[13px] font-extrabold transition-colors ${visibleTab === 'receptury' ? 'bg-bakery-dark text-white' : 'text-bakery-dark hover:bg-[#efebe9]'}`}
          >
            <BookOpen aria-hidden className={`w-4 h-4 ${visibleTab === 'receptury' ? 'text-bakery-accent' : ''}`} /> Receptury
          </button>
        </div>
      </div>

      {visibleTab === 'ceny' && (
        <div className="flex flex-col w-full">
            <div className="bg-bakery-card rounded-[14px] border border-bakery-btnBorder shadow-sm h-[70vh] max-h-[700px] min-h-[360px] flex flex-col overflow-hidden">
              <DashboardListScrollbar className="products-table-scrollbar flex-1 min-h-0" contentClassName="pr-2">
                {isLoading ? (
                  <div role="status" className="absolute inset-0 flex items-center justify-center text-sm text-[#5f5a58] font-semibold">Ładowanie danych z bazy...</div>
                ) : (
                  products.length === 0 ? (
                    <p className="m-0 p-6 text-sm font-semibold text-[#5f5a58]">Brak produktów w cenniku.</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="dashboard-list-table-header">
                        <tr className="text-[11px] font-extrabold text-bakery-dark uppercase tracking-wider">
                          <th className="py-3 px-4">ID</th>
                          <th className="py-3 px-4">Nazwa produktu</th>
                          <th className="py-3 px-4">Kategoria</th>
                          <th className="py-3 px-4 text-right">Cena bazowa</th>
                          <th className="py-3 px-4 text-center">Akcje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e6e1df] text-sm">
                        {products.map((product) => (
                          <tr key={product.product_id} className="bg-white transition-colors hover:bg-[#efebe9]">
                            <td className="py-3 px-4 font-mono text-xs text-[#77716e]">#{product.product_id}</td>
                            <td className="py-3 px-4 font-bold text-bakery-dark">{product.name}</td>
                            <td className="py-3 px-4 text-[13px] font-semibold text-[#5f5a58]">{CATEGORY_LABELS[product.category] ?? product.category}</td>
                            <td className="py-3 px-4 text-right font-mono font-extrabold text-bakery-dark">
                              {parseFloat(product.base_price).toFixed(2)} zł
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPrice(product.product_id)}
                                  aria-label={`Edytuj cenę produktu ${product.name}`}
                                  className="size-9 inline-flex items-center justify-center rounded-lg bg-white hover:bg-bakery-dark hover:text-white border border-bakery-btnBorder text-bakery-dark transition-colors"
                                >
                                  <Edit aria-hidden className="w-4 h-4" />
                                </button>
                                {currentRole === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => setProductPendingDeletion(product)}
                                    aria-label={`Usuń produkt ${product.name}`}
                                    className="size-9 inline-flex items-center justify-center rounded-lg bg-white hover:bg-red-700 hover:text-white border border-red-200 text-red-700 transition-colors"
                                  >
                                    <Trash2 aria-hidden className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </DashboardListScrollbar>
            </div>
        </div>
      )}

      {isEditingPrice && selectedProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-price-dialog-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-bakery-btnBorder bg-bakery-card font-auth shadow-2xl"
          >
            <div className="flex items-center justify-between bg-bakery-dark px-5 py-4 text-white">
              <h2 id="product-price-dialog-title" className="m-0 text-sm font-extrabold uppercase tracking-wider">
                Edycja ceny bazowej
              </h2>
              <button
                type="button"
                aria-label="Zamknij"
                onClick={() => setIsEditingPrice(false)}
                className="rounded-lg p-1 text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div>
                <span className="mb-1 block text-xs font-extrabold text-[#5f5a58]">Produkt</span>
                <p className="m-0 text-sm font-bold text-bakery-dark">
                  {products.find(product => product.product_id === selectedProductId)?.name}
                </p>
              </div>
              <div>
                <label htmlFor="product-base-price" className="mb-1.5 block text-xs font-extrabold text-[#4a4543]">
                  Nowa cena podstawowa (zł)
                </label>
                <input
                  id="product-base-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-bakery-btnBorder bg-white px-3.5 text-sm font-bold text-bakery-dark outline-none focus:border-bakery-accent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#e6e1df] bg-bakery-card p-3">
              <button
                type="button"
                onClick={() => setIsEditingPrice(false)}
                className="min-h-10 rounded-xl border border-bakery-btnBorder bg-white px-4 text-[13px] font-extrabold text-bakery-dark transition-colors hover:bg-[#efebe9]"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSavePrice}
                className="min-h-10 rounded-xl bg-bakery-dark px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-[#2e2e2e]"
              >
                Zapisz cenę
              </button>
            </div>
          </div>
        </div>
      )}

      {visibleTab === 'receptury' && (
        <div className="flex flex-col gap-4 w-full">
          {currentRole !== 'baker' && (
            <div className="flex justify-start">
              <button type="button" onClick={handleOpenAddRecipe} className="inline-flex items-center gap-2 min-h-11 px-[18px] rounded-xl bg-bakery-dark hover:bg-[#2e2e2e] text-white text-sm font-extrabold transition-colors">
                <Plus className="w-4 h-4 text-bakery-accent" /> Zdefiniuj nową recepturę
              </button>
            </div>
          )}

          <div className="bg-bakery-card rounded-[14px] border border-bakery-btnBorder shadow-sm overflow-hidden w-full">
            {recipes.length === 0 ? (
              <p className="m-0 p-6 text-sm font-semibold text-[#5f5a58]">Brak zdefiniowanych receptur.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead className="dashboard-list-table-header">
                    <tr className="text-[11px] font-extrabold text-bakery-dark uppercase tracking-wider">
                      <th className="py-3 px-4">Produkt końcowy</th>
                      <th className="py-3 px-4">Kategoria</th>
                      <th className="py-3 px-4">Liczba użytych surowców</th>
                      <th className="py-3 px-4">Skład szczegółowy receptury</th>
                      {currentRole !== 'baker' && <th className="py-3 px-4 text-center w-32">Akcje</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e6e1df] text-sm">
                    {recipes.map((recipe) => (
                      <tr key={recipe.product_id} className="bg-white hover:bg-[#efebe9] transition-colors">
                        <td className="py-3 px-4 font-bold text-bakery-dark">{recipe.name}</td>
                        <td className="py-3 px-4 text-[13px] font-semibold text-[#5f5a58]">{CATEGORY_LABELS[recipe.category] ?? recipe.category}</td>
                        <td className="py-3 px-4 font-mono font-bold text-center text-bakery-dark w-44">{recipe.items.length} składn.</td>
                        <td className="py-3 px-4 text-xs">
                          <div className="flex flex-wrap gap-1.5">
                            {recipe.items.map((item, index) => (
                              <span key={index} className="bg-bakery-card border border-bakery-btnBorder px-2.5 py-1 rounded-lg text-[#4a4543] font-semibold text-[11px]">
                                {item.ingredient_name}: <span className="text-bakery-dark font-extrabold">{item.amount} {item.unit}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        {currentRole !== 'baker' && (
                          <td className="py-3 px-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <button type="button" aria-label={`Edytuj recepturę: ${recipe.name}`} onClick={() => handleOpenEditRecipe(recipe)} className="size-9 inline-flex items-center justify-center rounded-lg bg-white hover:bg-bakery-dark hover:text-white border border-bakery-btnBorder text-bakery-dark transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bakery-card border border-bakery-btnBorder rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] h-[520px] font-auth">

            <div className="bg-bakery-dark text-white px-5 py-4 flex justify-between items-center shrink-0">
              <h2 className="m-0 text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-bakery-accent" />
                {recipeModalMode === 'add' ? 'Nowa Karta Technologiczna Receptury' : 'Modyfikacja Składu Receptury'}
              </h2>
              <button type="button" aria-label="Zamknij" onClick={() => setIsRecipeModalOpen(false)} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4 min-h-0">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-extrabold text-[#4a4543] block mb-1.5">Nazwa wypieku</label>
                  {recipeModalMode === 'add' ? (
                    <input
                      type="text"
                      placeholder="np. Chleb Szefa"
                      value={recipeProductName}
                      onChange={(e) => setRecipeProductName(e.target.value)}
                      className="w-full min-h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent"
                    />
                  ) : (
                    <p className="m-0 min-h-11 flex items-center px-3.5 bg-white border border-bakery-btnBorder rounded-xl text-sm font-bold text-bakery-dark">{recipeProductName}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#4a4543] block mb-1.5">Kategoria</label>
                  {recipeModalMode === 'add' ? (
                    <select
                      value={recipeProductCategory}
                      onChange={(e) => setRecipeProductCategory(e.target.value)}
                      className="w-full min-h-11 px-3.5 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none cursor-pointer focus:border-bakery-accent"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="m-0 min-h-11 flex items-center px-3.5 bg-white border border-bakery-btnBorder rounded-xl text-sm font-semibold text-[#5f5a58]">{CATEGORY_LABELS[recipeProductCategory] ?? recipeProductCategory}</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-bakery-btnBorder p-4 rounded-xl">
                <span className="text-xs font-extrabold text-[#4a4543] block mb-2.5">Dodaj komponent / surowiec</span>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1">
                    <select
                      value={selectedIngredientId ?? ''}
                      onChange={(e) => setSelectedIngredientId(parseInt(e.target.value))}
                      className="w-full min-h-11 px-3 border border-bakery-btnBorder bg-white text-bakery-dark font-semibold rounded-xl text-sm outline-none focus:border-bakery-accent"
                    >
                      {ingredients.map(i => (
                        <option key={i.ingredient_id} value={i.ingredient_id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-32">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Ilość"
                      value={ingredientAmount}
                      onChange={(e) => setIngredientAmount(e.target.value)}
                      className="w-full min-h-11 px-3 border border-bakery-btnBorder bg-white text-bakery-dark font-bold font-mono rounded-xl text-sm outline-none text-right focus:border-bakery-accent"
                    />
                  </div>
                  <button type="button" onClick={handleAddItemToRecipe} className="min-h-11 px-4 rounded-xl bg-bakery-dark hover:bg-[#2e2e2e] text-white font-extrabold text-[13px] transition-colors flex items-center gap-2">
                    <Plus className="w-3.5 h-3.5 text-bakery-accent" /> Dołącz
                  </button>
                </div>
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <span className="text-xs font-extrabold text-[#4a4543] block mb-1.5">Składniki przypisane do zestawu</span>
                <div className="border border-bakery-btnBorder rounded-xl bg-white flex-1 min-h-0 overflow-hidden">
                  <DashboardListScrollbar className="h-full" contentClassName="p-2 divide-y divide-[#e6e1df]">
                  {recipeItems.length > 0 ? (
                    recipeItems.map((item, idx) => {
                      const ing = ingredients.find(i => i.ingredient_id === item.ingredient_id);
                      return (
                        <div key={idx} className="py-2.5 px-2 flex justify-between items-center text-sm">
                          <span className="font-bold text-bakery-dark">{ing?.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold font-mono text-bakery-dark text-sm">{item.amount} {ing?.unit}</span>
                            <button type="button" aria-label={`Usuń składnik ${ing?.name ?? ''}`} onClick={() => handleRemoveItemFromRecipe(item.ingredient_id)} className="size-8 inline-flex items-center justify-center text-red-700 hover:text-white rounded-lg hover:bg-red-700 transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 px-4 text-[#5f5a58] text-sm font-semibold">Brak składników w tej karcie. Dodaj surowce powyżej.</div>
                  )}
                  </DashboardListScrollbar>
                </div>
              </div>

            </div>

            <div className="bg-bakery-card p-3 border-t border-[#e6e1df] flex justify-end gap-2 shrink-0">
              <button type="button" onClick={handleSaveRecipe} className="min-h-10 px-4 rounded-xl text-[13px] font-extrabold bg-bakery-dark hover:bg-[#2e2e2e] text-white transition-colors">
                Zapisz Recepturę i Produkt
              </button>
            </div>

          </div>
        </div>
      )}

      {productPendingDeletion && (
        <Modal
          title="Usunąć produkt?"
          subtitle="Produkt i jego receptura zostaną usunięte."
          icon={<AlertTriangle aria-hidden className="h-5 w-5 text-red-700" />}
          closeDisabled={isDeletingProduct}
          onClose={() => setProductPendingDeletion(null)}
        >
          <p className="m-0 text-sm text-[#4a4543]">
            Czy na pewno chcesz usunąć produkt{' '}
            <span className="font-extrabold text-bakery-dark">{productPendingDeletion.name}</span>? Operacja będzie możliwa
            tylko wtedy, gdy produkt nie jest używany w zamówieniach ani produkcji.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setProductPendingDeletion(null)}
              disabled={isDeletingProduct}
              className="min-h-10 px-4 rounded-xl border border-bakery-btnBorder bg-white text-[13px] font-extrabold text-bakery-dark hover:bg-[#efebe9] disabled:opacity-50 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDeletingProduct(true);
                void handleConfirmDeleteProduct();
              }}
              disabled={isDeletingProduct}
              className="min-h-10 px-4 rounded-xl bg-red-700 text-[13px] font-extrabold text-white hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {isDeletingProduct ? 'Usuwanie...' : 'Usuń produkt'}
            </button>
          </div>
        </Modal>
      )}

      <ActionToast toast={toast} onClose={closeToast} onRefresh={closeToast} />
    </div>
  );
}
