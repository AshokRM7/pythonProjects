import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Play, Activity, Clock, User, Calendar, Tag, FileText, Bot, ShieldCheck, AlertCircle, X, CheckCheck, Loader2, CheckCircle, ChevronRight, Download, Layers, RotateCcw, PlayCircle, ArrowLeft, ArrowRight, Info, Settings, Key, Mail } from 'lucide-react';
import { PCATTicketPanel } from './pcat/PCATTicketPanel';
import { pcatApi } from './pcat/pcatApi';
import { BRERemediationPanel } from './bre-new/BRERemediationPanel';
import { BRERemediationWizard } from './bre-new/BRERemediationWizard';
import Header from './Header';
import Footer from './Footer';
import { TicketStagesAccordion } from './TicketStagesAccordion';


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
  subcategory?: string; // For hierarchical categories (e.g., PCAT under IAM)
  risk_level?: string;
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
  final_csv_ready?: boolean;
  final_csv_path?: string;
  isPollingActive?: boolean;
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

// Centralized PCAT Identification Helper
const isPCATTicket = (ticket: Ticket | null) => {
  if (!ticket) return false;
  return ticket.subcategory?.toUpperCase() === 'PCAT';
};

// BRE-NEW Identification Helper (does NOT affect existing BRE-2026-* tickets unless they have deliverableType=BRE-NEW)
const isBRENewTicket = (ticket: Ticket | null) => {
  if (!ticket) return false;
  return (
    (ticket as any).deliverableType === 'BRE-NEW' &&
    ticket.subcategory?.toUpperCase() === 'BRE'
  );
};

// Get display name for category (supports hierarchical categories)
const getCategoryDisplay = (ticket: Ticket | null) => {
  if (!ticket) return 'Unknown';
  if (ticket.subcategory) {
    return `${ticket.category || 'Unknown'} -> ${ticket.subcategory}`;
  }
  return ticket.category || 'Unknown';
};

export default function Home({ currentUser, onSignOut }: HomeProps) {

  const navigate = useNavigate();
  const { ticketId } = useParams();
  const wsRef = useRef<WebSocket | null>(null);
  const selectedTicketRef = useRef<Ticket | null>(null); // Ref to hold the latest selectedTicket

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showAllTickets, setShowAllTickets] = useState(true); // Default to show all to match Dashboard

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showRemediationModal, setShowRemediationModal] = useState(false);
  const [showBRERemediationModal, setShowBRERemediationModal] = useState(false);

  // ARM Admin Drawer State (V2)
  const [showAdminModal, setShowAdminModal] = useState(false); // Using drawer but keeping same state name for trigger
  const [adminDetails, setAdminDetails] = useState<any>(null);
  const [adminPrimaryInput, setAdminPrimaryInput] = useState('');
  const [adminPrimaryNbkidInput, setAdminPrimaryNbkidInput] = useState('');
  const [adminSecondaryInput, setAdminSecondaryInput] = useState('');
  const [adminSecondaryNbkidInput, setAdminSecondaryNbkidInput] = useState('');
  const [adminUpdateResult, setAdminUpdateResult] = useState<any>(null);
  const [adminToastMessage, setAdminToastMessage] = useState('');
  const [showAdminToast, setShowAdminToast] = useState(false);
  const [currentAdminStep, setCurrentAdminStep] = useState(1);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [showARMPortal, setShowARMPortal] = useState(false);
  const [armPortalData, setARMPortalData] = useState<any>(null);

  const [emailTemplate, setEmailTemplate] = useState<{ to: string, cc?: string[], subject: string, body: string } | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [hasSimulatedConflict, setHasSimulatedConflict] = useState(false);
  const [simulatedConflictData, setSimulatedConflictData] = useState<any>(null);
  const [simulationAttempt, setSimulationAttempt] = useState(0);
  // Tracks whether a real Outlook inbox poll is actively running (EMAIL_SENDING_ENABLED=true).
  const [isPollingInbox, setIsPollingInbox] = useState(false);
  const [adminEmailBody, setAdminEmailBody] = useState('');

  const areRolesValid = useMemo(() => {
    if (!adminDetails) return false;
    const primary = (adminDetails.primary_admin_name || '').trim();
    const secondary = (adminDetails.secondary_admin_name || '').trim();
    const owner = (adminDetails.app_owner_name || '').trim();

    return primary && secondary &&
      primary.toLowerCase() !== owner.toLowerCase() &&
      secondary.toLowerCase() !== owner.toLowerCase() &&
      primary.toLowerCase() !== secondary.toLowerCase();
  }, [adminDetails]);
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | string[]>('all');
  const [ownerFilter, setOwnerFilter] = useState<string | string[]>('all');
  const [pastDueOptions, setPastDueOptions] = useState<string[]>(['all']);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTickets, setExpandedTickets] = useState<Record<string, boolean>>({});

  const toggleTicketExpansion = (ticketId: string) => {
    setExpandedTickets(prev => ({
      ...prev,
      [ticketId]: !prev[ticketId]
    }));
  };

  const fetchTickets = useCallback(async () => {
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
  }, [showAllTickets]);

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

  // ─── ARM Admin Modal Handlers ───

  const handleOpenAdminModal = async () => {
    if (!selectedTicket) return;
    const ait = (selectedTicket as any).aitNumber || (selectedTicket as any).ait_number || '';
    try {
      const res = await fetch(`http://localhost:8000/api/admin-details/${ait}`);
      if (res.ok) {
        const data = await res.json();
        setAdminDetails(data);
        setAdminPrimaryInput(data.primary_admin_name || '');
        setAdminPrimaryNbkidInput(data.primary_nbkid || '');
        setAdminSecondaryInput(data.secondary_admin_name || '');
        setAdminSecondaryNbkidInput(data.secondary_nbkid || '');
      } else {
        setAdminDetails(null);
      }
    } catch {
      setAdminDetails(null);
    }
    setAdminUpdateResult(null);
    setCurrentAdminStep(1); // Reset to first step
    setSelectedService(null);
    
    // Initialize default email body
    const appName = (selectedTicket as any).applicationName || (selectedTicket as any).application_name || 'Your Application';
    const ownerName = (selectedTicket as any).lobOwner || 'App Owner';
    const defaultBody = `Dear ${ownerName},\n\nOur records indicate that your application "${appName}" is missing required administrator assignments.\n\nPlease provide 2 unique administrator names and their NBKID.\n\nPlease reply to this email using the following format:\n\nPrimary Admin Name: [Full Name]\nPrimary Admin NBKID: [7-char NBKID]\nSecondary Admin Name: [Full Name]\nSecondary Admin NBKID: [7-char NBKID]\n\nBest regards,\nApp Governance & IAM Team`;
    setAdminEmailBody(defaultBody);

    setShowAdminModal(true);
  };

  const handleAdminNextStep = () => {
    // We already pre-fetch or rely on manual/simulated updates
    setCurrentAdminStep(prev => Math.min(prev + 1, 4));
  };

  const handleAdminPrevStep = () => {
    setCurrentAdminStep(prev => Math.max(prev - 1, 1));
  };

  const handleAdminValidate = async () => {
    if (!selectedTicket || !adminDetails) return;
    const ait = adminDetails.ait_number || (selectedTicket as any).aitNumber || (selectedTicket as any).ait_number;
    try {
      const res = await fetch(`http://localhost:8000/api/admin-details/${ait}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_admin_name: adminPrimaryInput || '',
          primary_nbkid: adminPrimaryNbkidInput || '',
          secondary_admin_name: adminSecondaryInput || '',
          secondary_nbkid: adminSecondaryNbkidInput || ''
        })
      });
      const result = await res.json();
      setAdminUpdateResult(result);

      // If we are at Step 3, and validation is successful, we can move to Step 4
      if (result.updated) {
        // Move to Step 4 (Review & Create)
        setSelectedService('arm_admin');
        const isAppOwnerConflict = result.warnings?.some((w: string) => w.toLowerCase().includes('bank policy'));
        if (!isAppOwnerConflict) {
          handleAdminNextStep();
        }
      }
    } catch (err) {
      console.error('Error validating admin names:', err);
    }
  };

  const handleAdminConfirmAndContinue = async () => {
    if (!selectedTicket) return;
    const ticketId = selectedTicket.id;
    try {
      const res = await fetch(`http://localhost:8000/api/tickets/${ticketId}/confirm-admin-update`, {
        method: 'POST'
      });
      if (res.ok) {
        const action = adminUpdateResult?.action || 'NEW';
        const ait = adminDetails?.ait_number || '';

        // Prepare data for ARM Portal Preview
        setARMPortalData({
          action,
          ait_number: ait,
          application_name: adminDetails?.application_name || 'Application',
          primary_admin: adminUpdateResult?.details?.primary_admin_name || adminDetails?.primary_admin_name,
          secondary_admin: adminUpdateResult?.details?.secondary_admin_name || adminDetails?.secondary_admin_name,
          access_name: "ARM ADMIN"
        });

        setAdminToastMessage(
          action === 'NEW'
            ? `✅ NEW ARM request created for ${ait}`
            : `✅ MODIFY ARM request updated for ${ait}`
        );
        setShowAdminToast(true);
        setTimeout(() => setShowAdminToast(false), 5000);
        setShowAdminModal(false);
        setAdminUpdateResult(null);

        // Show the ARM Portal Preview
        setTimeout(() => setShowARMPortal(true), 100);
      }
    } catch (error) {
      console.error('Error confirming admin update:', error);
    }
  };

  const handleSimulateResponse = async () => {
    if (!selectedTicket || !adminDetails) return;
    const ait = adminDetails.ait_number;
    const isArmAdmin = (selectedTicket as any).subcategory === "ARM FORMS NO ADMIN" || (selectedTicket as any).deliverableType === "ARM FORMS NO ADMIN";

    try {
      setStatusMessage(`Simulating response from App Owner (Attempt ${simulationAttempt + 1})...`);
      const res = await fetch(`http://localhost:8000/api/admin-details/${ait}/simulate-response`, {
        method: 'POST'
      });
      if (res.ok) {
        const result = await res.json();
        const data = result.details || result;
        const msg = result.simulation_message || '';
        const isConflict = msg.includes('[POLICY]');

        // Update attempt count for AIT-5001 logic
        setSimulationAttempt(prev => prev + 1);

        if (isArmAdmin && isConflict) {
          // Stay on Step 2 (Email) to show the conflict
          setHasSimulatedConflict(true);
          // Store the simulated names from the API result for display purposes
          setSimulatedConflictData(data && data.primary_admin_name ? data : {
            primary_admin_name: data?.primary_admin_name || adminDetails?.primary_admin_name || 'N/A',
            secondary_admin_name: data?.secondary_admin_name || adminDetails?.secondary_admin_name || 'N/A',
          });
          setAdminToastMessage(msg);
          setShowAdminToast(true);
          setTimeout(() => setShowAdminToast(false), 4000);
          return; // STOP HERE - user must send notification to progress
        }

        // Standard Success Flow or Non-ARM Flow
        setHasSimulatedConflict(false);
        setSimulatedConflictData(null);
        setAdminDetails(data);
        setAdminPrimaryInput(data.primary_admin_name || '');
        setAdminPrimaryNbkidInput(data.primary_nbkid || '');
        setAdminSecondaryInput(data.secondary_admin_name || '');
        setAdminSecondaryNbkidInput(data.secondary_nbkid || '');

        setAdminToastMessage(result.simulation_message || "📩 Response received from App Owner.");
        setShowAdminToast(true);
        setTimeout(() => setShowAdminToast(false), 4000);

        // Instant advance to Step 3
        setCurrentAdminStep(3);

        if (result.updated) {
          setAdminUpdateResult(result);
        }
      }
    } catch (err) {
      console.error('Error simulating response:', err);
    }
  };

  const handleResetAdmin = async () => {
    if (!selectedTicket) return;
    const ticketId = selectedTicket.id;
    try {
      const res = await fetch(`http://localhost:8000/api/tickets/${ticketId}/reset-admin`, {
        method: 'POST'
      });
      if (res.ok) {
        // Clear ALL local state
        setShowAdminModal(false);
        setShowRemediationModal(false);
        setShowClosureModal(false);
        setCurrentAdminStep(1);
        setAdminDetails(null);
        setAdminPrimaryInput('');
        setAdminPrimaryNbkidInput('');
        setAdminSecondaryInput('');
        setAdminSecondaryNbkidInput('');
        setAdminUpdateResult(null);
        setSelectedService(null);
        setHasSimulatedConflict(false);
        setSimulatedConflictData(null);
        setSimulationAttempt(0);
        setAdminToastMessage(`🔄 Ticket ${ticketId} and Admin Data Reset!`);
        setShowAdminToast(true);
        setTimeout(() => setShowAdminToast(false), 5000);
        // Modal stays closed — user must click ARM Admin button to reopen
      }
    } catch (err) {
      console.error('Error resetting admin ticket:', err);
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
      const isBRE = isBRENewTicket(selectedTicket);
      setEmailTemplate({
        to: selectedTicket?.contacts?.join(', ') || '',
        subject: `Evidence Required: ${selectedTicket?.title || 'Ticket'} - ${selectedTicket?.id}`,
        body: isBRE
          ? `Dear Application Owner,\n\nWe are processing ticket ${selectedTicket?.id} regarding ${selectedTicket?.title}.\n\nApplication Details:\n- Application Name: ${selectedTicket?.applicationName || 'N/A'}\n- AIT Number: ${selectedTicket?.aitNumber || 'N/A'}\n- LOB Owner: ${selectedTicket?.lobOwner || 'N/A'}\n\nBRE Violation Details:\n- The Business Rule Engine (BRE) has detected policy violations in your application.\n- Specifically: ${selectedTicket?.description || 'Review required'}\n\nWe require evidence of the following actions:\n1. BRE Rule Certification\n2. Remediation Verification\n3. Policy Compliance Proof\n\nPlease provide the requested evidence within 48 hours.\n\nBest regards,\nGovernance Team`
          : `Dear Application Owner,\n\nWe are processing ticket ${selectedTicket?.id} regarding ${selectedTicket?.title}.\n\nApplication Details:\n- Application Name: ${selectedTicket?.applicationName || 'N/A'}\n- AIT Number: ${selectedTicket?.aitNumber || 'N/A'}\n- LOB Owner: ${selectedTicket?.lobOwner || 'N/A'}\n\nUpdated Admin Assignments:\n- Primary Admin: ${adminPrimaryInput || 'N/A'}\n- Secondary Admin: ${adminSecondaryInput || 'N/A'}\n\nWe require evidence of the following actions:\n1. User access review\n2. Compliance verification\n3. Security approval\n\nPlease provide the requested evidence within 48 hours.\n\nBest regards,\nGovernance Team`
      });
      setShowEmailModal(true);
    }
  };

  const sendRealAdminEmail = async () => {
    if (!selectedTicket) return;
    try {
      const ait_number = (selectedTicket as any).aitNumber || (selectedTicket as any).ait_number;
      const app_name = (selectedTicket as any).applicationName || (selectedTicket as any).application_name;

      // Improved recipient logic: contacts list first, then customer field if it looks like an email
      let app_owner = '';
      if (adminDetails?.app_owner_email) {
        app_owner = adminDetails.app_owner_email;
      } else if (selectedTicket.contacts && selectedTicket.contacts.length > 0) {
        app_owner = selectedTicket.contacts[0];
      } else if (selectedTicket.customer && selectedTicket.customer.includes('@')) {
        app_owner = selectedTicket.customer;
      } else {
        // Fallback to the current user email if everything else fails
        app_owner = 'velmuruganpandian@outlook.com';
      }

      const subject = `ARM Admin Access Required: ${app_name} (${ait_number})`;
      const body = adminEmailBody;

      setStatusMessage(`Sending investigative email to ${app_owner}...`);

      const response = await fetch(`http://localhost:8000/api/tickets/${selectedTicket.id}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [app_owner],
          cc: [],
          subject: subject,
          body: body
        }),
      });

      if (!response.ok) throw new Error('Failed to send email');

      const data = await response.json();
      console.log('Admin Email Response:', data);

      // Backend auto-starts polling if EMAIL_SENDING_ENABLED=true
      setIsPollingInbox(true);
      setStatusMessage('✅ Email sent successfully. Waiting for reply...');

    } catch (error) {
      console.error('Error sending admin email:', error);
      alert('Failed to send real email. Please check if Outlook is running.');
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
          cc: emailTemplate.cc || [],
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

      // If this was a real ARM Forms NO ADMIN email (not simulated), switch UI to
      // inbox polling mode — the backend will watch Outlook and push the reply via WS.
      const subcap = (selectedTicket as any)?.subcategory?.toUpperCase() || '';
      const delType = (selectedTicket as any)?.deliverableType?.toUpperCase() || '';
      const isArmNoAdmin = subcap.includes('ARM FORM') || delType.includes('ARM FORM');
      
      if (data.status === 'success' && data.sent === true && isArmNoAdmin) {
        // Real email was sent, show the inbox-waiting spinner in the wizard
        setIsPollingInbox(true);
        // Close the email preview modal and return to the admin wizard
        return;
      }

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
      if (location.state.pastDueOptions) setPastDueOptions(location.state.pastDueOptions);
      // Ensure we fetch all categories if coming from Dashboard
      setShowAllTickets(true);
    }
  }, [location]);

  // Combined fetch and reset logic
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets, currentUser]);


  // Filter tickets based on dashboard selection, inputs and search
  // 1. Context Filters (Category, Owner, Timeline, Search)
  const contextTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // Check Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const titleMatch = ticket.title.toLowerCase().includes(query);
        const idMatch = ticket.id.toLowerCase().includes(query);
        const categoryMatch = (ticket.category || '').toLowerCase().includes(query) ||
          (ticket.subcategory || '').toLowerCase().includes(query);
        const ownerMatch = (ticket.owner || '').toLowerCase().includes(query);
        if (!titleMatch && !idMatch && !categoryMatch && !ownerMatch) return false;
      }

      // Check Category
      if (categoryFilter !== 'all' && (!Array.isArray(categoryFilter) || !categoryFilter.includes('all'))) {
        const selected = Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
        const hasMatch = ticket.subcategory ? selected.includes(ticket.subcategory) : selected.includes(ticket.category || 'IAM');
        if (!hasMatch) return false;
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

      // Past Due logic - Check if active
      const isPastDueSelected = pastDueOptions.length > 0 && !pastDueOptions.includes("all");

      // Check Timeline - ONLY if past due is NOT selected
      if (timelineFilter && !isPastDueSelected) {
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

      const now = new Date();
      const isOverdue = ticket.slaDeadline && new Date(ticket.slaDeadline) < now;
      if (isOverdue && ticket.status !== 'closed' && ticket.status !== 'completed') {
        ticket.priority = 'high'; // Elevate priority for display
      }

      if (isPastDueSelected) {
        // If any specific option is selected, ticket must match at least one
        const matchesOption = pastDueOptions.some(option => {
          if (option === 'past_due') return isOverdue && ticket.status !== 'closed' && ticket.status !== 'completed';
          if (option === 'past_due_10') {
            const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
            return ticket.slaDeadline && new Date(ticket.slaDeadline) < tenDaysAgo && ticket.status !== 'closed' && ticket.status !== 'completed';
          }
          if (option === 'past_due_30') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return ticket.slaDeadline && new Date(ticket.slaDeadline) < thirtyDaysAgo && ticket.status !== 'closed' && ticket.status !== 'completed';
          }
          return false;
        });

        if (!matchesOption) return false;
      }

      return true;
    });
  }, [tickets, categoryFilter, ownerFilter, timelineFilter, searchQuery, pastDueOptions]);

  // 2. Status Filter (Applied on top of Context)
  const filteredTickets = useMemo(() => {
    if (!statusFilter || statusFilter === 'Total') return contextTickets;

    return contextTickets.filter(ticket => {
      // Use standardized normalization to match Dashboard counts
      const tNormalizedStatus = normalizeStatus(ticket.status || '');
      const matchesStatus = tNormalizedStatus.toLowerCase() === statusFilter.toLowerCase();

      // PERSISTENCE FIX: Always show the selected ticket in the sidebar list, 
      // even if its status changed (e.g. from Open to In Progress), 
      // so it doesn't "disappear" from under the user.
      const isSelected = selectedTicket?.id === ticket.id;

      return matchesStatus || isSelected;
    });
  }, [contextTickets, statusFilter, selectedTicket]);


  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8000/ws');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatusMessage('Connected to server');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'tickets_update':
            setTickets(data.tickets);
            break;
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

            // ── Handle Outlook inbox reply received ──────────────────────────
            if (data.ticket?.inboxReplyReceived) {
              const adminData = data.ticket.inboxAdminData || {};
              setIsPollingInbox(false);
              if (selectedTicket && selectedTicket.id === data.ticket.id) {
                selectedTicket.isPollingActive = false;
              }
              // Pre-fill admin input fields from the parsed reply email
              if (adminData.primary_admin_name) {
                setAdminPrimaryInput(adminData.primary_admin_name);
              }
              if (adminData.primary_nbkid) {
                setAdminPrimaryNbkidInput(adminData.primary_nbkid);
              }
              if (adminData.secondary_admin_name) {
                setAdminSecondaryInput(adminData.secondary_admin_name);
              }
              if (adminData.secondary_nbkid) {
                setAdminSecondaryNbkidInput(adminData.secondary_nbkid);
              }
              // Refresh adminDetails with the latest data from backend
              const updatedDetails = { ...adminDetails, ...adminData };
              setAdminDetails(updatedDetails);
              // Advance the wizard to Step 3 (Validate)
              setCurrentAdminStep(3);
            }

            // Update status message if provided
            if (data.message) {
              setStatusMessage(data.message);
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
            // Update status message banner for PCAT
            if (data.message) {
              setStatusMessage(data.message);
            }
            break;
          case 'processing_complete':
            setStatusMessage(data.message || 'Processing complete');

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

            // ALWAYS clear the status message after 3 seconds for completion
            setTimeout(() => setStatusMessage(''), 3000);
            break;

          case 'error':
            setStatusMessage(`Error: ${data.message}`);
            alert(`Error: ${data.message}`);
            break;
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatusMessage('Connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
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
    const s = (selectedTicket?.status || '').toLowerCase().replace(/-/g, ' ').trim();
    if (s === 'completed' || s === 'closed') {
      setShowSuccessToast(true);
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [selectedTicket?.status]);

  // AUTO-TRIGGER Remediation Modal
  useEffect(() => {
    if (!selectedTicket || showRemediationModal || showAdminModal || showBRERemediationModal) return;

    const isBreNew = isBRENewTicket(selectedTicket);
    const isArmNoAdmin = selectedTicket.subcategory === 'ARM FORMS NO ADMIN' ||
      (selectedTicket as any).deliverableType === 'ARM FORMS NO ADMIN' ||
      (selectedTicket as any).waitingForAdminUpdate;

    // Stage 5 Triggers (Legacy & Admin Forms)
    if (selectedTicket.currentStage === 5 && selectedTicket.stages[5]?.status === 'in-progress') {
      if (isArmNoAdmin) {
        handleOpenAdminModal();
      } else if (!isBreNew && !isPCATTicket(selectedTicket)) {
        setShowRemediationModal(true);
      }
    }

    // Stage 6 Triggers (BRE-NEW Remediation)
    if (isBreNew && selectedTicket.currentStage === 6 && selectedTicket.stages[6]?.status === 'in-progress') {
      setShowBRERemediationModal(true);
    }
  }, [selectedTicket?.currentStage, selectedTicket?.stages?.[5]?.status, selectedTicket?.stages?.[6]?.status]);

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

  // Sync selectedTicket with tickets state when updates arrive

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
        return <CheckCircle className="w-4 h-4" />;
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
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-3">
                <span>{(pastDueOptions.length > 0 && !pastDueOptions.includes('all')) ? 'Past Due' : (statusFilter ? `${statusFilter}` : 'All')} Tickets</span>
                <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                  {filteredTickets.length} items
                </span>
                {statusFilter && statusFilter !== 'Total' && (
                  <button
                    onClick={() => setStatusFilter(null)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 transition-all"
                  >
                    ✕ Clear Filter
                  </button>
                )}
              </h1>
            </div>

            {/* KPI / Quick Stats in Header - Animated */}
            <div className="flex items-center gap-3">
              <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 transition-transform hover:scale-105 duration-300 hover:shadow-md">
                <div className="p-2 bg-[#E31837]/10 text-[#E31837] rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed</p>
                  <p className="text-lg font-bold text-gray-800 leading-none">
                    {contextTickets.filter(t => {
                      const s = (t.status || '').toLowerCase().replace(/-/g, ' ').trim();
                      return s === 'completed' || s === 'closed';
                    }).length}
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
                    {contextTickets.filter(t => {
                      const s = (t.status || '').toLowerCase().replace(/-/g, ' ').trim();
                      return s !== 'completed' && s !== 'closed' && s !== 'not started' && s !== 'not-started';
                    }).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PCAT Global Dashboard Widget - Conditionally shown if only PCAT tickets are viewed */}
          {filteredTickets.length > 0 && filteredTickets.every(isPCATTicket) && (
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
            <div
              onClick={() => {
                // If the message contains a ticket ID (e.g. REQ9999), select it on click
                const match = statusMessage.match(/REQ\d+|PCAT-\d+/);
                if (match) {
                  const t = tickets.find(ticket => ticket.id === match[0]);
                  if (t) handleTicketClick(t);
                }
              }}
              className={`bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 shadow-sm flex items-center gap-2 transition-all group ${statusMessage.match(/REQ\d+|PCAT-\d+/) ? 'cursor-pointer hover:bg-blue-100' : ''}`}
            >
              <Activity className={`w-4 h-4 ${statusMessage.includes('Processing') ? 'animate-pulse' : ''}`} />
              <span className="flex-1">{statusMessage}</span>
              {statusMessage.match(/REQ\d+|PCAT-\d+/) && (
                <span className="text-[10px] font-bold uppercase bg-blue-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to View Ticket
                </span>
              )}
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
                          <span className="text-gray-900 font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={(e) => { e.stopPropagation(); toggleTicketExpansion(ticket.id); }}>{ticket.id}</span>
                          {/* Category Badge */}
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleTicketExpansion(ticket.id); }}
                            className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:brightness-95 transition-all ${isPCATTicket(ticket)
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : ticket.category?.toUpperCase() === 'IAM'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}>
                            {getCategoryDisplay(ticket)}
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
                            onClick={(e) => { e.stopPropagation(); toggleTicketExpansion(ticket.id); }}
                            className={`px-2 py-1 rounded text-xs border cursor-pointer hover:brightness-95 transition-all ${getPriorityColor(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority.toUpperCase()}
                          </span>
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleTicketExpansion(ticket.id); }}
                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 cursor-pointer hover:brightness-95 transition-all ${getStatusColor(
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

                      <div
                        className="flex items-center justify-between pt-3 border-t border-gray-200 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTicketExpansion(ticket.id);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${expandedTickets[ticket.id] ? 'rotate-90' : ''}`} />
                          <span className="text-gray-600 text-sm font-medium">
                            Stage {(ticket.status === 'completed' || ticket.status === 'closed') ? ticket.stages.length : ticket.currentStage + 1}/{ticket.stages.length}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {ticket.stages.slice(0, 9).map((stage, idx) => {
                            const isDone = (ticket.status === 'completed' || ticket.status === 'closed');
                            const isStatusOpen = (ticket.status || '').toLowerCase().replace(/-/g, '').trim() === 'open';

                            // Defense logic: If the ticket is in "Open" status, only the first stage (ID 0) should be green.
                            // This handles cases where backend data might accidentally include more completed stages.
                            let stageIsGreen = isDone || stage.status === 'completed';
                            if (isStatusOpen && idx > 0) {
                              stageIsGreen = false;
                            }

                            return (
                              <div
                                key={idx}
                                className={`w-2 h-2 rounded-full ${stageIsGreen ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
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

                      {/* ACCORDION CONTENT */}
                      {expandedTickets[ticket.id] && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <TicketStagesAccordion
                            stages={ticket.stages}
                            ticketStatus={ticket.status}
                          />
                        </div>
                      )}
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
              {isPCATTicket(selectedTicket) ? (
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
                      <div className="flex items-center gap-3">
                        <h2 className="text-gray-900 font-bold">{selectedTicket.id}</h2>
                        {(selectedTicket.subcategory === 'ARM FORMS NO ADMIN' || (selectedTicket as any).deliverableType === 'ARM FORMS NO ADMIN') && (
                          <button
                            onClick={handleResetAdmin}
                            className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 border border-red-100 rounded text-[10px] font-black uppercase hover:bg-red-100 transition-all active:scale-95 shadow-sm"
                            title="Reset Ticket & Admin Data"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                          </button>
                        )}
                      </div>
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
                        const currentStatus = (selectedTicket.status || '').toLowerCase().replace(/-/g, ' ').trim();

                        // 1. Priority Confirmation
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

                        // 2. Start Processing (Priority for fresh tickets)
                        if (currentStatus === 'not started' || currentStatus === 'open') {
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

                        // 3. ARM Admin Update
                        if ((selectedTicket as any).waitingForAdminUpdate) {
                          return (
                            <button
                              onClick={() => handleOpenAdminModal()}
                              className="w-full bg-orange-600 text-white border border-orange-700 py-3 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-lg font-bold"
                            >
                              <ShieldCheck className="w-5 h-5" />
                              Update Admin Names
                            </button>
                          );
                        }

                        // 4. Review Approval
                        if (selectedTicket.stages[6].status === 'in-progress' || selectedTicket.waitingForReview) {
                          if ((selectedTicket as any).needsResendEmail) {
                            return (
                              <button
                                onClick={() => handleShowEmailPreview(selectedTicket.id)}
                                className="w-full bg-orange-600 text-white border border-orange-700 py-3 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-lg font-bold"
                              >
                                <CheckCheck className="w-5 h-5" />
                                Resend Email - Waiting for App Owner
                              </button>
                            );
                          }
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

                        // 5. Closure Confirmation
                        if (selectedTicket.stages[7].status === 'in-progress' || selectedTicket.waitingForClosureConfirmation) {
                          if ((selectedTicket as any).needsResendEmail) {
                            return (
                              <button
                                onClick={() => handleShowEmailPreview(selectedTicket.id)}
                                className="w-full bg-orange-600 text-white border border-orange-700 py-3 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-lg font-bold"
                              >
                                <CheckCheck className="w-5 h-5" />
                                Resend Email - Waiting for App Owner
                              </button>
                            );
                          }
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

                        // 6. Processing State (In Progress but no action needed)
                        if (currentStatus === 'in progress') {
                          // Check if any stage has an error (meaning it halted)
                          const hasError = selectedTicket.stages.some(s => s.status === 'error');

                          // Check if all stages are completed within an 'in-progress' ticket
                          const isCompleted = selectedTicket.stages.every(s => s.status === 'completed');

                          // Check if ticket is stuck (no stage is actively in-progress)
                          const isActivelyProcessing = selectedTicket.stages.some(s => s.status === 'in-progress');

                          if (isCompleted) {
                            return (
                              <div className="w-full bg-green-50 text-green-700 py-3 rounded-lg flex items-center justify-center gap-2 border border-green-100 font-bold shadow-sm">
                                <Bot className="w-5 h-5" />
                                Execution Completed
                              </div>
                            );
                          }

                          if (hasError) {
                            return (
                              <div className="w-full bg-red-50 text-red-700 py-3 rounded-lg flex items-center justify-center gap-2 border border-red-100 font-bold shadow-sm">
                                <AlertCircle className="w-5 h-5" />
                                Execution Halted / Not Eligible
                              </div>
                            );
                          }

                          // If ticket is stuck (in-progress status but no active stage), show continue button
                          if (!isActivelyProcessing) {
                            return (
                              <button
                                onClick={() => handleProcessTicket(selectedTicket.id)}
                                className="w-full bg-orange-600 text-white border border-orange-700 py-3 rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2 shadow-sm font-bold"
                              >
                                <Play className="w-5 h-5" />
                                Continue Processing
                              </button>
                            );
                          }

                          return (
                            <div className="w-full bg-blue-50 text-blue-700 py-3 rounded-lg flex items-center justify-center gap-2 border border-blue-100 font-medium shadow-sm">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processing...
                            </div>
                          );
                        }

                        // 6. Completed State
                        if (currentStatus === 'completed' || currentStatus === 'closed') {
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
                            {currentStatus.toUpperCase()}
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
                            <span className={`px-2 py-1 rounded text-xs font-bold ${isPCATTicket(selectedTicket)
                              ? 'bg-purple-100 text-purple-700'
                              : selectedTicket.category.toUpperCase() === 'IAM'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                              }`}>
                              {getCategoryDisplay(selectedTicket)}
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
                                  <Bot className="w-5 h-5" />
                                ) : isError ? (
                                  <AlertCircle className="w-5 h-5" />
                                ) : isCurrent ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
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
                                    {stage.name.includes("IAM Remediation") ? (
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

                    {/* BRE Remediation Panel – BRE-NEW deliverable only */}
                    {isBRENewTicket(selectedTicket) && (
                      <div className="pt-6 border-t border-gray-200">
                        <BRERemediationPanel
                          deliverableId={selectedTicket.id}
                          aitNumber={(selectedTicket as any).ait_number || (selectedTicket as any).aitNumber || ''}
                          applicationName={(selectedTicket as any).applicationName || (selectedTicket as any).application_name || selectedTicket.title}
                          applicationId={(selectedTicket as any).application_id || (selectedTicket as any).applicationId || ''}
                          onComplete={(result) => {
                            console.log('BRE Remediation completed:', result);
                          }}
                        />
                      </div>
                    )}
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

                {emailTemplate.cc && emailTemplate.cc.length > 0 && (
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-1">Cc (Admins)</label>
                    <div className="text-sm font-medium text-blue-800 bg-blue-50 p-2 rounded border border-blue-100 flex flex-wrap gap-1">
                      {emailTemplate.cc.map((email: string, i: number) => (
                        <span key={i} className="bg-white px-2 py-0.5 rounded border border-blue-200">{email}</span>
                      ))}
                    </div>
                  </div>
                )}

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
                    <li className="flex items-center gap-2 font-medium text-gray-700"><Bot className="w-4 h-4 text-green-500" /> IAM Category Verified</li>
                    <li className="flex items-center gap-2 font-medium text-gray-700"><Bot className="w-4 h-4 text-green-500" /> Risk Assessment Complete</li>
                    <li className="flex items-center gap-2 font-medium text-gray-700"><Bot className="w-4 h-4 text-green-500" /> Evidence Collected</li>
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
                            <Bot className="w-6 h-6" />
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
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-gray-200 animate-in zoom-in-95 slide-in-from-bottom-5 duration-500 max-h-[90vh] flex flex-col">
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
                {selectedTicket.stages.find(s => s.name.includes("IAM Remediation"))?.message.split('\n\n').map((step, idx) => (
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

      {/* ARM Admin Remediation Modal (Centered V2) */}
      {showAdminModal && selectedTicket && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowAdminModal(false)} />

          <div className="relative w-full max-w-2xl bg-white shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300 ease-out border border-slate-200 max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="px-6 py-6 bg-[#012169] text-white">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg border border-white/10">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Remediation Wizard</h2>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider uppercase mt-0.5">ARM Form Verification</p>
                  </div>
                </div>
                <button onClick={() => setShowAdminModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2" />
                <div
                  className="absolute top-1/2 left-0 h-0.5 bg-blue-400 -translate-y-1/2 transition-all duration-500 ease-out"
                  style={{ width: `${((currentAdminStep - 1) / 3) * 100}%` }}
                />
                <div className="relative flex justify-between">
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 z-10 ${currentAdminStep >= s ? 'bg-blue-600 border-blue-400 text-white scale-110' : 'bg-[#012169] border-white/20 text-white/40'
                        }`}>
                        {currentAdminStep > s ? <CheckCheck className="w-4 h-4" /> : s}
                      </div>
                      <span className={`text-[10px] mt-2 font-bold uppercase tracking-tighter ${currentAdminStep >= s ? 'text-white' : 'text-white/30'}`}>
                        {s === 1 ? 'Insight' : s === 2 ? 'Email' : s === 3 ? 'Enroll' : 'Create'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 px-8 py-8">
              {adminDetails ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                  {/* Step 1: Application Insight */}
                  {currentAdminStep === 1 && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 border-b-4 border-b-blue-600">
                        <h3 className="text-slate-800 font-bold flex items-center gap-2 mb-4">
                          <Info className="w-5 h-5 text-blue-600" />
                          Application Context
                        </h3>
                        <div className="grid grid-cols-2 gap-y-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-slate-400 font-semibold uppercase text-[10px]">AIT Number</p>
                            <p className="text-slate-900 font-bold">{adminDetails.ait_number}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-slate-400 font-semibold uppercase text-[10px]">App Name</p>
                            <p className="text-slate-900 font-bold">{adminDetails.application_name}</p>
                          </div>
                          <div className="col-span-2 space-y-1 pt-2 border-t border-slate-100">
                            <p className="text-slate-400 font-semibold uppercase text-[10px]">Application Owner</p>
                            <p className="text-slate-900 font-bold flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              {adminDetails.app_owner_name}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-slate-800 font-bold flex items-center gap-2 mb-4">
                          <Layers className="w-5 h-5 text-blue-600" />
                          Role Gap Analysis
                        </h3>
                        <div className="space-y-4">
                          {[
                            { label: 'Primary Admin', value: adminDetails.primary_admin_name },
                            { label: 'Secondary Admin', value: adminDetails.secondary_admin_name }
                          ].map((role, idx) => (
                            <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${role.value ? 'bg-green-50/50 border-green-100 text-green-800' : 'bg-red-50/50 border-red-100 text-red-800 animate-pulse'
                              }`}>
                              <div className="flex items-center gap-3">
                                {role.value ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                <span className="font-bold text-sm tracking-tight">{role.label}</span>
                              </div>
                              <span className="text-xs font-black uppercase">{role.value || 'Not Assigned'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {!adminDetails.primary_admin_name || !adminDetails.secondary_admin_name ? (
                        <div className="bg-blue-600 rounded-xl p-4 text-white flex items-center gap-4 shadow-lg shadow-blue-600/20">
                          <div className="p-2 bg-white/20 rounded-lg"><Settings className="w-5 h-5" /></div>
                          <p className="text-sm font-semibold leading-snug">Administrative gaps detected. Enrollment required to proceed.</p>
                        </div>
                      ) : (
                        <div className="bg-green-600 rounded-xl p-4 text-white flex items-center gap-4 shadow-lg shadow-green-600/20">
                          <div className="p-2 bg-white/20 rounded-lg"><CheckCircle className="w-5 h-5" /></div>
                          <p className="text-sm font-semibold leading-snug">All roles assigned. You can review and complete the ticket.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2: Communication Preview */}
                  {currentAdminStep === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-slate-800 font-bold flex items-center gap-2 mb-4">
                          <Mail className="w-5 h-5 text-blue-600" />
                          {hasSimulatedConflict ? 'Correction Email Preview' : 'App Owner Notification Preview'}
                        </h3>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-mono text-sm text-slate-700 leading-relaxed mb-6">
                          <p className="font-bold mb-1">To: {adminDetails?.app_owner_email || selectedTicket?.contacts?.[0] || selectedTicket?.customer || 'velmuruganpandian@outlook.com'}</p>
                          <p className="font-bold mb-4">Subject: ARM Admin Access Required: {adminDetails.application_name} ({adminDetails.ait_number})</p>
                          <textarea
                            className="w-full h-64 bg-white border border-slate-300 rounded-lg p-3 text-sm font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none transition-all"
                            value={adminEmailBody}
                            onChange={(e) => setAdminEmailBody(e.target.value)}
                            placeholder="Type your email body here..."
                          />
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                          <p className="text-xs text-blue-800 font-medium leading-relaxed">
                            {hasSimulatedConflict
                              ? 'Clicking "Send Notification" will notify the owner of the policy violation and automatically fetch the corrected details.'
                              : isPollingInbox
                                ? '📡 Email sent. Monitoring Outlook inbox for App Owner\'s reply...'
                                : 'Clicking "Send Notification" will simulate sending this investigative email to the App Owner.'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          onClick={() => {
                            if (hasSimulatedConflict) {
                              setStatusMessage('✅ Correction email sent. Fetching responses...');
                              setTimeout(() => {
                                setStatusMessage('');
                                handleSimulateResponse(); // Trigger the fix!
                              }, 1500);
                            } else {
                              // Trigger real email flow
                              sendRealAdminEmail();
                            }
                          }}
                          className={`w-full h-14 ${hasSimulatedConflict ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-3 border ${hasSimulatedConflict ? 'border-rose-400' : 'border-slate-200'}`}
                        >
                          <Mail className="w-5 h-5" />
                          {hasSimulatedConflict ? 'Send Correction Email' : 'Send Notification'}
                        </button>

                        {(isPollingInbox || selectedTicket?.isPollingActive) ? (
                          /* Real mode: show live waiting indicator instead of simulate button */
                          <div className="w-full h-14 bg-blue-50 border-2 border-blue-200 rounded-xl flex items-center justify-center gap-3 text-blue-700">
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                            </svg>
                            <span className="font-bold text-xs uppercase tracking-widest">⏳ Waiting for App Owner Reply…</span>
                          </div>
                        ) : (
                          <button
                            onClick={handleSimulateResponse}
                            disabled={hasSimulatedConflict}
                            className="w-full h-14 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Bot className="w-5 h-5" />
                            Simulate Response
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                          </button>
                        )}
                      </div>

                      {hasSimulatedConflict && simulatedConflictData && (
                        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 shadow-sm animate-in zoom-in-95 duration-300">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                              <Bot className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Response Received</p>
                              <h4 className="text-lg font-black text-rose-700 leading-tight">Policy Violation Detected</h4>
                            </div>
                          </div>

                          <div className="space-y-3 mb-6 bg-white/50 p-4 rounded-xl border border-rose-100">
                            <p className="text-xs font-bold text-rose-800 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              App Owner provided their own name as admin:
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-[10px] uppercase font-black text-slate-400">Primary Admin</p>
                                <p className="font-bold text-slate-700">{simulatedConflictData.primary_admin_name}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase font-black text-slate-400">Secondary Admin</p>
                                <p className="font-bold text-slate-700">{simulatedConflictData.secondary_admin_name}</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-3 bg-rose-100/50 p-3 rounded-xl">
                            <Info className="w-4 h-4 text-rose-700 mt-0.5" />
                            <p className="text-[11px] font-bold text-rose-900 leading-snug">
                              Bank Policy forbids App Owners from being their own admins. Click "Send Correction Email" below to request correct names.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Admin Enrollment */}
                  {currentAdminStep === 3 && (
                    <div className="space-y-6">
                      {/* Name Summary Card */}
                      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Tag className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.15em] leading-none mb-1">Confirmation Required</p>
                            <h4 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Submitting Names</h4>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Primary Admin</p>
                            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-500" />
                              {adminPrimaryInput || adminDetails?.primary_admin_name || <span className="text-slate-300 italic">Not Provided</span>}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 pl-6">NBKID: {adminPrimaryNbkidInput || adminDetails?.primary_nbkid || 'N/A'}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Secondary Admin</p>
                            <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-500" />
                              {adminSecondaryInput || adminDetails?.secondary_admin_name || <span className="text-slate-300 italic">Not Provided</span>}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 pl-6">NBKID: {adminSecondaryNbkidInput || adminDetails?.secondary_nbkid || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-start gap-3 bg-blue-50/50 p-3 rounded-xl">
                          <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5" />
                          <p className="text-[11px] font-medium text-blue-800 leading-snug">
                            System will perform a global lookup across all applications to determine if these admins require a NEW or MODIFY ARM request.
                          </p>
                        </div>
                      </div>

                      {(isPollingInbox || selectedTicket?.isPollingActive) ? (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
                          <div className="relative">
                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                            <Mail className="absolute inset-0 m-auto w-6 h-6 text-blue-600 animate-pulse" />
                          </div>
                          <div className="text-center">
                            <h3 className="text-blue-900 font-black text-xl tracking-tight">Investigative Poll Active</h3>
                            <p className="text-blue-700 font-bold text-sm mt-1">Waiting for details via email conversation...</p>
                            <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mt-4 leading-none">Status: Monitoring Inbox</p>
                          </div>
                          <div className="mt-4 p-4 bg-white/50 rounded-xl border border-blue-100 max-w-sm">
                            <p className="text-[11px] font-medium text-blue-800 leading-snug text-center">
                              The system is actively communicating with the App Owner. This form will update automatically once the required details are identified in the email thread.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                          <h3 className="text-amber-900 font-bold flex items-center gap-2 mb-4 text-lg">
                            <Bot className="w-6 h-6" />
                            Admin Enrollment
                          </h3>

                          <div className="space-y-5">
                            {(!adminDetails.primary_admin_name ||
                              (adminPrimaryInput?.toLowerCase() === adminDetails.app_owner_name?.toLowerCase()) ||
                              (adminUpdateResult?.warnings?.some((w: string) => w.toLowerCase().includes('bank policy'))) ||
                              adminUpdateResult?.warnings?.some((w: string) => w.toLowerCase().includes('same person'))) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-amber-900/60 uppercase tracking-widest pl-1">Primary Admin Name</label>
                                    <div className="relative group">
                                      <input
                                        type="text"
                                        value={adminPrimaryInput}
                                        onChange={(e) => setAdminPrimaryInput(e.target.value)}
                                        placeholder="e.g. Ashok Vel"
                                        className="w-full h-12 bg-white px-4 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 font-semibold"
                                      />
                                      <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-300 group-focus-within:text-amber-500 transition-colors" />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-amber-900/60 uppercase tracking-widest pl-1">Primary NBKID</label>
                                    <div className="relative group">
                                      <input
                                        type="text"
                                        maxLength={7}
                                        value={adminPrimaryNbkidInput}
                                        onChange={(e) => setAdminPrimaryNbkidInput(e.target.value)}
                                        placeholder="7-digit ID"
                                        className="w-full h-12 bg-white px-4 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 font-semibold"
                                      />
                                      <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-300 group-focus-within:text-amber-500 transition-colors" />
                                    </div>
                                  </div>
                                </div>
                              )}

                            {(!adminDetails.secondary_admin_name ||
                              (adminSecondaryInput?.toLowerCase() === adminDetails.app_owner_name?.toLowerCase()) ||
                              (adminUpdateResult?.warnings?.some((w: string) => w.toLowerCase().includes('bank policy'))) ||
                              adminUpdateResult?.warnings?.some((w: string) => w.toLowerCase().includes('same person'))) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-amber-900/60 uppercase tracking-widest pl-1">Secondary Admin Name</label>
                                    <div className="relative group">
                                      <input
                                        type="text"
                                        value={adminSecondaryInput}
                                        onChange={(e) => setAdminSecondaryInput(e.target.value)}
                                        placeholder="e.g. Vel Murugan"
                                        className="w-full h-12 bg-white px-4 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 font-semibold"
                                      />
                                      <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-300 group-focus-within:text-amber-500 transition-colors" />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-amber-900/60 uppercase tracking-widest pl-1">Secondary NBKID</label>
                                    <div className="relative group">
                                      <input
                                        type="text"
                                        maxLength={7}
                                        value={adminSecondaryNbkidInput}
                                        onChange={(e) => setAdminSecondaryNbkidInput(e.target.value)}
                                        placeholder="7-digit ID"
                                        className="w-full h-12 bg-white px-4 rounded-xl border-2 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-slate-300 font-semibold"
                                      />
                                      <ShieldCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-300 group-focus-within:text-amber-500 transition-colors" />
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Real-time Intelligent Validation Display */}
                      {adminUpdateResult && (
                        <div className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 animate-in slide-in-from-top-4 duration-300">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${adminUpdateResult.action === 'NEW' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                              {adminUpdateResult.action === 'NEW' ? <Tag className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Request Type Detected</p>
                              <h4 className={`text-lg font-black tracking-tight ${adminUpdateResult.action === 'NEW' ? 'text-emerald-700' : 'text-blue-700'}`}>
                                {adminUpdateResult.action === 'NEW' ? '🆕 NEW ARM REQUEST' : '📝 MODIFY ARM REQUEST'}
                              </h4>
                              <p className="text-xs font-semibold text-slate-500 mt-1 max-w-xs leading-snug">
                                {adminUpdateResult.action === 'NEW'
                                  ? 'This name is not currently registered as an admin. A NEW ARM request is required.'
                                  : 'This admin is already part of another AIT. We need to raise a "Modify" request.'}
                              </p>
                            </div>
                          </div>

                          {adminUpdateResult.warnings && adminUpdateResult.warnings.length > 0 && (
                            <div className="space-y-2 mt-4">
                              {adminUpdateResult.warnings.map((w: string, i: number) => (
                                <div key={i} className={`p-3 rounded-xl border flex items-start gap-3 ${(w.includes('Application Owner') || w.toLowerCase().includes('bank policy')) ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'
                                  }`}>
                                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                  <p className="text-sm font-bold leading-tight">{w}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!adminUpdateResult && (
                        <div className="bg-slate-100 rounded-xl p-4 text-slate-500 flex items-center gap-3 italic text-sm font-medium">
                          <Bot className="w-5 h-5" />
                          Validation engine will trigger automatically as you proceed...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Review & Create ARM Ticket */}
                  {currentAdminStep === 4 && (
                    <div className="space-y-6">
                      <div className="relative bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
                        <div className="px-8 py-10">
                          <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                              <FileText className="w-8 h-8" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tight">New Request</h3>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">ARM Ticket Generation</p>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-blue-600 transition-colors">Request Context</p>
                                <p className="text-lg font-black text-slate-800">{adminUpdateResult?.action === 'NEW' ? 'NEW ARM PROVISION' : 'MODIFY ARM UPDATE'}</p>
                                <div className="mt-2 space-y-1">
                                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                    Access: ARM ADMIN access
                                  </p>
                                </div>
                              </div>
                              {adminUpdateResult?.action === 'NEW' ? <Tag className="w-10 h-10 text-emerald-100" /> : <RotateCcw className="w-10 h-10 text-blue-100" />}
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                              <div className="p-4 rounded-2xl border-2 border-slate-50">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Administrative Assignment</p>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                                    <span className="text-sm font-bold text-slate-700">AIT-{adminDetails.ait_number}</span>
                                  </div>
                                  <div className="flex items-center gap-3 pl-8 relative before:absolute before:left-[3px] before:-top-3 before:h-6 before:w-[2px] before:bg-slate-100">
                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                    <span className="text-sm font-bold text-slate-700">{adminUpdateResult?.details?.primary_admin_name || adminDetails.primary_admin_name} <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">(Primary)</span></span>
                                  </div>
                                  <div className="flex items-center gap-3 pl-8 relative before:absolute before:left-[3px] before:-top-3 before:h-6 before:w-[2px] before:bg-slate-100">
                                    <div className="w-2 h-2 rounded-full bg-blue-300" />
                                    <span className="text-sm font-bold text-slate-700">{adminUpdateResult?.details?.secondary_admin_name || adminDetails.secondary_admin_name} <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">(Secondary)</span></span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-900 border-t border-slate-800 p-8">
                          <button
                            onClick={handleAdminConfirmAndContinue}
                            className="w-full h-16 bg-blue-600 text-white rounded-[1.25rem] font-black text-lg shadow-2xl shadow-blue-500/40 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                          >
                            <PlayCircle className="w-6 h-6 animate-pulse" />
                            CREATE ARM TICKET
                            <ArrowRight className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" />
                          </button>
                          <p className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-6 leading-none">
                            Policy Compliance Verified • Ref: IAM-V4.2
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12">
                  <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <Bot className="w-12 h-12 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Synchronizing Data...</h3>
                  <p className="text-slate-400 text-sm font-medium mt-2 max-w-xs">Connecting to the administrative vault to fetch your records. Please hold...</p>
                  <div className="mt-8 flex flex-col items-center gap-4">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                    </div>
                    <button
                      onClick={handleOpenAdminModal}
                      className="mt-4 px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-100 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retry Now
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Navigation */}
            {adminDetails && (
              <div className="px-8 py-8 bg-white border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={handleResetAdmin}
                    className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Reset ARM Admin Data & Ticket"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  {currentAdminStep > 1 && (
                    <button
                      onClick={handleAdminPrevStep}
                      className="flex items-center gap-2 text-slate-500 font-black text-sm uppercase tracking-widest hover:text-slate-900 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      Back
                    </button>
                  )}
                </div>

                {currentAdminStep === 1 && (
                  <button
                    onClick={() => {
                      if (areRolesValid) {
                        setCurrentAdminStep(4);
                        setSelectedService('arm_admin');
                      } else {
                        handleAdminNextStep();
                      }
                    }}
                    disabled={isPollingInbox || selectedTicket?.isPollingActive}
                    className={`h-14 px-8 ${areRolesValid ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'} text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center gap-3 group disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {(isPollingInbox || selectedTicket?.isPollingActive) ? '⏳ Communication Active' : (areRolesValid ? 'Skip to Review' : 'Begin Communication')}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {currentAdminStep === 3 && (
                  <button
                    onClick={handleAdminValidate}
                    disabled={isPollingInbox || selectedTicket?.isPollingActive || ((!adminPrimaryInput && !adminDetails?.primary_admin_name) || (!adminSecondaryInput && !adminDetails?.secondary_admin_name))}
                    className="h-14 px-8 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-3 group disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {(isPollingInbox || selectedTicket?.isPollingActive) ? '⏳ Polling...' : 'Check & Proceed'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}

                {currentAdminStep === 4 && (
                  <button
                    onClick={handleAdminNextStep}
                    disabled={isPollingInbox || selectedTicket?.isPollingActive || !selectedService}
                    className="h-14 px-8 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-3 group disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {(isPollingInbox || selectedTicket?.isPollingActive) ? '⏳ Polling...' : 'Proceed to Review'}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            )}

          </div>
        </div>,
        document.body
      )
      }

      {/* Success Toast Notification */}

      {
        showSuccessToast && (
          <div className="fixed bottom-8 right-8 bg-white border-l-4 border-green-500 shadow-2xl rounded-lg p-4 flex items-center gap-4 animate-slide-up z-50 max-w-md">
            <div className="bg-green-100 p-2 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
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

      {/* ARM Admin Toast Notification */}
      {
        showAdminToast && (
          <div className="fixed bottom-8 right-8 bg-white border-l-4 border-green-500 shadow-2xl rounded-lg p-4 flex items-center gap-4 animate-slide-up z-50 max-w-md">
            <div className="bg-green-100 p-2 rounded-full">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900">{adminToastMessage}</h4>
            </div>
            <button
              onClick={() => setShowAdminToast(false)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      }

      {/* Mock ARM Portal Preview */}
      {
        showARMPortal && armPortalData && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-100/90 backdrop-blur-md animate-in fade-in duration-500">
            <div className="w-full max-w-4xl bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-500 max-h-[95vh] flex flex-col">
              {/* ARM Brand Header */}
              <div className="bg-[#003366] px-10 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">ARM Portal</h1>
                    <p className="text-blue-300 text-[10px] font-bold uppercase tracking-[0.2em]">Enterprise Access Management</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-10 w-[1px] bg-white/10" />
                  <div className="text-right">
                    <p className="text-white text-xs font-bold">Logged in as System Admin</p>
                    <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase">Environment: Production</p>
                  </div>
                </div>
              </div>

              {/* Portal Content */}
              <div className="p-12 flex-1 overflow-y-auto">
                <div className="flex items-start justify-between mb-12">
                  <div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">
                      Request Submission Successful
                    </span>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                      {armPortalData.action === 'NEW' ? 'New Request' : 'Modify Request'}
                    </h2>
                    <p className="text-slate-500 font-medium">Ticket Reference: <span className="text-blue-600 font-bold">ARM-{armPortalData.ait_number}-{Math.floor(1000 + Math.random() * 9000)}</span></p>
                  </div>
                  <div className={`px-6 py-4 rounded-2xl flex items-center gap-4 border-2 ${armPortalData.action === 'NEW' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {armPortalData.action === 'NEW' ? <Tag className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Status</p>
                      <p className="text-lg font-black leading-none">PENDING APPROVAL</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Administrative Assignments
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs shadow-sm">P</div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Primary Admin</p>
                          <p className="text-lg font-bold text-slate-800 tracking-tight">{armPortalData.primary_admin}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs shadow-sm">S</div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Secondary Admin</p>
                          <p className="text-lg font-bold text-slate-800 tracking-tight">{armPortalData.secondary_admin}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Resource Information
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Application Asset</p>
                        <p className="text-lg font-bold text-slate-800 tracking-tight">{armPortalData.application_name} (AIT-{armPortalData.ait_number})</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Access Entitlement</p>
                        <div className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl w-fit shadow-md shadow-blue-600/20">
                          <Key className="w-4 h-4" />
                          <span className="font-black text-sm uppercase tracking-widest">{armPortalData.access_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setShowARMPortal(false);
                      // Show ARM ticket raised toast
                      const action = armPortalData?.action || 'NEW';
                      const ait = armPortalData?.ait_number || '';
                      setAdminToastMessage(
                        action === 'NEW'
                          ? `✅ ARM NEW ticket raised successfully for AIT-${ait}!`
                          : `✅ ARM MODIFY ticket raised successfully for AIT-${ait}!`
                      );
                      setShowAdminToast(true);
                      setTimeout(() => setShowAdminToast(false), 5000);
                    }}
                    className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-900/20 flex items-center gap-3 group"
                  >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    Return to Dashboard
                  </button>
                </div>
              </div>

              {/* Footer Watermark */}
              <div className="bg-slate-50 px-10 py-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 ARM GLOBAL SYSTEMS • CONFIDENTIAL</p>
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Secure</p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* BRE Remediation Wizard Global Modal */}
      {showBRERemediationModal && selectedTicket && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowBRERemediationModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowBRERemediationModal(false)}
              className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-all z-20"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex-1 overflow-y-auto">
              <BRERemediationWizard
                deliverableId={selectedTicket.id}
                aitNumber={(selectedTicket as any).ait_number || (selectedTicket as any).aitNumber || ''}
                applicationName={(selectedTicket as any).applicationName || (selectedTicket as any).application_name || selectedTicket.title}
                onSuccess={() => {
                  setShowBRERemediationModal(false);
                  fetchTickets();
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      <Footer />
    </div >
  );
}
