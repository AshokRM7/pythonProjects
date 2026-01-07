import { PCATReport } from './types';

const BASE_URL = 'http://localhost:8000/api/pcat';

export const pcatApi = {
    getHealth: async () => {
        const response = await fetch(`${BASE_URL}/health`);
        return response.json();
    },

    downloadTemplate: () => {
        window.location.href = `${BASE_URL}/template/download`;
    },

    downloadTicketCsv: (ticketId: string) => {
        window.location.href = `${BASE_URL}/tickets/${ticketId}/csv/download`;
    },

    validateTicket: async (ticketId: string) => {
        const response = await fetch(`${BASE_URL}/tickets/${ticketId}/validate`, {
            method: 'POST'
        });
        return response.json();
    },

    getLatestReport: async (ticketId: string): Promise<PCATReport> => {
        const response = await fetch(`${BASE_URL}/tickets/${ticketId}/report/latest`);
        if (!response.ok) throw new Error('Report not found');
        return response.json();
    },

    downloadReport: (ticketId: string) => {
        window.location.href = `${BASE_URL}/tickets/${ticketId}/report/latest/download`;
    },

    resetDemo: async () => {
        const response = await fetch(`${BASE_URL}/demo/reset`);
        return response.json();
    }
};
