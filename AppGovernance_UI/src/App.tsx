import { useState } from 'react';
import { TicketDashboard } from './components/TicketDashboard';
import { TicketWorkflow } from './components/TicketWorkflow';
import { Login } from './components/Login';

export interface Ticket {
  id: string;
  title: string;
  category: string;
  appId: string;
  slaDeadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'New' | 'In Progress' | 'Pending Evidence' | 'Closed';
  description: string;
  createdBy: string;
  createdDate: string;
  jiraStory?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedTicket(null);
  };

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const handleBackToDashboard = () => {
    setSelectedTicket(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {!selectedTicket ? (
        <TicketDashboard onTicketSelect={handleTicketSelect} user={user} onLogout={handleLogout} />
      ) : (
        <TicketWorkflow ticket={selectedTicket} onBack={handleBackToDashboard} user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}