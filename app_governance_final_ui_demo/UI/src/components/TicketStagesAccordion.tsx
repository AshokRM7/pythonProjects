import React from 'react';
import {
    Bot
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { HorizontalStageTracker } from './HorizontalStageTracker';

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
                {stages.find(s => s.status === 'in-progress')?.name ? `Current Agent: ${stages.find(s => s.status === 'in-progress')?.name}` : 'Live Agent Execution'}
            </h4>

            <div className="space-y-0 relative">
                <HorizontalStageTracker
                    stages={stages}
                    ticketStatus={ticketStatus}
                />
            </div>
        </motion.div>
    );
};
