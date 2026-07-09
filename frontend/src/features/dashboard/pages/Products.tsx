import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Tag, BookOpen, X } from 'lucide-react';
import {
  fetchProducts,
  fetchIngredients,
  fetchRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
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
  const [activeTab, setActiveTab] = useState<'ceny' | 'receptury'>('ceny');

  const [products, setProducts] = useState<AppProduct[]>([]);
  const [ingredients, setIngredients] = useState<AppIngredient[]>([]);
  const [recipes, setRecipes] = useState<AppRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState<string>('');

  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeModalMode, setRecipeModalMode] = useState<'add' | 'edit'>('add');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const [recipeProductName, setRecipeProductName] = useState<string>('');
  const [recipeProductCategory, setRecipeProductCategory] = useState<string>('bread');

  const [recipeItems, setRecipeItems] = useState<DraftItem[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<number | null>(null);
  const [ingredientAmount, setIngredientAmount] = useState<string>('');

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

  const handleStartEditPrice = () => {
    const prod = products.find(p => p.product_id === selectedProductId);
    if (prod) {
      setNewPrice(parseFloat(prod.base_price).toFixed(2));
      setIsEditingPrice(true);
    }
  };

  const handleSavePrice = async () => {
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0 || !selectedProductId) {
      alert('Cena nie może być mniejsza niż zero.');
      return;
    }
    try {
      const updated = await updateProductPrice(selectedProductId, parsedPrice);
      setProducts(products.map(p => p.product_id === selectedProductId ? updated : p));
      setIsEditingPrice(false);
      setSelectedProductId(null);
    } catch (error) {
      console.error('Błąd podczas aktualizacji ceny:', error);
      alert('Nie udało się zapisać nowej ceny.');
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
      alert('Wpisz poprawną ilość surowca.');
      return;
    }
    if (recipeItems.some(item => item.ingredient_id === selectedIngredientId)) {
      alert('Ten składnik znajduje się już na liście. Usuń go najpierw, aby zmienić ilość.');
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
      alert('Nazwa produktu oraz kategoria nie mogą być puste.');
      return;
    }

    if (recipeItems.length === 0) {
      alert('Receptura musi zawierać co najmniej jeden składnik.');
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
    } catch (error) {
      console.error('Błąd podczas zapisu receptury:', error);
      alert('Nie udało się zapisać receptury.');
    }
  };

  const handleDeleteRecipe = async (productId: number) => {
    if (confirm('Czy na pewno chcesz bezpowrotnie usunąć tę recepturę?')) {
      try {
        await deleteRecipe(productId);
        setRecipes(recipes.filter(r => r.product_id !== productId));
      } catch (error) {
        console.error('Błąd podczas usuwania receptury:', error);
        alert('Nie udało się usunąć receptury.');
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-8 py-6 flex flex-col gap-5 text-bakery-dark">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight text-bakery-dark">Zarządzanie Produktami</h1>
          <p className="text-xs text-gray-500 font-medium">Ustalanie cennika bazowego oraz zarządzanie recepturami technologicznymi.</p>
        </div>

        <div className="flex bg-bakery-inactive p-1 rounded border border-bakery-btnBorder shadow-sm">
          <button
            onClick={() => setActiveTab('ceny')}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'ceny' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Cennik bazowy</div>
          </button>
          <button
            onClick={() => setActiveTab('receptury')}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-all ${activeTab === 'receptury' ? 'bg-bakery-dark text-white shadow-xs' : 'text-bakery-dark hover:bg-bakery-rowBg'}`}
          >
            <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Receptury</div>
          </button>
        </div>
      </div>

      <hr className="border-0 border-t border-bakery-border my-1" />

      {activeTab === 'ceny' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm h-[400px] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-2 relative">
                {isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500 font-semibold">Ładowanie danych z bazy...</div>
                ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-bakery-inactive z-10">
                    <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider">
                      <th className="py-2 px-3 w-12 text-center h-8">Wybór</th>
                      <th className="py-2 px-3 h-8">ID</th>
                      <th className="py-2 px-3 h-8">Nazwa Produktu</th>
                      <th className="py-2 px-3 h-8">Kategoria</th>
                      <th className="py-2 px-3 text-right h-8">Cena bazowa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bakery-btnBorder text-sm">
                    {products.map((product) => (
                      <tr key={product.product_id} className={`bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder ${selectedProductId === product.product_id ? 'bg-[#c9c3c3]' : ''}`}>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedProductId === product.product_id}
                            onChange={() => {
                              setSelectedProductId(selectedProductId === product.product_id ? null : product.product_id);
                              setIsEditingPrice(false);
                            }}
                            className="rounded border-bakery-border text-bakery-dark focus:ring-bakery-accent w-4 h-4 accent-bakery-dark cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-gray-500">#{product.product_id}</td>
                        <td className="py-2 px-3 font-semibold text-bakery-dark">{product.name}</td>
                        <td className="py-2 px-3 text-xs font-semibold text-gray-600">{CATEGORY_LABELS[product.category] ?? product.category}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-950">{parseFloat(product.base_price).toFixed(2)} PLN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
            </div>

            <div className="flex gap-2 items-center bg-bakery-inactive p-3 rounded border border-bakery-btnBorder shadow-sm">
              <button
                onClick={handleStartEditPrice}
                disabled={!selectedProductId}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
              >
                <Edit className="w-4 h-4 text-bakery-accent" /> Modyfikuj Cenę
              </button>
              {!selectedProductId && (
                <span className="text-[10px] text-gray-500 font-semibold ml-2 italic">Zaznacz produkt w tabeli powyżej, aby dokonać korekty ceny. Usunięcie pozycji jest zablokowane.</span>
              )}
            </div>
          </div>

          <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm p-4 flex flex-col h-[400px] overflow-hidden">
            <div className="border-b border-bakery-btnBorder pb-3 shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">Edycja wartości</h2>
              <p className="text-[11px] text-gray-500 font-medium">Wprowadzanie zmian w cenniku handlowym przedsiębiorstwa.</p>
            </div>

            <div className="flex-1 mt-4">
              {isEditingPrice && selectedProductId ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Wybrany produkt</span>
                    <p className="font-bold text-bakery-dark text-sm">{products.find(p => p.product_id === selectedProductId)?.name}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nowa cena podstawowa (PLN)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full mt-1 border border-bakery-btnBorder rounded p-2 text-sm bg-bakery-rowBg text-bakery-dark font-mono font-bold outline-none focus:border-bakery-accent"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSavePrice} className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded transition shadow-xs">
                      Zatwierdź
                    </button>
                    <button onClick={() => setIsEditingPrice(false)} className="px-4 py-2 text-xs font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded transition">
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-gray-500 text-xs font-semibold italic">
                  Wybierz produkt i kliknij „Modyfikuj Cenę”, aby otworzyć panel edycyjny.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'receptury' && (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex justify-start">
            <button onClick={handleOpenAddRecipe} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded transition shadow-xs">
              <Plus className="w-4 h-4 text-bakery-accent" /> Zdefiniuj nową recepturę
            </button>
          </div>

          <div className="bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm overflow-hidden w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-bakery-btnBorder text-[10px] font-bold text-bakery-dark uppercase tracking-wider bg-bakery-inactive">
                  <th className="py-3 px-4">Produkt końcowy</th>
                  <th className="py-3 px-4">Kategoria</th>
                  <th className="py-3 px-4">Liczba użytych surowców</th>
                  <th className="py-3 px-4">Skład szczegółowy receptury</th>
                  <th className="py-3 px-4 text-center w-32">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bakery-btnBorder text-sm">
                {recipes.map((recipe) => (
                  <tr key={recipe.product_id} className="bg-bakery-rowBg hover:bg-bakery-inactive transition border-b border-bakery-btnBorder">
                    <td className="py-3 px-4 font-bold text-bakery-dark">{recipe.name}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-gray-600">{CATEGORY_LABELS[recipe.category] ?? recipe.category}</td>
                    <td className="py-3 px-4 font-mono font-bold text-center text-blue-950 w-44">{recipe.items.length} składn.</td>
                    <td className="py-3 px-4 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.items.map((item, index) => (
                          <span key={index} className="bg-bakery-inactive border border-bakery-btnBorder px-2 py-0.5 rounded text-gray-700 font-semibold text-[11px]">
                            {item.ingredient_name}: <span className="text-blue-950 font-bold">{item.amount} {item.unit}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex gap-1.5 justify-center">
                        <button onClick={() => handleOpenEditRecipe(recipe)} className="text-bakery-dark hover:text-white p-1 rounded bg-bakery-inactive hover:bg-bakery-dark border border-bakery-btnBorder text-[11px] font-bold transition-all shadow-2xs">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteRecipe(recipe.product_id)} className="text-red-700 hover:text-white p-1 rounded bg-red-50 hover:bg-red-700 border border-red-200 text-[11px] font-bold transition-all shadow-2xs">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-bakery-inactive border border-bakery-border rounded shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[520px]">

            <div className="bg-bakery-dark text-white p-4 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-bakery-accent" />
                {recipeModalMode === 'add' ? 'Nowa Karta Technologiczna Receptury' : 'Modyfikacja Składu Receptury'}
              </h2>
              <button onClick={() => setIsRecipeModalOpen(false)} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4 min-h-0">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Nazwa wypieku</label>
                  {recipeModalMode === 'add' ? (
                    <input
                      type="text"
                      placeholder="np. Chleb Szefa"
                      value={recipeProductName}
                      onChange={(e) => setRecipeProductName(e.target.value)}
                      className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none focus:border-bakery-accent"
                    />
                  ) : (
                    <p className="p-2 bg-bakery-rowBg border border-bakery-btnBorder rounded text-xs font-bold text-bakery-dark">{recipeProductName}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Kategoria</label>
                  {recipeModalMode === 'add' ? (
                    <select
                      value={recipeProductCategory}
                      onChange={(e) => setRecipeProductCategory(e.target.value)}
                      className="w-full border border-bakery-btnBorder bg-bakery-rowBg text-bakery-dark font-semibold rounded text-xs p-2 outline-none cursor-pointer focus:border-bakery-accent"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="p-2 bg-bakery-rowBg border border-bakery-btnBorder rounded text-xs font-semibold text-gray-600">{CATEGORY_LABELS[recipeProductCategory] ?? recipeProductCategory}</p>
                  )}
                </div>
              </div>

              <div className="bg-bakery-rowBg border border-bakery-btnBorder p-3 rounded">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Dodaj komponent / surowiec:</span>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <select
                      value={selectedIngredientId ?? ''}
                      onChange={(e) => setSelectedIngredientId(parseInt(e.target.value))}
                      className="w-full border border-bakery-btnBorder bg-bakery-inactive text-bakery-dark font-semibold rounded text-xs p-1.5 outline-none"
                    >
                      {ingredients.map(i => (
                        <option key={i.ingredient_id} value={i.ingredient_id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Ilość"
                      value={ingredientAmount}
                      onChange={(e) => setIngredientAmount(e.target.value)}
                      className="w-full border border-bakery-btnBorder bg-bakery-inactive text-bakery-dark font-bold font-mono rounded text-xs p-1.5 outline-none text-right"
                    />
                  </div>
                  <button onClick={handleAddItemToRecipe} className="px-3 py-1.5 bg-bakery-dark hover:bg-[#2e2e2e] text-white font-bold text-xs rounded transition flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-bakery-accent" /> Dołącz
                  </button>
                </div>
              </div>

              <div className="flex flex-col flex-1 min-h-0">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Składniki przypisane do zestawu:</span>
                <div className="border border-bakery-btnBorder rounded bg-bakery-rowBg flex-1 overflow-y-auto p-1.5 divide-y divide-bakery-btnBorder">
                  {recipeItems.length > 0 ? (
                    recipeItems.map((item, idx) => {
                      const ing = ingredients.find(i => i.ingredient_id === item.ingredient_id);
                      return (
                        <div key={idx} className="py-2 px-2 flex justify-between items-center text-xs">
                          <span className="font-semibold text-bakery-dark">{ing?.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold font-mono text-blue-950 text-sm">{item.amount} {ing?.unit}</span>
                            <button onClick={() => handleRemoveItemFromRecipe(item.ingredient_id)} className="text-red-700 hover:text-red-900 p-0.5 rounded hover:bg-red-50 transition">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-gray-400 text-xs font-semibold italic">Brak składników w tej karcie. Dodaj surowce powyżej.</div>
                  )}
                </div>
              </div>

            </div>

            <div className="bg-bakery-rowBg p-3 border-t border-bakery-btnBorder flex justify-end gap-2 shrink-0">
              <button onClick={handleSaveRecipe} className="px-4 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs transition">
                Zapisz Recepturę i Produkt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
