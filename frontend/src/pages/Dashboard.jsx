import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTickets } from '../services/api';
import TicketTable from '../components/TicketTable';
import AgentRunPanel from '../components/AgentRunPanel';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
    const [selectedTicketId, setSelectedTicketId] = React.useState(null);
    const { data: tickets, isLoading, error, refetch } = useQuery({
        queryKey: ['tickets'],
        queryFn: () => getTickets(),
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                <strong className="font-bold">Error!</strong>
                <span className="block sm:inline"> Failed to load tickets. Is the backend running?</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Governance Dashboard</h1>
                <div className="flex space-x-2">
                    {/* Filters could go here */}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Total Tickets</div>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{tickets?.length || 0}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Pending Review</div>
                    <div className="text-3xl font-bold text-orange-600 mt-2">
                        {tickets?.filter(t => t.status === 'New').length || 0}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-gray-500 text-sm font-medium">Closed</div>
                    <div className="text-3xl font-bold text-green-600 mt-2">
                        {tickets?.filter(t => t.status === 'Closed').length || 0}
                    </div>
                </div>
            </div>

            <TicketTable
                tickets={tickets || []}
                onRunAgent={(id) => setSelectedTicketId(id)}
            />

            {selectedTicketId && (
                <AgentRunPanel
                    ticketId={selectedTicketId}
                    onClose={() => setSelectedTicketId(null)}
                    onTicketUpdate={refetch}
                />
            )}
        </div>
    );
};

export default Dashboard;
