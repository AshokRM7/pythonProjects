import React from 'react';
import {
    CheckCircle2,
    Bot,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Stage {
    id: number;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    message: string;
}

interface HorizontalStageTrackerProps {
    stages: Stage[];
    ticketStatus: string;
}

export const HorizontalStageTracker: React.FC<HorizontalStageTrackerProps> = ({ stages = [] }) => {
    // Only show stages that are NOT pending
    const visibleStages = stages.filter(s => s.status !== 'pending');

    // If no stages are visible yet, we show nothing or maybe just a placeholder
    if (visibleStages.length === 0) return null;

    return (
        <div className="w-full py-4 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max px-2">
                <AnimatePresence mode="popLayout">
                    {visibleStages.map((stage, index) => {
                        const isLast = index === visibleStages.length - 1;
                        const isCompleted = stage.status === 'completed';
                        const isCurrent = stage.status === 'in-progress';
                        const isError = stage.status === 'error';

                        return (
                            <React.Fragment key={stage.id}>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${isCurrent
                                            ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100 min-w-[200px]'
                                            : isError
                                                ? 'bg-red-50 border-red-200'
                                                : 'bg-white border-gray-100 shadow-sm'
                                        }`}
                                >
                                    {/* Icon Container */}
                                    <div className="flex-shrink-0">
                                        {isCompleted && (
                                            <div className="bg-green-100 p-1.5 rounded-full">
                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            </div>
                                        )}
                                        {isCurrent && (
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-blue-400 blur-md opacity-30 animate-pulse rounded-full" />
                                                <div className="relative bg-white p-1.5 rounded-full border-2 border-blue-500 shadow-sm">
                                                    <Bot className="w-6 h-6 text-blue-600 animate-bounce" />
                                                </div>
                                            </div>
                                        )}
                                        {isError && (
                                            <div className="bg-red-100 p-1.5 rounded-full">
                                                <AlertCircle className="w-5 h-5 text-red-600" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Stage Info (Only for current or error) */}
                                    <div className="flex flex-col">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-blue-700' : isError ? 'text-red-700' : 'text-gray-500'
                                            }`}>
                                            {stage.name}
                                        </span>
                                        {isCurrent && stage.message && (
                                            <span className="text-[10px] text-blue-600 font-medium truncate max-w-[150px] italic">
                                                {stage.message}
                                            </span>
                                        )}
                                        {isCompleted && (
                                            <span className="text-[10px] text-green-600 font-bold uppercase">Completed</span>
                                        )}
                                    </div>
                                </motion.div>

                                {/* Connector */}
                                {!isLast && (
                                    <motion.div
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        className="h-px w-6 bg-gray-200 flex-shrink-0 origin-left"
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};
