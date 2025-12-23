from .db import get_conn, init_db

def ensure_seeded():
    """Seeds the database with sample data if not already present."""
    init_db()
    conn = get_conn()
    cursor = conn.cursor()
    
    employee_id = "E1023"
    
    # Check if user exists
    cursor.execute("SELECT 1 FROM users WHERE employee_id = ?", (employee_id,))
    if not cursor.fetchone():
        print(f"Seeding user {employee_id}...")
        cursor.execute("""
        INSERT INTO users (employee_id, email, status, last_day)
        VALUES (?, ?, ?, ?)
        """, (employee_id, "leaver.crm@example.com", "Resigned", "2025-12-10"))
        
        # Add account
        cursor.execute("""
        INSERT INTO accounts (employee_id, system, username, enabled)
        VALUES (?, ?, ?, ?)
        """, (employee_id, "CRM_DB", "leaver_crm", 1))
        
        # Add permissions
        roles = ["READ_CUSTOMERS", "WRITE_CASES", "ADMIN_REPORTS"]
        for role in roles:
            cursor.execute("""
            INSERT INTO permissions (employee_id, system, role)
            VALUES (?, ?, ?)
            """, (employee_id, "CRM_DB", role))
            
        conn.commit()
        print("Seeding completed.")
    else:
        print(f"User {employee_id} already exists. Skipping seed.")
        
    conn.close()

if __name__ == "__main__":
    ensure_seeded()
