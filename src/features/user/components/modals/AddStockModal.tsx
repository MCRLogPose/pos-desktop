import { useState, useEffect } from 'react';
import { X, Search, Package, DollarSign, Truck, BarChart3, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';

interface Product {
    id: number;
    code: string | null;
    name: string;
    category_id: number | null;
    price: number;
    cost: number;
    stock: number;
    unit: string | null;
    image_url: string | null;
}

interface AddStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    products: Product[];
    storeId: number | null;
}

export default function AddStockModal({ isOpen, onClose, onSubmit, products, storeId }: AddStockModalProps) {
    const { showNotification } = useNotification();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedProduct(null);
            setQuantity('');
            setSupplierName('');
            setPaymentMethod('cash');
        }
    }, [isOpen]);

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm('');
    };

    const handleUpdateStock = async () => {
        if (!selectedProduct) {
            showNotification('warning', 'Producto requerido', 'Selecciona un producto');
            return;
        }

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            showNotification('warning', 'Cantidad inválida', 'Ingresa una cantidad mayor a 0');
            return;
        }

        if (!storeId) {
            showNotification('error', 'Error', 'No hay tienda seleccionada');
            return;
        }

        const newStock = selectedProduct.stock + qty;
        const expenseAmount = selectedProduct.cost * qty;

        setIsSubmitting(true);
        try {
            await invoke('update_product', {
                id: selectedProduct.id,
                code: selectedProduct.code || null,
                name: selectedProduct.name,
                categoryId: selectedProduct.category_id || null,
                price: selectedProduct.price,
                cost: selectedProduct.cost,
                stock: newStock,
                unit: selectedProduct.unit || null,
                imageUrl: selectedProduct.image_url || null,
                storeId
            });

            await invoke('add_expense_standalone', {
                description: `Ingreso mercadería: ${selectedProduct.name}`,
                amount: expenseAmount,
                paymentMethod,
                category: 'Mercadería',
                supplier: supplierName || null,
                storeId
            });

            showNotification('success', 'Stock actualizado', `Se agregaron ${qty} unidades de "${selectedProduct.name}". Stock total: ${newStock}`);
            onSubmit();
            onClose();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al actualizar el stock');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalCost = selectedProduct ? (selectedProduct.cost * (parseInt(quantity) || 0)) : 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg pointer-events-auto overflow-hidden max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                                <h3 className="text-lg font-bold text-gray-900">Agregar Mercadería</h3>
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Search */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Buscar Producto (código o SKU)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setSelectedProduct(null);
                                            }}
                                            placeholder="Escribe el nombre, código o SKU..."
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                        />
                                    </div>

                                    {/* Search Results */}
                                    {searchTerm && !selectedProduct && filteredProducts.length > 0 && (
                                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                                            {filteredProducts.slice(0, 10).map((product) => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => handleSelectProduct(product)}
                                                    className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors flex items-center gap-3"
                                                >
                                                    <Package className="w-4 h-4 text-gray-400" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {product.code ? `Código: ${product.code}` : 'Sin código'} · Stock: {product.stock}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-mono text-green-600 font-bold">S/ {product.cost.toFixed(2)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {searchTerm && !selectedProduct && filteredProducts.length === 0 && (
                                        <p className="text-sm text-gray-500 py-2">No se encontraron productos</p>
                                    )}
                                </div>

                                {/* Selected Product */}
                                {selectedProduct && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-100 rounded-lg">
                                                <Package className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-green-900">{selectedProduct.name}</p>
                                                <p className="text-xs text-green-600">
                                                    {selectedProduct.code ? `Código: ${selectedProduct.code}` : 'Sin código'} · Stock actual: {selectedProduct.stock}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedProduct(null)}
                                                className="text-green-400 hover:text-green-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Quantity */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Cantidad a agregar</label>
                                    <div className="relative">
                                        <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            placeholder="0"
                                            min="1"
                                            disabled={!selectedProduct}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Supplier */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Proveedor</label>
                                    <div className="relative">
                                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={supplierName}
                                            onChange={(e) => setSupplierName(e.target.value)}
                                            placeholder="Nombre del proveedor"
                                            disabled={!selectedProduct}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                {/* Payment Method */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Método de Pago</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            disabled={!selectedProduct}
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none appearance-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="cash">Efectivo</option>
                                            <option value="virtual">Virtual</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Summary */}
                                {selectedProduct && quantity && (
                                    <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Costo unitario:</span>
                                            <span className="font-mono font-medium">S/ {selectedProduct.cost.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Cantidad:</span>
                                            <span className="font-medium">{quantity}</span>
                                        </div>
                                        <div className="border-t border-gray-200 pt-2 flex justify-between">
                                            <span className="text-sm font-bold text-gray-700">Monto del gasto:</span>
                                            <span className="text-sm font-bold text-green-600 font-mono">S/ {totalCost.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Nuevo stock:</span>
                                            <span className="font-bold">{selectedProduct.stock + (parseInt(quantity) || 0)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Action Button */}
                                <button
                                    type="button"
                                    onClick={handleUpdateStock}
                                    disabled={isSubmitting || !selectedProduct || !quantity}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Plus className="w-5 h-5" />
                                    )}
                                    Agregar Mercadería
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
