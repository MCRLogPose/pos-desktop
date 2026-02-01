import { useState, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { useNotification } from '@/context/NotificationContext';

// Mock Data
const CATEGORIES = [
    { id: 'all', name: 'Todos' },
    { id: 'coffee', name: 'Café' },
    { id: 'pastry', name: 'Pastelería' },
    { id: 'food', name: 'Comida' },
    { id: 'drinks', name: 'Bebidas' },
];

const PRODUCTS = [
    { id: 1, name: 'Cappuccino', price: 8.50, category: 'coffee', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&q=80' },
    { id: 2, name: 'Espresso', price: 6.00, category: 'coffee', image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80' },
    { id: 3, name: 'Latte', price: 9.00, category: 'coffee', image: 'https://images.unsplash.com/photo-1561882468-411333a76845?w=400&q=80' },
    { id: 4, name: 'Croissant', price: 5.50, category: 'pastry', image: 'https://images.unsplash.com/photo-1555507036-ab1f40388085?w=400&q=80' },
    { id: 5, name: 'Muffin Arándanos', price: 6.50, category: 'pastry', image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&q=80' },
    { id: 6, name: 'Sandwich Pollo', price: 12.00, category: 'food', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80' },
    { id: 7, name: 'Jugo Naranja', price: 7.00, category: 'drinks', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80' },
    { id: 8, name: 'Agua Mineral', price: 3.50, category: 'drinks', image: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?w=400&q=80' },
];

const POSPage = () => {
    const [cart, setCart] = useState<{ product: typeof PRODUCTS[0], quantity: number, id: string }[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const { showNotification } = useNotification();

    const addToCart = (product: typeof PRODUCTS[0]) => {
        const existingItem = cart.find(item => item.product.id === product.id);
        if (existingItem) {
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
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQuantity = item.quantity + delta;
                return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
            }
            return item;
        }));
    };

    const filteredProducts = useMemo(() => {
        return PRODUCTS.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const total = subtotal; // Usually prices include tax in POS
    const base = total / 1.18;
    const igv = total - base;

    const handleCheckout = () => {
        // Simulate API call
        setTimeout(() => {
            showNotification('success', 'Venta Exitosa', 'Venta realizada y factura emitida correctamente');
            setCart([]);
            setIsCheckoutOpen(false);
        }, 1500);
    };

    return (
        <div className="flex h-[calc(100vh-2rem)] gap-6">
            {/* Products Section */}
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

                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={clsx(
                                    "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
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

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="group cursor-pointer bg-white rounded-xl border border-gray-100 hover:border-blue-500 hover:shadow-md transition-all overflow-hidden"
                            >
                                <div className="aspect-4/3 bg-gray-100 relative overflow-hidden">
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                </div>
                                <div className="p-3">
                                    <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                                    <p className="text-blue-600 font-bold">S/ {product.price.toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cart Section */}
            <div className="w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Orden Actual
                    </h2>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        #{Math.floor(Math.random() * 10000)}
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
                                <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0 border border-gray-200">
                                    <img src={item.product.image} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-medium text-sm truncate pr-2">{item.product.name}</h4>
                                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <p className="text-blue-600 font-bold text-sm">S/ {(item.product.price * item.quantity).toFixed(2)}</p>
                                        <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-1 py-0.5">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
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
                            <span>Subtotal</span>
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

            {/* Checkout Modal (Custom Implementation) */}
            <AnimatePresence>
                {isCheckoutOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsCheckoutOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-xl font-bold">Procesar Pago</h3>
                                <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="text-center py-4">
                                    <p className="text-gray-500 mb-1">Total a Pagar</p>
                                    <p className="text-4xl font-bold text-gray-900">S/ {total.toFixed(2)}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setPaymentMethod('cash')}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                                            paymentMethod === 'cash'
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-gray-100 hover:border-gray-200 text-gray-600"
                                        )}
                                    >
                                        <Banknote className="w-8 h-8" />
                                        <span className="font-medium">Efectivo</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('card')}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
                                            paymentMethod === 'card'
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-gray-100 hover:border-gray-200 text-gray-600"
                                        )}
                                    >
                                        <CreditCard className="w-8 h-8" />
                                        <span className="font-medium">Tarjeta</span>
                                    </button>
                                </div>

                                {/* Mock Client Info */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Cliente (Opcional - DNI/RUC)</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input type="text" placeholder="Ingrese documento" className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl" />
                                    </div>
                                </div>

                                <button
                                    onClick={handleCheckout}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-green-600/20 transition-all hover:translate-y-[-2px]"
                                >
                                    Confirmar Pago
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default POSPage;