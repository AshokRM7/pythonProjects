import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle, Edit2, Save } from 'lucide-react';
import { Ticket } from '../../App';

interface SLAVerificationProps {
  ticket: Ticket;
  onComplete: () => void;
}

export function SLAVerification({ ticket, onComplete }: SLAVerificationProps) {
  const [verified, setVerified] = useState(false);
  const [priorityConfirmed, setPriorityConfirmed] = useState(false);
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [editedDeadline, setEditedDeadline] = useState(ticket.slaDeadline);
  const [editedPriority, setEditedPriority] = useState<'High' | 'Medium' | 'Low'>(ticket.priority);

  const calculateDaysRemaining = (deadline: string) => {
    const today = new Date();
    const slaDate = new Date(deadline);
    const diffTime = slaDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = calculateDaysRemaining(editedDeadline);
  const isUrgent = daysRemaining <= 3;
  const isOverdue = daysRemaining < 0;

  const getSLAStatus = () => {
    if (isOverdue) return { text: 'Overdue', color: 'red' };
    if (isUrgent) return { text: 'Urgent', color: 'orange' };
    return { text: 'On Track', color: 'green' };
  };

  const slaStatus = getSLAStatus();

  const handleSaveDeadline = () => {
    setIsEditingDeadline(false);
  };

  const handleSavePriority = () => {
    setIsEditingPriority(false);
  };

  const handleVerify = () => {
    setVerified(true);
  };

  const handleConfirmPriority = () => {
    setPriorityConfirmed(true);
  };

  const handleProceed = () => {
    onComplete();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 2: SLA Verification</h3>
          <p className="text-sm text-gray-600">Check and prioritize based on SLA deadline</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Review the SLA deadline for this deliverable</li>
          <li>2. Calculate days remaining until deadline</li>
          <li>3. Determine priority level based on timeline</li>
          <li>4. High-priority items (SLA {'\u2264'} 3 days) should be addressed first</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">SLA Deadline</p>
              {!verified && !isEditingDeadline && (
                <button
                  onClick={() => setIsEditingDeadline(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {isEditingDeadline && (
                <button
                  onClick={handleSaveDeadline}
                  className="text-green-600 hover:text-green-700"
                >
                  <Save className="w-4 h-4" />
                </button>
              )}
            </div>
            {isEditingDeadline ? (
              <input
                type="date"
                value={editedDeadline}
                onChange={(e) => setEditedDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <>
                <p className="text-xl text-gray-900">{new Date(editedDeadline).toLocaleDateString()}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(editedDeadline).toLocaleDateString('en-US', { weekday: 'long' })}</p>
              </>
            )}
          </div>

          <div className={`border rounded-lg p-4 ${
            slaStatus.color === 'red' ? 'bg-red-50 border-red-200' :
            slaStatus.color === 'orange' ? 'bg-orange-50 border-orange-200' :
            'bg-green-50 border-green-200'
          }`}>
            <p className="text-sm text-gray-600 mb-1">Days Remaining</p>
            <p className={`text-xl ${
              slaStatus.color === 'red' ? 'text-red-900' :
              slaStatus.color === 'orange' ? 'text-orange-900' :
              'text-green-900'
            }`}>
              {isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
            </p>
            <p className={`text-xs mt-1 ${
              slaStatus.color === 'red' ? 'text-red-700' :
              slaStatus.color === 'orange' ? 'text-orange-700' :
              'text-green-700'
            }`}>
              Status: {slaStatus.text}
            </p>
          </div>
        </div>

        {!verified && (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Priority Level</p>
              {!isEditingPriority && (
                <button
                  onClick={() => setIsEditingPriority(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {isEditingPriority && (
                <button
                  onClick={handleSavePriority}
                  className="text-green-600 hover:text-green-700"
                >
                  <Save className="w-4 h-4" />
                </button>
              )}
            </div>
            {isEditingPriority ? (
              <select
                value={editedPriority}
                onChange={(e) => setEditedPriority(e.target.value as 'High' | 'Medium' | 'Low')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded text-sm ${
                  editedPriority === 'High' ? 'bg-red-100 text-red-800' :
                  editedPriority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {editedPriority}
                </span>
                {(isUrgent || isOverdue) && editedPriority !== 'High' && (
                  <span className="text-xs text-orange-600">Consider changing to High priority</span>
                )}
              </div>
            )}
          </div>
        )}

        {!verified && (isUrgent || isOverdue) && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-900">
                {isOverdue ? 'SLA Deadline Exceeded' : 'Urgent: Approaching SLA Deadline'}
              </p>
              <p className="text-xs text-red-700 mt-1">
                This deliverable requires immediate attention to avoid non-compliance
              </p>
            </div>
          </div>
        )}

        {verified && !priorityConfirmed && (
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-3">Confirm Priority Level:</p>
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-sm text-gray-900">Current Priority: {ticket.priority}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {isUrgent || isOverdue ? 'Recommend changing to High priority' : 'Priority level is appropriate'}
                </p>
              </div>
              <button
                onClick={handleConfirmPriority}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Confirm Priority
              </button>
            </div>
          </div>
        )}

        {verified && priorityConfirmed && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900">SLA Verification Complete</p>
              <p className="text-xs text-blue-700 mt-1">
                Priority confirmed. Ready to proceed to AppHQ lookup.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {!verified ? 'Review SLA information and verify timeline.' :
           !priorityConfirmed ? 'Confirm the priority level to continue.' :
           'SLA verified. Ready to proceed.'}
        </p>
        <div className="flex gap-3">
          {!verified ? (
            <button
              onClick={handleVerify}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Verify SLA
            </button>
          ) : priorityConfirmed ? (
            <button
              onClick={handleProceed}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Proceed to Next Step
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}