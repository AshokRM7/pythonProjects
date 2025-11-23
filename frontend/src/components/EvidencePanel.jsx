import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addEvidence } from '../services/api';
import { Plus, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EvidencePanel = ({ ticketId, evidence }) => {
    const [newEvidence, setNewEvidence] = useState('');
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: (text) => addEvidence(ticketId, text),
        onSuccess: () => {
            queryClient.invalidateQueries(['ticket', ticketId]);
            setNewEvidence('');
            toast.success('Evidence added successfully');
        },
        onError: () => {
            toast.error('Failed to add evidence');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newEvidence.trim()) return;
        mutation.mutate(newEvidence);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Evidence
            </h3>

            <div className="space-y-3 mb-6">
                {evidence && evidence.length > 0 ? (
                    evidence.map((item, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200 text-sm text-gray-700">
                            {item}
                        </div>
                    ))
                ) : (
                    <div className="text-gray-400 text-sm italic">No evidence attached yet.</div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={newEvidence}
                    onChange={(e) => setNewEvidence(e.target.value)}
                    placeholder="Add evidence URL or description..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                    type="submit"
                    disabled={mutation.isPending || !newEvidence.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
            </form>
        </div>
    );
};

export default EvidencePanel;
