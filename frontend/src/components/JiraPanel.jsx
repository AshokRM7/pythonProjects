import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJiraItem, addJiraComment, updateJiraStatus } from '../services/api';
import { MessageSquare, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const JiraPanel = ({ jiraId }) => {
    const [comment, setComment] = useState('');
    const queryClient = useQueryClient();

    const { data: jira, isLoading } = useQuery({
        queryKey: ['jira', jiraId],
        queryFn: () => getJiraItem(jiraId),
        enabled: !!jiraId,
    });

    const commentMutation = useMutation({
        mutationFn: (text) => addJiraComment(jiraId, text),
        onSuccess: () => {
            queryClient.invalidateQueries(['jira', jiraId]);
            setComment('');
            toast.success('Comment added to JIRA');
        },
    });

    const closeMutation = useMutation({
        mutationFn: () => updateJiraStatus(jiraId, 'Closed'),
        onSuccess: () => {
            queryClient.invalidateQueries(['jira', jiraId]);
            toast.success('JIRA item closed');
        },
    });

    if (isLoading) return <div className="animate-pulse h-48 bg-gray-100 rounded-lg"></div>;
    if (!jira) return null;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <img src="https://cdn.icon-icons.com/icons2/2699/PNG/512/atlassian_jira_logo_icon_170511.png" alt="Jira" className="w-5 h-5 mr-2" />
                    {jiraId}
                </h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${jira.status === 'Closed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {jira.status}
                </span>
            </div>

            <p className="text-sm text-gray-600 mb-4">{jira.summary}</p>

            <div className="space-y-3 mb-6 max-h-40 overflow-y-auto">
                {jira.comments.map((c, i) => (
                    <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-100 text-gray-700">
                        {c}
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add comment..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                        onClick={() => commentMutation.mutate(comment)}
                        disabled={!comment.trim() || commentMutation.isPending}
                        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
                    >
                        <MessageSquare className="w-4 h-4" />
                    </button>
                </div>

                {jira.status !== 'Closed' && (
                    <button
                        onClick={() => closeMutation.mutate()}
                        disabled={closeMutation.isPending}
                        className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        {closeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Close JIRA Item
                    </button>
                )}
            </div>
        </div>
    );
};

export default JiraPanel;
