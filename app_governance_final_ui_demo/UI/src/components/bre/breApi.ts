/**
 * API wrapper for BRE Rule Certification endpoints
 */

import { BREWorkflowState, AITRules } from './types';

const API_BASE = 'http://localhost:8000/api/bre';

export const breApi = {
  /**
   * Start async BRE workflow for a deliverable (stages 1-4)
   */
  async processDeliverable(deliverableId: string): Promise<{ status: string; message: string; deliverable_id: string }> {
    const response = await fetch(`${API_BASE}/process/${deliverableId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to start BRE process: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Verify App Owner response and trigger Evidence & Closure (Stage 5)
   */
  async verifyAndClose(deliverableId: string, autoCertify: boolean = false): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE}/verify/${deliverableId}?auto_certify=${autoCertify}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to verify deliverable: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get current workflow status for a deliverable
   */
  async getWorkflowStatus(deliverableId: string): Promise<BREWorkflowState | null> {
    const response = await fetch(`${API_BASE}/status/${deliverableId}`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to get workflow status: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * Get live BRE ticket state (including stage progress)
   */
  async getTicket(deliverableId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/tickets/${deliverableId}`);
    if (!response.ok) {
      throw new Error(`Failed to get ticket: ${response.statusText}`);
    }
    const data = await response.json();
    return data.ticket;
  },

  /**
   * Get AIT rules and certification history
   */
  async getAITRules(aitNumber: string): Promise<AITRules> {
    const response = await fetch(`${API_BASE}/ait/${aitNumber}/rules`);
    if (!response.ok) {
      throw new Error(`Failed to get AIT rules: ${response.statusText}`);
    }
    const data = await response.json();
    return data.ait_rules;
  },

  /**
   * Reset BRE ticket to initial state
   */
  async resetTicket(deliverableId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}/reset/${deliverableId}`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error(`Failed to reset ticket: ${response.statusText}`);
    }
    return response.json();
  },

  /**
   * List all BRE tickets
   */
  async listTickets(): Promise<any[]> {
    const response = await fetch(`${API_BASE}/tickets`);
    if (!response.ok) {
      throw new Error(`Failed to list tickets: ${response.statusText}`);
    }
    const data = await response.json();
    return data.tickets || [];
  },

  /**
   * Connect to deliverable-specific WebSocket for real-time updates
   */
  connectWebSocket(deliverableId: string, onMessage: (data: any) => void): WebSocket {
    const wsUrl = `ws://localhost:8000/api/bre/ws/${deliverableId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`BRE WebSocket connected for ${deliverableId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('BRE WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log(`BRE WebSocket disconnected for ${deliverableId}`);
    };

    return ws;
  },
};
