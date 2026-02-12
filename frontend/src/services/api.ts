import axios from 'axios';
import type {
    Experiment,
    CreateExperimentRequest,
    ExperimentAnalysis,
    UserGroup,
    CreateUserGroupRequest,
    MoveUserGroupRequest,
    IngestEventRequest,
    AssignUserRequest,
    MetricEvent,
    FeatureFlag,
    FeatureGate,
    CreateFeatureFlagRequest,
    UpdateFeatureFlagRequest,
    CreateFeatureGateRequest,
    EvaluateFeatureGateRequest,
    FeatureGateEvaluationResponse,
    Session,
    ActivityEvent,
    StartSessionRequest,
    StartSessionResponse,
    EndSessionRequest,
    TrackEventRequest,
    TrackReplayRequest,
    ListSessionsResponse,
} from '../types';

const API_BASE = 'http://localhost:8080/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

const TRACKING_KEY = import.meta.env.VITE_TRACKING_KEY;
const trackingHeaders = TRACKING_KEY ? { 'x-expothesis-key': TRACKING_KEY } : undefined;

// Experiments
export const experimentApi = {
    create: (data: CreateExperimentRequest) =>
        api.post<Experiment>('/experiments', data),

    list: () =>
        api.get<Experiment[]>('/experiments'),

    get: (id: string) =>
        api.get<Experiment>(`/experiments/${id}`),

    start: (id: string) =>
        api.post<Experiment>(`/experiments/${id}/start`),

    pause: (id: string) =>
        api.post<Experiment>(`/experiments/${id}/pause`),

    stop: (id: string) =>
        api.post<Experiment>(`/experiments/${id}/stop`),

    getAnalysis: (id: string) =>
        api.get<ExperimentAnalysis>(`/experiments/${id}/analysis`),
};

// Events
export const eventApi = {
    ingest: (data: IngestEventRequest) =>
        api.post<MetricEvent>('/events', data),
};

// User Groups
export const userGroupApi = {
    create: (data: CreateUserGroupRequest) =>
        api.post<UserGroup>('/user-groups', data),

    list: () =>
        api.get<UserGroup[]>('/user-groups'),

    get: (id: string) =>
        api.get<UserGroup>(`/user-groups/${id}`),

    move: (id: string, data: MoveUserGroupRequest) =>
        api.post(`/user-groups/${id}/move`, data),

    getMetrics: (id: string) =>
        api.get(`/user-groups/${id}/metrics`),

    assign: (data: AssignUserRequest) =>
        api.post('/user-groups/assign', data),
};

// Feature Flags
export const featureFlagApi = {
    create: (data: CreateFeatureFlagRequest) =>
        api.post<FeatureFlag>('/feature-flags', data),

    list: () =>
        api.get<FeatureFlag[]>('/feature-flags'),

    get: (id: string) =>
        api.get<FeatureFlag>(`/feature-flags/${id}`),

    update: (id: string, data: UpdateFeatureFlagRequest) =>
        api.put<FeatureFlag>(`/feature-flags/${id}`, data),

    delete: (id: string) =>
        api.delete<void>(`/feature-flags/${id}`),
};

// Feature Gates
export const featureGateApi = {
    create: (data: CreateFeatureGateRequest) =>
        api.post<FeatureGate>('/feature-gates', data),

    list: (flagId?: string) =>
        api.get<FeatureGate[]>('/feature-gates', { params: flagId ? { flag_id: flagId } : {} }),

    get: (id: string) =>
        api.get<FeatureGate>(`/feature-gates/${id}`),

    evaluate: (id: string, data: EvaluateFeatureGateRequest) =>
        api.post<FeatureGateEvaluationResponse>(`/feature-gates/${id}/evaluate`, data),
};

// Tracking
export const trackApi = {
    startSession: (data: StartSessionRequest) =>
        api.post<StartSessionResponse>('/track/session/start', data, { headers: trackingHeaders }),

    endSession: (data: EndSessionRequest) =>
        api.post<Session>('/track/session/end', data, { headers: trackingHeaders }),

    trackEvent: (data: TrackEventRequest) =>
        api.post<ActivityEvent>('/track/event', data, { headers: trackingHeaders }),

    trackReplay: (data: TrackReplayRequest) =>
        api.post('/track/replay', data, { headers: trackingHeaders }),

    listSessions: (limit = 20, offset = 0, signal?: AbortSignal) =>
        api.get<ListSessionsResponse>('/track/sessions', { params: { limit, offset }, headers: trackingHeaders, signal }),

    getReplay: (sessionId: string, limit = 1200, offset = 0, signal?: AbortSignal) =>
        api.get<Record<string, any>[]>(`/track/replay/${sessionId}`, { params: { limit, offset }, headers: trackingHeaders, signal }),

    listEvents: (sessionId: string, eventType?: string, limit = 200, signal?: AbortSignal) =>
        api.get<ActivityEvent[]>('/track/events', { params: { session_id: sessionId, event_type: eventType, limit }, headers: trackingHeaders, signal }),
};

export default api;
