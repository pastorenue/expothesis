import React from 'react';

type StepNavigationProps = {
    step: number;
    onPrev: () => void;
    onNext: () => void;
    onCancel: () => void;
    onSubmit: () => void;
};

export const StepNavigation: React.FC<StepNavigationProps> = ({
    step,
    onPrev,
    onNext,
    onCancel,
    onSubmit,
}) => {
    return (
        <div className="mt-8 flex justify-between">
            {step > 1 ? (
                <button onClick={onPrev} className="btn-secondary">
                    ← Previous
                </button>
            ) : (
                <button onClick={onCancel} className="btn-secondary">
                    Cancel
                </button>
            )}

            {step < 4 ? (
                <button onClick={onNext} className="btn-primary">
                    Next →
                </button>
            ) : (
                <button onClick={onSubmit} className="btn-success">
                    Create Experiment
                </button>
            )}
        </div>
    );
};
