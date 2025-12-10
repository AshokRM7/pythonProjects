import { useState } from 'react';
import { Building2, CheckCircle, Search } from 'lucide-react';
import { Ticket } from '../../App';

interface AppHQStepProps {
  ticket: Ticket;
  onComplete: () => void;
}

interface AppOwnerDetails {
  appOwner: string;
  appOwnerEmail: string;
  aitOwner: string;
  aitOwnerEmail: string;
  lobOwner: string;
  lobOwnerEmail: string;
  businessUnit: string;
}

export function AppHQStep({ ticket, onComplete }: AppHQStepProps) {
  const [ownerDetails, setOwnerDetails] = useState<AppOwnerDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleLookup = () => {
    setLoading(true);
    // Simulate API call to AppHQ portal
    setTimeout(() => {
      setOwnerDetails({
        appOwner: 'John Smith',
        appOwnerEmail: 'john.smith@company.com',
        aitOwner: 'Sarah Johnson',
        aitOwnerEmail: 'sarah.johnson@company.com',
        lobOwner: 'Michael Chen',
        lobOwnerEmail: 'michael.chen@company.com',
        businessUnit: 'Finance Operations'
      });
      setLoading(false);
    }, 1500);
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
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 3: AppHQ Lookup</h3>
          <p className="text-sm text-gray-600">Retrieve application owner details</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Access the AppHQ portal</li>
          <li>2. Enter the AIT number associated with the deliverable</li>
          <li>3. Retrieve Application Owner, AIT Owner, and LOB Owner details</li>
          <li>4. Document contact information for email communication</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Application ID</p>
              <p className="text-xl text-gray-900">{ticket.appId}</p>
            </div>
            {!ownerDetails && (
              <button
                onClick={handleLookup}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Looking up...' : 'Lookup in AppHQ'}
              </button>
            )}
          </div>
        </div>

        {ownerDetails && (
          <>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <p className="text-sm text-gray-700">Application Owner Details</p>
              </div>
              <div className="divide-y divide-gray-200">
                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="text-xs text-gray-600">Application Owner</p>
                    <p className="text-sm text-gray-900">{ownerDetails.appOwner}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Email</p>
                    <p className="text-sm text-blue-600">{ownerDetails.appOwnerEmail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="text-xs text-gray-600">AIT Owner</p>
                    <p className="text-sm text-gray-900">{ownerDetails.aitOwner}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Email</p>
                    <p className="text-sm text-blue-600">{ownerDetails.aitOwnerEmail}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4">
                  <div>
                    <p className="text-xs text-gray-600">LOB Owner</p>
                    <p className="text-sm text-gray-900">{ownerDetails.lobOwner}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Email</p>
                    <p className="text-sm text-blue-600">{ownerDetails.lobOwnerEmail}</p>
                  </div>
                </div>

                <div className="p-4">
                  <p className="text-xs text-gray-600">Business Unit</p>
                  <p className="text-sm text-gray-900">{ownerDetails.businessUnit}</p>
                </div>
              </div>
            </div>

            {!verified && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900 mb-2">Verification Required</p>
                <p className="text-xs text-yellow-700">
                  Please verify that the owner details are correct and up-to-date before proceeding.
                </p>
              </div>
            )}

            {verified && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">Owner Details Verified</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Contact information retrieved and verified. Ready to proceed to review.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {!ownerDetails ? 'Look up owner details from AppHQ portal.' :
           !verified ? 'Verify the owner information is accurate.' :
           'Owner details confirmed. Ready to proceed.'}
        </p>
        <div className="flex gap-3">
          {ownerDetails && !verified && (
            <button
              onClick={handleVerify}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Verify Details
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
