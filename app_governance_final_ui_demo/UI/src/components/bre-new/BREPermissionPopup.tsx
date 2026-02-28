/**
 * BRE Permission Popup / Modal
 * Shows invalid permissions with Certify / Remove radio buttons.
 * "Simulate App Owner Response" auto-fills the decisions.
 * On Submit → calls POST /api/bre/remediation/{id}/submit
 * BRE-NEW deliverable ONLY.
 */
import { useState } from "react";
import { breApi } from "./breApi";

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

type Action = "certify" | "remove" | "";

interface Decision {
    permission_id: string;
    permission_name: string;
    action: Action;
    comment: string;
}

interface Props {
    deliverableId: string;
    aitNumber: string;
    applicationName: string;
    permissions: InvalidPermission[];
    onClose: () => void;
    onSuccess: (result: any) => void;
}

const riskColor = (risk: string) => {
    const m: Record<string, string> = {
        critical: "text-red-600",
        high: "text-orange-600",
        medium: "text-yellow-600",
        low: "text-green-600",
    };
    return m[risk] ?? "text-gray-600";
};

const riskBg = (risk: string) => {
    const m: Record<string, string> = {
        critical: "bg-red-100 border-red-300",
        high: "bg-orange-100 border-orange-300",
        medium: "bg-yellow-100 border-yellow-300",
        low: "bg-green-100 border-green-300",
    };
    return m[risk] ?? "bg-gray-100 border-gray-300";
};

export const BREPermissionPopup = ({
    deliverableId,
    aitNumber,
    applicationName,
    permissions,
    onClose,
    onSuccess,
}: Props) => {
    const [decisions, setDecisions] = useState<Decision[]>(
        permissions.map((p) => ({
            permission_id: p.permission_id,
            permission_name: p.permission_name,
            action: "",
            comment: "",
        }))
    );
    const [simulating, setSimulating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setAction = (permId: string, action: Action) => {
        setDecisions((prev) =>
            prev.map((d) => (d.permission_id === permId ? { ...d, action } : d))
        );
    };

    const setComment = (permId: string, comment: string) => {
        setDecisions((prev) =>
            prev.map((d) => (d.permission_id === permId ? { ...d, comment } : d))
        );
    };

    const allDecided = decisions.every((d) => d.action !== "");

    const handleSimulate = async () => {
        setSimulating(true);
        setError(null);
        try {
            const data = await breApi.simulateOwnerResponse(deliverableId);
            if (data.success && data.decisions) {
                setDecisions((prev) =>
                    prev.map((d) => {
                        const simDecision = data.decisions.find(
                            (sd: any) => sd.permission_id === d.permission_id
                        );
                        return simDecision
                            ? { ...d, action: simDecision.action, comment: simDecision.comment }
                            : d;
                    })
                );
            }
        } catch {
            setError("Failed to simulate owner response. Please select actions manually.");
        } finally {
            setSimulating(false);
        }
    };

    const handleSubmit = async () => {
        if (!allDecided) return;
        setSubmitting(true);
        setError(null);
        try {
            const data = await breApi.submitDecisions(deliverableId, decisions);
            if (data.success) {
                onSuccess(data);
            } else {
                setError(data.detail || "Submission failed.");
            }
        } catch {
            setError("Network error during submission.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        /* Backdrop */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-200">

                {/* Header */}
                <div className="bg-[#012169] rounded-t-2xl px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-bold text-lg">🔍 Invalid Permissions Review</h2>
                        <p className="text-blue-200 text-xs mt-0.5">
                            {applicationName} · {aitNumber} · {permissions.length} violation(s)
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white text-2xl leading-none transition-colors"
                    >
                        ×
                    </button>
                </div>

                {/* Simulate Banner */}
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-4">
                    <div className="text-sm text-amber-800">
                        <span className="font-semibold">📧 App Owner Email Sent.</span>{" "}
                        Waiting for App Owner's response. You may simulate it for the demo:
                    </div>
                    <button
                        onClick={handleSimulate}
                        disabled={simulating}
                        className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                    >
                        {simulating ? "⏳ Simulating…" : "🔄 Simulate App Owner Response"}
                    </button>
                </div>

                {/* Permission List */}
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                    {permissions.map((perm, idx) => {
                        const dec = decisions.find((d) => d.permission_id === perm.permission_id)!;
                        return (
                            <div
                                key={perm.permission_id}
                                className={`rounded-xl border p-4 ${riskBg(perm.risk_level)} transition-all`}
                            >
                                {/* Permission Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <span className="text-xs text-gray-500 font-mono">{perm.permission_id}</span>
                                        <h3 className="font-bold text-gray-800 text-sm mt-0.5">
                                            {idx + 1}. {perm.permission_name}
                                        </h3>
                                        <p className="text-xs text-gray-600 mt-0.5">
                                            <span className="font-medium">Type:</span> {perm.user_type} ·{" "}
                                            <span className="font-medium">Account:</span> {perm.assigned_to} ·{" "}
                                            <span className="font-medium">Env:</span> {perm.environment}
                                        </p>
                                        <p className="text-xs text-red-700 font-semibold mt-1">
                                            ⚠️ {perm.rule_description}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${riskBg(perm.risk_level)} ${riskColor(perm.risk_level)}`}
                                    >
                                        {perm.risk_level}
                                    </span>
                                </div>

                                {/* Certify / Remove Buttons */}
                                <div className="flex gap-3 mb-3">
                                    <button
                                        onClick={() => setAction(perm.permission_id, "certify")}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${dec.action === "certify"
                                            ? "bg-green-500 border-green-500 text-white shadow-md"
                                            : "bg-white border-green-300 text-green-700 hover:bg-green-50"
                                            }`}
                                    >
                                        ✅ Certify
                                    </button>
                                    <button
                                        onClick={() => setAction(perm.permission_id, "remove")}
                                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${dec.action === "remove"
                                            ? "bg-red-500 border-red-500 text-white shadow-md"
                                            : "bg-white border-red-300 text-red-700 hover:bg-red-50"
                                            }`}
                                    >
                                        ❌ Remove
                                    </button>
                                </div>

                                {/* Comment */}
                                <input
                                    type="text"
                                    placeholder={
                                        dec.action === "certify"
                                            ? "Justification for certifying…"
                                            : dec.action === "remove"
                                                ? "Reason for removing…"
                                                : "Select an action first…"
                                    }
                                    value={dec.comment}
                                    disabled={!dec.action}
                                    onChange={(e) => setComment(perm.permission_id, e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:bg-gray-50"
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-4 bg-gray-50 rounded-b-2xl">
                    {error && (
                        <p className="text-red-600 text-xs flex-1">{error}</p>
                    )}
                    {!error && (
                        <p className="text-gray-500 text-xs flex-1">
                            {allDecided
                                ? `✅ All ${decisions.length} permission(s) decided. Ready to submit.`
                                : `${decisions.filter((d) => d.action).length} of ${decisions.length} decided. Select an action for each permission.`}
                        </p>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!allDecided || submitting}
                            className="px-6 py-2 rounded-lg text-sm font-bold bg-[#012169] text-white hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow"
                        >
                            {submitting ? "⏳ Submitting…" : "Submit Decisions"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
