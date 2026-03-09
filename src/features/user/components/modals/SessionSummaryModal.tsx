import React from 'react';
import { X, CheckCircle2, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface SessionSummaryModalProps {
    session: any;
    onClose: () => void;
}

const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({ session, onClose }) => {
    if (!session) return null;

    const totalExpected = session.expected_closing_cash + session.expected_closing_virtual;
    const totalReal = (session.real_closing_cash || 0) + (session.real_closing_virtual || 0);
    const difference = session.difference || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 text-center bg-slate-50 border-b border-gray-100 relative">
                    <button 
                        onClick={onClose}
                        className="absolute right-6 top-6 p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                    
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    
                    <h2 className="text-2xl font-black text-gray-900 leading-tight">Cierre de Caja Exitoso</h2>
                    <p className="text-gray-500 mt-2 font-medium">Resumen de la sesión finalizada</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl flex justify-between items-center">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Esperado</p>
                            <p className="text-xl font-black italic opacity-50">S/ {totalExpected.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Real</p>
                            <p className="text-3xl font-black">S/ {totalReal.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Efectivo Real</p>
                            <p className="text-xl font-black text-slate-900">S/ {(session.real_closing_cash || 0).toFixed(2)}</p>
                        </div>
                        <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Virtual Real</p>
                            <p className="text-xl font-black text-slate-900">S/ {(session.real_closing_virtual || 0).toFixed(2)}</p>
                        </div>
                    </div>

                    <div className={clsx(
                        "p-6 rounded-3xl flex items-center justify-between border-2 shadow-sm",
                        difference === 0 ? "bg-green-50 border-green-100 text-green-700" :
                        difference > 0 ? "bg-blue-50 border-blue-100 text-blue-700" :
                        "bg-red-50 border-red-100 text-red-700"
                    )}>
                        <div className="flex items-center gap-3">
                            <div className={clsx(
                                "p-2 rounded-xl",
                                difference === 0 ? "bg-green-100" : difference > 0 ? "bg-blue-100" : "bg-red-100"
                            )}>
                                {difference === 0 ? <Minus className="w-5 h-5" /> : difference > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                            </div>
                            <span className="font-bold">Diferencia Total</span>
                        </div>
                        <span className="text-2xl font-black tracking-tight">S/ {difference.toFixed(2)}</span>
                    </div>

                    {session.justification && (
                        <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-xl relative overflow-hidden group">
                            <div className="relative z-10">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> Justificación
                                </p>
                                <p className="text-sm font-medium leading-relaxed italic">"{session.justification}"</p>
                            </div>
                            <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <FileText className="w-20 h-20" />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-3xl transition-all shadow-lg active:scale-[0.98] mt-2"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionSummaryModal;
