import React from 'react';

type StepIndicatorProps = {
    step: number;
};

const STEPS = ['Basics', 'Hypothesis', 'Variants', 'Review'];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ step }) => {
    return (
        <div className="mb-8 flex justify-between">
            {STEPS.map((label, idx) => (
                <div key={label} className="flex flex-1 items-start">
                    <div className="flex flex-col items-center">
                        <div
                            className={`step-circle flex h-10 w-10 items-center justify-center rounded-full ${
                                step > idx + 1
                                    ? 'bg-emerald-400 text-slate-900'
                                    : step === idx + 1
                                    ? 'bg-cyan-400 text-slate-900'
                                    : 'bg-slate-800 text-slate-400'
                            }`}
                        >
                            {step > idx + 1 ? '✓' : idx + 1}
                        </div>
                        <span className="mt-2 text-sm font-medium text-slate-300">{label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                        <div
                            className={`step-connector mx-4 mt-5 h-1 flex-1 rounded-full ${
                                step > idx + 1 ? 'step-connector-active' : 'step-connector-inactive'
                            }`}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};
