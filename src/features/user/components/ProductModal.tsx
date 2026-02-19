import { useState, useEffect } from 'react';
import { X, Package, DollarSign, BarChart3, Layers, Image as ImageIcon, Tag, Percent } from 'lucide-react';
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

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void; // Trigger reload
    initialData?: Product | null;
    categories: Category[];
}

export default function ProductModal({ isOpen, onClose, onSubmit, initialData, categories }: ProductModalProps) {
    const { showNotification } = useNotification();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [price, setPrice] = useState('0');
    const [cost, setCost] = useState('0');
    const [stock, setStock] = useState('0');
    const [unit, setUnit] = useState('Unidades');
    const [imageUrl, setImageUrl] = useState('');

    // Simulation States (Not saved in DB)
    const [profitPercent, setProfitPercent] = useState('0');

    // Derived values
    const profitAmount = (parseFloat(price) || 0) - (parseFloat(cost) || 0);

    // Handlers for reactive updates
    const handlePriceChange = (val: string) => {
        setPrice(val);
        const p = parseFloat(val) || 0;
        const c = parseFloat(cost) || 0;
        if (c > 0) {
            const percent = ((p - c) / c) * 100;
            setProfitPercent(percent < 0 ? '0' : percent.toFixed(2));
        } else if (p > 0) {
            setProfitPercent('100'); // Or some logic for 0 cost
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
                setName(initialData.name);
                setCode(initialData.code || '');
                setCategoryId(initialData.category_id);
                setPrice(initialData.price.toString());
                setCost(initialData.cost.toString());
                setStock(initialData.stock.toString());
                setUnit(initialData.unit || 'Unidades');
                setImageUrl(initialData.image_url || '');

                // Initial percent calculation
                const p = initialData.price;
                const c = initialData.cost;
                if (c > 0) {
                    setProfitPercent((((p - c) / c) * 100).toFixed(2));
                }
            } else {
                resetForm();
            }
        }
    }, [initialData, isOpen]);

    const resetForm = () => {
        setName('');
        setCode('');
        setCategoryId(null);
        setPrice('0');
        setCost('0');
        setStock('0');
        setUnit('Unidades');
        setImageUrl('');
        setProfitPercent('0');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            showNotification('warning', 'Faltan datos', 'El nombre es obligatorio');
            return;
        }

        setIsSubmitting(true);
        try {
            // Parse numbers
            const priceVal = parseFloat(price) || 0;
            const costVal = parseFloat(cost) || 0;
            const stockVal = parseInt(stock) || 0;

            if (initialData) {
                await invoke('update_product', {
                    id: initialData.id,
                    code: code || null,
                    name,
                    categoryId: categoryId || null,
                    price: priceVal,
                    cost: costVal,
                    stock: stockVal,
                    unit: unit || null,
                    imageUrl: imageUrl || null
                });
                showNotification('success', 'Éxito', 'Producto actualizado');
            } else {
                await invoke('create_product', {
                    code: code || null,
                    name,
                    categoryId: categoryId || null,
                    price: priceVal,
                    cost: costVal,
                    stock: stockVal,
                    unit: unit || null,
                    imageUrl: imageUrl || null
                });
                showNotification('success', 'Éxito', 'Producto creado');
            }
            onSubmit();
            onClose();
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'Error al guardar el producto');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl pointer-events-auto overflow-hidden max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm z-10">
                                <h3 className="text-lg font-bold text-gray-900">
                                    {initialData ? 'Editar Producto' : 'Nuevo Producto'}
                                </h3>
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column: Basic Info */}
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
                                                required
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">Código / SKU (Opcional)</label>
                                        <div className="relative">
                                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                            <input
                                                type="text"
                                                value={code}
                                                onChange={(e) => setCode(e.target.value)}
                                                placeholder="Ej. PROD-001"
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                                            >
                                                <option value="">Seleccionar Categoría</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
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
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Pricing & Stock */}
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
                                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
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
                                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Simulation Section */}
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

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Stock Actual</label>
                                            <div className="relative">
                                                <BarChart3 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                <input
                                                    type="number"
                                                    value={stock}
                                                    onChange={(e) => setStock(e.target.value)}
                                                    placeholder="0"
                                                    min="0"
                                                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700">Unidad</label>
                                            <input
                                                type="text"
                                                value={unit}
                                                onChange={(e) => setUnit(e.target.value)}
                                                placeholder="Unidades"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Image Preview (Optional) */}
                                    {imageUrl && (
                                        <div className="mt-4 p-2 border border-gray-100 rounded-lg bg-gray-50 flex items-center justify-center">
                                            <img src={imageUrl} alt="Preview" className="h-24 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-2 pt-4 flex justify-end gap-3 border-t border-gray-50 mt-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all shadow-md shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                        {initialData ? 'Actualizar Producto' : 'Crear Producto'}
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
