import { get, post } from './client';
import { Ticket } from '../App';

export interface AgentJob {
    job_id: string;
    ticket_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    steps: AgentStep[];
    email_body?: string;
    final_summary?: string;
    rise_status?: string;
    jira_status?: string;
    error?: string;
}

export interface AgentStep {
    ts: string;
    label: string;
    detail: string;
}

export async function fetchTickets(status?: string): Promise<Ticket[]> {
    const query = status ? `?status=${status}` : '';
    return get<Ticket[]>(`/rise/tickets${query}`);
}

export async function fetchTicket(id: string): Promise<Ticket> {
    return get<Ticket>(`/rise/tickets/${id}`);
}

export async function runAgent(ticketId: string): Promise<{ job_id: string; ticket_id: string; status: string }> {
    return post<{ job_id: string; ticket_id: string; status: string }>(`/agent/run/${ticketId}`);
}

export async function getAgentStatus(jobId: string): Promise<AgentJob> {
    return get<AgentJob>(`/agent/status/${jobId}`);
}

export async function getEmailLogs(): Promise<any[]> {
    return get<any[]>('/mail/logs');
}
