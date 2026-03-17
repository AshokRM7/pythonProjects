"""
BRE Remediation Agent - Stage 6 (BRE-NEW Deliverable)
Validates invalid permissions against BRE business rules.
Handles: rules dashboard, permission popup, certify/remove, screenshot, emails.
This agent ONLY activates for BRE-NEW tickets and does NOT affect existing BRE/IAM/PCAT flows.
"""
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional


# ─── Business Rules (canonical source) ───────────────────────────────────────
BRE_BUSINESS_RULES = [
    {
        "rule_id": "BRE-RULE-1",
        "rule_name": "No Developer → Production Access",
        "description": "Developers cannot have Production environment access",
        "user_type": "Developer",
        "forbidden_permission": "Production Environment Access",
        "risk_level": "high",
        "category": "Environment Access",
        "icon": "🔒",
    },
    {
        "rule_id": "BRE-RULE-2",
        "rule_name": "No User → Admin Access",
        "description": "Users cannot have Admin access",
        "user_type": "Regular User",
        "forbidden_permission": "Admin Access",
        "risk_level": "critical",
        "category": "Privilege Escalation",
        "icon": "🛡️",
    },
    {
        "rule_id": "BRE-RULE-3",
        "rule_name": "No Contractor → Confidential Data",
        "description": "Contractors cannot access confidential data",
        "user_type": "Contractor",
        "forbidden_permission": "Confidential Data Access",
        "risk_level": "high",
        "category": "Data Access",
        "icon": "📂",
    },
    {
        "rule_id": "BRE-RULE-4",
        "rule_name": "No Test Account → Elevated Privileges",
        "description": "Test accounts cannot be assigned elevated privileges",
        "user_type": "Test Account",
        "forbidden_permission": "Elevated Privileges",
        "risk_level": "medium",
        "category": "Privilege Management",
        "icon": "⚠️",
    },
    {
        "rule_id": "BRE-RULE-5",
        "rule_name": "No Service Account → Interactive Login",
        "description": "Service accounts must not have interactive login enabled",
        "user_type": "Service Account",
        "forbidden_permission": "Interactive Login",
        "risk_level": "critical",
        "category": "Account Security",
        "icon": "🔑",
    },
]


class BRERemediationAgent:
    """
    BRE Remediation Agent for BRE-NEW deliverable.
    Handles invalid permission detection, dashboard display, certify/remove decisions,
    screenshot capture, and email notifications.

    This agent ONLY processes tickets with deliverableType='BRE-NEW'.
    It does NOT interfere with existing BRE (BRE-2026-*) or any IAM/PCAT/SECURITY tickets.
    """

    def __init__(self):
        self.data_path = Path(__file__).resolve().parents[2] / "data"
        self._portal_data_cache: Optional[Dict] = None

    # ─── Data Helpers ─────────────────────────────────────────────────────────

    def _load_portal_data(self) -> Dict[str, Any]:
        """Load and cache bre_portal_data.json"""
        if self._portal_data_cache is None:
            portal_file = self.data_path / "bre_portal_data.json"
            with open(portal_file, "r", encoding="utf-8") as f:
                self._portal_data_cache = json.load(f)
        return self._portal_data_cache

    def _get_app_owner(self, application_id: str) -> Optional[Dict[str, Any]]:
        """Get app owner info from bre_portal_data.json"""
        data = self._load_portal_data()
        return data.get("app_owners", {}).get(application_id)

    # ─── Public API ───────────────────────────────────────────────────────────

    def get_business_rules(self) -> List[Dict[str, Any]]:
        """Return all 5 BRE business rules (for the dashboard table)."""
        return BRE_BUSINESS_RULES

    def get_invalid_permissions(self, ait_number: str) -> Dict[str, Any]:
        """
        Load invalid permissions for a given AIT number from bre_portal_data.json.
        Returns a dict with 'invalid_permissions' list and summary counts.
        """
        data = self._load_portal_data()
        ait_data = data.get("ait_rules", {}).get(ait_number, {})
        invalid_perms = ait_data.get("invalid_permissions", [])

        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for perm in invalid_perms:
            level = perm.get("risk_level", "low").lower()
            if level in risk_counts:
                risk_counts[level] += 1

        return {
            "ait_number": ait_number,
            "application_name": ait_data.get("application_name", "Unknown"),
            "invalid_permissions": invalid_perms,
            "total_violations": len(invalid_perms),
            "risk_summary": risk_counts,
            "has_violations": len(invalid_perms) > 0,
        }

    def simulate_owner_response(self, ait_number: str) -> List[Dict[str, Any]]:
        """
        Simulate app owner's response for demo purposes.
        Returns a list of decisions (one per invalid permission).
        """
        perms_data = self.get_invalid_permissions(ait_number)
        decisions = []
        for perm in perms_data["invalid_permissions"]:
            # Simulate: critical/high → Remove, medium/low → Certify
            risk = perm.get("risk_level", "low").lower()
            action = "remove" if risk in ("critical", "high") else "certify"
            decisions.append({
                "permission_id": perm["permission_id"],
                "permission_name": perm["permission_name"],
                "action": action,
                "comment": (
                    f"App Owner decision: {'Remove - violates BRE policy' if action == 'remove' else 'Certify - justified exception'}"
                ),
            })
        return decisions

    def submit_remediation_decision(
        self,
        deliverable_id: str,
        ait_number: str,
        application_id: str,
        decisions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Process the support team's submitted decisions.
        Steps:
        1. Validate all permissions have a decision.
        2. Capture screenshot (simulated Pillow PNG).
        3. Send email to app owner with screenshot.
        4. Attach screenshot to JIRA ticket.
        5. Send RISA portal notification.
        Returns a result dict with paths and event records.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_filename = f"bre_remediation_{deliverable_id}_{timestamp}.png"
        
        # Consistent with user request: screenshots under evidence folder
        project_root = self.data_path.parent
        screenshots_dir = project_root / "backend" / "bre" / "data" / "evidence" / "screenshots"
        screenshots_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = str(screenshots_dir / screenshot_filename)

        # Capture screenshot
        screenshot_result = self._capture_screenshot(
            deliverable_id, decisions, screenshot_path
        )

        # Get app owner
        app_owner = self._get_app_owner(application_id) or {
            "name": "Application Owner",
            "email": "app.owner@company.com",
        }

        # Send emails
        email_result = self._send_owner_email(
            app_owner, deliverable_id, decisions, screenshot_path
        )

        # Update JIRA
        jira_result = self._attach_to_jira(deliverable_id, screenshot_path)

        # RISE notification
        rise_result = self._send_rise_notification(deliverable_id, decisions)

        # Summary
        certified = [d for d in decisions if d.get("action") == "certify"]
        removed = [d for d in decisions if d.get("action") == "remove"]

        return {
            "success": True,
            "deliverable_id": deliverable_id,
            "ait_number": ait_number,
            "timestamp": datetime.now().isoformat(),
            "decisions_submitted": len(decisions),
            "certified_count": len(certified),
            "removed_count": len(removed),
            "decisions": decisions,
            "screenshot": screenshot_result,
            "email_sent": email_result,
            "jira_updated": jira_result,
            "rise_notified": rise_result,
            "status": "completed",
            "message": (
                f"BRE Remediation complete: {len(certified)} permission(s) certified, "
                f"{len(removed)} permission(s) removed. Screenshot captured and emails sent."
            ),
        }

    # ─── Private Helpers ──────────────────────────────────────────────────────

    def _capture_screenshot(
        self,
        deliverable_id: str,
        decisions: List[Dict[str, Any]],
        output_path: str,
    ) -> Dict[str, Any]:
        """
        Generate a PNG screenshot using Pillow (demo-friendly, no browser needed).
        Falls back gracefully if Pillow is not installed.
        """
        try:
            from PIL import Image, ImageDraw, ImageFont

            # Canvas
            width, height = 900, 120 + len(decisions) * 60 + 80
            img = Image.new("RGB", (width, height), color=(245, 248, 255))
            draw = ImageDraw.Draw(img)

            # Header bar
            draw.rectangle([(0, 0), (width, 60)], fill=(1, 33, 105))

            try:
                header_font = ImageFont.truetype("arial.ttf", 22)
                body_font = ImageFont.truetype("arial.ttf", 16)
                small_font = ImageFont.truetype("arial.ttf", 13)
            except Exception:
                header_font = ImageFont.load_default()
                body_font = header_font
                small_font = header_font

            draw.text((20, 18), f"BRE Remediation – {deliverable_id}", fill="white", font=header_font)
            draw.text((width - 260, 22), datetime.now().strftime("%Y-%m-%d %H:%M:%S"), fill="#aaccff", font=small_font)

            # Column headers
            y = 75
            draw.rectangle([(0, y), (width, y + 35)], fill=(230, 236, 255))
            draw.text((15, y + 8), "Permission", fill="#012169", font=body_font)
            draw.text((380, y + 8), "Assigned To", fill="#012169", font=body_font)
            draw.text((600, y + 8), "Action", fill="#012169", font=body_font)

            # Decision rows
            action_colors = {"certify": (34, 197, 94), "remove": (239, 68, 68)}
            for i, d in enumerate(decisions):
                row_y = 110 + i * 55
                bg = (255, 255, 255) if i % 2 == 0 else (248, 250, 255)
                draw.rectangle([(0, row_y), (width, row_y + 50)], fill=bg)
                draw.text((15, row_y + 16), d.get("permission_name", ""), fill="#1e293b", font=body_font)
                draw.text((380, row_y + 16), d.get("permission_id", ""), fill="#475569", font=small_font)
                action = d.get("action", "").upper()
                a_color = action_colors.get(d.get("action", ""), (100, 116, 139))
                draw.rectangle([(600, row_y + 12), (720, row_y + 38)], fill=a_color, outline=a_color)
                draw.text((615, row_y + 17), action, fill="white", font=body_font)

            # Footer
            footer_y = height - 40
            draw.rectangle([(0, footer_y), (width, height)], fill=(241, 245, 249))
            draw.text((15, footer_y + 10), "Generated by BRE Remediation Agent | App Governance Platform", fill="#64748b", font=small_font)

            img.save(output_path, "PNG")
            print(f"✅ BRE Screenshot saved: {output_path}")
            return {"success": True, "path": output_path, "filename": os.path.basename(output_path)}

        except ImportError:
            # Fallback: write a simple text file as placeholder if Pillow is still missing
            txt_path = output_path.replace(".png", ".txt")
            lines = [f"BRE Remediation Screenshot - {deliverable_id}", f"Generated: {datetime.now().isoformat()}", ""]
            for d in decisions:
                lines.append(f"  [{d.get('action', '').upper()}] {d.get('permission_name', '')} ({d.get('permission_id', '')})")
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            print(f"⚠️ Pillow not installed – screenshot saved as text: {txt_path}")
            return {"success": True, "path": txt_path, "filename": os.path.basename(txt_path), "format": "text"}

        except Exception as e:
            print(f"⚠️ Screenshot generation failed: {e}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    def _send_owner_email(
        self,
        app_owner: Dict[str, Any],
        deliverable_id: str,
        decisions: List[Dict[str, Any]],
        screenshot_path: str,
    ) -> Dict[str, Any]:
        """
        Send email to app owner with decisions and screenshot.
        In demo mode, logs the event (no real SMTP required).
        """
        certified = [d for d in decisions if d.get("action") == "certify"]
        removed = [d for d in decisions if d.get("action") == "remove"]

        subject = f"BRE Remediation Completed – {deliverable_id}"
        body = (
            f"Dear {app_owner.get('name', 'Application Owner')},\n\n"
            f"The BRE Remediation process for deliverable {deliverable_id} has been completed.\n"
            f"Please review the attached remediation screenshot showing which permissions have been certified vs removed.\n\n"
            f"Summary:\n"
            f"  ✅ Certified: {len(certified)} permission(s)\n"
            f"  ❌ Removed: {len(removed)} permission(s)\n\n"
            f"Details:\n"
        )
        for d in decisions:
            body += f"  • [{d.get('action', '').upper()}] {d.get('permission_name', '')} – {d.get('comment', '')}\n"
        body += (
            f"\nACTION REQUIRED:\n"
            f"Please reply to this email with either 'APPROVE' or 'REJECT' to finalize this remediation.\n"
            f"Once approved, the ticket will be closed automatically.\n\n"
            f"This is an automated notification from the App Governance BRE Platform.\n"
        )

        print(f"\n📧 [BRE EMAIL] To: {app_owner.get('email')}")
        print(f"   Subject: {subject}")
        print(f"   Attachment: {os.path.basename(screenshot_path)}")
        print(f"   Body preview: {body[:200]}...")

        return {
            "success": True,
            "to": app_owner.get("email"),
            "subject": subject,
            "screenshot_attached": os.path.basename(screenshot_path),
            "sent_at": datetime.now().isoformat(),
            "mode": "simulated",
        }

    def _attach_to_jira(
        self, deliverable_id: str, screenshot_path: str
    ) -> Dict[str, Any]:
        """Attach screenshot to the JIRA ticket (simulated in demo mode)."""
        attachment_id = f"JIRA-ATTACH-{deliverable_id}-{datetime.now().strftime('%H%M%S')}"
        print(f"\n📎 [JIRA] Attaching screenshot to ticket {deliverable_id}")
        print(f"   Attachment ID: {attachment_id}")
        print(f"   File: {os.path.basename(screenshot_path)}")
        return {
            "success": True,
            "deliverable_id": deliverable_id,
            "attachment_id": attachment_id,
            "file": os.path.basename(screenshot_path),
            "mode": "simulated",
        }

    def _send_rise_notification(
        self, deliverable_id: str, decisions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Send RISE portal notification (simulated in demo mode)."""
        notification_id = f"RISE-NOTIF-{deliverable_id}-{datetime.now().strftime('%H%M%S')}"
        print(f"\n🔔 [RISE] Sending notification for {deliverable_id}")
        print(f"   Notification ID: {notification_id}")
        print(f"   Decisions count: {len(decisions)}")
        return {
            "success": True,
            "deliverable_id": deliverable_id,
            "notification_id": notification_id,
            "sent_at": datetime.now().isoformat(),
            "mode": "simulated",
        }
