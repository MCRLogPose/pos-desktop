import { Package, X, Truck, User } from 'lucide-react';
import type { Product } from '../tables/InventoryTable';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getStatusInfo = (product: Product) => {
  if (product.stock === 0) return { label: 'Agotado', cls: 'bg-red-100 text-red-700' };
  if (product.stock <= (product.min_stock ?? 5)) return { label: 'Stock Bajo', cls: 'bg-yellow-100 text-yellow-700' };
  return { label: 'En Stock', cls: 'bg-green-100 text-green-700' };
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="font-medium text-gray-900 mt-0.5">{value}</p>
  </div>
);

const ProductDetailModal = ({ product, onClose }: ProductDetailModalProps) => {
  if (!product) return null;

  const status = getStatusInfo(product);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{product.name}</h2>
              <p className="text-xs text-gray-500">{product.code ? `Código: ${product.code}` : 'Sin código'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {product.image_url && (
            <div className="rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-3">
              <img src={product.image_url} alt={product.name} className="max-h-40 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            </div>
          )}

          {/* Proveedor & Responsable */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Proveedor
              </p>
              <p className="font-medium text-gray-900">{product.supplier_name || 'Sin proveedor'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Agregado por
              </p>
              <p className="font-medium text-gray-900">{product.created_by_name || 'No registrado'}</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailRow label="Categoría" value={product.category_name || '-'} />
            <DetailRow label="Unidad" value={product.unit || 'Unidades'} />
            <DetailRow label="Precio Venta" value={`S/ ${product.price.toFixed(2)}`} />
            <DetailRow label="Costo" value={`S/ ${product.cost.toFixed(2)}`} />
            <DetailRow label="Stock" value={`${product.stock} ${product.unit || 'und.'}`} />
            <DetailRow label="Stock Mínimo" value={`${product.min_stock ?? 5}`} />
            <div className="flex items-end justify-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                {status.label}
              </span>
            </div>
            <DetailRow label="Fecha de Creación" value={formatDate(product.created_at)} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;