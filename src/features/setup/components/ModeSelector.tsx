import { Monitor, Server, Wifi } from 'lucide-react';

type ModeColor = 'blue' | 'green' | 'purple';
type ModeId = 'primary' | 'replica' | 'hybrid';

interface ModeSelectorProps {
    selected: ModeId | null;
    onSelect: (mode: ModeId) => void;
}

const modes = [
    {
        id: 'primary' as ModeId,
        title: 'Primary',
        subtitle: 'Computadora Central',
        description: 'Almacena toda la información del negocio. Recibe datos de las terminales. Genera reportes consolidados.',
        icon: Server,
        color: 'blue' as ModeColor,
        features: ['Almacenamiento ilimitado', 'Reportes globales', 'Gestión de tiendas', 'Recibe sincronización'],
    },
    {
        id: 'replica' as ModeId,
        title: 'Replica',
        subtitle: 'Terminal de Venta',
        description: 'Terminal ligera que realiza ventas y envía datos diariamente a la Primary.',
        icon: Wifi,
        color: 'green' as ModeColor,
        features: ['Punto de Venta', 'Gestión de caja', 'Envío diario de datos', 'Retención 31 días'],
    },
    {
        id: 'hybrid' as ModeId,
        title: 'Hybrid',
        subtitle: 'Independiente',
        description: 'Estación completa sin dependencia de red. Todo el control en un solo punto.',
        icon: Monitor,
        color: 'purple' as ModeColor,
        features: ['Todos los módulos', 'Sin sincronización', 'Sin dependencia de red', 'Autónomo'],
    },
];

const colorClasses = {
    blue: {
        border: 'border-blue-200 hover:border-blue-400',
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-700',
        ring: 'ring-blue-500',
    },
    green: {
        border: 'border-green-200 hover:border-green-400',
        bg: 'bg-green-50',
        icon: 'text-green-600',
        badge: 'bg-green-100 text-green-700',
        ring: 'ring-green-500',
    },
    purple: {
        border: 'border-purple-200 hover:border-purple-400',
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700',
        ring: 'ring-purple-500',
    },
};

export default function ModeSelector({ selected, onSelect }: ModeSelectorProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {modes.map((mode) => {
                const colors = colorClasses[mode.color];
                const isSelected = selected === mode.id;
                const Icon = mode.icon;

                return (
                    <button
                        key={mode.id}
                        type="button"
                        onClick={() => onSelect(mode.id)}
                        className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                            isSelected
                                ? `${colors.border} ${colors.bg} ring-2 ${colors.ring} shadow-lg`
                                : `border-gray-200 hover:border-gray-300 bg-white hover:shadow-md`
                        }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${isSelected ? colors.bg : 'bg-gray-100'}`}>
                                <Icon className={`w-6 h-6 ${isSelected ? colors.icon : 'text-gray-500'}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-gray-900">{mode.title}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                                        {mode.subtitle}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-500 mb-3">{mode.description}</p>
                                <ul className="space-y-1.5">
                                    {mode.features.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2 text-xs text-gray-600">
                                            <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? colors.icon.replace('text-', 'bg-') : 'bg-gray-300'}`} />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        {isSelected && (
                            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full ${colors.bg} flex items-center justify-center`}>
                                <div className={`w-3 h-3 rounded-full ${colors.icon.replace('text-', 'bg-')}`} />
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
