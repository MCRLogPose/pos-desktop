import { useState, useEffect } from 'react';
import { Search, Plus, Filter, ArrowUpDown, Layers } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import ProductModal from '../components/modals/ProductModal';
import CategoryModal from '../components/modals/CategoryModal';
import { useAuth } from '@/context/AuthContext';
import InventoryTable, { type Product } from '../components/tables/InventoryTable';

interface Category {
  id: number;
  name: string;
}

const InventoryPage = () => {
  const { showNotification } = useNotification();
  const { activeStoreId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Pagination (Client-side for now)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (activeStoreId) {
      loadData();
    }
  }, [activeStoreId]);

  const loadData = async () => {
    await Promise.all([loadProducts(), loadCategories()]);
  };

  const loadProducts = async () => {
    if (!activeStoreId) return;
    try {
      const data = await invoke<Product[]>('get_products', { storeId: activeStoreId });
      // Compute status based on stock
      const computedData = data.map(p => ({
        ...p,
        status: p.stock === 0 ? 'out_of_stock' : (p.stock <= (p.min_stock || 5) ? 'low_stock' : 'active') as any
      }));
      setProducts(computedData);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'Error al cargar productos');
    }
  };

  const loadCategories = async () => {
    if (!activeStoreId) return;
    try {
      const data = await invoke<Category[]>('get_categories', { storeId: activeStoreId });
      setCategories(data);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'Error al cargar categorías');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    if (!activeStoreId) return;
    try {
      await invoke('delete_product', { id });
      showNotification('success', 'Éxito', 'Producto eliminado correctamente');
      loadProducts();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error', 'Error al eliminar producto');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  // Filter & Pagination Logic
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500">Gestión de productos y existencias</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95"
          >
            <Layers className="w-5 h-5" />
            Categorías
          </button>
          <button
            onClick={openNewProduct}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre, código..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
              <ArrowUpDown className="w-4 h-4" />
              Ordenar
            </button>
          </div>
        </div>

        {/* Table */}
        <InventoryTable
          products={paginatedProducts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {paginatedProducts.length} de {filteredProducts.length} productos</span>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <span className="flex items-center px-2">
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={loadProducts}
        initialData={editingProduct}
        categories={categories}
        storeId={activeStoreId}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoryChange={() => {
          loadCategories();
          loadProducts(); // Reload products to reflect category changes (names)
        }}
        storeId={activeStoreId}
      />
    </div>
  );
}

export default InventoryPage;