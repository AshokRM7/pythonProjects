import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface PCATMetricsCardsProps {
    errors: number;
    warnings: number;
    totalRows: number;
}

export const PCATMetricsCards: React.FC<PCATMetricsCardsProps> = ({ errors, warnings, totalRows }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Critical Errors</p>
                    <p className="text-2xl font-bold text-gray-900">{errors}</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Warnings</p>
                    <p className="text-2xl font-bold text-gray-900">{warnings}</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-gray-500 font-medium">Rows Validated</p>
                    <p className="text-2xl font-bold text-gray-900">{totalRows}</p>
                </div>
            </div>
        </div>
    );
};
