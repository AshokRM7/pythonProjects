import React from 'react';

const StatusBadge = ({ status }) => {
    const getColors = (status) => {
        switch (status?.toLowerCase()) {
            case 'new':
                return 'bg-blue-100 text-blue-800';
            case 'in progress':
                return 'bg-yellow-100 text-yellow-800';
            case 'closed':
                return 'bg-green-100 text-green-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getColors(status)}`}>
            {status}
        </span>
    );
};

export default StatusBadge;
