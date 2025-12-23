import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "iam_demo.db"

def get_conn():
    """Returns a connection to the SQLite database."""
    # Ensure data directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema."""
    conn = get_conn()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        employee_id TEXT PRIMARY KEY,
        email TEXT,
        status TEXT,
        last_day TEXT
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT,
        system TEXT,
        username TEXT,
        enabled INTEGER,
        FOREIGN KEY (employee_id) REFERENCES users(employee_id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT,
        system TEXT,
        role TEXT,
        FOREIGN KEY (employee_id) REFERENCES users(employee_id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT DEFAULT (datetime('now')),
        ticket_id TEXT,
        action TEXT,
        detail TEXT
    )
    """)
    
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

if __name__ == "__main__":
    init_db()
