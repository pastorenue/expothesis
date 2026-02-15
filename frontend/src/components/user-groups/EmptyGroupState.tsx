import React from 'react';

type EmptyGroupStateProps = {
    hasGroups: boolean;
    showCreateForm: boolean;
};

export const EmptyGroupState: React.FC<EmptyGroupStateProps> = ({ hasGroups, showCreateForm }) => {
    if (hasGroups || showCreateForm) return null;

    return (
        <div className="card text-center">
            <p className="text-slate-400">No user groups yet. Create your first group to get started!</p>
        </div>
    );
};
