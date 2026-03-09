import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/core';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import CheckoutModal from '../components/modals/CheckoutModal';

// ─── Types ───────────────────────────────────────────────────
interface Category {
    id: number;
    name: string;
}

interface Product {
    id: number;
    code: string | null;
    name: string;
    category_id: number | null;
    category_name: string | null;
    price: number;
    cost: number;
    stock: number;
    min_stock: number | null;
    unit: string | null;
    image_url: string | null;
    is_active: boolean;
}

interface CartItem {
    id: string;       // uuid for cart key
    product: Product;
    quantity: number;
    customPrice?: number; // override price for this sale only
}

type PaymentMethod = 'cash' | 'card' | 'yape';

// ─── Component ───────────────────────────────────────────────
const POSPage = () => {
    const { showNotification } = useNotification();
    const { user } = useAuth();

    // Data from DB
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Checkout modal
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [clientDocument, setClientDocument] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientName, setClientName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // ─── Load data ──────────────────────────────────────────
    const loadProducts = useCallback(async () => {
        try {
            const data = await invoke<Product[]>('get_products');
            setProducts(data);
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'No se pudieron cargar los productos');
        }
    }, [showNotification]);

    const loadCategories = useCallback(async () => {
        try {
            const data = await invoke<Category[]>('get_categories');
            setCategories(data);
        } catch (error) {
            console.error(error);
            showNotification('error', 'Error', 'No se pudieron cargar las categorías');
        }
    }, [showNotification]);

    useEffect(() => {
        const init = async () => {
            setIsLoadingProducts(true);
            await Promise.all([loadProducts(), loadCategories()]);
            setIsLoadingProducts(false);
        };
        init();
    }, [loadProducts, loadCategories]);

    // ─── Cart helpers ────────────────────────────────────────
    const addToCart = (product: Product) => {
        if (product.stock <= 0) {
            showNotification('warning', 'Sin stock', `"${product.name}" no tiene stock disponible`);
            return;
        }

        const existingItem = cart.find(item => item.product.id === product.id);
        if (existingItem) {
            if (existingItem.quantity >= product.stock) {
                showNotification('warning', 'Stock máximo', `Solo hay ${product.stock} unidad(es) disponibles de "${product.name}"`);
                return;
            }
            setCart(cart.map(item =>
                item.product.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { product, quantity: 1, id: uuidv4() }]);
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prevCart => prevCart.reduce<CartItem[]>((acc, item) => {
            if (item.id === id) {
                const newQty = item.quantity + delta;
                if (newQty <= 0) return acc; // remove item
                if (newQty > item.product.stock) {
                    showNotification('warning', 'Stock máximo', `Solo hay ${item.product.stock} unidad(es) disponibles`);
                    return [...acc, item];
                }
                return [...acc, { ...item, quantity: newQty }];
            }
            return [...acc, item];
        }, []));
    };

    const updateCustomPrice = (id: string, value: string) => {
        const parsed = parseFloat(value);
        setCart(prev => prev.map(item =>
            item.id === id
                ? { ...item, customPrice: isNaN(parsed) || parsed < 0 ? 0 : parsed }
                : item
        ));
    };

    const effectivePrice = (item: CartItem) => item.customPrice ?? item.product.price;

    // ─── Filtering ───────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.code && product.code.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, searchQuery]);

    // ─── Totals ──────────────────────────────────────────────
    const subtotal = cart.reduce((sum, item) => sum + ((item.customPrice ?? item.product.price) * item.quantity), 0);
    const total = subtotal;
    const base = total / 1.18;
    const igv = total - base;

    // ─── Checkout ─────────────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!user) {
            showNotification('error', 'Error', 'Debes iniciar sesión para realizar ventas');
            return;
        }

        setIsProcessing(true);
        try {
            const items = cart.map(item => ({
                product_id: item.product.id,
                product_name: item.product.name,
                unit_price: item.customPrice ?? item.product.price,
                quantity: item.quantity,
                subtotal: (item.customPrice ?? item.product.price) * item.quantity,
            }));

            await invoke<number>('create_sale', {
                userId: user.id,
                clientDocument: clientDocument.trim() || null,
                clientPhone: clientPhone.trim() || null,
                clientName: clientName.trim() || null,
                paymentMethod,
                items,
                subtotal: base,
                igv,
                total,
            });

            showNotification('success', '¡Venta Exitosa!', `Venta registrada correctamente. Total: S/ ${total.toFixed(2)}`);
            setCart([]);
            setClientDocument('');
            setClientPhone('');
            setClientName('');
            setPaymentMethod('cash');
            setIsCheckoutOpen(false);

            // Reload products to reflect updated stock
            await loadProducts();
        } catch (error) {
            console.error(error);
            const message = typeof error === 'string' ? error : 'Error al procesar la venta';
            showNotification('error', 'Error en la venta', message);
        } finally {
            setIsProcessing(false);
        }
    };

    // ─── Stock badge helper ───────────────────────────────────
    const getStockBadge = (product: Product) => {
        if (product.stock === 0) return { cls: 'bg-red-100 text-red-700', label: 'Agotado' };
        if (product.stock <= (product.min_stock ?? 5)) return { cls: 'bg-yellow-100 text-yellow-600', label: `${product.stock} uds` };
        return { cls: 'bg-green-100 text-green-700', label: `${product.stock} uds` };
    };

    // ─── Render ───────────────────────────────────────────────
    return (
        <div className="flex h-[calc(100vh-2rem)] gap-6">

            {/* ── Products Section ── */}
            <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Header / Filter */}
                <div className="p-4 border-b border-gray-100 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Category tags */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            key="all"
                            onClick={() => setSelectedCategory('all')}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                                selectedCategory === 'all'
                                    ? "bg-slate-900 text-white"
                                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                            )}
                        >
                            Todos
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={clsx(
                                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                                    selectedCategory === cat.id
                                        ? "bg-slate-900 text-white"
                                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                )}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoadingProducts ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm">Cargando productos...</p>
                            </div>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                            <Package className="w-14 h-14 opacity-20" />
                            <p>No se encontraron productos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map(product => {
                                const badge = getStockBadge(product);
                                const outOfStock = product.stock === 0;
                                return (
                                    <div
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        className={clsx(
                                            "group cursor-pointer bg-white rounded-xl border transition-all overflow-hidden",
                                            outOfStock
                                                ? "border-gray-100 opacity-50 cursor-not-allowed"
                                                : "border-gray-100 hover:border-blue-500 hover:shadow-md"
                                        )}
                                    >
                                        <div className="aspect-4/3 bg-gray-100 relative overflow-hidden">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <Package className="w-10 h-10" />
                                                </div>
                                            )}
                                            {/* Stock badge */}
                                            <span className={clsx("absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full", badge.cls)}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <div className="p-3">
                                            <h3 className="font-semibold text-gray-900 truncate text-sm">{product.name}</h3>
                                            {product.category_name && (
                                                <p className="text-xs text-gray-400 truncate">{product.category_name}</p>
                                            )}
                                            <p className="text-blue-600 font-bold mt-1">S/ {product.price.toFixed(2)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Cart Section ── */}
            <div className="w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Orden Actual
                    </h2>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        {cart.length} ítem{cart.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                            <ShoppingCart className="w-12 h-12 opacity-20" />
                            <p>Carrito vacío</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="w-14 h-14 rounded-lg bg-white overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center text-gray-300">
                                    {item.product.image_url ? (
                                        <img src={item.product.image_url} className="w-full h-full object-cover" alt={item.product.name} />
                                    ) : (
                                        <Package className="w-6 h-6" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-medium text-sm truncate pr-2">{item.product.name}</h4>
                                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Price editor */}
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-xs text-gray-400">S/</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.10"
                                            value={item.customPrice ?? item.product.price}
                                            onChange={e => updateCustomPrice(item.id, e.target.value)}
                                            className="w-20 text-sm font-semibold text-blue-600 bg-white border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        />
                                        {item.customPrice !== undefined && item.customPrice !== item.product.price && (
                                            <span className="text-xs text-amber-500 line-through">{item.product.price.toFixed(2)}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-end mt-1">
                                        <p className="text-xs text-gray-400">Total: <span className="font-semibold text-gray-700">S/ {(effectivePrice(item) * item.quantity).toFixed(2)}</span></p>
                                        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-1 py-0.5">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-gray-200">
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Subtotal (sin IGV)</span>
                            <span>S/ {base.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>IGV (18%)</span>
                            <span>S/ {igv.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                            <span>Total</span>
                            <span>S/ {total.toFixed(2)}</span>
                        </div>
                    </div>

                    <button
                        disabled={cart.length === 0}
                        onClick={() => setIsCheckoutOpen(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                    >
                        Cobrar S/ {total.toFixed(2)}
                    </button>
                </div>
            </div>

            <CheckoutModal
                isOpen={isCheckoutOpen}
                isProcessing={isProcessing}
                total={total}
                base={base}
                igv={igv}
                itemCount={cart.length}
                paymentMethod={paymentMethod}
                clientDocument={clientDocument}
                clientPhone={clientPhone}
                clientName={clientName}
                onClose={() => setIsCheckoutOpen(false)}
                onConfirm={handleCheckout}
                onPaymentMethodChange={setPaymentMethod}
                onClientDocumentChange={setClientDocument}
                onClientPhoneChange={setClientPhone}
                onClientNameChange={setClientName}
            />
        </div>
    );
};

export default POSPage;