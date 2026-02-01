import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';
import { clsx } from 'clsx';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
}

interface NotificationContextType {
    showNotification: (type: NotificationType, title: string, message: string, duration?: number) => void;
    removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

interface NotificationProviderProps {
    children: ReactNode;
}

const ICONS = {
    success: CheckCircle,
    error: AlertOctagon,
    warning: AlertTriangle,
    info: Info,
};

const COLORS = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-orange-500 text-white',
    info: 'bg-blue-500 text-white',
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const showNotification = useCallback((type: NotificationType, title: string, message: string, duration = 3000) => {
        const id = uuidv4();
        const newNotification = { id, type, title, message, duration };

        setNotifications((prev) => [newNotification, ...prev]);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                removeNotification(id);
            }, duration);
        }
    }, [removeNotification]);

    // Handle "Show All" or "Collapse" interactions
    const handleMouseEnter = () => notifications.length > 1 && setIsExpanded(true);
    const handleMouseLeave = () => setIsExpanded(false);

    // Determines visible notifications based on state
    // If expanded, show all. If collapsed, show top 3 stacked.
    const visibleNotifications = notifications;

    return (
        <NotificationContext.Provider value={{ showNotification, removeNotification }}>
            {children}

            {/* Notification Container */}
            <div
                className="fixed top-4 right-4 z-50 flex flex-col items-end pointer-events-none"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className={clsx(
                        "relative w-80 transition-all duration-300 pointer-events-auto",
                        isExpanded ? "space-y-2 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar" : "h-20"
                    )}
                >
                    <AnimatePresence mode="popLayout">
                        {visibleNotifications.map((notification, index) => {
                            // Logic for Stacking Effect
                            // Only calculate stack styles if NOT expanded
                            const stackScale = 1 - (index * 0.05);
                            const stackY = index * 10; // 10px increment
                            const stackOpacity = 1 - (index * 0.2); // Fade out items behind

                            // If collapsed, hide items beyond index 2 (top 3 only)
                            if (!isExpanded && index > 2) return null;

                            return (
                                <motion.div
                                    key={notification.id}
                                    layout
                                    initial={{ opacity: 0, x: 50, scale: 0.9 }}
                                    animate={{
                                        opacity: isExpanded ? 1 : stackOpacity,
                                        x: 0,
                                        y: isExpanded ? 0 : stackY,
                                        scale: isExpanded ? 1 : stackScale,
                                        zIndex: notifications.length - index,
                                    }}
                                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    onDragEnd={(_, info) => {
                                        if (Math.abs(info.offset.x) > 100) {
                                            removeNotification(notification.id);
                                        }
                                    }}
                                    className={clsx(
                                        "w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden cursor-grab active:cursor-grabbing",
                                        !isExpanded && "absolute top-0 right-0 origin-top-right",
                                        isExpanded && "relative"
                                    )}
                                    // Make stacked items clickable to expand
                                    onClick={() => !isExpanded && setIsExpanded(true)}
                                >
                                    <div className="flex bg-white">
                                        <div className={clsx("w-1.5", COLORS[notification.type].split(' ')[0])} />
                                        <div className="p-4 flex-1 flex gap-3 items-start">
                                            {(() => {
                                                const Icon = ICONS[notification.type];
                                                const textColor = notification.type === 'warning' ? 'text-orange-500' :
                                                    notification.type === 'error' ? 'text-red-500' :
                                                        notification.type === 'success' ? 'text-green-500' : 'text-blue-500';

                                                return <Icon className={clsx("w-5 h-5 flex-shrink-2 mt-0.5", textColor)} />;
                                            })()}

                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-gray-900">{notification.title}</h4>
                                                <p className="text-sm text-gray-500 mt-1 leading-tight">{notification.message}</p>
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeNotification(notification.id);
                                                }}
                                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Progress Bar (Optional - conceptual) */}
                                    {notification.duration && notification.duration > 0 && (
                                        <motion.div
                                            initial={{ width: "100%" }}
                                            animate={{ width: "0%" }}
                                            transition={{ duration: notification.duration / 1000, ease: "linear" }}
                                            className={clsx("h-0.5", COLORS[notification.type].split(' ')[0])}
                                        />
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Indicator if more items are hidden in stack */}
                {!isExpanded && notifications.length > 3 && (
                    <div className="mt-2 mr-2 text-xs font-medium text-gray-400 bg-white/80 px-2 py-1 rounded-full shadow-sm border border-gray-200">
                        +{notifications.length - 3} más
                    </div>
                )}
            </div>
        </NotificationContext.Provider>
    );
};
