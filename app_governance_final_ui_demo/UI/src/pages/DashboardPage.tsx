import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SeverityChart } from "../components/dashboard/charts/SeverityChart";
import { StatusBarChart } from "../components/dashboard/charts/StatusBarChart";
import { AiInsights } from "../components/dashboard/AiInsights";
import { AlertsIssues } from "../components/dashboard/AlertsIssues";
import { DashboardFilters } from "../components/dashboard/DashboardFilter";
import ChartContainer from "../components/dashboard/reusable/ChartContainer";
import { StatCard } from "../components/dashboard/StatCard";
import { TicketsTrendOverview } from "../components/dashboard/TicketsTrendOverview";
import { mockAlerts, mockInsights, mockTickets as staticMockTickets } from "../data/mockData";
import Header from "../components/Header";
import Footer from "../components/Footer";

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


export const DashboardPage = () => {
  const [category, setCategory] = useState<string[]>(["all"]);
  const [owner, setOwner] = useState<string[]>(["all"]); // Array state
  const [timeline, setTimeline] = useState("90");
  const [pastDueOptions, setPastDueOptions] = useState<string[]>(["all"]);
  const [apiTickets, setApiTickets] = useState<any[]>([]);
  const navigate = useNavigate();

  // Fetch tickets from API
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/tickets');
        const data = await response.json();
        if (data.tickets) {
          // Transform API tickets to match mockData structure if needed, or just use them
          const transformed = data.tickets.map((t: any) => ({
            id: t.id,
            title: t.title,
            category: t.category || 'IAM', // Default fallback
            subcategory: t.subcategory, // Include subcategory
            owner: t.owner || 'owner1',
            priority: t.priority?.charAt(0).toUpperCase() + t.priority?.slice(1) || 'Medium',
            status: t.status ? normalizeStatus(t.status) : 'Open',
            date: t.createdAt || new Date().toISOString(),
            slaDeadline: t.slaDeadline || t.sla_deadline,
          }));
          setApiTickets(transformed);
        }
      } catch (error) {
        console.error("Failed to fetch tickets", error);
        // Fallback to static mock data if API fails
        setApiTickets(staticMockTickets);
      }
    };
    fetchTickets();
  }, []);

  // Use API tickets if available, otherwise static
  const ticketsToUse = apiTickets.length > 0 ? apiTickets : staticMockTickets;

  // Extract unique categories and owners for filters
  const filterOptions = useMemo(() => {
    const categories = Array.from(new Set(ticketsToUse.map(t => t.category).filter(Boolean)));
    const owners = Array.from(new Set(ticketsToUse.map(t => t.owner).filter(Boolean)));

    // Build hierarchical category structure
    const categoryOptions = [
      { value: 'all', label: 'All Categories' }
    ];

    // Add categories with hierarchical structure
    categories.forEach(cat => {
      if (cat === 'IAM') {
        const iamOption: any = {
          value: 'IAM_GROUP',
          label: 'IAM CATEGORY',
          children: [
            { value: 'IAM', label: 'IAM-PAST DUE' }
          ]
        };

        // Add PCAT and Toxic Combination as children
        iamOption.children.push({ value: 'PCAT', label: 'PCAT' });
        iamOption.children.push({ value: 'TOXIC COMBINATION', label: 'TOXIC COMBINATION' });
        iamOption.children.push({ value: 'ARM FORM', label: 'ARM FORM' });
        iamOption.children.push({ value: 'NON-HUMAN ACCOUNTS', label: 'NON-HUMAN ACCOUNTS' });
        iamOption.children.push({ value: 'DORMANCY ALERT', label: 'DORMANCY ALERT' });
        iamOption.children.push({ value: 'INTRA AIT', label: 'INTRA AIT' });
        iamOption.children.push({ value: 'EQ', label: 'EQ' });
        iamOption.children.push({ value: 'PCAT-QUARANTINE', label: 'PCAT-QUARANTINE' });
        iamOption.children.push({ value: 'PCAT-DUPLICATE', label: 'PCAT-DUPLICATE' });

        categoryOptions.push(iamOption);
      } else if (cat !== 'PCAT') {
        // Add other categories normally (exclude individual PCAT from top level)
        categoryOptions.push({ value: cat, label: cat });
      }
    });

    return {
      categories: categoryOptions,
      owners: [
        { value: 'all', label: 'All Owners' },
        ...owners.map(o => ({ value: o, label: o }))
      ]
    };
  }, [ticketsToUse]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    const now = new Date();
    const days = parseInt(timeline) || 7;
    const limit = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return ticketsToUse.filter((ticket) => {
      const ticketDate = new Date(ticket.date);
      // If date is invalid, assume it's recent
      const isValidDate = !isNaN(ticketDate.getTime());
      const matchesTimeline = isValidDate ? ticketDate >= limit : true;

      // Multi-select category match
      // If IAM_GROUP is selected, we should include everything in it? Or just let children handle it?
      // Let's assume selecting the parent select/deselects children in the UI logic later.
      const matchesCategory = category.includes("all") ||
        (ticket.subcategory ? category.includes(ticket.subcategory) : category.includes(ticket.category));

      // Multi-select owner match
      const matchesOwner = owner.includes("all") || owner.includes(ticket.owner);

      // Past Due logic with Multi-select
      // If "all" is selected or array is empty, we don't filter for past due specifically
      // unless user selected specific past due options
      let matchesPastDue = true;
      const isPastDueSelected = pastDueOptions.length > 0 && !pastDueOptions.includes("all");

      const isOverdue = ticket.slaDeadline && new Date(ticket.slaDeadline) < now;
      if (isOverdue && ticket.status !== 'Closed') {
        ticket.priority = 'Critical'; // Elevate priority dynamically
      }

      if (isPastDueSelected) {
        // If any specific option is selected, ticket must match at least one
        const matchesOption = pastDueOptions.some(option => {
          if (option === 'past_due') return isOverdue && ticket.status !== 'Closed';
          if (option === 'past_due_10') {
            const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
            return ticket.slaDeadline && new Date(ticket.slaDeadline) < tenDaysAgo && ticket.status !== 'Closed';
          }
          if (option === 'past_due_30') {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return ticket.slaDeadline && new Date(ticket.slaDeadline) < thirtyDaysAgo && ticket.status !== 'Closed';
          }
          return false;
        });
        matchesPastDue = matchesOption;
      }

      // If any past due filter is active, we should show those tickets regardless of the timeline
      // Otherwise, we strictly respect the timeline (creation date)
      const effectiveMatchesTimeline = isPastDueSelected ? true : matchesTimeline;

      return effectiveMatchesTimeline && matchesCategory && matchesOwner && matchesPastDue;
    });
  }, [category, owner, timeline, pastDueOptions, ticketsToUse]);

  // Stats Calculation
  const stats = useMemo(() => {
    const total = filteredTickets.length;
    const open = filteredTickets.filter(t => t.status === 'Open').length;
    const closed = filteredTickets.filter(t => t.status === 'Closed').length;
    const inProgress = filteredTickets.filter(t => t.status === 'In Progress').length;
    const pending = filteredTickets.filter(t => t.status === 'Pending').length;
    const waiting = filteredTickets.filter(t => t.status === 'Waiting for Evidence').length;
    const recentIssues = filteredTickets.filter(t => t.status === 'Recent Issues').length;

    return [
      { title: "Total", count: total, gradient: "bg-white border-t-4 border-[#012169]", icon: "📊", percentageChange: 12.5, isIncrease: true },
      { title: "Open", count: open, gradient: "bg-white border-t-4 border-[#0061AA]", icon: "📬", percentageChange: 8.3, isIncrease: true },
      { title: "Closed", count: closed, gradient: "bg-white border-t-4 border-[#E31837]", icon: "✅", percentageChange: 15.2, isIncrease: true },
      { title: "In Progress", count: inProgress, gradient: "bg-white border-t-4 border-[#012169]", icon: "⚙️", percentageChange: 5.7, isIncrease: false },
      { title: "Pending", count: pending, gradient: "bg-white border-t-4 border-[#E31837]", icon: "⏳", percentageChange: 3.2, isIncrease: false },
      { title: "Waiting for Evidence", count: waiting, gradient: "bg-white border-t-4 border-[#0061AA]", icon: "🔍", percentageChange: 2.1, isIncrease: true },
      {
        title: 'Recent Issues',
        count: recentIssues,
        gradient: 'bg-white border-t-4 border-[#E31837]',
        icon: '⚡',
        percentageChange: 18.5,
        isIncrease: true
      }
    ];
  }, [filteredTickets]);

  // Severity Data for Pie Chart
  const severityData = useMemo(() => {
    const counts = {
      Critical: filteredTickets.filter(t => t.priority === 'Critical').length,
      High: filteredTickets.filter(t => t.priority === 'High').length,
      Medium: filteredTickets.filter(t => t.priority === 'Medium').length,
      Low: filteredTickets.filter(t => t.priority === 'Low').length,
    };

    return [
      { name: "Critical", value: counts.Critical, fill: "#dc2626" },
      { name: "High", value: counts.High, fill: "#ea580c" },
      { name: "Medium", value: counts.Medium, fill: "#d97706" },
      { name: "Low", value: counts.Low, fill: "#059669" },
    ];
  }, [filteredTickets]);

  // Category Data for Bar Chart
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      const cat = t.category || "Unknown";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const total = filteredTickets.length || 1;

    // Define colors for known categories
    const categoryColors: Record<string, string> = {
      'IAM': '#4f46e5', // Indigo
      'APP': '#dc2626', // Red
      'DATA': '#0891b2', // Cyan
      'SECURITY': '#ea580c', // Orange
      'Unknown': '#9ca3af' // Gray
    };

    // return array based on counts keys
    return Object.keys(counts).map(cat => ({
      name: cat,
      value: Math.round((counts[cat] / total) * 100),
      fill: categoryColors[cat] || '#6366f1'
    })).sort((a, b) => b.value - a.value); // Sort by highest percentage
  }, [filteredTickets]);

  // Filtered Alerts & Insights (Keeping mock for now as requested, or can be fetched too)
  const filteredAlerts = useMemo(() => {
    return mockAlerts.filter(a => {
      const matchesCategory = category.includes("all") || category.includes(a.category);
      const matchesOwner = owner.includes("all") || owner.includes(a.owner);
      return matchesCategory && matchesOwner;
    });
  }, [category, owner]);

  const filteredInsights = useMemo(() => {
    return mockInsights.filter(i => {
      const matchesCategory = category.includes("all") || category.includes(i.category);
      const matchesOwner = owner.includes("all") || owner.includes(i.owner);
      return matchesCategory && matchesOwner;
    });
  }, [category, owner]);

  const numDays = parseInt(timeline) || 7;
  const minDays = 1;
  const maxDays = numDays;

  // Mock handlers since we are in dashboard
  const handleSignOut = () => {
    localStorage.removeItem('currentUser');
    window.location.href = '/signin';
  };
  const currentUser = localStorage.getItem('currentUser') || 'User';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header currentUser={currentUser} onSignOut={handleSignOut} />

      <main className="flex-1 max-w-[95%] w-full mx-auto px-4 py-8">
        <div className="py-3">
          <div className="bg-white rounded-xl p-4 shadow mb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="mb-1 text-2xl font-medium text-gray-800">Ticket Assignment Dashboard</h1>
              <p className="text-gray-600 text-sm">Monitor and manage your support tickets</p>
            </div>
            <DashboardFilters
              category={category}
              setCategory={setCategory}
              owner={owner}
              setOwner={setOwner}
              timeline={timeline}
              setTimeline={setTimeline}
              pastDueOptions={pastDueOptions}
              setPastDueOptions={setPastDueOptions}
              categoryOptions={filterOptions.categories}
              ownerOptions={filterOptions.owners}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {stats.map((stat) => (
              <div key={stat.title} onClick={() => navigate('/home', { state: { statusFilter: stat.title, timeline: timeline, category: category, owner: owner, pastDueOptions: pastDueOptions } })} className="cursor-pointer transition-transform hover:scale-105">
                <StatCard {...stat} />
              </div>
            ))}
          </div>
          <TicketsTrendOverview minDays={minDays} maxDays={maxDays} tickets={filteredTickets} />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
            <div className="bg-white rounded-xl p-4 shadow h-full">
              <AlertsIssues alerts={filteredAlerts} />
            </div>
            <div className="h-full">
              <ChartContainer
                title="Tickets By Priority"
                subtitle={`Showing data for last ${numDays} days`}
              >
                <SeverityChart severityData={severityData} />
                <div className="mt-auto pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {numDays <= 7
                        ? "Critical tickets decreased by"
                        : "High priority tickets increased by"}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${numDays <= 7 ? "text-green-600" : "text-red-600"
                        }`}
                    >
                      {numDays <= 7 ? "↓ 8.5%" : "↑ 12.3%"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {numDays <= 7
                      ? "Improved response time contributing to reduction"
                      : "Increased workload from new security audit"}
                  </p>
                </div>
              </ChartContainer>
            </div>
            <div className="h-full">
              <ChartContainer
                title="Tickets By Category"
                subtitle={`Showing data for last ${numDays} days`}
              >
                <StatusBarChart data={categoryData} />
                <div className="mt-auto pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {numDays <= 7
                        ? "Bug reports trending down"
                        : "Service requests increased"}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${numDays <= 7 ? "text-green-600" : "text-blue-600"
                        }`}
                    >
                      {numDays <= 7 ? "↓ 15.2%" : "↑ 24.7%"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {numDays <= 7
                      ? "Recent bug fixes showing positive impact"
                      : "New feature rollout driving support requests"}
                  </p>
                </div>
              </ChartContainer>
            </div>
            <div className="bg-white rounded-xl p-4 shadow h-full">
              <AiInsights insights={filteredInsights} />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
