import React from 'react';

type DebugReplayPanelProps = {
    debugSessionId: string;
    onChangeSessionId: (value: string) => void;
    onInspect: () => void;
    debugInfo: string;
};

export const DebugReplayPanel: React.FC<DebugReplayPanelProps> = ({
    debugSessionId,
    onChangeSessionId,
    onInspect,
    debugInfo,
}) => {
    return (
        <div className="card session-panel">
            <div className="session-panel-header">
                <div>
                    <h3>Debug replay</h3>
                    <p>Inspect stored replay events for a specific session id.</p>
                </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                    className="input flex-1"
                    placeholder="Session id (e.g., ff270994)"
                    value={debugSessionId}
                    onChange={(event) => onChangeSessionId(event.target.value)}
                />
                <button className="btn-secondary" onClick={onInspect}>
                    Inspect replay
                </button>
            </div>
            {debugInfo && <div className="session-debug text-slate-300">{debugInfo}</div>}
        </div>
    );
};
