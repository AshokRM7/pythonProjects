import { useState } from 'react';
import { FileCheck, Upload, CheckCircle, X } from 'lucide-react';
import { Ticket } from '../../App';

interface CollectEvidenceProps {
  ticket: Ticket;
  onComplete: () => void;
}

interface Evidence {
  id: string;
  name: string;
  type: string;
  uploadedDate: string;
  size: string;
}

export function CollectEvidence({ ticket, onComplete }: CollectEvidenceProps) {
  const [evidenceFiles, setEvidenceFiles] = useState<Evidence[]>([]);
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(false);

  const handleFileUpload = () => {
    // Simulate file upload
    const newFile: Evidence = {
      id: `file-${Date.now()}`,
      name: `IAM_Evidence_${ticket.id}_${evidenceFiles.length + 1}.pdf`,
      type: 'PDF Document',
      uploadedDate: new Date().toISOString(),
      size: '2.4 MB'
    };
    setEvidenceFiles([...evidenceFiles, newFile]);
  };

  const handleRemoveFile = (fileId: string) => {
    setEvidenceFiles(evidenceFiles.filter(f => f.id !== fileId));
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
          <FileCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-gray-900">Step 6: Collect Evidence</h3>
          <p className="text-sm text-gray-600">Gather completion evidence and documentation</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="text-sm text-gray-700 mb-3">Process Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-2 ml-4">
          <li>1. Wait for application owners to complete required actions</li>
          <li>2. Collect evidence and supporting documentation</li>
          <li>3. Verify all completion criteria are met</li>
          <li>4. Take screenshots or download proof as needed</li>
          <li>5. Prepare documentation for ticket closure</li>
        </ol>
      </div>

      <div className="space-y-4 mb-6">
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-700">Evidence Documents</p>
            <button
              onClick={handleFileUpload}
              disabled={verified}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Upload Evidence
            </button>
          </div>

          {evidenceFiles.length > 0 ? (
            <div className="space-y-2">
              {evidenceFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{file.type} • {file.size} • {new Date(file.uploadedDate).toLocaleString()}</p>
                    </div>
                  </div>
                  {!verified && (
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No evidence uploaded yet</p>
              <p className="text-xs text-gray-500 mt-1">Click "Upload Evidence" to add documentation</p>
            </div>
          )}
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <label className="block text-sm text-gray-700 mb-2">Evidence Summary Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={verified}
            placeholder="Summarize the evidence collected, completion status, and any relevant details..."
            className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            These notes will be attached to the ticket in RISE and JIRA
          </p>
        </div>

        {evidenceFiles.length > 0 && !verified && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900 mb-2">Verification Required</p>
            <p className="text-xs text-yellow-700">
              Please verify that all evidence is complete and accurate before proceeding to ticket closure.
            </p>
          </div>
        )}

        {verified && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-900">Evidence Collection Complete</p>
              <p className="text-xs text-blue-700 mt-1">
                All evidence has been collected and verified. {evidenceFiles.length} document(s) ready for attachment.
              </p>
            </div>
          </div>
        )}

        {verified && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm text-green-900 mb-2">Evidence Summary</h4>
            <div className="space-y-1 text-xs text-green-800">
              <p>• Total documents: {evidenceFiles.length}</p>
              <p>• Collected on: {new Date().toLocaleDateString()}</p>
              <p>• Ready for RISE and JIRA attachment</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          {evidenceFiles.length === 0 ? 'Upload evidence documents to proceed.' :
           !verified ? 'Verify all evidence is complete and accurate.' :
           'Evidence verified. Ready to close the ticket.'}
        </p>
        <div className="flex gap-3">
          {evidenceFiles.length > 0 && !verified && (
            <button
              onClick={handleVerify}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Verify Evidence
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
