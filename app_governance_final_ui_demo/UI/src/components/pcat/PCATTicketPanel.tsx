import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Loader2, CheckCircle2, ChevronRight, Eye, UploadCloud, Wand2, X, Download } from 'lucide-react';
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
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        if (ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded') {
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

    const handlePreviewFixes = async () => {
        setLoading(true);
        try {
            const data = await pcatApi.getFixPreview(ticket.id);
            setPreviewData(data);
            setPreviewModalOpen(true);
        } catch (err) {
            setError('Failed to load fix preview.');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyFixes = async () => {
        setIsApplying(true);
        setConfirmModalOpen(false);
        try {
            await pcatApi.applyFixes(ticket.id, {
                apply: true,
                upload_to_pcat: true,
                upload_to_rise: true
            });
            fetchReport();
            onRefresh();
        } catch (err) {
            setError('Failed to apply fixes and upload.');
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
            {/* Action Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRunValidation}
                        disabled={loading || ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded' || (ticket.currentStage > 0 && ticket.status === 'in-progress')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded'
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-[#012169] text-white hover:bg-[#00174F] active:scale-95 disabled:opacity-50'
                            }`}
                    >
                        {(ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded') ? (
                            <CheckCircle2 className="w-5 h-5" />
                        ) : ticket.status === 'in-progress' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5 fill-current" />
                        )}
                        {(ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded') ? 'Validation Finished' : 'Run PCAT Validation'}
                    </button>

                    {ticket.status === 'PCAT Validation Completed' && (
                        <>
                            <button
                                onClick={handlePreviewFixes}
                                className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                            >
                                <Eye className="w-5 h-5" />
                                Preview Fixes
                            </button>
                            <button
                                onClick={() => setConfirmModalOpen(true)}
                                disabled={isApplying}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
                            >
                                {isApplying ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                Apply Fixes & Upload
                            </button>
                        </>
                    )}

                    {ticket.status === 'Uploaded' && (
                        <button
                            onClick={() => pcatApi.downloadUpdatedCsv(ticket.id)}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 active:scale-95 transition-all shadow-lg"
                        >
                            <Download className="w-5 h-5" />
                            Download Updated CSV
                        </button>
                    )}

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

            {/* Preview Modal */}
            {previewModalOpen && previewData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl transition-all scale-100">
                        <div className="p-6 border-b flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Recommended Auto-Fixes</h2>
                                <p className="text-sm text-gray-500">{previewData.preview_count} corrections identified</p>
                            </div>
                            <button onClick={() => setPreviewModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Row ID</th>
                                        <th className="px-4 py-3">Field</th>
                                        <th className="px-4 py-3">Proposed Change</th>
                                        <th className="px-4 py-3">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {previewData.fix_preview.map((fix: any, i: number) => (
                                        <tr key={i} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-4 font-mono text-sm">{fix.row_id}</td>
                                            <td className="px-4 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold uppercase">{fix.field}</span></td>
                                            <td className="px-4 py-4 whitespace-pre">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs text-red-500 line-through">{fix.old_value}</span>
                                                    <span className="text-sm text-green-600 font-bold">{fix.new_value}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-xs text-gray-500 italic">{fix.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setPreviewModalOpen(false)}
                                className="px-6 py-2 bg-[#012169] text-white rounded-xl font-bold"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Apply Modal */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl transition-all scale-100">
                        <div className="flex items-center gap-4 text-orange-600 mb-6 font-bold text-xl">
                            <Wand2 className="w-8 h-8" />
                            Confirm Workflow
                        </div>
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            This will apply all deterministic fixes to the metadata, generate the final governed CSV, and upload it to both PCAT and RISE portals (mock).
                            <br /><br />
                            <span className="font-bold text-gray-900">Are you sure you want to proceed?</span>
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmModalOpen(false)}
                                className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyFixes}
                                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg"
                            >
                                Yes, Apply & Upload
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
