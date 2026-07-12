import { useState, useEffect } from 'react';
import { X, Package, DollarSign, BarChart3, Layers, Image as ImageIcon, Tag, Percent, Plus, Trash2, Calendar, Truck, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';

interface Category {
    id: number;
    name: string;
}

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

interface BatchItem {
    id: string;
    name: string;
    sku: string;
    categoryId: number | null;
    categoryName: string;
    price: string;
    cost: string;
    stock: string;
    imageUrl: string;
}

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    initialData?: Product | null;
    categories: Category[];
    storeId: number | null;
}

export default function ProductModal({ isOpen, onClose, onSubmit, initialData, categories, storeId }: ProductModalProps) {
    const { showNotification } = useNotification();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Batch items list
    const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Form states for current item
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [price, setPrice] = useState('0');
    const [cost, setCost] = useState('0');
    const [stock, setStock] = useState('1');
    const [imageUrl, setImageUrl] = useState('');

    // Profit simulation
    const [profitPercent, setProfitPercent] = useState('0');
    const profitAmount = (parseFloat(price) || 0) - (parseFloat(cost) || 0);

    // Lote metadata
    const [batchDate, setBatchDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [supplierName, setSupplierName] = useState('');
    const [alias, setAlias] = useState('');
    const [lotePaymentMethod, setLotePaymentMethod] = useState('cash');

    const handlePriceChange = (val: string) => {
        setPrice(val);
        const p = parseFloat(val) || 0;
        const c = parseFloat(cost) || 0;
        if (c > 0) {
            const percent = ((p - c) / c) * 100;
            setProfitPercent(percent < 0 ? '0' : percent.toFixed(2));
        } else if (p > 0) {
            setProfitPercent('100');
        } else {
            setProfitPercent('0');
        }
    };

    const handleCostChange = (val: string) => {
        setCost(val);
        const c = parseFloat(val) || 0;
        const p = parseFloat(price) || 0;
        if (c > 0) {
            const percent = ((p - c) / c) * 100;
            setProfitPercent(percent < 0 ? '0' : percent.toFixed(2));
        } else {
            setProfitPercent('0');
        }
    };

    const handlePercentChange = (val: string) => {
        setProfitPercent(val);
        const percent = parseFloat(val) || 0;
        const c = parseFloat(cost) || 0;
        if (percent >= 0) {
            const newPrice = c * (1 + percent / 100);
            setPrice(newPrice.toFixed(2));
        }
    };

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit mode: fill form with existing product
                setName(initialData.name);
                setSku(initialData.code || '');
                setCategoryId(initialData.category_id);
                setPrice(initialData.price.toString());
                setCost(initialData.cost.toString());
                setStock(initialData.stock.toString());
                setImageUrl(initialData.image_url || '');
                const p = initialData.price;
                const c = initialData.cost;
                if (c > 0) {
                    setProfitPercent((((p - c) / c) * 100).toFixed(2));
                }
            } else {
                resetForm();
                setBatchItems([]);
            }
        }
    }, [initialData, isOpen]);

    const resetForm = () => {
        setName('');
        setSku('');
        setCategoryId(null);
        setPrice('0');
        setCost('0');
        setStock('1');
        setImageUrl('');
        setProfitPercent('0');
        setEditingItemId(null);
    };

    const getCategoryName = (id: number | null): string => {
        if (!id) return '';
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : '';
    };

    const handleAddItem = () => {
        if (!name.trim()) {
            showNotification('warning', 'Faltan datos', 'El nombre del producto es obligatorio');
            return;
        }

        const newItem: BatchItem = {
            id: editingItemId || crypto.randomUUID(),
            name: name.trim(),
            sku: sku.trim(),
            categoryId,
            categoryName: getCategoryName(categoryId),
            price,
            cost,
            stock,
            imageUrl,
        };

        if (editingItemId) {
            setBatchItems(prev => prev.map(item => item.id === editingItemId ? newItem : item));
            setEditingItemId(null);
        } else {
            setBatchItems(prev => [...prev, newItem]);
        }

        resetForm();
    };

    const handleDeleteItem = (id: string) => {
        setBatchItems(prev => prev.filter(item => item.id !== id));
        if (editingItemId === id) {
            setEditingItemId(null);
            resetForm();
        }
    };

    const handleDoubleClickItem = (item: BatchItem) => {
        setName(item.name);
        setSku(item.sku);
        setCategoryId(item.categoryId);
        setPrice(item.price);
        setCost(item.cost);
        setStock(item.stock);
        setImageUrl(item.imageUrl);
        setEditingItemId(item.id);

        const p = parseFloat(item.price) || 0;
        const c = parseFloat(item.cost) || 0;
        if (c > 0) {
            setProfitPercent((((p - c) / c) * 100).toFixed(2));
        } else {
            setProfitPercent('0');
        }
    };

    const totalCost = batchItems.reduce((sum, item) => {
        return sum + (parseFloat(item.cost) || 0) * (parseInt(item.stock) || 0);
    }, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // If editing a single product (initialData mode), use old behavior
        if (initialData) {
            setIsSubmitting(true);
            try {
                await invoke('update_product', {
                    id: initialData.id,
                    code: sku || null,
                    name,
                    categoryId: categoryId || null,
                    price: parseFloat(price) || 0,
                    cost: parseFloat(cost) || 0,
                    stock: parseInt(stock) || 0,
                    unit: null,
                    imageUrl: imageUrl || null,
                    storeId
                });
                showNotification('success', 'Éxito', 'Producto actualizado');
                onSubmit();
                onClose();
            } catch (error) {
                console.error(error);
                showNotification('error', 'Error', 'Error al guardar el producto');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Batch mode: create purchase order
        if (batchItems.length === 0) {
            showNotification('warning', 'Faltan datos', 'Agrega al menos un producto al lote');
            return;
        }

        if (!storeId) {
            showNotification('error', 'Error', 'No hay tienda seleccionada');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                storeId,
                createdBy: 1, // TODO: get from auth context
                supplierName: supplierName || null,
                batchDate,
                alias: alias || null,
                paymentMethod: lotePaymentMethod,
                items: batchItems.map(item => ({
                    productName: item.name,
                    sku: item.sku || null,
                    categoryId: item.categoryId,
                    quantity: parseInt(item.stock) || 1,
                    unitCost: parseFloat(item.cost) || 0,
                    unitPrice: parseFloat(item.price) || 0,
                    imageUrl: item.imageUrl || null,
                })),
            };

            await invoke('create_purchase_order', { payload });
            showNotification('success', 'Éxito', `Lote registrado: ${batchItems.length} productos`);
            onSubmit();
            onClose();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al registrar el lote');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditMode = !!initialData;

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
                        className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none gap-10"
                    >
                        {/* Lote Metadata - Separate Section */}
                        {!isEditMode && (
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm pointer-events-auto mt-3 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Truck className="w-4 h-4 text-gray-500" />
                                    <h4 className="text-sm font-bold text-gray-700">Datos del Lote</h4>
                                </div>
                                <div className="grid grid-rows-1 sm:grid-rows-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                            Fecha
                                        </label>
                                        <input
                                            type="date"
                                            value={batchDate}
                                            onChange={(e) => setBatchDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                            <Truck className="w-3.5 h-3.5 text-gray-400" />
                                            Proveedor
                                        </label>
                                        <input
                                            type="text"
                                            value={supplierName}
                                            onChange={(e) => setSupplierName(e.target.value)}
                                            placeholder="Nombre del proveedor"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                            <Bookmark className="w-3.5 h-3.5 text-gray-400" />
                                            Alias
                                        </label>
                                        <input
                                            type="text"
                                            value={alias}
                                            onChange={(e) => setAlias(e.target.value)}
                                            placeholder="Ej. Lote-Julio-2026"
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                                            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                                            Método de Pago
                                        </label>
                                        <select
                                            value={lotePaymentMethod}
                                            onChange={(e) => setLotePaymentMethod(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white text-sm"
                                        >
                                            <option value="cash">Efectivo</option>
                                            <option value="virtual">Virtual</option>
                                        </select>
                                    </div>
                                </div>
                                {/* Simulation */}
                                <br />
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                                    <div className="flex items-center gap-2 text-blue-700 font-semibold text-xs uppercase tracking-wider">
                                        <Percent className="w-3.5 h-3.5" />
                                        Simulador de Ganancia
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-blue-400 uppercase">Utilidad (%)</label>
                                            <div className="relative">
                                                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-300 w-3.5 h-3.5" />
                                                <input
                                                    type="number"
                                                    value={profitPercent}
                                                    onChange={(e) => handlePercentChange(e.target.value)}
                                                    placeholder="0"
                                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-blue-700"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-bold text-blue-400 uppercase">Margen (S/)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-300 w-3.5 h-3.5" />
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={profitAmount.toFixed(2)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-blue-100/50 border border-transparent rounded-lg text-sm font-bold text-blue-800 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl pointer-events-auto overflow-hidden max-h-[90vh] overflow-y-auto">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {isEditMode ? 'Editar Producto' : 'Nuevo Lote'}
                                </h3>
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-0">
                                {/* Main Product Form */}
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Left: Basic Info */}
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Nombre del Producto</label>
                                                <div className="relative">
                                                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                    <input
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        placeholder="Ej. Café Americano"
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">SKU (Opcional)</label>
                                                <div className="relative">
                                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                    <input
                                                        type="text"
                                                        value={sku}
                                                        onChange={(e) => setSku(e.target.value)}
                                                        placeholder="Ej. PROD-001"
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Categoría</label>
                                                <div className="relative">
                                                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                    <select
                                                        value={categoryId || ''}
                                                        onChange={(e) => setCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                                    >
                                                        <option value="">Seleccionar Categoría</option>
                                                        {categories.map((cat) => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Pricing & Stock */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-700">Precio Venta</label>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                        <input
                                                            type="number"
                                                            value={price}
                                                            onChange={(e) => handlePriceChange(e.target.value)}
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-700">Costo Unit.</label>
                                                    <div className="relative">
                                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                        <input
                                                            type="number"
                                                            value={cost}
                                                            onChange={(e) => handleCostChange(e.target.value)}
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Imagen URL (Opcional)</label>
                                                <div className="relative">
                                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                    <input
                                                        type="text"
                                                        value={imageUrl}
                                                        onChange={(e) => setImageUrl(e.target.value)}
                                                        placeholder="https://..."
                                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Stock</label>
                                                <div className="relative">
                                                    <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                    <input
                                                        type="number"
                                                        value={stock}
                                                        onChange={(e) => setStock(e.target.value)}
                                                        placeholder="1"
                                                        min="1"
                                                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            {imageUrl && (
                                                <div className="p-2 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center">
                                                    <img src={imageUrl} alt="Preview" className="h-16 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add / Update Item Button */}
                                    {!isEditMode && (
                                        <div className="flex justify-end pt-4">
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md shadow-green-600/20"
                                            >
                                                <Plus className="w-4 h-4" />
                                                {editingItemId ? 'Actualizar Item' : 'Agregar Item'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Batch Items Table */}
                                {!isEditMode && batchItems.length > 0 && (
                                    <div className="mx-6 mb-6 border border-gray-200 rounded-xl overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                            <span className="text-sm font-semibold text-gray-700">Items del Lote ({batchItems.length})</span>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr className="text-left text-gray-500 text-xs uppercase">
                                                        <th className="px-4 py-2">#</th>
                                                        <th className="px-4 py-2">Producto</th>
                                                        <th className="px-4 py-2">SKU</th>
                                                        <th className="px-4 py-2 text-right">Stock</th>
                                                        <th className="px-4 py-2 text-right">Costo</th>
                                                        <th className="px-4 py-2 text-right">Precio</th>
                                                        <th className="px-4 py-2 text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {batchItems.map((item, index) => (
                                                        <tr
                                                            key={item.id}
                                                            onDoubleClick={() => handleDoubleClickItem(item)}
                                                            className={`cursor-pointer hover:bg-blue-50 transition-colors ${editingItemId === item.id ? 'bg-blue-100' : ''}`}
                                                        >
                                                            <td className="px-4 py-2 text-gray-400">{index + 1}</td>
                                                            <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                                                            <td className="px-4 py-2 text-gray-500">{item.sku || '-'}</td>
                                                            <td className="px-4 py-2 text-right">{item.stock}</td>
                                                            <td className="px-4 py-2 text-right font-mono">S/ {parseFloat(item.cost).toFixed(2)}</td>
                                                            <td className="px-4 py-2 text-right font-mono text-blue-600 font-bold">S/ {parseFloat(item.price).toFixed(2)}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center">
                                            <span className="text-xs text-gray-500">Doble-click para editar un item</span>
                                            <span className="text-sm font-bold text-gray-900">
                                                Total Costo: <span className="text-blue-600">S/ {totalCost.toFixed(2)}</span>
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Footer Buttons */}
                                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all shadow-md shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                        {isEditMode ? 'Actualizar Producto' : `Agregar Lote${batchItems.length > 0 ? ` (${batchItems.length})` : ''}`}
                                    </button>
                                </div>
                            </form>
                        </div>


                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
