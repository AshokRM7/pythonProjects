import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:9002';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const getTickets = async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/rise/tickets', { params });
    return response.data;
};

export const getTicket = async (id) => {
    const response = await api.get(`/rise/tickets/${id}`);
    return response.data;
};

export const getOwners = async (aitNumber) => {
    const response = await api.get(`/apphq/owners/${aitNumber}`);
    return response.data;
};

export const assignOwners = async (ticketId, businessOwner, supportOwner) => {
    const response = await api.post(`/rise/tickets/${ticketId}/assign_owners`, null, {
        params: { business_owner: businessOwner, support_owner: supportOwner }
    });
    return response.data;
};

export const updateTicketStatus = async (id, status) => {
    const response = await api.post(`/rise/tickets/${id}/status`, null, {
        params: { status },
    });
    return response.data;
};

export const addEvidence = async (id, evidence) => {
    const response = await api.post(`/rise/tickets/${id}/evidence`, null, {
        params: { evidence },
    });
    return response.data;
};

export const getJiraItem = async (jiraId) => {
    const response = await api.get(`/jira/items/${jiraId}`);
    return response.data;
};

export const addJiraComment = async (jiraId, comment) => {
    const response = await api.post(`/jira/items/${jiraId}/comment`, null, {
        params: { comment },
    });
    return response.data;
};

export const updateJiraStatus = async (jiraId, status) => {
    const response = await api.post(`/jira/items/${jiraId}/status`, null, {
        params: { status },
    });
    return response.data;
};

export const sendEmail = async (emailData) => {
    const response = await api.post('/mail/send', emailData);
    return response.data;
};

export const getEmailLogs = async () => {
    const response = await api.get('/mail/logs');
    return response.data;
};

// Real OpenAI Draft via UI Server
export const draftEmail = async (ticket, owners) => {
    const UI_SERVER_URL = 'http://127.0.0.1:8000';
    const response = await axios.post(`${UI_SERVER_URL}/api/draft_email`, {
        ticket,
        owners
    });
    return response.data.draft;
};
