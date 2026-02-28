import { useState, useEffect } from "react";
import { ShieldCheck, Bot, CheckCircle, Loader2 } from "lucide-react";
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

interface RemediationResult {
    certified_count: number;
    removed_count: number;
    screenshot?: string;
    timestamp: string;
    message: string;
}

interface Props {
    deliverableId: string;
    aitNumber: string;
    applicationName: string;
    applicationId?: string;
    onComplete?: (result: RemediationResult) => void;
}

export const BRERemediationPanel = ({
    deliverableId,
    aitNumber: _aitNumber,
    applicationName: _applicationName,
    onComplete: _onComplete,
}: Props) => {
    const [permissions, setPermissions] = useState<InvalidPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const data = await breApi.getRemediationPermissions(deliverableId);
                if (data.success) {
                    setPermissions(data.invalid_permissions ?? []);
                } else {
                    setError("Could not load invalid permissions.");
                }
            } catch {
                setError("Failed to connect to backend.");
            } finally {
                setLoading(false);
            }
        };
        fetchPermissions();
    }, [deliverableId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
                <Loader2 className="w-10 h-10 text-[#012169] animate-spin mb-4" />
                <p className="text-gray-500 font-medium tracking-tight">Accessing BRE Portal...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6" />
                <p className="font-bold">{error}</p>
            </div>
        );
    }

    const violatedRuleIds = Array.from(new Set(permissions.map((p) => p.violates_rule)));


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-50 rounded-2xl border border-red-100">
                        <ShieldCheck className="w-8 h-8 text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Stage 6: BRE Remediation Agent</h2>
                        <p className="text-gray-500 text-sm font-medium">Identifying and fixing policy violations</p>
                    </div>
                </div>
            </div>

            <BREBusinessRulesTable highlightRuleIds={violatedRuleIds} />

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                {permissions.length > 0 ? (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Violations Identified</h3>
                        <p className="text-slate-500 text-sm mb-6 max-w-xs">
                            Agent detected <strong>{permissions.length}</strong> permissions that require App Owner review and decision.
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold animate-pulse">
                                Remediation Global Modal Active
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="py-4">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-green-900">Portal is Compliant</h3>
                        <p className="text-green-700 text-sm">No policy violations were found in the BRE Portal.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
