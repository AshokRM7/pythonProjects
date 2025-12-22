from pydantic import BaseModel
from typing import List

class AppDetail(BaseModel):
    ait_number: str    
    application_name: str
    application_owner: str
    lob_owner: str
    ait_owner: str
    contacts: List[str]

class AppDetailsResponse(BaseModel):
    app_detail: AppDetail
