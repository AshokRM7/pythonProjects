import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Play, Activity, Clock, User, Calendar, Tag, FileText, CheckCircle2, ShieldCheck, AlertCircle, X, CheckCheck, Loader2, CheckCircle, Search, Filter, ChevronLeft, ChevronRight, Menu, Bell, Settings, Download, MoreVertical, Heart, Share2, Clipboard, Layers, RotateCcw, PlayCircle } from 'lucide-react';
import { PCATTicketPanel } from './pcat/PCATTicketPanel';
import { PCATMetricsCards } from './pcat/PCATMetricsCards';
import { PCATSummary } from './pcat/types';
import { pcatApi } from './pcat/pcatApi';
import Header from './Header';
import Footer from './Footer';

interface HomeProps {
  currentUser: string;
  onSignOut: () => void;
}

interface Stage {
  id: number;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  message: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not-started' | 'in-progress' | 'completed' | 'open' | 'closed' | 'PCAT Validation Completed';
  customer: string;
  createdAt: string;
  currentStage: number;
  stages: Stage[];
  waitingForReview?: boolean;
  waitingForPriorityConfirmation?: boolean;
  waitingForClosureConfirmation?: boolean;
  aitNumber?: string;
  deliverableType?: string;
  category?: string;
  slaDeadline?: string;
  armId?: string;
  applicationName?: string;
  lobOwner?: string;
  aitOwner?: string;
  owner?: string;
  contacts?: string[];
  ticket_type?: string;
  pcat_summary?: {
    errors: number;
    warnings: number;
    last_run_at: string;
    report_path?: string;
  };
}

// Helper to map API ticket status to Dashboard status
const normalizeStatus = (apiStatus: string) => {
  const s = apiStatus.toLowerCase().replace(/-/g, ' ').trim();
  if (s === 'open' || s === 'not started') return 'Open';

  if (s === 'closed' || s === 'completed') return 'Closed';
  if (s === 'in progress') return 'In Progress';
  if (s === 'pending') return 'Pending';
  if (s === 'waiting for evidence') return 'Waiting for Evidence';
  if (s === 'recent issues') return 'Recent Issues';
  return 'Open';
};

export default function Home({ currentUser, onSignOut }: HomeProps) {

  const navigate = useNavigate();
  const { ticketId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const selectedTicketRef = useRef<Ticket | null>(null); // Ref to hold the latest selectedTicket

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [showAllTickets, setShowAllTickets] = useState(true); // Default to show all to match Dashboard

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showRemediationModal, setShowRemediationModal] = useState(false);

  const [emailTemplate, setEmailTemplate] = useState<{ to: string, subject: string, body: string } | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | string[]>('all');
  const [ownerFilter, setOwnerFilter] = useState<string | string[]>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Update selectedTicketRef whenever selectedTicket state changes
  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);

  useEffect(() => {
    // 1. Process location state if coming from Dashboard
    if (location.state) {
      if (location.state.statusFilter) setStatusFilter(location.state.statusFilter);
      if (location.state.timeline) setTimelineFilter(parseInt(location.state.timeline));
      if (location.state.category) setCategoryFilter(location.state.category);
      if (location.state.owner) setOwnerFilter(location.state.owner);
      // Ensure we fetch all categories if coming from Dashboard
      setShowAllTickets(true);
    }
  }, [location]);

  // Combined fetch and reset logic
  useEffect(() => {
    fetchTickets();
  }, [showAllTickets, currentUser]);


  // Filter tickets based on dashboard selection, inputs and search
  // 1. Context Filters (Category, Owner, Timeline, Search)
  const contextTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Check Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = ticket.title.toLowerCase().includes(query);
        const idMatch = ticket.id.toLowerCase().includes(query);
        const categoryMatch = (ticket.category || '').toLowerCase().includes(query);
        const ownerMatch = (ticket.owner || '').toLowerCase().includes(query);
        if (!titleMatch && !idMatch && !categoryMatch && !ownerMatch) return false;
      }

      // Check Category
      if (categoryFilter !== 'all' && (!Array.isArray(categoryFilter) || !categoryFilter.includes('all'))) {
        const tCat = ticket.category || 'IAM';
        if (Array.isArray(categoryFilter)) {
          if (!categoryFilter.includes(tCat)) return false;
        } else {
          if (tCat !== categoryFilter) return false;
        }
      }

      // Check Owner
      if (ownerFilter !== 'all' && (!Array.isArray(ownerFilter) || !ownerFilter.includes('all'))) {
        const tOwner = ticket.owner || 'owner1';
        if (Array.isArray(ownerFilter)) {
          if (!ownerFilter.includes(tOwner)) return false;
        } else {
          if (tOwner !== ownerFilter) return false;
        }
      }

      // Check Timeline
      if (timelineFilter) {
        const ticketDate = new Date(ticket.createdAt);
        const days = timelineFilter;
        const limit = new Date();
        limit.setDate(limit.getDate() - days);
        // If date is invalid (mock data issues), we might keep it or filter it.
        // Assuming valid mock data or permissive fallback
        if (!isNaN(ticketDate.getTime()) && ticketDate < limit) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, categoryFilter, ownerFilter, timelineFilter, searchQuery]);

  // 2. Status Filter (Applied on top of Context)
  const filteredTickets = useMemo(() => {
    if (!statusFilter || statusFilter === 'Total') return contextTickets;

    return contextTickets.filter(ticket => {
      // Use standardized normalization to match Dashboard counts
      const tNormalizedStatus = normalizeStatus(ticket.status || '');
      return tNormalizedStatus.toLowerCase() === statusFilter.toLowerCase();
    });
  }, [contextTickets, statusFilter]);


  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8000/ws');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setStatusMessage('Connected to server');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);

        switch (data.type) {
          case 'initial_state':
            // Don't set tickets from WebSocket - let HTTP fetch handle initial load
            // This ensures the filter (IAM vs All) is respected
            console.log('WebSocket connected, initial state received');
            break;

          case 'ticket_update':
            setTickets((prev) => {
              const index = prev.findIndex((t) => t.id === data.ticket.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = data.ticket;
                return updated;
              } else {
                return [...prev, data.ticket];
              }
            });

            // Update selected ticket if it's the one being updated
            if (selectedTicket && selectedTicket.id === data.ticket.id) {
              setSelectedTicket(data.ticket);
            }
            break;

          case 'processing_start':
            setStatusMessage(data.message);
            break;

          case 'stage_update':
            setStatusMessage(`${data.stage}: ${data.message}`);
            break;

          case 'pcat_stage_update':
            // Update individual ticket for PCAT real-time progress
            setTickets(prev => prev.map(t =>
              t.id === data.ticket_id ? { ...t, ...data.ticket } : t
            ));
            if (selectedTicketRef.current?.id === data.ticket_id) {
              setSelectedTicket(prev => prev ? { ...prev, ...data.ticket } : null);
            }
            break;
          case 'processing_complete':
            setStatusMessage(data.message);
            if (data.ticket) {
              // Update the specific ticket
              setTickets((prev) => {
                const index = prev.findIndex((t) => t.id === data.ticket.id);
                if (index >= 0) {
                  const updated = [...prev];
                  updated[index] = data.ticket;
                  return updated;
                }
                return prev;
              });
            }
            break;

          case 'error':
            setStatusMessage(`Error: ${data.message}`);
            alert(`Error: ${data.message}`);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('disconnected');
        setStatusMessage('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        setStatusMessage('Disconnected from server');

        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Show success toast when ticket is completed
  useEffect(() => {
    if (selectedTicket?.status === 'completed') {
      setShowSuccessToast(true);
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [selectedTicket?.status]);

  // AUTO-TRIGGER Remediation Modal
  useEffect(() => {
    if (selectedTicket &&
      selectedTicket.currentStage === 5 &&
      selectedTicket.stages[5].status === 'in-progress' &&
      selectedTicket.ticket_type !== 'PCAT' &&
      selectedTicket.category !== 'PCAT' &&
      !showRemediationModal) {
      setShowRemediationModal(true);
    }
  }, [selectedTicket?.currentStage, selectedTicket?.stages?.[5]?.status]);

  // Handle ticket selection from URL


  // Handle ticket selection from URL
  useEffect(() => {
    if (ticketId && tickets.length > 0) {
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket) {
        setSelectedTicket(ticket);
      }
    }
  }, [ticketId, tickets]);

  // No-op - removed redundant effects


  const fetchTickets = async () => {
    try {
      const endpoint = showAllTickets
        ? 'http://localhost:8000/api/tickets'
        : 'http://localhost:8000/api/tickets/iam';
      const response = await fetch(endpoint);
      const data = await response.json();
      if (data.tickets) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const handleProcessTicket = async (ticketId: string) => {
    try {
      setStatusMessage(`Processing ticket ${ticketId}...`);

      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/process`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      const data = await response.json();
      console.log('Processing started:', data);
    } catch (error) {
      console.error('Error starting processing:', error);
      setStatusMessage('Failed to start processing');
      alert('Error: ' + (error as Error).message);
    }
  };

  const handleConfirmPriority = async (ticketId: string) => {
    try {
      setStatusMessage(`Confirming priority for ticket ${ticketId}...`);

      // Get priority from currently selected ticket (which reflects dropdown state)
      const priority = selectedTicket && selectedTicket.id === ticketId
        ? selectedTicket.priority
        : 'medium';

      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/confirm-priority`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm priority');
      }

      const data = await response.json();
      console.log('Priority confirmed:', data);
      setStatusMessage(data.message);
    } catch (error) {
      console.error('Error confirming priority:', error);
      setStatusMessage('Failed to confirm priority');
    }
  };

  const handleConfirmClosure = async (ticketId: string) => {
    try {
      setStatusMessage(`Confirming closure for ticket ${ticketId}...`);
      setShowClosureModal(false);

      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/confirm-closure`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to confirm closure');
      }

      const data = await response.json();
      console.log('Closure confirmed:', data);
      setStatusMessage(data.message);
    } catch (error) {
      console.error('Error confirming closure:', error);
      setStatusMessage('Failed to confirm closure');
    }
  };

  const handleShowEmailPreview = async (ticketId: string) => {
    try {
      // Fetch email template from backend
      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/email-preview`);

      if (!response.ok) {
        throw new Error('Failed to fetch email template');
      }

      const data = await response.json();
      setEmailTemplate(data.email);
      setShowEmailModal(true);
    } catch (error) {
      console.error('Error fetching email template:', error);
      // If API doesn't exist yet, show sample template
      setEmailTemplate({
        to: selectedTicket?.contacts?.join(', ') || 'app.owner@company.com',
        subject: `Evidence Required: ${selectedTicket?.title || 'Ticket'} - ${selectedTicket?.id}`,
        body: `Dear Application Owner,\n\nWe are processing ticket ${selectedTicket?.id} regarding ${selectedTicket?.title}.\n\nApplication Details:\n- Application Name: ${selectedTicket?.applicationName || 'N/A'}\n- AIT Number: ${selectedTicket?.aitNumber || 'N/A'}\n- LOB Owner: ${selectedTicket?.lobOwner || 'N/A'}\n\nWe require evidence of the following actions:\n1. User access review\n2. Compliance verification\n3. Security approval\n\nPlease provide the requested evidence within 48 hours.\n\nBest regards,\nGovernance Team`
      });
      setShowEmailModal(true);
    }
  };

  const handleApproveReview = async (ticketId: string) => {
    try {
      setStatusMessage(`Approving and sending email for ticket ${ticketId}...`);

      // Get the email details from the template state
      if (!emailTemplate) {
        throw new Error('Email template not found');
      }

      // Convert comma-separated string back to array and trim
      const toArray = emailTemplate.to.split(',').map(e => e.trim()).filter(e => e !== '');

      const response = await fetch(`http://localhost:8000/api/tickets/${ticketId}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: toArray,
          subject: emailTemplate.subject,
          body: emailTemplate.body
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      const data = await response.json();
      console.log('Email sent/simulated:', data);

      setShowEmailModal(false);
      setStatusMessage(data.message);

      // Notify user via alert/toast
      if (data.status === 'success') {
        alert('Email sent successfully!');
      } else {
        alert('Error: ' + data.message);
      }

    } catch (error) {
      console.error('Error in handleApproveReview:', error);
      setStatusMessage('Failed to approve and send email');
      alert('Error: ' + (error as Error).message);
    }
  };

  // Sync selectedTicket with tickets state when updates arrive
  useEffect(() => {
    if (selectedTicket) {
      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket && JSON.stringify(updatedTicket) !== JSON.stringify(selectedTicket)) {
        setSelectedTicket(updatedTicket);
      }
    }
  }, [tickets]);

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    // Update URL without navigation
    window.history.pushState({}, '', `/home/ticket/${ticket.id}`);
  };

  const handleCloseTicket = () => {
    setSelectedTicket(null);
    navigate('/home');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'not-started':
        return <Clock className="w-4 h-4" />;
      case 'in-progress':
        return <PlayCircle className="w-4 h-4" />;
      case 'completed':
      case 'closed':
      case 'pcat validation completed':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;

    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'not-started':
        return 'bg-gray-100 text-gray-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
      case 'closed':
      case 'pcat validation completed':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';

    }
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 border-green-500 text-white';
      case 'in-progress':
        return 'bg-blue-500 border-blue-500 text-white';
      case 'error':
        return 'bg-red-500 border-red-500 text-white';
      default:
        return 'border-gray-300 text-gray-500';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header
        currentUser={currentUser}
        onSignOut={onSignOut}
        onSearch={setSearchQuery}
        searchValue={searchQuery}
      />

      <main className="flex-1 max-w-[95%] w-full mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => navigate('/')}
                  className="group px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-[#012169] hover:bg-blue-50 hover:text-[#012169] transition-all duration-300 flex items-center gap-2 text-sm font-medium shadow-sm hover:shadow-md"
                >
                  <span className="group-hover:-translate-x-1 transition-transform duration-300">←</span>
                  Back to Dashboard
                </button>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                {statusFilter ? `${statusFilter} Tickets` : 'All Tickets'}
                <span className="ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                  {filteredTickets.length} items
                </span>
              </h1>
            </div>

            {/* KPI / Quick Stats in Header - Animated */}
            <div className="flex items-center gap-3">
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 transition-transform hover:scale-105 duration-300 hover:shadow-md">
                <div className="p-2 bg-[#E31837]/10 text-[#E31837] rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed</p>
                  <p className="text-lg font-bold text-gray-800 leading-none">
                    {contextTickets.filter(t => (t.status as string) === 'completed' || (t.status as string) === 'closed').length}
                  </p>
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 transition-transform hover:scale-105 duration-300 hover:shadow-md">
                <div className="p-2 bg-[#012169]/10 text-[#012169] rounded-lg">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Active</p>
                  <p className="text-lg font-bold text-gray-800 leading-none">
                    {contextTickets.filter(t => (t.status as string) !== 'completed' && (t.status as string) !== 'closed' && (t.status as string) !== 'not-started').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PCAT Global Dashboard Widget - Conditionally shown if tickets exist */}
          {tickets.some(t => t.ticket_type === 'PCAT') && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Layers className="w-6 h-6 text-[#012169]" />
                  PCAT Automation Dashboard
                </h2>
                <button
                  onClick={() => pcatApi.resetDemo()}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" /> Reset Demo
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-lg font-bold">
                    {tickets.filter(t => t.ticket_type === 'PCAT').length}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">PCAT Tickets</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">Total Identified</p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Validated</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">
                      {tickets.filter(t => t.ticket_type === 'PCAT' && t.status === 'PCAT Validation Completed').length}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Findings</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">
                      {tickets.reduce((acc, t) => acc + (t.pcat_summary?.errors || 0) + (t.pcat_summary?.warnings || 0), 0)}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Action Items</p>
                    <p className="text-lg font-bold text-gray-900 leading-none">
                      {tickets.reduce((acc, t) => acc + (t.pcat_summary?.errors || 0), 0)} High Risk
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 shadow-sm flex items-center gap-2">
              <Activity className="w-4 h-4 animate-pulse" />
              {statusMessage}
            </div>
          )}
        </div>

        {/* Tickets Grid */}
        <div className={`grid gap-6 ${selectedTicket ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Tickets List */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-gray-900 mb-4">
                {statusFilter ? statusFilter : 'All'} Tickets ({filteredTickets.length})
              </h2>

              {tickets.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No tickets available</p>
                  <p className="text-sm mt-2">Tickets will load automatically</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className={`border rounded-lg p-4 transition hover:shadow-md cursor-pointer ${selectedTicket?.id === ticket.id
                        ? 'border-[#E31837] bg-white ring-1 ring-[#E31837]'
                        : 'border-gray-200 bg-white'
                        }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-semibold">{ticket.id}</span>
                          {/* Category Badge */}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${ticket.category?.toUpperCase() === 'IAM'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                            {ticket.category || 'Unknown'}
                          </span>
                          {ticket.priority === 'urgent' && (
                            <AlertCircle className="w-4 h-4 text-red-600" />
                          )}
                          {ticket.waitingForReview && (
                            <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700 border border-yellow-200">
                              ⏸️ Review
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs border ${getPriorityColor(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority.toUpperCase()}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${getStatusColor(
                              ticket.status
                            )}`}
                          >
                            {getStatusIcon(ticket.status)}
                            {ticket.status.replace('-', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-gray-900 mb-3 font-medium">{ticket.title}</h3>

                      <div className="flex items-center gap-4 text-gray-600 text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{ticket.customer}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{ticket.createdAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <span className="text-gray-600 text-sm">
                          Stage {(ticket.status === 'completed' || ticket.status === 'closed') ? ticket.stages.length : ticket.currentStage + 1}/{ticket.stages.length}
                        </span>
                        <div className="flex gap-1">
                          {ticket.stages.slice(0, 9).map((stage, idx) => {
                            const isDone = (ticket.status === 'completed' || ticket.status === 'closed');

                            return (
                              <div
                                key={idx}
                                className={`w-2 h-2 rounded-full ${isDone || stage.status === 'completed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                  stage.status === 'in-progress' ? 'bg-blue-500 animate-pulse' :
                                    stage.status === 'error' ? 'bg-red-500' :
                                      'bg-gray-300'
                                  }`}

                                title={stage.name}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ticket Detail Panel */}
          {/* Ticket Detail Panel */}
          {selectedTicket && (
            <div className="md:sticky md:top-24 h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              {(selectedTicket.ticket_type === 'PCAT' || selectedTicket.category === 'PCAT') ? (
                <div className="flex flex-col h-full bg-white">
                  <div className="p-6 pb-2 border-b border-gray-100 bg-white z-20">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-gray-900 font-bold">{selectedTicket.id}</h2>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold uppercase">PCAT Module</span>
                      </div>
                      <button
                        onClick={handleCloseTicket}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 font-medium mb-2">{selectedTicket.title}</p>
                  </div>
                  <PCATTicketPanel
                    ticket={selectedTicket}
                    onRefresh={() => fetchTickets()}
                  />
                </div>
              ) : (
                <>
                  {/* FIXED HEADER SECTION */}
                  <div className="p-6 pb-2 border-b border-gray-100 bg-white z-20">
                    <div className="flex items-start justify-between mb-4">
                      <h2 className="text-gray-900 font-bold">{selectedTicket.id}</h2>
                      <button
                        onClick={handleCloseTicket}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                      >
                        ×
                      </button>
                    </div>

                    {/* ACTION BUTTONS Container - Always Visible */}
                    <div className="mb-2">
                      {(() => {
                        // 1. Priority Confirmation with Editable Dropdown
                        if (selectedTicket.waitingForPriorityConfirmation ||
                          (selectedTicket.stages[2].status === 'completed' &&
                            selectedTicket.stages[3].status !== 'in-progress' &&
                            selectedTicket.stages[3].status !== 'completed')) {
                          return (
                            <div className="space-y-3 p-1">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800 font-medium">
                                  ⚡ Priority calculated as <span className="font-bold uppercase">{selectedTicket.priority}</span>. Confirm to proceed.
                                </p>
                              </div>
                              <button
                                onClick={() => handleConfirmPriority(selectedTicket.id)}
                                className="w-full bg-blue-600 text-white border border-blue-700 py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg font-bold"
                              >
                                <CheckCheck className="w-5 h-5" />
                                Confirm Priority & Continue
                              </button>
                            </div>
                          );
                        }

                        // 2. Review Approval
                        if (selectedTicket.stages[5].status === 'in-progress' || selectedTicket.waitingForReview) {
                          return (
                            <button
                              onClick={() => handleShowEmailPreview(selectedTicket.id)}
                              className="w-full bg-[#012169] text-white border border-[#012169] py-3 rounded-lg hover:bg-[#00174F] transition flex items-center justify-center gap-2 shadow-lg font-bold"
                            >
                              <CheckCheck className="w-5 h-5" />
                              Review Email & Approve
                            </button>
                          );
                        }

                        // 3. Closure Confirmation
                        if (selectedTicket.stages[6].status === 'in-progress' || selectedTicket.waitingForClosureConfirmation) {
                          return (
                            <button
                              onClick={() => setShowClosureModal(true)}
                              className="w-full bg-[#012169] text-white border border-[#012169] py-3 rounded-lg hover:bg-[#00174F] transition flex items-center justify-center gap-2 shadow-lg font-bold"
                            >
                              <CheckCheck className="w-5 h-5" />
                              Confirm Closure
                            </button>
                          );
                        }

                        // 4. Start Processing
                        if (selectedTicket.status === 'not-started' || selectedTicket.status.toLowerCase() === 'open') {
                          return (
                            <button
                              onClick={() => handleProcessTicket(selectedTicket.id)}
                              className="w-full bg-[#012169] text-white border border-[#012169] py-3 rounded-lg hover:bg-[#00174F] transition flex items-center justify-center gap-2 shadow-sm font-bold"
                            >
                              <Play className="w-5 h-5" />
                              Start Processing
                            </button>
                          );
                        }

                        // 5. Processing State
                        if (selectedTicket.status === 'in-progress') {
                          return (
                            <div className="w-full bg-blue-50 text-blue-700 py-3 rounded-lg flex items-center justify-center gap-2 border border-blue-100 font-medium">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processing...
                            </div>
                          );
                        }

                        // 6. Completed State
                        if (selectedTicket.status === 'completed' || selectedTicket.status === 'closed') {
                          return (
                            <div className="w-full bg-green-50 text-green-700 py-3 rounded-lg flex items-center justify-center gap-2 border border-green-100 font-medium">
                              <CheckCircle className="w-5 h-5" />
                              Completed
                            </div>
                          );
                        }

                        // Fallback for other states
                        return (
                          <div className="w-full bg-gray-50 text-gray-600 py-3 rounded-lg flex items-center justify-center gap-2 border border-gray-200 font-medium">
                            <Activity className="w-5 h-5" />
                            {(selectedTicket.status as string).toUpperCase()}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* SCROLLABLE CONTENT AREA */}
                  <div className="flex-1 overflow-y-auto p-6 pt-0">
                    <h3 className="text-gray-900 mb-4 font-semibold mt-4">{selectedTicket.title}</h3>

                    <div className="space-y-3 mb-6 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                            <User className="w-3 h-3" /> Customer
                          </span>
                          <p className="text-gray-900 font-medium">{selectedTicket.customer}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                            <AlertCircle className="w-3 h-3" /> Priority
                          </span>
                          <p className={`font-medium ${getPriorityColor(selectedTicket.priority).replace('bg-', 'text-').replace('100', '700').replace('border-', '')}`}>
                            {selectedTicket.priority.toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                            <Activity className="w-3 h-3" /> Status
                          </span>
                          <p className="text-gray-900 font-medium capitalize">{selectedTicket.status.replace('-', ' ')}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3" /> Created
                          </span>
                          <p className="text-gray-900 font-medium">{selectedTicket.createdAt}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                          <FileText className="w-3 h-3" /> Description
                        </span>
                        <p className="text-gray-900 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                          {selectedTicket.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        {selectedTicket.category && (
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                              <Tag className="w-3 h-3" /> Category
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${selectedTicket.category.toUpperCase() === 'IAM'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                              }`}>
                              {selectedTicket.category}
                            </span>
                          </div>
                        )}
                        {selectedTicket.slaDeadline && (
                          <div>
                            <span className="text-gray-500 text-xs uppercase tracking-wider font-semibold flex items-center gap-1 mb-1">
                              <Clock className="w-3 h-3" /> SLA Deadline
                            </span>
                            <p className="text-gray-900 font-medium">{selectedTicket.slaDeadline}</p>
                          </div>
                        )}
                      </div>
                    </div>



                    <div className="pt-6 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-900 font-semibold">Agent Pipeline Progress</h3>
                        <button
                          onClick={() => setShowStepsModal(true)}
                          className="px-2.5 py-1 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 transition flex items-center gap-1 shadow-sm"
                          title="View detailed progress in modal"
                        >
                          <Activity className="w-3 h-3" />
                          Expand
                        </button>
                      </div>

                      <div className="space-y-3">
                        {selectedTicket.stages.map((stage, index) => {
                          const isFinallyDone = (selectedTicket.status === 'completed' || selectedTicket.status === 'closed');
                          const effectiveStageStatus = isFinallyDone ? 'completed' : stage.status;
                          const isCompleted = effectiveStageStatus === 'completed';
                          const isCurrent = effectiveStageStatus === 'in-progress';
                          const isError = effectiveStageStatus === 'error';

                          return (
                            <div key={stage.id} className="flex items-start gap-3">
                              <div
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${getStageStatusColor(isFinallyDone ? 'completed' : stage.status)}`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : isError ? (
                                  <AlertCircle className="w-5 h-5" />
                                ) : (
                                  <span className="text-sm font-medium">{index + 1}</span>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className={`font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-900'}`}>
                                  {stage.name}
                                </p>
                                {stage.message && (
                                  <div className="mt-1">
                                    {stage.name === "IAM Remediation" ? (
                                      <button
                                        onClick={() => setShowRemediationModal(true)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-[#012169] bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        View Remediation Journey
                                      </button>
                                    ) : (
                                      <p className="text-sm text-gray-500">{stage.message}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Email Preview Modal */}
      {
        showEmailModal && emailTemplate && createPortal(
          <div className="flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-lg shadow-2xl w-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style={{ maxHeight: '90vh' }}>

              {/* Header */}
              <div className="text-white px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#012169' }}>
                <div>
                  <h2 className="text-xl font-bold">📧 Review Email</h2>
                  <p className="text-blue-100 text-sm mt-1">Ticket {selectedTicket?.id}</p>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-1 text-white hover:bg-blue-700/50 rounded transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">To</label>
                  <div className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{emailTemplate.to}</div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Subject</label>
                  <div className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded border border-gray-200">{emailTemplate.subject}</div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Message Body</label>
                  <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap font-mono leading-relaxed" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {emailTemplate.body}
                  </div>
                </div>

                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded flex gap-2 items-start">
                  <span className="text-lg">ℹ️</span>
                  <span className="mt-0.5">This email will be sent immediately to the application owner.</span>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 font-medium shadow-sm transition flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedTicket && handleApproveReview(selectedTicket.id)}
                  className="px-4 py-2 text-white rounded font-bold shadow-md hover:brightness-110 flex items-center gap-2 transition"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  <CheckCheck className="w-4 h-4" /> Approve & Send
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* Closure Confirmation Modal */}
      {
        showClosureModal && selectedTicket && createPortal(
          <div className="flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-lg shadow-2xl w-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style={{ maxHeight: '90vh' }}>

              {/* Header */}
              <div className="text-white px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#012169' }}>
                <div>
                  <h2 className="text-xl font-bold">✅ Confirm Closure</h2>
                  <p className="text-blue-100 text-sm mt-1">Ticket {selectedTicket?.id}</p>
                </div>
                <button
                  onClick={() => setShowClosureModal(false)}
                  className="p-1 text-white hover:bg-purple-700/50 rounded transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <CheckCheck className="w-5 h-5" /> Actions Verified
                  </h3>
                  <ul className="space-y-2 text-sm text-green-700 ml-1">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> IAM Category Verified</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Risk Assessment Complete</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Evidence Collected</li>
                  </ul>
                </div>

                <p className="text-gray-600">
                  You are about to close this ticket. This action will archive the collected evidence and notify the requester.
                </p>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end items-center gap-3 border-t border-gray-200">
                <button
                  onClick={() => setShowClosureModal(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 font-medium shadow-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedTicket && handleConfirmClosure(selectedTicket.id)}
                  className="px-4 py-2 text-white rounded font-bold shadow-md hover:brightness-110 flex items-center gap-2 transition"
                  style={{ backgroundColor: '#7e22ce' }}
                >
                  <CheckCheck className="w-4 h-4" /> Confirm & Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* Agent Pipeline Progress Modal */}
      {
        showStepsModal && selectedTicket && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="bg-[#012169] text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">🤖 Agent Pipeline Progress</h2>
                    <p className="text-blue-100 text-sm mt-1">
                      Ticket {selectedTicket.id} - Stage {(selectedTicket.status === 'completed' || selectedTicket.status === 'closed') ? selectedTicket.stages.length : selectedTicket.currentStage + 1}/{selectedTicket.stages.length}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowStepsModal(false)}
                    className="text-white hover:text-purple-200 transition"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {selectedTicket.stages.map((stage, index) => {
                    const isFinallyDone = (selectedTicket.status === 'completed' || selectedTicket.status === 'closed');
                    const effectiveStageStatus = isFinallyDone ? 'completed' : stage.status;
                    const isCompleted = effectiveStageStatus === 'completed';
                    const isCurrent = effectiveStageStatus === 'in-progress';
                    const isError = effectiveStageStatus === 'error';

                    return (
                      <div
                        key={stage.id}
                        className={`flex items-start gap-4 p-4 rounded-lg border-2 transition ${isCurrent ? 'bg-blue-50 border-blue-300 shadow-md' :
                          isCompleted ? 'bg-green-50 border-green-200' :
                            isError ? 'bg-red-50 border-red-200' :
                              'bg-gray-50 border-gray-200'
                          }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${getStageStatusColor(isFinallyDone ? 'completed' : stage.status)}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : isError ? (
                            <AlertCircle className="w-6 h-6" />
                          ) : isCurrent ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                          ) : (
                            <span className="text-sm font-bold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`font-semibold text-lg ${isCurrent ? 'text-blue-700' :
                              isCompleted ? 'text-green-700' :
                                isError ? 'text-red-700' :
                                  'text-gray-700'
                              }`}>
                              {stage.name}
                            </p>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${isCompleted ? 'bg-green-100 text-green-700' :
                              isCurrent ? 'bg-blue-100 text-blue-700' :
                                isError ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-600'
                              }`}>
                              {effectiveStageStatus.toUpperCase().replace('-', ' ')}
                            </span>
                          </div>
                          {stage.message && (
                            <div className="mt-2 text-sm text-gray-600 bg-white p-2 rounded border border-gray-200">
                              <p className="italic">{stage.message.split('\n\n')[0]}</p>
                              {stage.name === "IAM Remediation" && (
                                <button
                                  onClick={() => setShowRemediationModal(true)}
                                  className="mt-3 w-full py-2 bg-blue-50 text-[#012169] rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2 shadow-sm transform active:scale-95"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                  View Full Remediation Journey
                                </button>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
                <button
                  onClick={() => setShowStepsModal(false)}
                  className="px-6 py-3 bg-[#012169] text-white rounded-lg hover:bg-[#00174F] transition font-medium shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* IAM Remediation Animated Modal */}
      {showRemediationModal && selectedTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#012169]/60 backdrop-blur-md animate-in fade-in duration-500"
            onClick={() => setShowRemediationModal(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-200 animate-in zoom-in-95 slide-in-from-bottom-5 duration-500">
            {/* Header */}
            <div className="bg-[#012169] p-8 text-white relative">
              <button
                onClick={() => setShowRemediationModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-3 relative z-10">
                <div className="p-3 bg-white/15 rounded-xl border border-white/20">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">IAM Remediation Journey</h3>
                  <p className="text-blue-100/80 text-xs font-semibold uppercase tracking-widest mt-0.5">Automated Governance Protocol</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto bg-gray-50/30">
              <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[3px] before:bg-blue-100">
                {selectedTicket.stages.find(s => s.name === "IAM Remediation")?.message.split('\n\n').map((step, idx) => (
                  <div key={idx} className="flex gap-6 relative animate-in slide-in-from-left-8 duration-700" style={{ animationDelay: `${idx * 200}ms` }}>
                    <div className="z-10 w-10 h-10 rounded-full bg-white border-[3px] border-green-500 flex items-center justify-center shadow-md">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-[11px] font-black">
                        {idx + 1}
                      </div>
                    </div>
                    <div className="flex-1 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-gray-800 text-sm font-semibold leading-relaxed">
                        {step}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 bg-white border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowRemediationModal(false)}
                className="px-8 py-3 bg-[#E31837] text-white rounded-xl font-bold hover:bg-[#C8102E] transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                Acknowledge Journey
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}

      {
        showSuccessToast && (
          <div className="fixed bottom-8 right-8 bg-white border-l-4 border-green-500 shadow-2xl rounded-lg p-4 flex items-center gap-4 animate-slide-up z-50 max-w-md">
            <div className="bg-green-100 p-2 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Ticket Processed Successfully!</h4>
              <p className="text-sm text-gray-600">Ticket {selectedTicket?.id} has been closed and logged.</p>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      }

      <Footer />
    </div >
  );
}
