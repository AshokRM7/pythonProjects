import { useState } from 'react';
import { CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { Ticket } from '../../App';

interface CategoryCheckProps {
  ticket: Ticket;
  onComplete: () => void;
}

export function CategoryCheck({ ticket, onComplete }: CategoryCheckProps) {
  const [verified, setVerified] = useState(false);

  const isIAM = ticket.category === 'IAM';

  const handleVerify = () => {
    if (isIAM) {
      setVerified(true);
    }
  };

  const handleProceed = () => {
    onComplete();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 1: Category Check</h3>
          <p className="text-sm text-gray-600">Verify the ticket belongs to IAM category</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Open the ticket in RISE tool</li>
          <li>2. Review the Deliverable Description section</li>
          <li>3. Under the Product field, look for Category: IAM</li>
          <li>4. Confirm if the product category is listed as IAM</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm text-gray-600">Ticket ID</p>
              <p className="text-gray-900">{ticket.id}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Category</p>
              <p className="text-gray-900">{ticket.category}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Description</p>
            <p className="text-gray-900">{ticket.description}</p>
          </div>
        </div>

        {!verified ? (
          <div className={`flex items-start gap-3 p-4 rounded-lg ${isIAM ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            {isIAM ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-900">Category Matches IAM</p>
                  <p className="text-xs text-green-700 mt-1">This ticket is valid for IAM deliverable processing</p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-900">Category Does Not Match IAM</p>
                  <p className="text-xs text-yellow-700 mt-1">This ticket should be reassigned to the appropriate team</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900">Verification Complete</p>
              <p className="text-xs text-blue-700 mt-1">Category has been verified as IAM. Ready to proceed to SLA verification.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {verified ? 'Verification confirmed. You can now proceed.' : 'Review the category and click verify to continue.'}
        </p>
        <div className="flex gap-3">
          {!verified ? (
            <button
              onClick={handleVerify}
              disabled={!isIAM}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Verify Category
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
