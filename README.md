# IAM Governance Demo

A complete demonstration of an Identity and Access Management (IAM) Governance workflow. This project simulates a real-world enterprise environment where access review tickets are managed, owners are assigned via an external system (AppHQ), and communications are handled via email and JIRA.

## 🌟 Project Overview

This project consists of two main parts:

1.  **Backend (Python/FastAPI)**: A mock server that simulates enterprise services:
    *   **Rise**: Ticket management system.
    *   **AppHQ**: Application ownership database.
    *   **JIRA**: Issue tracking system.
    *   **Email Service**: Simulates sending emails and logging them.
2.  **Frontend (React/Vite)**: A modern dashboard for IAM analysts to manage the entire lifecycle of access reviews.

## 📂 Folder Structure

Here's a quick guide to where everything is:

```
IAM_Antigravity/
├── data/                   # JSON files acting as the database
│   ├── email_log.json      # Logs of all sent emails
│   └── users.json          # Mock user/owner data
├── frontend/               # The React Application
│   ├── src/
│   │   ├── components/     # Reusable UI components (Tables, Modals, etc.)
│   │   ├── pages/          # Main pages (Dashboard, TicketDetails, Logs)
│   │   └── services/       # API integration logic
│   └── package.json        # Frontend dependencies
├── mock_services/          # The Python Backend
│   └── mock_server.py      # FastAPI server defining all endpoints
├── requirements.txt        # Backend dependencies
└── README.md               # This file
```

## 🚀 Getting Started

Follow these steps to set up the project from scratch.

### Prerequisites

*   **Node.js** (v18 or higher): Required for the frontend. [Download Here](https://nodejs.org/)
*   **Python** (v3.8 or higher): Required for the backend. [Download Here](https://www.python.org/)

### Step 1: Setup the Backend

The backend runs on port `9000`.

1.  Open a terminal in the root folder (`IAM_Antigravity`).
2.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv .venv
    # Windows:
    .venv\Scripts\activate
    # Mac/Linux:
    source .venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    *(If `requirements.txt` is missing, just install FastAPI and Uvicorn: `pip install fastapi uvicorn`)*
4.  Start the server:
    ```bash
    python -m uvicorn mock_services.mock_server:app --port 9000 --reload
    ```
    You should see: `Uvicorn running on http://127.0.0.1:9000`

### Step 2: Setup the Frontend

The frontend runs on port `5173`.

1.  Open a **new** terminal window.
2.  Navigate to the frontend folder:
    ```bash
    cd frontend
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start the development server:
    ```bash
    npm run dev
    ```
5.  Open your browser and go to: [http://localhost:5173](http://localhost:5173)

## 💡 How to Use the Demo

Once both servers are running, you can simulate a full IAM workflow:

1.  **Dashboard**: You will see a list of tickets (e.g., "Payments Portal Access Review").
2.  **View Ticket**: Click "View" on a ticket to see details.
3.  **Assign Owners**:
    *   Notice "Business Owner" is empty.
    *   Click **"Sync from AppHQ"**. The system fetches owners (e.g., `alice@example.com`) from the mock database.
4.  **Draft Email**:
    *   Click **"Draft Email (AI)"**.
    *   A modal appears with a pre-written email to the owner.
    *   Click **"Send Email"**.
5.  **Verify Email**:
    *   Go to the **"Email Logs"** page in the sidebar.
    *   You will see your sent email there.
6.  **Add Evidence**:
    *   Back in the ticket, type "Approved by Alice via email" in the Evidence panel and click "+".
7.  **JIRA Integration**:
    *   See the linked JIRA item on the right.
    *   Add a comment like "Review started".
    *   Click **"Close JIRA Item"**.
8.  **Close Ticket**:
    *   Finally, click **"Close Ticket"** at the top right. The status changes to "Closed".

## 🛠 Troubleshooting

*   **"Failed to load tickets"**: Ensure the backend python server is running on port 9000.
*   **Tailwind/PostCSS Errors**: If you see errors about `tailwindcss` and `postcss`, try deleting `node_modules` in the `frontend` folder and running `npm install` again. We use Tailwind v4 which requires `@tailwindcss/postcss`.

## 📚 Tech Stack Details

*   **Frontend**: React 19, Vite, Tailwind CSS v4, React Query (TanStack Query), React Router v7.
*   **Backend**: Python, FastAPI, Uvicorn.
*   **Data**: Simple JSON files in `data/` folder (No database required).