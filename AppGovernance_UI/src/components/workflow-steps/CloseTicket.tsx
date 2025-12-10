import { useState } from 'react';
import { CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import { Ticket } from '../../App';

interface CloseTicketProps {
  ticket: Ticket;
  onComplete: () => void;
  onBack: () => void;
}

export function CloseTicket({ ticket, onComplete, onBack }: CloseTicketProps) {
  const [riseUpdated, setRiseUpdated] = useState(false);
  const [jiraUpdated, setJiraUpdated] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [ticketClosed, setTicketClosed] = useState(false);

  const handleUpdateRISE = () => {
    // Simulate RISE update
    setTimeout(() => {
      setRiseUpdated(true);
    }, 1000);
  };

  const handleUpdateJIRA = () => {
    // Simulate JIRA update
    setTimeout(() => {
      setJiraUpdated(true);
    }, 1000);
  };

  const handleCloseTicket = () => {
    setTicketClosed(true);
  };

  const handleFinish = () => {
    onComplete();
    setTimeout(() => {
      onBack();
    }, 500);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 7: Close Ticket</h3>
          <p className="text-sm text-gray-600">Close ticket in RISE and JIRA with evidence</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Return to the RISE ticket</li>
          <li>2. Attach all collected documentation and screenshots</li>
          <li>3. Add closure notes summarizing the completion</li>
          <li>4. Close the RISE ticket with appropriate status</li>
          <li>5. Update the associated JIRA story with same evidence</li>
          <li>6. Mark the JIRA story as closed</li>
          <li>7. Log final update in daily tracking system</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm text-gray-700 mb-2">Ticket Closure Notes</label>
          <textarea
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            disabled={ticketClosed}
            placeholder="Enter closure notes summarizing the deliverable completion, evidence collected, and final status..."
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`border rounded-lg p-4 ${riseUpdated ? 'bg-green-50 border-green-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className={`w-5 h-5 ${riseUpdated ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm text-gray-900">RISE Ticket</p>
                  <p className="text-xs text-gray-600">{ticket.id}</p>
                </div>
              </div>
              {riseUpdated && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
            
            {!riseUpdated ? (
              <div>
                <p className="text-xs text-gray-600 mb-3">Attach evidence and close the RISE ticket</p>
                <button
                  onClick={handleUpdateRISE}
                  disabled={ticketClosed}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Update & Close in RISE
                </button>
              </div>
            ) : (
              <div className="bg-white rounded p-2 border border-green-200">
                <p className="text-xs text-green-800">✓ Evidence attached</p>
                <p className="text-xs text-green-800">✓ Closure notes added</p>
                <p className="text-xs text-green-800">✓ Ticket closed successfully</p>
              </div>
            )}
          </div>

          <div className={`border rounded-lg p-4 ${jiraUpdated ? 'bg-green-50 border-green-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className={`w-5 h-5 ${jiraUpdated ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <p className="text-sm text-gray-900">JIRA Story</p>
                  <p className="text-xs text-gray-600">{ticket.jiraStory}</p>
                </div>
              </div>
              {jiraUpdated && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
            
            {!jiraUpdated ? (
              <div>
                <p className="text-xs text-gray-600 mb-3">Attach evidence and close the JIRA story</p>
                <button
                  onClick={handleUpdateJIRA}
                  disabled={ticketClosed || !riseUpdated}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  Update & Close in JIRA
                </button>
              </div>
            ) : (
              <div className="bg-white rounded p-2 border border-green-200">
                <p className="text-xs text-green-800">✓ Evidence attached</p>
                <p className="text-xs text-green-800">✓ Story updated</p>
                <p className="text-xs text-green-800">✓ Story marked as closed</p>
              </div>
            )}
          </div>
        </div>

        {riseUpdated && jiraUpdated && !ticketClosed && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900 mb-2">Ready to Complete</p>
            <p className="text-xs text-yellow-700">
              Both RISE and JIRA have been updated. Click "Close Ticket" to finalize the process and log to the tracking system.
            </p>
          </div>
        )}

        {ticketClosed && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-900">IAM Deliverable Process Complete</p>
              <p className="text-xs text-green-700 mt-1">
                Ticket {ticket.id} has been successfully closed in both RISE and JIRA with all evidence attached. Daily tracking log updated.
              </p>
            </div>
          </div>
        )}
      </div>

      {ticketClosed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="text-sm text-blue-900 mb-3">Process Summary</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-blue-700">✓ Category verified (IAM)</p>
              <p className="text-blue-700">✓ SLA timeline assessed</p>
              <p className="text-blue-700">✓ App owners contacted</p>
            </div>
            <div>
              <p className="text-blue-700">✓ Evidence collected</p>
              <p className="text-blue-700">✓ RISE ticket closed</p>
              <p className="text-blue-700">✓ JIRA story closed</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {!riseUpdated ? 'Update and close the RISE ticket first.' :
           !jiraUpdated ? 'Now update and close the JIRA story.' :
           !ticketClosed ? 'Finalize the ticket closure process.' :
           'Process completed successfully!'}
        </p>
        <div className="flex gap-3">
          {riseUpdated && jiraUpdated && !ticketClosed && (
            <button
              onClick={handleCloseTicket}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close Ticket
            </button>
          )}
          {ticketClosed && (
            <button
              onClick={handleFinish}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
