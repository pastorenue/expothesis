export enum ExperimentStatus {
    Draft = 'draft',
    Running = 'running',
    Paused = 'paused',
    Stopped = 'stopped',
}

export enum MetricType {
    Proportion = 'proportion',
    Continuous = 'continuous',
    Count = 'count',
}

export interface Hypothesis {
    null_hypothesis: string;
    alternative_hypothesis: string;
    expected_effect_size: number;
    metric_type: MetricType;
    significance_level: number;
    power: number;
    minimum_sample_size?: number;
}

export interface Variant {
    name: string;
    description: string;
    allocation_percent: number;
    is_control: boolean;
}

export interface Experiment {
    id: string;
    name: string;
    description: string;
    status: ExperimentStatus;
    hypothesis?: Hypothesis;
    variants: Variant[];
    user_groups: string[];
    primary_metric: string;
    start_date?: string;
    end_date?: string;
    created_at: string;
    updated_at: string;
}

export interface UserGroup {
    id: string;
    name: string;
    description: string;
    assignment_rule: string;
    size: number;
    created_at: string;
    updated_at: string;
}

export interface StatisticalResult {
    experiment_id: string;
    variant_a: string;
    variant_b: string;
    metric_name: string;
    sample_size_a: number;
    sample_size_b: number;
    mean_a: number;
    mean_b: number;
    std_dev_a?: number;
    std_dev_b?: number;
    effect_size: number;
    p_value: number;
    confidence_interval_lower: number;
    confidence_interval_upper: number;
    is_significant: boolean;
    test_type: string;
    calculated_at: string;
}

export interface VariantSampleSize {
    variant: string;
    current_size: number;
    required_size: number;
}

export interface ExperimentAnalysis {
    experiment: Experiment;
    results: StatisticalResult[];
    sample_sizes: VariantSampleSize[];
}

export interface CreateExperimentRequest {
    name: string;
    description: string;
    hypothesis: Hypothesis;
    variants: Variant[];
    primary_metric: string;
    user_groups: string[];
}

export interface CreateUserGroupRequest {
    name: string;
    description: string;
    assignment_rule: string;
}

export interface MoveUserGroupRequest {
    from_experiment_id: string;
    to_experiment_id: string;
}
export interface IngestEventRequest {
    experiment_id: string;
    user_id: string;
    variant: string;
    metric_name: string;
    metric_value: number;
    attributes?: Record<string, any>;
}

export interface AssignUserRequest {
    user_id: string;
    experiment_id: string;
    group_id: string;
    attributes?: Record<string, any>;
}

export interface MetricEvent {
    id: string;
    experiment_id: string;
    user_id: string;
    variant: string;
    metric_name: string;
    metric_value: number;
    timestamp: string;
}
