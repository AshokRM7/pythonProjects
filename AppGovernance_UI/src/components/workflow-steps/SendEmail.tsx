import { useState } from 'react';
import { Mail, CheckCircle, Send } from 'lucide-react';
import { Ticket } from '../../App';

interface SendEmailProps {
  ticket: Ticket;
  onComplete: () => void;
}

export function SendEmail({ ticket, onComplete }: SendEmailProps) {
  const [emailDraft, setEmailDraft] = useState(`Dear Application Owner,

This is to notify you about the following IAM deliverable that requires your attention:

Ticket ID: ${ticket.id}
Application ID: ${ticket.appId}
Title: ${ticket.title}
Priority: ${ticket.priority}
SLA Deadline: ${new Date(ticket.slaDeadline).toLocaleDateString()}

Description:
${ticket.description}

Required Actions:
• Review the IAM deliverable details
• Complete any pending access management tasks
• Provide evidence of completion
• Submit supporting documentation

Please complete the required actions and provide evidence by the SLA deadline to ensure compliance with Identity and Access Management requirements.

If you have any questions or need assistance, please contact the Application Governance team.

Best regards,
Application Governance Team`);

  const [recipients, setRecipients] = useState('john.smith@company.com; sarah.johnson@company.com; michael.chen@company.com');
  const [ccRecipients, setCcRecipients] = useState('app.governance@company.com');
  const [subject, setSubject] = useState(`IAM Deliverable - Action Required: ${ticket.id}`);
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendEmail = () => {
    setSending(true);
    // Simulate email sending
    setTimeout(() => {
      setEmailSent(true);
      setSending(false);
    }, 2000);
  };

  const handleProceed = () => {
    onComplete();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 5: Send Email</h3>
          <p className="text-sm text-gray-600">Email app owners with deliverable details</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Review the email draft with deliverable summary</li>
          <li>2. Verify recipient list includes all stakeholders</li>
          <li>3. Highlight high-priority items if applicable</li>
          <li>4. Clearly specify required actions and timeline</li>
          <li>5. Send email and log communication in RISE and JIRA</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm text-gray-700 mb-2">To:</label>
          <input
            type="text"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            disabled={emailSent}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm text-gray-700 mb-2">CC:</label>
          <input
            type="text"
            value={ccRecipients}
            onChange={(e) => setCcRecipients(e.target.value)}
            disabled={emailSent}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm text-gray-700 mb-2">Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={emailSent}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm text-gray-700 mb-2">Email Body:</label>
          <textarea
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            disabled={emailSent}
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:bg-gray-50 resize-none"
          />
        </div>

        {ticket.priority === 'High' && !emailSent && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50 border border-orange-200">
            <Mail className="w-5 h-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-orange-900">High Priority Deliverable</p>
              <p className="text-xs text-orange-700 mt-1">
                Make sure to emphasize the urgency and SLA deadline in your communication
              </p>
            </div>
          </div>
        )}

        {emailSent && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900">Email Sent Successfully</p>
              <p className="text-xs text-blue-700 mt-1">
                Email has been sent to all stakeholders. Communication logged in tracking system.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {!emailSent ? 'Review the email content and send to stakeholders.' : 'Email sent. Ready to collect evidence.'}
        </p>
        <div className="flex gap-3">
          {!emailSent ? (
            <button
              onClick={handleSendEmail}
              disabled={sending}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          ) : (
            <button
              onClick={handleProceed}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Proceed to Next Step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
