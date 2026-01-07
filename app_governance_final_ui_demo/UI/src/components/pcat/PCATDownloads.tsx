import React from 'react';
import { Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { pcatApi } from './pcatApi';

interface PCATDownloadsProps {
    ticketId: string;
}

export const PCATDownloads: React.FC<PCATDownloadsProps> = ({ ticketId }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
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
