import React, { useEffect, useState } from 'react';
import axios from 'axios';

const TicketDashboard = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTickets = async () => {
            try {
                const response = await axios.get('http://127.0.0.1:9000/rise/tickets');
                setTickets(response.data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching tickets:", err);
                setError(`Failed to fetch tickets. Error: ${err.message}. Ensure backend is running on port 9000.`);
                setLoading(false);
            }
        };

        fetchTickets();
    }, []);

    if (loading) return <div className="loading">Loading tickets...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="dashboard-container">
            <h1>Ticket Dashboard</h1>
            <table className="ticket-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Application</th>
                        <th>Description</th>
                        <th>Priority</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {tickets.map((ticket) => (
                        <tr key={ticket.id}>
                            <td>{ticket.id}</td>
                            <td>{ticket.application}</td>
                            <td>{ticket.description}</td>
                            <td>
                                <span className={`priority-badge priority-${ticket.priority.toLowerCase()}`}>
                                    {ticket.priority}
                                </span>
                            </td>
                            <td>
                                <span className={`status-badge status-${ticket.status.toLowerCase()}`}>
                                    {ticket.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TicketDashboard;
