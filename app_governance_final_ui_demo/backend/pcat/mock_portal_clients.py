import os
import shutil
from typing import Dict

def upload_to_pcat_portal(ticket_id: str, csv_path: str) -> Dict[str, str]:
    """
    Simulated upload to PCAT portal by copying file to a specific directory.
    """
    dest_dir = "backend/data/pcat/uploads/pcat_portal"
    os.makedirs(dest_dir, exist_ok=True)
    
    dest_path = f"{dest_dir}/{ticket_id}_uploaded.csv"
    shutil.copy2(csv_path, dest_path)
    
    return {
        "status": "success",
        "destination": "PCAT_PORTAL",
        "path": dest_path
    }

def upload_to_rise_portal(ticket_id: str, csv_path: str) -> Dict[str, str]:
    """
    Simulated upload to RISE portal by copying file to a specific directory.
    """
    dest_dir = "backend/data/pcat/uploads/rise_portal"
    os.makedirs(dest_dir, exist_ok=True)
    
    dest_path = f"{dest_dir}/{ticket_id}_uploaded.csv"
    shutil.copy2(csv_path, dest_path)
    
    return {
        "status": "success",
        "destination": "RISE_PORTAL",
        "path": dest_path
    }
