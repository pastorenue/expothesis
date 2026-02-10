import React from 'react';
import { ExperimentStatus } from '../types';

interface StatusBadgeProps {
    status: ExperimentStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const getStatusStyle = () => {
        switch (status) {
            case ExperimentStatus.Running:
                return 'badge-success';
            case ExperimentStatus.Paused:
                return 'badge-warning';
            case ExperimentStatus.Stopped:
                return 'badge-danger';
            default:
                return 'badge-gray';
        }
    };

    return (
        <span className={`badge ${getStatusStyle()}`}>
            {status.toUpperCase()}
        </span>
    );
};

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, trend, icon }) => {
    const getTrendColor = () => {
        switch (trend) {
            case 'up':
                return 'text-success-600';
            case 'down':
                return 'text-danger-600';
            default:
                return 'text-gray-600';
        }
    };

    return (
        <div className="card animate-fade-in">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
                    {subtitle && (
                        <p className={`mt-1 text-sm ${getTrendColor()}`}>{subtitle}</p>
                    )}
                </div>
                {icon && (
                    <div className="rounded-full bg-primary-100 p-3 text-primary-600">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className="flex items-center justify-center p-4">
            <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-primary-600`} />
        </div>
    );
};

interface ProgressBarProps {
    current: number;
    total: number;
    label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label }) => {
    const percentage = Math.min((current / total) * 100, 100);
    const isComplete = current >= total;

    return (
        <div className="w-full">
            {label && (
                <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-600">
                        {current.toLocaleString()} / {total.toLocaleString()}
                    </span>
                </div>
            )}
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                    className={`h-full transition-all duration-500 ${isComplete ? 'bg-success-500' : 'bg-primary-600'
                        }`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

interface SignificanceIndicatorProps {
    pValue: number;
    alpha?: number;
}

export const SignificanceIndicator: React.FC<SignificanceIndicatorProps> = ({
    pValue,
    alpha = 0.05,
}) => {
    const isSignificant = pValue < alpha;

    return (
        <div className="flex items-center gap-2">
            <div
                className={`h-3 w-3 rounded-full ${isSignificant ? 'bg-success-500' : 'bg-gray-400'
                    }`}
            />
            <span className={`text-sm font-medium ${isSignificant ? 'text-success-700' : 'text-gray-600'
                }`}>
                {isSignificant ? 'Significant' : 'Not Significant'}
            </span>
            <span className="text-sm text-gray-500">
                (p = {pValue !== null && pValue !== undefined && !isNaN(pValue) ? pValue.toFixed(4) : '—'})
            </span>
        </div>
    );
};
