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
} from '../types';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

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

export default api;
