import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Mail, ShieldCheck, ArrowRight, Eye, Bot, Loader2, ClipboardCheck, Camera, FileText } from "lucide-react";
import { breApi } from "./breApi";
import { BREBusinessRulesTable } from "./BREBusinessRulesTable";

interface InvalidPermission {
    permission_id: string;
    user_type: string;
    permission_name: string;
    environment: string;
    assigned_to: string;
    violates_rule: string;
    rule_description: string;
    risk_level: string;
}

interface Decision {
    permission_id: string;
    permission_name: string;
    action: "certify" | "remove" | "";
    comment: string;
}

interface Props {
    deliverableId: string;
    aitNumber: string;
    applicationName: string;
    permissions?: InvalidPermission[]; // Optional - will fetch if missing
    onSuccess: (result: any) => void;
}

export const BRERemediationWizard = ({
    deliverableId,
    aitNumber,
    applicationName,
    permissions: initialPermissions,
    onSuccess,
}: Props) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [permissions, setPermissions] = useState<InvalidPermission[]>(initialPermissions || []);
    const [loading, setLoading] = useState(!initialPermissions);
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [emailSent, setEmailSent] = useState(false);
    const [responseReceived, setResponseReceived] = useState(false);
    const [screenshotCaptured, setScreenshotCaptured] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [ticket, setTicket] = useState<any>(null);

    // Initialize decisions when permissions change
    useEffect(() => {
        const fetchPerms = async () => {
            if (!initialPermissions) {
                setLoading(true);
                try {
                    const data = await breApi.getRemediationPermissions(deliverableId);
                    if (data.success) {
                        setPermissions(data.invalid_permissions ?? []);
                    }
                } catch {
                    setError("Backend connection failed.");
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchPerms();
    }, [deliverableId, initialPermissions]);

    // Poll for ticket updates when waiting for response
    useEffect(() => {
        let timer: any;
        if (emailSent && !responseReceived) {
            timer = setInterval(async () => {
                try {
                    // We'll fetch the ticket status to see if decisions arrived
                    const response = await fetch(`http://localhost:8000/api/tickets/${deliverableId}`);
                    const data = await response.json();
                    if (data.success && data.ticket) {
                        setTicket(data.ticket);
                        if (data.ticket.status === "Decisions Received" || data.ticket.bre_owner_decisions) {
                            setResponseReceived(true);
                            // If decisions are "ALL_CERTIFIED", auto-map them
                            if (data.ticket.bre_owner_decisions === "ALL_CERTIFIED") {
                                setDecisions(prev => prev.map(d => ({ ...d, action: "certify" })));
                            }
                        }
                        // Handle Reset logic (if status became "not started" again)
                        if (data.ticket.status === "not started" && data.ticket.currentStage === 0) {
                            window.location.reload(); // Hard reset UI
                        }
                    }
                } catch (e) {
                    console.error("Polling error:", e);
                }
            }, 3000);
        }
        return () => clearInterval(timer);
    }, [emailSent, responseReceived, deliverableId]);

    useEffect(() => {
        if (permissions.length > 0 && decisions.length === 0) {
            setDecisions(
                permissions.map((p) => ({
                    permission_id: p.permission_id,
                    permission_name: p.permission_name,
                    action: "",
                    comment: "",
                }))
            );
        }
    }, [permissions]);

    const violatedRuleIds = Array.from(
        new Set(permissions.map((p) => p.violates_rule))
    );

    const handleAction = (permId: string, action: "certify" | "remove") => {
        setDecisions((prev) =>
            prev.map((d) => (d.permission_id === permId ? { ...d, action } : d))
        );
    };

    const handleSendDecisionEmail = async () => {
        setSubmitting(true);
        try {
            const data = await breApi.sendDecisionRequest(deliverableId);
            if (data.success) {
                setEmailSent(true);
                setCurrentStep(3); // Move to Awaiting Response
            }
        } catch {
            setError("Failed to send decision request.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSimulateResponse = async () => {
        try {
            setLoading(true);
            const data = await breApi.simulateOwnerResponse(deliverableId);
            if (data.success && data.decisions) {
                setDecisions(data.decisions);
                setResponseReceived(true);
                setCurrentStep(4); // Move directly to Review Decisions
            }
        } catch {
            setError("Simulation failed.");
        } finally {
            setLoading(false);
        }
    };

    const handleCaptureScreenshot = async () => {
        setSubmitting(true);
        try {
            const data = await breApi.capturePreview(deliverableId, decisions);
            if (data.success) {
                setPreviewUrl(`http://localhost:8000${data.preview_url}`);
                setScreenshotCaptured(true);
            } else {
                setError("Screenshot capture failed.");
            }
        } catch {
            setError("Network error during capture.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const data = await breApi.submitDecisions(deliverableId, decisions);
            if (data.success) {
                onSuccess(data);
            } else {
                setError(data.detail || "Submission failed.");
            }
        } catch {
            setError("Network error.");
        } finally {
            setSubmitting(false);
        }
    };

    const PreviewModal = () => {
        if (!showPreview || !previewUrl) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-lg border border-white/10">
                                <Camera className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">Evidence Preview</h3>
                                <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black">Portal Remediation Proof</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="bg-white/10 hover:bg-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        >
                            <AlertCircle className="w-6 h-6 rotate-45" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto bg-slate-100 p-8 flex items-center justify-center">
                        <img
                            src={previewUrl}
                            alt="Evidence Preview"
                            className="max-w-full h-auto shadow-xl rounded-lg border border-slate-300"
                        />
                    </div>
                    <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 shrink-0">
                        <p className="text-[11px] text-slate-500 font-medium italic">
                            * This is a live preview of the screenshot that will be attached to the RISE ticket and JIRA.
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white h-full flex flex-col overflow-hidden">
            <PreviewModal />
            {/* Wizard Header */}
            <div className="bg-[#012169] px-8 py-8 text-white">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg border border-white/10">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">BRE Remediation Wizard</h2>
                            <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mt-0.5">Decision Governance Flow</p>
                        </div>
                    </div>
                </div>

                {/* Progress Indicators */}
                <div className="relative max-w-2xl mx-auto">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2" />
                    <div
                        className="absolute top-1/2 left-0 h-0.5 bg-blue-400 -translate-y-1/2 transition-all duration-500 ease-out"
                        style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
                    />
                    <div className="relative flex justify-between">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <div key={s} className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300 z-10 ${currentStep >= s ? 'bg-blue-600 border-blue-400 text-white scale-110 shadow-lg' : 'bg-[#012169] border-white/20 text-white/40'
                                    }`}>
                                    {currentStep > s ? <CheckCircle className="w-4 h-4" /> : s}
                                </div>
                                <span className={`text-[8px] mt-2 font-black uppercase tracking-tighter ${currentStep >= s ? 'text-white' : 'text-white/30'}`}>
                                    {s === 1 ? 'Review Rules' : s === 2 ? 'Notify Owner' : s === 3 ? 'Awaiting' : s === 4 ? 'Review decisions' : 'Submit'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">

                {loading && (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <Loader2 className="w-10 h-10 text-[#012169] animate-spin mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">Accessing BRE Portal Data...</p>
                    </div>
                )}

                {error && !loading && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}

                {/* STEP 1: REVIEW RULES */}
                {currentStep === 1 && !loading && permissions.length > 0 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-3 mb-2 text-slate-800">
                            <Eye className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-bold">Step 1: BRE Portal Review</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-6">Reviewing <strong>{applicationName}</strong> permissions against active Business Rules.</p>
                        <BREBusinessRulesTable highlightRuleIds={violatedRuleIds} />
                        <div className="flex justify-end pt-4">
                            <button onClick={() => setCurrentStep(2)} className="group flex items-center gap-2 bg-[#012169] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                                Proceed to Notification <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: NOTIFY OWNER */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-3 mb-6 text-slate-800">
                            <Mail className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-bold">Step 2: Notify App Owner</h3>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-8">
                            <p className="text-sm text-blue-800 leading-relaxed mb-4">
                                You are about to send a decision request email to the Application Owner. 
                                They will be asked to <strong>Certify</strong> or <strong>Remove</strong> for the following violations:
                            </p>
                            <div className="space-y-2">
                                {permissions.map(p => (
                                    <div key={p.permission_id} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white/50 p-2 rounded-lg">
                                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                        <span>{p.permission_name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4 pt-6">
                            <button onClick={() => setCurrentStep(1)} className="text-slate-400 font-bold text-sm hover:text-slate-800 transition-colors">← Back</button>
                            <div className="flex-1" />
                            <button 
                                onClick={handleSimulateResponse}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 border border-slate-200 px-4 py-4 rounded-xl hover:bg-slate-50 transition-all"
                            >
                                Simulate Response
                            </button>
                            <button 
                                onClick={handleSendDecisionEmail} 
                                disabled={submitting}
                                className="group flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                Send Decision Request <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: AWAITING RESPONSE */}
                {currentStep === 3 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col items-center justify-center text-center py-10">
                        {!responseReceived ? (
                            <>
                                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
                                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800">Awaiting Response...</h3>
                                <p className="text-slate-500 max-w-sm text-sm italic">
                                    {ticket?.status || "Email sent. We are polling the inbox for the App Owner's Certify/Remove decisions."}
                                </p>
                                <div className="flex gap-4 mt-8">
                                    <button 
                                        onClick={handleSendDecisionEmail}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        Resend Email
                                    </button>
                                    <button 
                                        onClick={handleSimulateResponse}
                                        className="text-xs font-bold text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1 rounded"
                                    >
                                        [Simulate Reply]
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-10 h-10 text-green-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800">Decisions Extracted!</h3>
                                <p className="text-slate-500 max-w-sm text-sm">
                                    The App Owner has specified actions for all permissions.
                                </p>
                                <button onClick={() => setCurrentStep(4)} className="mt-8 flex items-center gap-3 bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-700 transition-all">
                                    Review Decisions <ArrowRight className="w-6 h-6" />
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* STEP 4: REVIEW DECISIONS */}
                {currentStep === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-3 mb-2 text-slate-800">
                            <Bot className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-bold">Step 4: Review Extracted Decisions</h3>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-1 px-4 bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Extracted from email body via LLM
                            </div>
                            <div className="divide-y divide-slate-100">
                                {decisions.map((d) => (
                                    <div key={d.permission_id} className="p-5 flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{d.permission_id}</p>
                                            <h4 className="text-sm font-bold text-slate-800">{d.permission_name}</h4>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleAction(d.permission_id, "certify")}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${d.action === 'certify' ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                            >
                                                Certify
                                            </button>
                                            <button 
                                                onClick={() => handleAction(d.permission_id, "remove")}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${d.action === 'remove' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col items-center gap-4 text-center mt-8">
                            {!screenshotCaptured ? (
                                <>
                                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"><Camera className="w-6 h-6" /></div>
                                    <p className="text-[11px] font-bold leading-tight text-slate-300 italic">"I have reviewed the violations and agree with the remediation steps."</p>
                                    <button
                                        onClick={handleCaptureScreenshot}
                                        disabled={submitting}
                                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
                                    >
                                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                        Capture Evidence Screenshot
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg"><CheckCircle className="w-6 h-6" /></div>
                                    <p className="text-sm font-bold leading-tight">Evidence Captured!</p>
                                    <button onClick={() => setCurrentStep(5)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
                                        Next Component <ArrowRight className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 5: FINAL REVIEW & SUBMIT */}
                {currentStep === 5 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-3 mb-2 text-slate-800">
                            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
                            <h3 className="text-lg font-bold">Step 5: Review Email & Approve</h3>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-6 bg-slate-50 border-b border-slate-200">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Email Agent Payload Preview</h4>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200">
                                        <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><FileText className="w-6 h-6" /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Body Content</p>
                                            <p className="text-xs font-bold text-slate-800">Owner Verification Snapshot ({aitNumber}_response.png)</p>
                                        </div>
                                        <div className="shrink-0 animate-pulse text-emerald-500"><Bot className="w-5 h-5" /></div>
                                    </div>
                                    <button
                                        onClick={() => setShowPreview(true)}
                                        className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left w-full group"
                                    >
                                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Camera className="w-6 h-6" /></div>
                                        <div className="flex-1">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Attachments</p>
                                            <p className="text-xs font-bold text-slate-800">Portal Remediation Proof ({aitNumber}_remedied.png)</p>
                                        </div>
                                        <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                            <span className="text-[10px] font-bold font-black uppercase">View</span>
                                            <Eye className="w-4 h-4" />
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="bg-slate-900 text-white rounded-2xl p-6">
                                    <div className="flex items-start gap-3 bg-white/5 p-4 rounded-xl border border-white/10 mb-6">
                                        <Bot className="w-5 h-5 text-blue-400 mt-0.5" />
                                        <p className="text-[11px] text-slate-300 leading-relaxed italic">
                                            The **Logger Agent** will ingest the response screenshot as primary evidence. Submitting will complete Stage 6 and advance the ticket to **Stage 7 (Archive & Close)**.
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="w-full h-16 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                                        Upload screenshot into RISE and JIRA ticket
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {!loading && permissions.length > 0 && currentStep > 0 && (
                    <div className="mt-8 border-t border-slate-100 pt-6 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Ticket: {deliverableId}</span>
                        <span>Stage: 6 (Remediation)</span>
                    </div>
                )}
            </div>
        </div>
    );
};
