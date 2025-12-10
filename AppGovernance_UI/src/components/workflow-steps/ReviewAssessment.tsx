import { useState } from 'react';
import { FileSearch, CheckCircle, AlertCircle } from 'lucide-react';
import { Ticket } from '../../App';

interface ReviewAssessmentProps {
  ticket: Ticket;
  onComplete: () => void;
}

interface ARMTicket {
  id: string;
  status: string;
  autoProvisioned: boolean;
  completedDate?: string;
}

export function ReviewAssessment({ ticket, onComplete }: ReviewAssessmentProps) {
  const [armTickets, setArmTickets] = useState<ARMTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [verified, setVerified] = useState(false);

  const handleCheckARM = () => {
    setLoading(true);
    // Simulate ARM ticket lookup
    setTimeout(() => {
      setArmTickets([
        {
          id: 'ARM-2024-5678',
          status: 'Completed',
          autoProvisioned: true,
          completedDate: '2024-12-05'
        },
        {
          id: 'ARM-2024-5679',
          status: 'In Progress',
          autoProvisioned: false
        }
      ]);
      setLoading(false);
    }, 1500);
  };

  const handleMarkReviewed = () => {
    setReviewed(true);
  };

  const handleVerify = () => {
    setVerified(true);
  };

  const handleProceed = () => {
    onComplete();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileSearch className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 4: Review & Assessment</h3>
          <p className="text-sm text-gray-600">Review ticket details and check ARM tickets</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Thoroughly review all details provided in the RISE ticket</li>
          <li>2. Check corresponding ARM (Access Request Management) tickets</li>
          <li>3. Verify if auto-provisioning has been completed</li>
          <li>4. Document assessment notes and required actions</li>
          <li>5. Prepare summary for application owners</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-700">RISE Ticket Details</p>
            {!reviewed && (
              <button
                onClick={handleMarkReviewed}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Mark as Reviewed
              </button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Ticket ID:</span>
              <span className="text-gray-900">{ticket.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Category:</span>
              <span className="text-gray-900">{ticket.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created By:</span>
              <span className="text-gray-900">{ticket.createdBy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created Date:</span>
              <span className="text-gray-900">{new Date(ticket.createdDate).toLocaleDateString()}</span>
            </div>
          </div>
          {reviewed && (
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Ticket details reviewed</span>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-700">ARM Ticket Verification</p>
            {armTickets.length === 0 && (
              <button
                onClick={handleCheckARM}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check ARM Tickets'}
              </button>
            )}
          </div>

          {armTickets.length > 0 ? (
            <div className="space-y-2">
              {armTickets.map((arm) => (
                <div key={arm.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-900">{arm.id}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      arm.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {arm.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {arm.autoProvisioned ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-green-700">Auto-provisioning completed</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-xs text-yellow-700">Manual provisioning required</span>
                      </>
                    )}
                  </div>
                  {arm.completedDate && (
                    <p className="text-xs text-gray-600 mt-1">Completed: {new Date(arm.completedDate).toLocaleDateString()}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Click to check for related ARM tickets</p>
          )}
        </div>

        {reviewed && armTickets.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4">
            <label className="block text-sm text-gray-700 mb-2">Assessment Notes</label>
            <textarea
              value={assessmentNotes}
              onChange={(e) => setAssessmentNotes(e.target.value)}
              placeholder="Document your findings, required actions, and any important observations..."
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              These notes will be included in the communication to application owners
            </p>
          </div>
        )}

        {verified && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900">Review & Assessment Complete</p>
              <p className="text-xs text-blue-700 mt-1">
                All ticket details reviewed and ARM tickets verified. Ready to send email to app owners.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {!reviewed ? 'Review ticket details and mark as reviewed.' :
           armTickets.length === 0 ? 'Check ARM tickets to verify auto-provisioning status.' :
           !verified ? 'Add assessment notes and verify to continue.' :
           'Assessment complete. Ready to proceed.'}
        </p>
        <div className="flex gap-3">
          {reviewed && armTickets.length > 0 && !verified && (
            <button
              onClick={handleVerify}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Verify Assessment
            </button>
          )}
          {verified && (
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
