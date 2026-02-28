/**
 * BRE Business Rules Dashboard Table
 * Displays all 5 BRE business rules.
 * BRE-NEW deliverable ONLY – does not affect existing flows.
 */
import { useEffect, useState } from "react";
import { breApi } from "./breApi";

interface BRERule {
    rule_id: string;
    rule_name: string;
    description: string;
    user_type: string;
    forbidden_permission: string;
    risk_level: string;
    category: string;
    icon: string;
}

const STATIC_RULES: BRERule[] = [
    {
        rule_id: "BRE-RULE-1",
        rule_name: "No Developer → Production Access",
        description: "Developers cannot have Production environment access",
        user_type: "Developer",
        forbidden_permission: "Production Environment Access",
        risk_level: "high",
        category: "Environment Access",
        icon: "🔒",
    },
    {
        rule_id: "BRE-RULE-2",
        rule_name: "No User → Admin Access",
        description: "Users cannot have Admin access",
        user_type: "Regular User",
        forbidden_permission: "Admin Access",
        risk_level: "critical",
        category: "Privilege Escalation",
        icon: "🛡️",
    },
    {
        rule_id: "BRE-RULE-3",
        rule_name: "No Contractor → Confidential Data",
        description: "Contractors cannot access confidential data",
        user_type: "Contractor",
        forbidden_permission: "Confidential Data Access",
        risk_level: "high",
        category: "Data Access",
        icon: "📂",
    },
    {
        rule_id: "BRE-RULE-4",
        rule_name: "No Test Account → Elevated Privileges",
        description: "Test accounts cannot be assigned elevated privileges",
        user_type: "Test Account",
        forbidden_permission: "Elevated Privileges",
        risk_level: "medium",
        category: "Privilege Management",
        icon: "⚠️",
    },
    {
        rule_id: "BRE-RULE-5",
        rule_name: "No Service Account → Interactive Login",
        description: "Service accounts must not have interactive login enabled",
        user_type: "Service Account",
        forbidden_permission: "Interactive Login",
        risk_level: "critical",
        category: "Account Security",
        icon: "🔑",
    },
];

const riskBadge = (level: string) => {
    const map: Record<string, string> = {
        critical: "bg-red-100 text-red-700 border border-red-300",
        high: "bg-orange-100 text-orange-700 border border-orange-300",
        medium: "bg-yellow-100 text-yellow-700 border border-yellow-300",
        low: "bg-green-100 text-green-700 border border-green-300",
    };
    return (
        <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${map[level] ?? "bg-gray-100 text-gray-600"}`}
        >
            {level}
        </span>
    );
};

interface Props {
    /** highlight a specific rule that has violations */
    highlightRuleIds?: string[];
}

export const BREBusinessRulesTable = ({ highlightRuleIds = [] }: Props) => {
    const [rules, setRules] = useState<BRERule[]>(STATIC_RULES);

    useEffect(() => {
        breApi.getBusinessRules()
            .then((d) => {
                if (d.success && d.rules?.length) setRules(d.rules);
            })
            .catch(() => {/* use static fallback */ });
    }, []);

    return (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-[#012169] px-5 py-3 flex items-center gap-3">
                <span className="text-white text-xl">📋</span>
                <div>
                    <h2 className="text-white font-bold text-base">BRE Business Rules Dashboard</h2>
                    <p className="text-blue-200 text-xs">Rules governing permissions during AIT onboarding</p>
                </div>
                <span className="ml-auto bg-blue-800 text-white text-xs px-3 py-1 rounded-full font-semibold">
                    {rules.length} Rules Active
                </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold w-8">#</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Rule</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Applies To</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Forbidden Permission</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Category</th>
                            <th className="text-left px-4 py-3 text-gray-600 font-semibold">Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map((rule, idx) => {
                            const isViolated = highlightRuleIds.includes(rule.rule_id);
                            return (
                                <tr
                                    key={rule.rule_id}
                                    className={`border-b border-gray-100 transition-colors ${isViolated
                                        ? "bg-red-50 border-l-4 border-l-red-500"
                                        : idx % 2 === 0
                                            ? "bg-white"
                                            : "bg-gray-50/50"
                                        } hover:bg-blue-50/40`}
                                >
                                    <td className="px-4 py-3 text-center text-lg">{rule.icon}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-800">{rule.rule_name}</span>
                                            <span className="text-xs text-gray-500 mt-0.5">{rule.description}</span>
                                            {isViolated && (
                                                <span className="mt-1 text-xs text-red-600 font-semibold">
                                                    ⚠️ Violation detected
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{rule.user_type}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-700 bg-gray-100 rounded">
                                        {rule.forbidden_permission}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                            {rule.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{riskBadge(rule.risk_level)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
