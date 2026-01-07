import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { PCATMetricsCards } from './PCATMetricsCards';
import { PCATFindingsTable } from './PCATFindingsTable';
import { PCATDownloads } from './PCATDownloads';
import { pcatApi } from './pcatApi';
import { PCATReport } from './types';

interface PCATTicketPanelProps {
    ticket: any;
    onRefresh: () => void;
}

export const PCATTicketPanel: React.FC<PCATTicketPanelProps> = ({ ticket, onRefresh }) => {
    const [report, setReport] = useState<PCATReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (ticket.status === 'PCAT Validation Completed') {
            fetchReport();
        } else {
            setReport(null);
        }
    }, [ticket.id, ticket.status]);

    const fetchReport = async () => {
        try {
            const data = await pcatApi.getLatestReport(ticket.id);
            setReport(data);
        } catch (err) {
            console.error('Failed to fetch report:', err);
        }
    };

    const handleRunValidation = async () => {
        setLoading(true);
        setError(null);
        try {
            await pcatApi.validateTicket(ticket.id);
            // Status will be updated via WebSocket in Home.tsx
        } catch (err) {
            setError('Failed to start validation. Check backend logs.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        try {
            await pcatApi.resetDemo();
            onRefresh();
        } catch (err) {
            console.error('Reset failed:', err);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRunValidation}
                        disabled={loading || ticket.status === 'PCAT Validation Completed' || (ticket.currentStage > 0 && ticket.status === 'in-progress')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${ticket.status === 'PCAT Validation Completed'
                                ? 'bg-green-100 text-green-700 cursor-default'
                                : 'bg-[#012169] text-white hover:bg-[#00174F] active:scale-95 disabled:opacity-50'
                            }`}
                    >
                        {ticket.status === 'PCAT Validation Completed' ? (
                            <CheckCircle2 className="w-5 h-5" />
                        ) : ticket.status === 'in-progress' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5 fill-current" />
                        )}
                        {ticket.status === 'PCAT Validation Completed' ? 'Validation Finished' : 'Run PCAT Validation'}
                    </button>

                    <button
                        onClick={handleReset}
                        className="p-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Reset Demo"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                </div>

                <div className="text-right">
                    <p className="text-sm text-gray-500">Current Status</p>
                    <p className="font-bold text-gray-900">{ticket.status}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            <PCATDownloads ticketId={ticket.id} />

            {/* Pipeline Progress */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-gray-900 font-bold mb-6 flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-blue-600" />
                    Validation Pipeline Status
                </h3>

                <div className="space-y-4">
                    {ticket.stages.map((stage: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${stage.status === 'completed' ? 'bg-green-500 border-green-500 text-white' :
                                        stage.status === 'in-progress' ? 'bg-blue-500 border-blue-500 text-white animate-pulse' :
                                            stage.status === 'error' ? 'bg-red-500 border-red-500 text-white' :
                                                'border-gray-200 bg-white text-gray-300'
                                    }`}>
                                    {stage.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                                </div>
                                {idx < ticket.stages.length - 1 && (
                                    <div className={`w-0.5 h-8 my-1 ${stage.status === 'completed' ? 'bg-green-200' : 'bg-gray-100'}`} />
                                )}
                            </div>
                            <div className="pt-1">
                                <p className={`font-bold ${stage.status === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>{stage.name}</p>
                                {stage.message && <p className="text-sm text-gray-500">{stage.message}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Results Section */}
            {report && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-gray-900 font-bold mb-4">Findings Summary</h3>
                    <PCATMetricsCards
                        errors={report.error_count}
                        warnings={report.warning_count}
                        totalRows={report.total_rows}
                    />
                    <PCATFindingsTable findings={report.findings} />
                </div>
            )}
        </div>
    );
};
