import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, ArrowRight, EyeOff, Eye, Power, Store as StoreIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

import Lottie from "lottie-react";
import shoppingBagAnim from "@/assets/lotties/Shopping-Bag.json";
import { useState, useEffect } from 'react';
import { exit } from "@tauri-apps/plugin-process";

interface Store {
    id: number;
    name: string;
}

export default function LoginCard() {
    const { login, setActiveStoreId } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
    const [passwordVisible, setPasswordVisible] = useState(false);
    
    const [step, setStep] = useState<'login' | 'select_store'>('login');
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [loggedInUser, setLoggedInUser] = useState<any>(null);

    const onSubmit = async (data: any) => {
        try {
            // First login attempt
            await login(data.username, data.password);
            
            // Re-fetch user from localStorage to see cargo/store_id
            const stored = localStorage.getItem('pos_user');
            if (stored) {
                const user = JSON.parse(stored);
                setLoggedInUser(user);
                
                if (user.cargo === 'ADMIN') {
                    // Admin gets to choose store
                    const fetchedStores = await invoke<Store[]>('get_stores');
                    setStores(fetchedStores);
                    setStep('select_store');
                } else if (user.store_id) {
                    // Regular user proceeds with their assigned store
                    toast.success(`Bienvenido de nuevo, ${data.username}`);
                    const from = (location.state as any)?.from?.pathname || '/home';
                    navigate(from, { replace: true });
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(typeof error === 'string' ? error : 'Credenciales inválidas');
        }
    };

    const handleStoreSelect = () => {
        if (!selectedStoreId) {
            toast.error('Por favor selecciona una tienda');
            return;
        }
        
        setActiveStoreId(parseInt(selectedStoreId));
        toast.success(`Bienvenido de nuevo, ${loggedInUser?.username}`);
        const from = (location.state as any)?.from?.pathname || '/home';
        navigate(from, { replace: true });
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-10 border border-white/20 relative z-10"
        >
            <div className="mb-8 text-center">
                <div className="w-26 h-26 flex items-center justify-center mx-auto mb-4 rotate-3">
                    <div className="w-26 h-26">
                        <Lottie animationData={shoppingBagAnim} loop={true} />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">VestikPOS</h1>
                <p className="text-gray-500 mt-2 text-sm">
                    {step === 'login' ? 'Tu punto de venta inteligente' : 'Selecciona una sucursal para continuar'}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {step === 'login' ? (
                    <motion.form 
                        key="login-form"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleSubmit(onSubmit)} 
                        className="space-y-5"
                    >
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 ml-1 uppercase tracking-wider">Usuario</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-600 transition-colors w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Ingresa tu usuario"
                                    {...register('username', { required: 'Usuario es requerido' })}
                                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 text-gray-900 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                                />
                            </div>
                            {errors.username && <span className="text-red-500 text-xs ml-1 font-medium">{errors.username.message as string}</span>}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 ml-1 uppercase tracking-wider">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-600 transition-colors w-5 h-5" />
                                <input
                                    type={passwordVisible ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    {...register('password', { required: 'Contraseña es requerida' })}
                                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 text-gray-900 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setPasswordVisible(!passwordVisible)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {passwordVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.password && <span className="text-red-500 text-xs ml-1 font-medium">{errors.password.message as string}</span>}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Ingresar
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => exit(0)}
                            className="w-full bg-white/50 hover:bg-red-50 text-gray-600 hover:text-red-600 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-100 hover:border-red-100"
                        >
                            <Power className="w-4 h-4" />
                            Cerrar Sistema
                        </button>
                    </motion.form>
                ) : (
                    <motion.div 
                        key="store-select"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-5"
                    >
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 ml-1 uppercase tracking-wider">Tienda / Sucursal</label>
                            <div className="relative group">
                                <StoreIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-600 transition-colors w-5 h-5" />
                                <select
                                    value={selectedStoreId}
                                    onChange={(e) => setSelectedStoreId(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-200 text-gray-900 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium appearance-none"
                                >
                                    <option value="">Selecciona una tienda</option>
                                    {stores.map(store => (
                                        <option key={store.id} value={store.id}>{store.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleStoreSelect}
                            className="w-full bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                        >
                            Continuar a la Tienda
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <button
                            type="button"
                            onClick={() => setStep('login')}
                            className="w-full bg-white/50 hover:bg-gray-100 text-gray-600 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 border border-gray-100"
                        >
                            Volver al login
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="mt-8 text-center text-xs text-gray-400 font-medium">
                <p>Versión Demo v1.0.0</p>
            </div>
        </motion.div>
    );
}
