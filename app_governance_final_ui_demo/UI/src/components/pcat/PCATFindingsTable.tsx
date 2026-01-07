import React from 'react';
import { PCATFinding } from './types';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface PCATFindingsTableProps {
    findings: PCATFinding[];
}

export const PCATFindingsTable: React.FC<PCATFindingsTableProps> = ({ findings }) => {
    if (!findings || findings.length === 0) {
        return (
            <div className="bg-green-50 border border-green-200 text-green-700 p-8 rounded-xl text-center">
                <p className="font-bold text-lg mb-2">Clean Pass!</p>
                <p>No issues or conflicts detected in the metadata.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                        <tr>
                            <th className="px-4 py-3">Row</th>
                            <th className="px-4 py-3">Field</th>
                            <th className="px-4 py-3">Issue</th>
                            <th className="px-4 py-3 text-center">Severity</th>
                            <th className="px-4 py-3">Recommendation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {findings.map((finding, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-700">#{finding.row_id}</td>
                                <td className="px-4 py-3 text-blue-600 font-medium">{finding.column}</td>
                                <td className="px-4 py-3 text-gray-600">{finding.message}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${finding.severity === 'ERROR' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                        {finding.severity === 'ERROR' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                        {finding.severity}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 italic max-w-xs truncate" title={finding.recommendation}>
                                    {finding.recommendation || 'Review policy.'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
