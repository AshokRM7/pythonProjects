from datetime import datetime
from .db import get_conn

def get_access(employee_id: str, system: str | None = None) -> dict:
    """Returns enabled flag + roles list (grouped by system) for a user."""
    conn = get_conn()
    cursor = conn.cursor()
    
    # Get accounts
    if system:
        cursor.execute("SELECT system, enabled FROM accounts WHERE employee_id = ? AND system = ?", (employee_id, system))
    else:
        cursor.execute("SELECT system, enabled FROM accounts WHERE employee_id = ?", (employee_id,))
    
    accounts = cursor.fetchall()
    
    # Get permissions
    if system:
        cursor.execute("SELECT system, role FROM permissions WHERE employee_id = ? AND system = ?", (employee_id, system))
    else:
        cursor.execute("SELECT system, role FROM permissions WHERE employee_id = ?", (employee_id,))
    
    permissions = cursor.fetchall()
    conn.close()
    
    # Process accounts
    account_status = {row["system"]: bool(row["enabled"]) for row in accounts}
    
    # Process permissions
    system_roles = {}
    for row in permissions:
        s = row["system"]
        r = row["role"]
        if s not in system_roles:
            system_roles[s] = []
        system_roles[s].append(r)
        
    return {
        "employee_id": employee_id,
        "accounts": account_status,
        "roles": system_roles
    }

def revoke_roles(employee_id: str, system: str) -> int:
    """Revokes all roles for a user in a specific system. Returns number revoked."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM permissions WHERE employee_id = ? AND system = ?", (employee_id, system))
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count

def disable_account(employee_id: str, system: str) -> bool:
    """Disables a user's account in a specific system."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE accounts SET enabled = 0 WHERE employee_id = ? AND system = ?", (employee_id, system))
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success

def verify_revocation(employee_id: str, system: str) -> bool:
    """Verifies that the user has no active roles in the system."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM permissions WHERE employee_id = ? AND system = ?", (employee_id, system))
    role_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT enabled FROM accounts WHERE employee_id = ? AND system = ?", (employee_id, system))
    row = cursor.fetchone()
    enabled = row[0] if row else 0
    
    conn.close()
    return role_count == 0 and enabled == 0

def audit(ticket_id: str, action: str, detail: str):
    """Writes an entry to the audit log."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO audit_log (ts, ticket_id, action, detail)
    VALUES (?, ?, ?, ?)
    """, (datetime.now().isoformat(), ticket_id, action, detail))
    conn.commit()
    conn.close()

def get_audit_logs(ticket_id: str) -> list:
    """Returns audit logs for a specific ticket."""
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT ts, action, detail FROM audit_log WHERE ticket_id = ? ORDER BY ts ASC", (ticket_id,))
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs
