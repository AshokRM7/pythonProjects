from fastapi import APIRouter, HTTPException
import json
import os

router = APIRouter(prefix="/apphq", tags=["AppHQ"])

USERS_FILE = "app/data/users.json"

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)

@router.get("/owners/{ait_number}")
async def get_owners(ait_number: str):
    users = load_users()
    if ait_number not in users:
        raise HTTPException(status_code=404, detail="AIT Number not found")
    return users[ait_number]
