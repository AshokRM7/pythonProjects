import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Loader2, Bot, Database, ChevronRight, Eye, UploadCloud, Wand2, X, Download } from 'lucide-react';
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
    const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);

    // Decisions state: { [fix_id]: 'ACCEPTED' | 'REJECTED' }
    const [decisions, setDecisions] = useState<Record<string, string>>({});

    // Email Modal state
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const actionHeaderRef = React.useRef<HTMLDivElement>(null);
    const lastAwaitingTicketId = React.useRef<string | null>(null);

    useEffect(() => {
        if (ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded') {
            fetchReport();
        } else {
            setReport(null);
        }

        // Auto-scroll logic for Awaiting Confirmation
        const isAwaiting = ticket.stages?.[7]?.status === 'awaiting_confirmation';
        if (isAwaiting && lastAwaitingTicketId.current !== ticket.id) {
            lastAwaitingTicketId.current = ticket.id;
            setTimeout(() => {
                actionHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);
        }
    }, [ticket.id, ticket.status, ticket.stages?.[7]?.status]);

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

            // Initialize decisions from preview data
            const initialDecisions: Record<string, string> = {};
            data.fix_preview.forEach((f: any) => {
                initialDecisions[f.fix_id] = f.user_decision || 'ACCEPTED';
            });
            setDecisions(initialDecisions);

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
            // Send decisions to backend first
            const decisionList = Object.entries(decisions).map(([fix_id, decision]) => ({
                fix_id,
                decision
            }));

            if (decisionList.length > 0) {
                await pcatApi.saveFixDecisions(ticket.id, decisionList);
            }

            await pcatApi.applyFixes(ticket.id, {
                apply: true,
                upload_to_pcat: true,
                upload_to_rise: true,
                fixes: decisionList // Also send in payload for atomicity
            });

            // Refresh ticket data from parent
            onRefresh();
            fetchReport();
        } catch (err) {
            setError('Failed to apply fixes and upload.');
        } finally {
            setIsApplying(false);
        }
    };

    const isAwaitingConfirmation = ticket.stages?.[7]?.status === 'awaiting_confirmation';
    const isAwaitingReview = ticket.stages?.[8]?.status === 'awaiting_review';
    const isPaused = ticket.stages?.[8]?.status === 'paused';
    const isError = ticket.stages?.[8]?.status === 'error';
    const isWaitingForReply = ticket.stages?.[8]?.status === 'in-progress';
    const canShowEmailButton = isAwaitingReview || isPaused || isError || isWaitingForReply;

    const handleOpenEmailModal = () => {
        const errorCount = report?.error_count || 0;
        const warningCount = report?.warning_count || 0;
        const subject = `[${ticket.id}] Action Required: PCAT Evidence Review`;
        const body = `Hello Application Owner,
+
+We have completed the PCAT metadata validation for your application (AIT: ${ticket.aitNumber || 'Unknown'}).
+The validation found ${errorCount} errors and ${warningCount} warnings that need your attention.
+
+Please review the recommended corrections. If you approve the necessary updates, please reply to this email with "Approved" or "Good to close" to proceed.
+
+Thank you,
+App Governance Team`;

        const defaultTo = ticket.contacts && Array.isArray(ticket.contacts) && ticket.contacts.length > 0
            ? ticket.contacts.join(', ')
            : 'velmuruganpandian@outlook.com';

        setEmailTo(defaultTo);
        setEmailSubject(subject);
        setEmailBody(body);
        setEmailModalOpen(true);
    };

    const handleEmailButtonClick = () => {
        if (isWaitingForReply || isPaused || isError) {
            setReminderConfirmOpen(true);
        } else {
            handleOpenEmailModal();
        }
    };

    const handleSendEmail = async () => {
        setIsSendingEmail(true);
        try {
            await pcatApi.sendEmail(ticket.id, {
                to: emailTo.split(',').map(e => e.trim()).filter(Boolean),
                subject: emailSubject,
                body: emailBody
            });
            setEmailModalOpen(false);
            onRefresh();
        } catch (err) {
            setError('Failed to send email.');
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
            {/* Action Header */}
            <div ref={actionHeaderRef} className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl transition-all duration-1000 ${isAwaitingConfirmation ? 'bg-blue-50/50 border-2 border-blue-200 shadow-lg scale-[1.02]' : ''}`}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRunValidation}
                        disabled={loading || ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded' || (ticket.currentStage > 0 && ticket.status === 'in-progress' && !isAwaitingConfirmation && !isAwaitingReview)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded'
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-[#012169] text-white hover:bg-[#00174F] active:scale-95 disabled:opacity-50'
                            }`}
                    >
                        {(ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded') ? (
                            <Bot className="w-5 h-5" />
                        ) : (ticket.status === 'in-progress' && !isAwaitingConfirmation && !isAwaitingReview) ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Play className="w-5 h-5 fill-current" />
                        )}
                        {(ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded') ? 'Validation Finished' : 'Run PCAT Validation'}
                    </button>

                    {canShowEmailButton && (
                        <button
                            onClick={handleEmailButtonClick}
                            className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold active:scale-95 transition-all shadow-lg ${isWaitingForReply ? 'bg-blue-600 hover:bg-blue-700' : isError ? 'bg-red-600 hover:bg-red-700' : isPaused ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700 animate-pulse'}`}
                        >
                            <UploadCloud className="w-5 h-5" />
                            {isWaitingForReply || isPaused || isError ? 'Send Reminder / Update' : 'Review & Email Evidence'}
                        </button>
                    )}

                    {isWaitingForReply && !isError && !isPaused && (
                        <div className="flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold shadow-sm">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Waiting for App Owner Reply...
                        </div>
                    )}

                    {(ticket.status === 'PCAT Validation Completed' || ticket.status === 'Uploaded' || isAwaitingConfirmation) && (
                        <>
                            {!ticket.final_csv_ready && (
                                <>
                                    <button
                                        onClick={handlePreviewFixes}
                                        className={`flex items-center gap-2 px-4 py-3 bg-white border text-gray-700 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition-all shadow-sm ${isAwaitingConfirmation ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'}`}
                                    >
                                        <Eye className="w-5 h-5" />
                                        Preview Fixes
                                    </button>
                                    <button
                                        onClick={() => setConfirmModalOpen(true)}
                                        disabled={isApplying}
                                        className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold active:scale-95 transition-all shadow-lg ${isAwaitingConfirmation ? 'bg-orange-600 hover:bg-orange-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {isApplying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                                        Apply Fixes & Prepare
                                    </button>
                                </>
                            )}

                            {ticket.final_csv_ready && (
                                <button
                                    onClick={() => pcatApi.downloadFinalCsv(ticket.id)}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 active:scale-95 transition-all shadow-lg"
                                >
                                    <Download className="w-5 h-5" />
                                    Download Updated CSV
                                </button>
                            )}
                        </>
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
                    <p className="font-bold text-gray-900">{isAwaitingConfirmation ? 'Awaiting Confirmation' : ticket.status}</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                    {error}
                </div>
            )}

            <PCATDownloads ticketId={ticket.id} ticket={ticket} />

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
                                            stage.status === 'awaiting_confirmation' || stage.status === 'awaiting_review' ? 'bg-orange-500 border-orange-500 text-white ring-4 ring-orange-100' :
                                                'border-gray-200 bg-white text-gray-300'
                                    }`}>
                                    {stage.status === 'completed' ? <Bot className="w-5 h-5" /> :
                                        stage.status === 'awaiting_confirmation' || stage.status === 'awaiting_review' ? <Wand2 className="w-4 h-4" /> : idx + 1}
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl transition-all scale-100 border border-gray-100">
                        <div className="p-8 border-b bg-gray-50/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-[#012169] tracking-tight">Selective Auto-Fixes</h2>
                                <p className="text-gray-500 font-medium">Review and choose which corrections to apply to the final CSV.</p>
                            </div>
                            <button onClick={() => setPreviewModalOpen(false)} className="p-2 hover:bg-white rounded-full shadow-sm transition-all">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <table className="w-full text-left border-separate border-spacing-y-3">
                                <thead className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4">
                                    <tr>
                                        <th className="px-6 py-2">Row</th>
                                        <th className="px-6 py-2">Field</th>
                                        <th className="px-6 py-2">Permission Name</th>
                                        <th className="px-6 py-2">Proposed Correction</th>
                                        <th className="px-6 py-2">Reasoning</th>
                                        <th className="px-6 py-2 text-center">Decision</th>
                                    </tr>
                                </thead>
                                <tbody className="">
                                    {previewData.fix_preview.map((fix: any, i: number) => {
                                        const isAccepted = decisions[fix.fix_id] === 'ACCEPTED';
                                        return (
                                            <tr key={i} className={`group transition-all duration-300 ${isAccepted ? 'bg-white' : 'bg-gray-50/50 opacity-75'}`}>
                                                <td className="px-6 py-5 rounded-l-2xl border-y border-l border-gray-100 font-mono text-sm text-gray-500">{fix.row_id}</td>
                                                <td className="px-6 py-5 border-y border-gray-100">
                                                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider">{fix.field}</span>
                                                </td>
                                                <td className="px-6 py-5 border-y border-gray-100">
                                                    <span
                                                        className="text-gray-900 font-bold text-xs truncate max-w-[120px] block"
                                                        title={fix.permission_name || '—'}
                                                    >
                                                        {fix.permission_name || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 border-y border-gray-100 whitespace-pre">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-xs text-red-400 line-through font-medium opacity-60 italic">{fix.old_value}</span>
                                                        <span className={`text-sm font-bold ${isAccepted ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {isAccepted ? fix.new_value : '(Correction Skipped)'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 border-y border-gray-100 text-xs text-gray-500 font-medium italic max-w-xs">{fix.reason}</td>
                                                <td className="px-6 py-5 rounded-r-2xl border-y border-r border-gray-100 text-center">
                                                    <div className="flex items-center justify-center p-1 bg-gray-100 rounded-xl w-fit mx-auto">
                                                        <button
                                                            onClick={() => setDecisions(d => ({ ...d, [fix.fix_id]: 'ACCEPTED' }))}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${isAccepted ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            ACCEPT
                                                        </button>
                                                        <button
                                                            onClick={() => setDecisions(d => ({ ...d, [fix.fix_id]: 'REJECTED' }))}
                                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${!isAccepted ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            REJECT
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-8 border-t bg-gray-50/50 flex justify-between items-center">
                            <div className="text-sm font-bold text-gray-400">
                                {Object.values(decisions).filter(d => d === 'ACCEPTED').length} of {previewData.preview_count} fixes accepted
                            </div>
                            <button
                                onClick={() => setPreviewModalOpen(false)}
                                className="px-10 py-3 bg-[#012169] text-white rounded-2xl font-black text-sm tracking-widest hover:bg-[#00174F] shadow-xl active:scale-95 transition-all"
                            >
                                SAVE DECISIONS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Apply Modal */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-md p-10 shadow-2xl transition-all scale-100 border border-gray-100">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="p-4 bg-orange-100 rounded-2xl mb-4 text-orange-600">
                                <Wand2 className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Confirm Workflow</h2>
                            <p className="mt-2 text-gray-500 font-medium leading-relaxed px-4">
                                Apply <span className="text-blue-600 font-bold">{Object.values(decisions).filter(d => d === 'ACCEPTED').length} corrections</span> and prepare the final CSV for review.
                            </p>
                        </div>

                        <div className="space-y-3 mb-10">
                            {[
                                { icon: Bot, text: 'Apply accepted fixes to CSV', color: 'text-green-500' },
                                { icon: Database, text: 'Refresh dashboard metrics', color: 'text-blue-500' },
                                { icon: UploadCloud, text: 'Prepare for App Owner Review', color: 'text-purple-500' }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                    <span className="text-sm font-bold text-gray-700">{item.text}</span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setConfirmModalOpen(false)}
                                className="flex-1 px-6 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-black text-xs tracking-widest hover:bg-gray-50 hover:text-gray-600 transition-all"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleApplyFixes}
                                className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 active:scale-95 transition-all"
                            >
                                PROCEED
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Email Modal */}
            {emailModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl flex flex-col transition-all scale-100 border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-[#012169] tracking-tight">Review & Send Email</h2>
                                <p className="text-sm text-gray-500 font-medium">Edit the content before sending it to the Application Owner.</p>
                            </div>
                            <button onClick={() => setEmailModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                                <X className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">To</label>
                                <input
                                    type="text"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-900"
                                    placeholder="velmuruganpandian@outlook.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-900"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Message Body</label>
                                <textarea
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                    rows={8}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-900 font-mono text-sm leading-relaxed"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setEmailModalOpen(false)}
                                disabled={isSendingEmail}
                                className="flex-1 px-6 py-4 border-2 border-gray-100 text-gray-500 rounded-2xl font-black text-xs tracking-widest hover:bg-gray-50 transition-all"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={isSendingEmail}
                                className="flex-1 px-6 py-4 bg-[#012169] text-white rounded-2xl font-black text-xs tracking-widest hover:bg-[#00174F] shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                {isSendingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                                SEND EMAIL
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Reminder Confirmation Modal */}
            {reminderConfirmOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl w-full max-w-md p-10 shadow-2xl transition-all scale-100 border border-gray-100">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="p-4 bg-blue-100 rounded-2xl mb-4 text-blue-600">
                                <UploadCloud className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Send Reminder?</h2>
                            <p className="mt-2 text-gray-500 font-medium leading-relaxed px-4">
                                We already sent an email to the owner and are currently waiting for their response. Do you want to send a reminder email or update the request?
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setReminderConfirmOpen(false)}
                                className="flex-1 px-6 py-4 border-2 border-gray-100 text-gray-400 rounded-2xl font-black text-xs tracking-widest hover:bg-gray-50 hover:text-gray-600 transition-all"
                            >
                                NO, WAIT
                            </button>
                            <button
                                onClick={() => {
                                    setReminderConfirmOpen(false);
                                    handleOpenEmailModal();
                                }}
                                className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 active:scale-95 transition-all"
                            >
                                YES, SEND
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
