import React, { useState, useEffect, useRef } from 'react';

const AgentRunPanel = ({ ticketId, onClose, onTicketUpdate }) => {
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, pending, running, completed, failed
    const [runData, setRunData] = useState(null);
    const [error, setError] = useState(null);
    const pollIntervalRef = useRef(null);

    // Start Agent Run when component mounts or ticketId changes
    useEffect(() => {
        if (!ticketId) return;

        const startRun = async () => {
            try {
                setStatus('pending');
                setError(null);
                setRunData(null);

                const response = await fetch(`http://127.0.0.1:9001/agent/run/${ticketId}`, {
                    method: 'POST',
                });

                if (!response.ok) {
                    throw new Error('Failed to start agent run');
                }

                const data = await response.json();
                setJobId(data.job_id);
                setStatus('running');
                if (onTicketUpdate) onTicketUpdate();
            } catch (err) {
                console.error(err);
                setError(err.message);
                setStatus('failed');
            }
        };

        startRun();

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [ticketId]);

    // Poll for status
    useEffect(() => {
        if (!jobId || (status === 'completed' || status === 'failed')) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            return;
        }

        const poll = async () => {
            try {
                const response = await fetch(`http://127.0.0.1:9001/agent/status/${jobId}`);
                if (!response.ok) return; // Retry next time

                const data = await response.json();
                setRunData(data);

                if (data.status === 'completed' || data.status === 'failed') {
                    setStatus(data.status);
                    if (data.error) setError(data.error);
                    if (onTicketUpdate) onTicketUpdate();
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        };

        // Poll immediately then interval
        poll();
        pollIntervalRef.current = setInterval(poll, 1000);

        return () => clearInterval(pollIntervalRef.current);
    }, [jobId, status]);

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Agent Run: {ticketId}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                        <p className="text-red-700">{error}</p>
                    </div>
                )}

                {/* Status Badge */}
                <div className="mb-6">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold 
            ${status === 'running' ? 'bg-blue-100 text-blue-800' :
                            status === 'completed' ? 'bg-green-100 text-green-800' :
                                status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                        Status: {status.toUpperCase()}
                    </span>
                </div>

                {/* Timeline */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-uppercase text-gray-500 tracking-wider">TIMELINE</h3>
                    <div className="relative border-l-2 border-gray-200 ml-3 space-y-6">
                        {runData?.steps?.map((step, idx) => (
                            <div key={idx} className="ml-6 relative">
                                <span className="absolute -left-9 flex items-center justify-center w-6 h-6 bg-green-500 rounded-full ring-4 ring-white">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </span>
                                <h4 className="text-sm font-semibold text-gray-900">{step.label}</h4>
                                <p className="text-xs text-gray-500">{step.detail}</p>
                                <span className="text-xs text-gray-400">{new Date(step.ts).toLocaleTimeString()}</span>
                            </div>
                        ))}
                        {status === 'running' && (
                            <div className="ml-6 relative">
                                <span className="absolute -left-9 flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full ring-4 ring-white animate-pulse">
                                    <div className="w-2 h-2 bg-white rounded-full"></div>
                                </span>
                                <h4 className="text-sm font-semibold text-gray-900 italic">Agent working...</h4>
                            </div>
                        )}
                    </div>
                </div>

                {/* Email Draft */}
                {runData?.email_body && (
                    <div className="mb-6">
                        <h3 className="text-sm font-uppercase text-gray-500 tracking-wider mb-2">GENERATED EMAIL</h3>
                        <div className="bg-gray-50 p-4 rounded-md border border-gray-200 text-sm font-mono whitespace-pre-wrap text-gray-700">
                            {runData.email_body}
                        </div>
                    </div>
                )}

                {/* Final Summary */}
                {runData?.final_summary && (
                    <div className="mb-6">
                        <h3 className="text-sm font-uppercase text-gray-500 tracking-wider mb-2">SUMMARY</h3>
                        <div className="bg-green-50 p-4 rounded-md border border-green-200 text-sm text-green-800">
                            {runData.final_summary}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentRunPanel;
