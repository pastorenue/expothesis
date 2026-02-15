export type FlowNode = {
    id: string;
    label: string;
    kind: 'trigger-start' | 'trigger-run' | 'experiment' | 'user-group' | 'hypothesis' | 'metric';
    x: number;
    y: number;
    data?: {
        experimentId?: string;
        groupId?: string;
        hypothesis?: string;
        metric?: string;
    };
};

export type FlowEdge = {
    from: string;
    to: string;
};
