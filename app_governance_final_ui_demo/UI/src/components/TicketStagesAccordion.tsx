import React from 'react';
import {
    AlertCircle,
    Clock,
    ShieldCheck,
    Database,
    UserCheck,
    FileText,
    Download,
    Tag,
    UserPlus,
    FileSearch,
    Archive,
    Bot,
    Loader2
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';

interface Stage {
    id: number;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    message: string;
}

interface TicketStagesAccordionProps {
    stages?: Stage[]; // Made optional to prevent crash
    ticketStatus: string;
}

export const TicketStagesAccordion: React.FC<TicketStagesAccordionProps> = ({ stages = [], ticketStatus }) => {

    // Safety check for empty stages
    if (!stages || stages.length === 0) {
        return (
            <div className="p-4 bg-gray-50 text-center text-gray-500 text-sm">
                No stage information available.
            </div>
        );
    }

    // Helper to determine the visual state of a stage
    const getStageState = (stage: Stage) => {
        const isTicketDone = ticketStatus === 'completed' || ticketStatus === 'closed';
        if (isTicketDone) return 'completed';
        if (stage.status === 'completed') return 'completed';
        if (stage.status === 'in-progress') return 'in-progress';
        if (stage.status === 'error') return 'error';
        return 'pending';
    };

    // Calculate active index for the traveling bot
    const activeIndex = stages.findIndex(s => s.status === 'in-progress');
    const errorIndex = stages.findIndex(s => s.status === 'error');

    // Bot should travel to the active stage, or the error stage if it halted there
    const displayIndex = activeIndex !== -1 ? activeIndex :
        (errorIndex !== -1 ? errorIndex :
            (ticketStatus === 'completed' || ticketStatus === 'closed' ? stages.length : 0));

    // Helper to get specific icon for each stage
    const getStageIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('fetch')) return <Download className="w-5 h-5" />;
        if (n.includes('category')) return <Tag className="w-5 h-5" />;
        if (n.includes('sla') || n.includes('priorit')) return <Clock className="w-5 h-5" />;
        if (n.includes('ownership')) return <UserPlus className="w-5 h-5" />;
        if (n.includes('owner check')) return <UserCheck className="w-5 h-5" />;
        if (n.includes('remediation') || n.includes('iam')) return <ShieldCheck className="w-5 h-5" />;
        if (n.includes('evidence')) return <FileSearch className="w-5 h-5" />;
        if (n.includes('closure') || n.includes('close')) return <Archive className="w-5 h-5" />;
        if (n.includes('log')) return <FileText className="w-5 h-5" />;
        return <Database className="w-5 h-5" />;
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0, height: 0 },
        show: {
            opacity: 1,
            height: 'auto',
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, x: -10 },
        show: { opacity: 1, x: 0 }
    };

    return (
        <motion.div
            initial="hidden"
            animate="show"
            variants={containerVariants}
            className="bg-gray-50/50 border-t border-gray-100 p-6 rounded-b-xl relative overflow-hidden"
        >
            {/* Dynamic Header based on Active Stage */}
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-6 pl-2 flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-500" />
                {activeIndex !== -1 ? `Current Agent: ${stages[activeIndex].name}` : 'Live Agent Execution'}
            </h4>

            <div className="space-y-0 relative pl-4">
                {/* Timeline Tracks */}
                <div className="absolute left-[34px] top-6 bottom-8 w-0.5 bg-gray-200 z-0" />

                {/* Progress Track (Green for completed stages) */}
                <motion.div
                    className="absolute left-[34px] top-6 w-0.5 bg-green-500 z-10 origin-top"
                    initial={{ scaleY: 0 }}
                    animate={{
                        scaleY: stages.length > 0
                            ? (displayIndex / (stages.length - 1))
                            : 0
                    }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    style={{ height: 'calc(100% - 3.5rem)' }}
                />

                {stages.map((stage) => {
                    const status = getStageState(stage);
                    const isActive = status === 'in-progress';
                    const isCompleted = status === 'completed';
                    const isError = status === 'error';
                    const icon = getStageIcon(stage.name);

                    return (
                        <motion.div
                            key={stage.id}
                            variants={itemVariants}
                            className={`relative z-10 flex gap-6 pb-8 last:pb-0 group min-h-[80px]`}
                        >
                            {/* Icon Indicator & Traveling Bot */}
                            <div className="relative flex-shrink-0 w-10">
                                {(isActive || (isError && activeIndex === -1)) && (
                                    <motion.div
                                        layoutId="active-bot-indicator"
                                        className="absolute -left-1 -top-1 z-30"
                                        transition={{
                                            type: "spring",
                                            stiffness: 250,
                                            damping: 25,
                                            mass: 1
                                        }}
                                    >
                                        <div className="relative">
                                            {/* Glow Effect - Red for error, Blue for progress */}
                                            <div className={`absolute inset-0 blur-md opacity-40 animate-pulse rounded-full ${isError ? 'bg-red-400' : 'bg-blue-400'}`} />

                                            <div className={`relative bg-white rounded-full p-1 border-2 shadow-lg ${isError ? 'border-red-500' : 'border-blue-500'}`}>
                                                <Bot className={`w-8 h-8 ${isError ? 'text-red-600 fill-red-50' : 'text-blue-600 fill-blue-50'}`} />
                                            </div>

                                            {/* Status Badge */}
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isError ? 'bg-red-400' : 'bg-blue-400'}`}></span>
                                                <span className={`relative inline-flex rounded-full h-4 w-4 border border-white ${isError ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                                            </span>
                                        </div>
                                    </motion.div>
                                )}

                                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center bg-white transition-all duration-300 relative z-10
                                    ${isCompleted ? 'border-green-500 bg-green-50 text-green-600' :
                                        isActive ? 'border-blue-200' :
                                            isError ? 'border-red-500 bg-red-50 text-red-600' :
                                                'border-gray-200 text-gray-300'
                                    } ${isCompleted ? 'shadow-[0_0_10px_rgba(34,197,94,0.2)]' : ''}`}>

                                    {isActive ? (
                                        <div className="w-5 h-5" /> // Spacer for bot
                                    ) : isCompleted ? (
                                        <div className="text-green-600 scale-90">{icon}</div>
                                    ) : isError ? (
                                        <AlertCircle className="w-5 h-5" />
                                    ) : (
                                        <div className="scale-90 opacity-40">{icon}</div>
                                    )}
                                </div>
                            </div>

                            {/* Content Card with Interactive Feel */}
                            <div className={`flex-1 -mt-1 transition-all duration-500 ${isActive ? 'translate-x-3' : ''}`}>
                                <motion.div
                                    layout
                                    className={`p-4 rounded-2xl border transition-all duration-300 ${isActive
                                        ? 'bg-white border-blue-200 shadow-[0_10px_25px_-5px_rgba(59,130,246,0.1)] ring-1 ring-blue-100'
                                        : isError
                                            ? 'bg-red-50 border-red-100 shadow-sm'
                                            : isCompleted
                                                ? 'bg-white/80 border-gray-100/50 shadow-sm'
                                                : 'bg-transparent border-transparent'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <h5 className={`font-bold text-sm tracking-tight ${isActive ? 'text-blue-800' :
                                                isCompleted ? 'text-gray-800' :
                                                    'text-gray-400 font-semibold'
                                                }`}>
                                                {stage.name}
                                            </h5>
                                            {isCompleted && (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                                    Done
                                                </span>
                                            )}
                                        </div>
                                        {isActive && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100">
                                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                                                <span className="text-[10px] font-bold text-blue-600 uppercase">Live</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Subtext / Logs / Progress Details */}
                                    {(isActive || isCompleted || isError) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`text-xs p-3 rounded-lg leading-relaxed ${isActive
                                                ? 'bg-blue-50/50 text-blue-800 border-l-2 border-blue-400'
                                                : isError
                                                    ? 'bg-red-50/50 text-red-700 border-l-2 border-red-400'
                                                    : 'text-gray-500 bg-gray-50/30'
                                                }`}
                                        >
                                            <div className="flex gap-2">
                                                {isActive && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />}
                                                <p className="font-medium italic">
                                                    {stage.message ? stage.message : (isActive ? 'Analyzing requirements and initializing agent context...' : 'Stage successfully verified and finalized.')}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
};
