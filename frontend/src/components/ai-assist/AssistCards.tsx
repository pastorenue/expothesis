import React from 'react';
import { Link } from 'react-router-dom';

type AssistCard = {
    title: string;
    badge: string;
    description: string;
    link: string;
    linkText: string;
};

type AssistCardsProps = {
    cards: AssistCard[];
};

const DEFAULT_CARDS: AssistCard[] = [
    {
        title: 'Experiment Insights',
        badge: 'Auto-summary',
        description: 'Generate live summaries, highlight winners, and identify statistical risks.',
        link: '/dashboard',
        linkText: 'Open Experiments →',
    },
    {
        title: 'Hypothesis + Metrics',
        badge: 'Create flow',
        description: 'Suggest primary metrics and auto-draft hypotheses based on experiment type.',
        link: '/dashboard?new=1',
        linkText: 'Create Experiment →',
    },
    {
        title: 'Alert Triage',
        badge: 'Insights',
        description: 'Summarize alert feeds, SRM risks, and guardrail anomalies.',
        link: '/insights',
        linkText: 'View Insights →',
    },
    {
        title: 'Targeting Rule Copilot',
        badge: 'User Groups',
        description: 'Convert plain-language targeting ideas into JSON rules.',
        link: '/user-groups',
        linkText: 'Manage User Groups →',
    },
    {
        title: 'Feature Gate Rollout Advisor',
        badge: 'Flags + Gates',
        description: 'Recommended rollout steps based on gate status, linked experiments, and guardrails.',
        link: '/feature-flags',
        linkText: 'Open Feature Flags →',
    },
];

export const AssistCards: React.FC<AssistCardsProps> = ({ cards }) => {
    return (
        <div className="space-y-6">
            {(cards.length ? cards : DEFAULT_CARDS).map((card) => (
                <div key={card.title} className="card">
                    <div className="flex items-center justify-between">
                        <h3>{card.title}</h3>
                        <span className="badge-gray">{card.badge}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{card.description}</p>
                    <Link to={card.link} className="mt-4 inline-flex items-center text-cyan-300 hover:text-cyan-200">
                        {card.linkText}
                    </Link>
                </div>
            ))}
        </div>
    );
};
