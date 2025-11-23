# IAM Governance Demo Frontend

This is the frontend dashboard for the IAM Governance Demo. It provides a visual interface for managing access review tickets, integrating with AppHQ, JIRA, and Email services.

## Features

- **Dashboard**: View all active tickets with status and priority.
- **Ticket Details**:
  - View full ticket information.
  - **AppHQ Integration**: Fetch and assign business/support owners.
  - **AI Email Drafting**: Auto-generate emails to owners using AI (mocked for demo).
  - **Evidence Management**: Add and view evidence for tickets.
  - **JIRA Integration**: View linked JIRA items, add comments, and close items.
- **Email Logs**: View a history of all sent emails.

## Prerequisites

- Node.js (v18+)
- Backend running on `http://127.0.0.1:9000`

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run the development server:
    ```bash
    npm run dev
    ```

3.  Open [http://localhost:5173](http://localhost:5173) in your browser.

## Tech Stack

- **React** (Vite)
- **Tailwind CSS** (Styling)
- **React Query** (State Management & Data Fetching)
- **React Router** (Routing)
- **Lucide React** (Icons)
