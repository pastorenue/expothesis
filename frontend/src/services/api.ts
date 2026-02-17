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
    AnalyticsOverviewResponse,
    CupedConfig,
    CupedConfigRequest,
    UpdateUserGroupRequest,
    AiChatRequest,
    AiChatResponse,
    AiModelsResponse,
    RegisterRequest,
    LoginRequest,
    VerifyOtpRequest,
    AuthStatusResponse,
    AuthTokenResponse,
    TotpSetupResponse,
    SdkTokensResponse,
    RotateSdkTokensRequest,
    AuthUserProfile,
    Organization,
} from '../types';

const API_BASE = 'http://localhost:8080/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = window.localStorage.getItem('expothesis-token');
    const orgId = window.localStorage.getItem('expothesis-org-id');
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (orgId) {
        config.headers = config.headers ?? {};
        config.headers['X-Org-Id'] = orgId;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const requestUrl = error?.config?.url ?? '';
        const token = window.localStorage.getItem('expothesis-token');
        if (status === 401 && token) {
            if (!requestUrl.includes('/track/')) {
                window.localStorage.removeItem('expothesis-token');
                window.localStorage.removeItem('expothesis-user-id');
                if (window.location.pathname !== '/login') {
                    window.location.assign('/login');
                }
            }
        }
        return Promise.reject(error);
    }
);

const getTrackingHeaders = () => {
    const envKey = import.meta.env.VITE_TRACKING_KEY as string | undefined;
    const storedKey = window.localStorage.getItem('expothesis-tracking-key') ?? '';
    const fallbackKey = 'expothesis-demo-key';
    const key = envKey || storedKey || fallbackKey;
    return key ? { 'x-expothesis-key': key } : undefined;
};

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

    getAnalysis: (id: string, useCuped = false) =>
        api.get<ExperimentAnalysis>(`/experiments/${id}/analysis`, {
            params: { use_cuped: useCuped },
        }),

    getCupedConfig: (id: string) =>
        api.get<CupedConfig>(`/experiments/${id}/cuped/config`),

    saveCupedConfig: (id: string, data: CupedConfigRequest) =>
        api.post<CupedConfig>(`/experiments/${id}/cuped/config`, data),
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

    update: (id: string, data: UpdateUserGroupRequest) =>
        api.put<UserGroup>(`/user-groups/${id}`, data),

    delete: (id: string) =>
        api.delete<void>(`/user-groups/${id}`),

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

// Organizations
export const organizationApi = {
    list: () => api.get<Organization[]>('/organizations'),
    create: (name: string) => api.post('/organizations', { name }),
};

// Tracking
export const trackApi = {
    startSession: (data: StartSessionRequest) =>
        api.post<StartSessionResponse>('/track/session/start', data, { headers: getTrackingHeaders() }),

    endSession: (data: EndSessionRequest) =>
        api.post<Session>('/track/session/end', data, { headers: getTrackingHeaders() }),

    trackEvent: (data: TrackEventRequest) =>
        api.post<ActivityEvent>('/track/event', data, { headers: getTrackingHeaders() }),

    trackReplay: (data: TrackReplayRequest) =>
        api.post('/track/replay', data, { headers: getTrackingHeaders() }),

    listSessions: (limit = 20, offset = 0, signal?: AbortSignal) =>
        api.get<ListSessionsResponse>('/track/sessions', { params: { limit, offset }, headers: getTrackingHeaders(), signal }),

    getReplay: (sessionId: string, limit = 1200, offset = 0, signal?: AbortSignal) =>
        api.get<import('../types').ReplayEvent[]>(`/track/replay/${sessionId}`, { params: { limit, offset }, headers: getTrackingHeaders(), signal }),

    listEvents: (sessionId: string, eventType?: string, limit = 200, signal?: AbortSignal) =>
        api.get<ActivityEvent[]>('/track/events', { params: { session_id: sessionId, event_type: eventType, limit }, headers: getTrackingHeaders(), signal }),
};

// Analytics
export const analyticsApi = {
    getOverview: () =>
        api.get<AnalyticsOverviewResponse>('/analytics/overview'),
};

// AI Assist (LiteLLM proxy)
export const aiApi = {
    chat: (data: AiChatRequest) =>
        api.post<AiChatResponse>('/ai/chat', data),
    models: () =>
        api.get<AiModelsResponse>('/ai/models'),
};

// Auth
export const authApi = {
    register: (data: RegisterRequest) =>
        api.post<AuthStatusResponse>('/auth/register', data),
    login: (data: LoginRequest) =>
        api.post<AuthStatusResponse>('/auth/login', data),
    verifyOtp: (data: VerifyOtpRequest) =>
        api.post<AuthTokenResponse>('/auth/verify-otp', data),
    setupTotp: (user_id: string) =>
        api.post<TotpSetupResponse>('/auth/totp/setup', { user_id }),
    verifyTotp: (user_id: string, code: string) =>
        api.post('/auth/totp/verify', { user_id, code }),
    disableTotp: (user_id: string) =>
        api.post('/auth/totp/disable', { user_id }),
    me: (user_id: string) =>
        api.get<AuthUserProfile>(`/auth/me/${user_id}`),
};

// SDK Tokens
export const sdkApi = {
    getTokens: () =>
        api.get<SdkTokensResponse>('/sdk/tokens'),
    rotateTokens: (data: RotateSdkTokensRequest) =>
        api.post<SdkTokensResponse>('/sdk/tokens/rotate', data),
};

export default api;
