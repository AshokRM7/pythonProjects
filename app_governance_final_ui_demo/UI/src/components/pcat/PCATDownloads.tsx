import React from 'react';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { pcatApi } from './pcatApi';

interface PCATDownloadsProps {
    ticketId: string;
}

export const PCATDownloads: React.FC<PCATDownloadsProps & { ticket?: any }> = ({ ticketId, ticket }) => {
    return (
        <div className={`grid grid-cols-1 ${ticket?.final_csv_ready ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 mb-6`}>
            {ticket?.final_csv_ready && (
                <button
                    onClick={() => pcatApi.downloadFinalCsv(ticketId)}
                    className="flex items-center justify-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 hover:border-green-300 text-green-700 transition-all font-bold text-sm shadow-sm"
                >
                    <Download className="w-5 h-5 text-green-600" />
                    Updated CSV
                </button>
            )}

            <button
                onClick={() => pcatApi.downloadTemplate()}
                className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 text-gray-700 transition-all font-medium text-sm"
            >
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                Download Template
            </button>

            <button
                onClick={() => pcatApi.downloadTicketCsv(ticketId)}
                className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 text-gray-700 transition-all font-medium text-sm"
            >
                <Download className="w-5 h-5 text-blue-600" />
                Raw Ticket CSV
            </button>

            <button
                onClick={() => pcatApi.downloadReport(ticketId)}
                className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-300 text-gray-700 transition-all font-medium text-sm"
            >
                <FileJson className="w-5 h-5 text-orange-600" />
                Full Report JSON
            </button>
        </div>
    );
};
