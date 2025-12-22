export interface Ticket {
  id: string;
  title: string;
  category: string; // Used for dropdown filter (iimDelivery, category1, category2)
  type: 'bug' | 'security' | 'serviceRequest' | 'performance'; // Used for 'Tickets By Category' chart
  owner: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Closed' | 'In Progress' | 'Pending' | 'Waiting for Evidence' | 'Recent Issues';
  date: string; // ISO string
}


const ticketTypes = ['bug', 'security', 'serviceRequest', 'performance'];
const categories = ['iimDelivery', 'category1', 'category2'];
const owners = ['owner1', 'owner2'];
const priorities: Ticket['priority'][] = ['Critical', 'High', 'Medium', 'Low'];
const statuses: Ticket['status'][] = ['Open', 'Closed', 'In Progress', 'Pending', 'Waiting for Evidence', 'Recent Issues'];

const generateTickets = (count: number, daysRange: number): Ticket[] => {
  const tickets: Ticket[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const date = new Date(now - Math.random() * daysRange * 24 * 60 * 60 * 1000).toISOString();
    const statusIdx = Math.random();
    // Bias towards 'Closed' and 'Open' for better trend distribution
    const status = statusIdx < 0.4 ? 'Closed' : (statusIdx < 0.8 ? 'Open' : statuses[Math.floor(Math.random() * statuses.length)]);
    
    tickets.push({
      id: `ticket-${i}`,
      title: `${status} ${categories[i % 3]} ticket #${i}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      type: ticketTypes[Math.floor(Math.random() * ticketTypes.length)] as any,
      owner: owners[Math.floor(Math.random() * owners.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status: status,
      date: date,
    });
  }
  return tickets;
};

export const mockTickets: Ticket[] = [
  // Hand-crafted samples for specific cases
  { id: '1', title: 'Critical Security Breach', category: 'category1', type: 'security', owner: 'owner1', priority: 'Critical', status: 'Open', date: new Date().toISOString() },
  { id: '2', title: 'IIM Delivery Performance Issue', category: 'iimDelivery', type: 'performance', owner: 'owner2', priority: 'High', status: 'In Progress', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '3', title: 'Data Inconsistency', category: 'category2', type: 'bug', owner: 'owner2', priority: 'Medium', status: 'Closed', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  ...generateTickets(3000, 90) // Increased to 3000 tickets for significantly higher volume, covering 90 days.
];

export interface Alert {
    id: number;
    title: string;
    description: string;
    severity: string;
    icon: string;
    category: string;
    owner: string;
}

export const mockAlerts: Alert[] = [
    // Owner 1
    { id: 1, title: "Critical Incident", description: "Database outage - investigate now", severity: "critical", icon: "🔴", category: 'category1', owner: 'owner1' },
    { id: 2, title: "Security Breach", description: "Unauthorized access attempt blocked", severity: "high", icon: "🔒", category: 'category1', owner: 'owner1' },
    { id: 3, title: "Compliance Review", description: "2 tickets pending compliance approval", severity: "medium", icon: "📋", category: 'iimDelivery', owner: 'owner1' },
    { id: 4, title: "System Maintenance", description: "Scheduled maintenance in 2 hours", severity: "low", icon: "🔧", category: 'category2', owner: 'owner1' },
    { id: 5, title: "New Patch Available", description: "Critical security patch released", severity: "high", icon: "🛠️", category: 'category1', owner: 'owner1' },
    { id: 6, title: "Ticket Backlog", description: "Increase in service requests for Owner 1", severity: "medium", icon: "⚠️", category: 'iimDelivery', owner: 'owner1' },
    { id: 7, title: "API Latency", description: "Slow response for core services", severity: "medium", icon: "📉", category: 'iimDelivery', owner: 'owner1' },
    { id: 8, title: "User Access Audit", description: "Monthly review required", severity: "low", icon: "🔑", category: 'category2', owner: 'owner1' },

    // Owner 2
    { id: 9, title: "3 Overdue Tickets", description: "Immediate action needed", severity: "high", icon: "🚨", category: 'iimDelivery', owner: 'owner2' },
    { id: 10, title: "SLA Breach", description: "5 tickets exceeded response time", severity: "medium", icon: "⚠️", category: 'category1', owner: 'owner2' },
    { id: 11, title: "Performance Degradation", description: "API response time increased by 40%", severity: "medium", icon: "📉", category: 'category2', owner: 'owner2' },
    { id: 12, title: "Disk Space Warning", description: "Server storage exceeding 90%", severity: "medium", icon: "💽", category: 'iimDelivery', owner: 'owner2' },
    { id: 13, title: "Network Jitter", description: "Intermittent connectivity detected", severity: "medium", icon: "📶", category: 'category2', owner: 'owner2' },
    { id: 14, title: "Bug Trend", description: "Regression found in recent deployment", severity: "high", icon: "🐛", category: 'category1', owner: 'owner2' },
    { id: 15, title: "Cloud Service Down", description: "Third-party dependency failure", severity: "critical", icon: "☁️", category: 'category1', owner: 'owner2' },
    { id: 16, title: "Vulnerability Scan", description: "High risk CVE found in container", severity: "high", icon: "🛡️", category: 'category2', owner: 'owner2' },
];

export interface Insight {
    id: number;
    type: string;
    description: string;
    icon: string;
    color: string;
    category: string;
    owner: string;
}

export const mockInsights: Insight[] = [
    // Owner 1
    { id: 1, type: "AI Suggestion", description: "12 repeated login failures detected", icon: "🤖", color: "bg-gradient-to-r from-indigo-500 to-purple-500", category: 'category1', owner: 'owner1' },
    { id: 2, type: "Smart Tip", description: "Prioritize security vulnerabilities", icon: "💡", color: "bg-gradient-to-r from-yellow-500 to-orange-500", category: 'category2', owner: 'owner1' },
    { id: 3, type: "Efficiency Gain", description: "Automate service request routing", icon: "🚀", color: "bg-gradient-to-r from-green-500 to-teal-500", category: 'iimDelivery', owner: 'owner1' },
    { id: 4, type: "Data Insight", description: "Average resolution time improved by 10%", icon: "📊", color: "bg-gradient-to-r from-blue-500 to-cyan-500", category: 'iimDelivery', owner: 'owner1' },

    // Owner 2
    { id: 5, type: "Predicted Issue", description: "Predicted network outage risk", icon: "🔮", color: "bg-gradient-to-r from-blue-500 to-cyan-500", category: 'iimDelivery', owner: 'owner2' },
    { id: 6, type: "Trend Alert", description: "Increased volume of service requests", icon: "📈", color: "bg-gradient-to-r from-green-500 to-teal-500", category: 'category1', owner: 'owner2' },
    { id: 7, type: "Bug Pattern", description: "Common failure point in UI components", icon: "🧩", color: "bg-gradient-to-r from-red-500 to-pink-500", category: 'category2', owner: 'owner2' },
    { id: 8, type: "Security Score", description: "System hardening recommendations available", icon: "🔐", color: "bg-gradient-to-r from-orange-500 to-red-600", category: 'category1', owner: 'owner2' },
];
