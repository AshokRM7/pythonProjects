
const BASE_URL = 'http://localhost:8000/api/bre';

export const breApi = {
    getBusinessRules: async () => {
        const response = await fetch(`${BASE_URL}/dashboard/rules`);
        if (!response.ok) throw new Error('Failed to fetch business rules');
        return response.json();
    },

    getRemediationPermissions: async (deliverableId: string) => {
        const response = await fetch(`${BASE_URL}/remediation/${deliverableId}/permissions`);
        if (!response.ok) throw new Error('Failed to fetch permissions');
        return response.json();
    },

    simulateOwnerResponse: async (deliverableId: string) => {
        const response = await fetch(`${BASE_URL}/remediation/${deliverableId}/simulate-owner-response`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to simulate owner response');
        return response.json();
    },

    submitDecisions: async (deliverableId: string, decisions: any[]) => {
        const response = await fetch(`${BASE_URL}/remediation/${deliverableId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decisions })
        });
        if (!response.ok) throw new Error('Failed to submit decisions');
        return response.json();
    },

    capturePreview: async (deliverableId: string, decisions: any[]) => {
        const response = await fetch(`${BASE_URL}/remediation/${deliverableId}/capture-preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decisions })
        });
        if (!response.ok) throw new Error('Failed to capture preview');
        return response.json();
    }
};
