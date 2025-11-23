import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTicket, getOwners, assignOwners, updateTicketStatus, draftEmail, sendEmail } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import EvidencePanel from '../components/EvidencePanel';
import JiraPanel from '../components/JiraPanel';
import { ArrowLeft, Users, Mail, Send, XCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const TicketDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailDraft, setEmailDraft] = useState('');
    const [isDrafting, setIsDrafting] = useState(false);

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['ticket', id],
        queryFn: () => getTicket(id),
    });

    const ownersMutation = useMutation({
        mutationFn: async () => {
            const owners = await getOwners(ticket.ait_number);
            await assignOwners(id, owners.business_owner, owners.support_owner);
            return owners;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['ticket', id]);
            toast.success('Owners fetched from AppHQ');
        },
        onError: () => toast.error('Failed to fetch owners'),
    });

    const statusMutation = useMutation({
        mutationFn: (status) => updateTicketStatus(id, status),
        onSuccess: (_, status) => {
            queryClient.invalidateQueries(['ticket', id]);
            toast.success(`Ticket marked as ${status}`);
        },
    });

    const handleDraftEmail = async () => {
        setIsDrafting(true);
        try {
            const draft = await draftEmail(ticket, {
                business_owner: ticket.business_owner,
                support_owner: ticket.support_owner
            });
            setEmailDraft(draft);
            setIsEmailModalOpen(true);
        } catch (error) {
            toast.error('Failed to draft email');
        } finally {
            setIsDrafting(false);
        }
    };

    const handleSendEmail = async () => {
        try {
            await sendEmail({
                to: [ticket.business_owner || 'owner@example.com'],
                subject: `Action Required: ${ticket.id}`,
                body: emailDraft
            });
            setIsEmailModalOpen(false);
            toast.success('Email sent successfully');
        } catch (error) {
            toast.error('Failed to send email');
        }
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    if (!ticket) return <div className="text-center mt-10">Ticket not found</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
            <button onClick={() => navigate('/')} className="flex items-center text-gray-500 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>

            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900">{ticket.id}</h1>
                        <StatusBadge status={ticket.status} />
                    </div>
                    <p className="text-gray-500">{ticket.application} • AIT: {ticket.ait_number}</p>
                </div>
                <div className="flex space-x-2">
                    {ticket.status !== 'Closed' && (
                        <button
                            onClick={() => statusMutation.mutate('Closed')}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center shadow-sm"
                        >
                            <CheckCircle className="w-4 h-4 mr-2" /> Close Ticket
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
                        <p className="text-gray-700 leading-relaxed">{ticket.description}</p>

                        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 block">Created By</span>
                                <span className="font-medium">{ticket.created_by}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Created At</span>
                                <span className="font-medium">{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">Priority</span>
                                <span className={`font-medium ${ticket.priority === 'High' ? 'text-red-600' : 'text-gray-900'}`}>{ticket.priority}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">SLA Days</span>
                                <span className="font-medium">{ticket.sla_days}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-blue-600" />
                                Ownership
                            </h3>
                            <button
                                onClick={() => ownersMutation.mutate()}
                                disabled={ownersMutation.isPending}
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center font-medium"
                            >
                                {ownersMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                                Sync from AppHQ
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Business Owner</span>
                                <div className="mt-1 font-medium text-gray-900">{ticket.business_owner || <span className="text-gray-400 italic">Not assigned</span>}</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Support Owner</span>
                                <div className="mt-1 font-medium text-gray-900">{ticket.support_owner || <span className="text-gray-400 italic">Not assigned</span>}</div>
                            </div>
                        </div>

                        <div className="mt-6 flex space-x-3">
                            <button
                                onClick={handleDraftEmail}
                                disabled={!ticket.business_owner || isDrafting}
                                className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-200 flex justify-center items-center font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDrafting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                                Draft Email (AI)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar Panels */}
                <div className="space-y-6">
                    <EvidencePanel ticketId={id} evidence={ticket.evidence} />
                    <JiraPanel jiraId={ticket.jira_id} />
                </div>
            </div>

            {/* Email Modal */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Preview Email</h3>
                            <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">To</label>
                                <input type="text" value={ticket.business_owner} disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Subject</label>
                                <input type="text" value={`Action Required: ${ticket.id}`} disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Body</label>
                                <textarea
                                    value={emailDraft}
                                    onChange={(e) => setEmailDraft(e.target.value)}
                                    rows={10}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end space-x-3">
                            <button onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                            <button onClick={handleSendEmail} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
                                <Send className="w-4 h-4 mr-2" /> Send Email
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TicketDetails;
