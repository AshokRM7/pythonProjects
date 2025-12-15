import { useState, useEffect } from 'react';
import { RefreshCw, Search, AlertCircle } from 'lucide-react';
import { Ticket } from '../App';
import { User as UserType } from '../App';
import { Header } from './Header';
import { Footer } from './Footer';
import { fetchTickets } from '../api/iam';

interface TicketDashboardProps {
  onTicketSelect: (ticket: Ticket) => void;
  user: UserType;
  onLogout: () => void;
}

export function TicketDashboard({ onTicketSelect, user, onLogout }: TicketDashboardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await fetchTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to load tickets', err);
      setError('Failed to load tickets. Is the backend running?');
      // Fallback to empty or could show error UI
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleRefresh = () => {
    loadTickets();
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.appId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-purple-100 text-purple-800';
      case 'Pending Evidence': return 'bg-orange-100 text-orange-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isNearSLA = (deadline: string) => {
    const today = new Date();
    const slaDate = new Date(deadline);
    const diffTime = slaDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} onLogout={onLogout} />

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by ticket ID, title, or app ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Fetch Tickets
            </button>
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onTicketSelect(ticket)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-gray-900">{ticket.id}</h3>
                    <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                    {isNearSLA(ticket.slaDeadline) && (
                      <span className="flex items-center gap-1 text-red-600 text-xs">
                        <AlertCircle className="w-4 h-4" />
                        SLA Alert
                      </span>
                    )}
                  </div>
                  <h2 className="text-gray-900 mb-2">{ticket.title}</h2>
                  <p className="text-gray-600 mb-3">{ticket.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">App ID:</span>
                  <p className="text-gray-900">{ticket.appId}</p>
                </div>
                <div>
                  <span className="text-gray-500">SLA Deadline:</span>
                  <p className="text-gray-900">{new Date(ticket.slaDeadline).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Created By:</span>
                  <p className="text-gray-900">{ticket.createdBy}</p>
                </div>
                <div>
                  <span className="text-gray-500">JIRA Story:</span>
                  <p className="text-gray-900">{ticket.jiraStory}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTickets.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No tickets found matching your search</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}