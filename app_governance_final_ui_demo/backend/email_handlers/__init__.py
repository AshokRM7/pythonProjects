"""
Shared interface and dependencies for deliverable-specific email handlers.
"""
from typing import Callable, Awaitable, Dict, Any
from dataclasses import dataclass

@dataclass
class EmailHandlerContext:
    """
    Context passed to each deliverable-specific email handler so they can interact
    with the core api_server system (broadcasts, state saving, etc.) without circular imports.
    """
    ticket_id: str
    ait_number: str
    ticket: Dict[str, Any]
    decision: str
    reason: str
    sender: str
    body: str
    e_id: str
    parsed_names: Dict[str, str]
    
    # Callback to broadcast WebSocket messages
    broadcaster: Callable[[dict], Awaitable[None]]
    
    # Callback to save the current global ticket state to disk
    save_tickets: Callable[[], None]
    
    # Callback to update the progress of a specific stage
    update_stage: Callable[[str, int, str, str], Awaitable[None]]
    
    # Callback to stop polling for this ait_number
    stop_polling: Callable[[str], None]
    
    # Callback to trigger final API server pipeline processing
    trigger_processing: Callable[[str], Awaitable[None]]
    
    # Reference to the ARM admin agent for handling Stage 5 logic
    arm_admin_agent: Any = None
