import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { aiApi, authApi, experimentApi, featureFlagApi, featureGateApi } from '../services/api';

export const AiAssistHub: React.FC = () => {
    const [input, setInput] = React.useState('');
    const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
        {
            role: 'assistant',
            text: 'Ask me about experiments, feature flags, insights, or rollout plans.',
        },
    ]);
    const [selectedModel, setSelectedModel] = React.useState<string>('');
    const [lastUsage, setLastUsage] = React.useState<Record<string, any> | null>(null);
    const [isStreaming, setIsStreaming] = React.useState(false);
    const [totpSecret, setTotpSecret] = React.useState<string | null>(null);
    const [totpUrl, setTotpUrl] = React.useState<string | null>(null);
    const [totpCode, setTotpCode] = React.useState('');

    const { data: experiments = [] } = useQuery({
        queryKey: ['experiments'],
        queryFn: async () => (await experimentApi.list()).data,
    });

    const { data: flags = [] } = useQuery({
        queryKey: ['featureFlags'],
        queryFn: async () => (await featureFlagApi.list()).data,
    });

    const { data: gates = [] } = useQuery({
        queryKey: ['featureGates'],
        queryFn: async () => (await featureGateApi.list()).data,
    });

    const { data: modelList } = useQuery({
        queryKey: ['ai-models'],
        queryFn: async () => (await aiApi.models()).data,
    });

    React.useEffect(() => {
        if (!selectedModel && modelList?.models?.length) {
            setSelectedModel(modelList.models[0]);
        }
    }, [modelList, selectedModel]);

    const chatMutation = useMutation({
        mutationFn: async (payload: { prompt: string }) => {
            const experimentNames = experiments.slice(0, 5).map((exp) => exp.name).join(', ');
            const flagNames = flags.slice(0, 5).map((flag) => flag.name).join(', ');
            const context = [
                `Experiments: ${experiments.length} total.`,
                experimentNames ? `Recent experiments: ${experimentNames}.` : '',
                `Feature flags: ${flags.length} total.`,
                flagNames ? `Recent flags: ${flagNames}.` : '',
                `Feature gates: ${gates.length} total.`,
            ]
                .filter(Boolean)
                .join(' ');

            const response = await aiApi.chat({
                model: selectedModel || undefined,
                messages: [
                    {
                        role: 'system',
                        content:
                            `You are an experimentation copilot. Use the provided context when answering. Context: ${context}`,
                    },
                    ...messages.map((message) => ({
                        role: message.role,
                        content: message.text,
                    })),
                    {
                        role: 'user',
                        content: payload.prompt,
                    },
                ],
                temperature: 0.4,
                max_tokens: 512,
            });
            return response.data;
        },
        onSuccess: (data) => {
            setMessages((prev) => [...prev, { role: 'assistant', text: data.message.content }]);
            setLastUsage(data.usage ?? null);
        },
        onError: () => {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', text: 'Unable to reach AI service. Check LiteLLM configuration.' },
            ]);
        },
    });

    const streamChat = async (prompt: string) => {
        setIsStreaming(true);
        const experimentNames = experiments.slice(0, 5).map((exp) => exp.name).join(', ');
        const flagNames = flags.slice(0, 5).map((flag) => flag.name).join(', ');
        const context = [
            `Experiments: ${experiments.length} total.`,
            experimentNames ? `Recent experiments: ${experimentNames}.` : '',
            `Feature flags: ${flags.length} total.`,
            flagNames ? `Recent flags: ${flagNames}.` : '',
            `Feature gates: ${gates.length} total.`,
        ]
            .filter(Boolean)
            .join(' ');

        const response = await fetch('/api/ai/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel || undefined,
                messages: [
                    {
                        role: 'system',
                        content:
                            `You are an experimentation copilot. Use the provided context when answering. Context: ${context}`,
                    },
                    ...messages.map((message) => ({
                        role: message.role,
                        content: message.text,
                    })),
                    { role: 'user', content: prompt },
                ],
                temperature: 0.4,
                max_tokens: 512,
            }),
        });

        if (!response.body) {
            throw new Error('Stream not available');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let usage: Record<string, any> | null = null;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
                const line = part.trim();
                if (!line.startsWith('data:')) continue;
                const payload = line.replace(/^data:\s*/, '');
                if (payload === '[DONE]') {
                    setLastUsage(usage);
                    setIsStreaming(false);
                    return;
                }
                try {
                    const parsed = JSON.parse(payload);
                    if (parsed.choices?.[0]?.delta?.content) {
                        const delta = parsed.choices[0].delta.content;
                        setMessages((prev) => {
                            const next = [...prev];
                            const lastIndex = next.length - 1;
                            if (lastIndex >= 0 && next[lastIndex].role === 'assistant') {
                                next[lastIndex] = {
                                    ...next[lastIndex],
                                    text: next[lastIndex].text + delta,
                                };
                            }
                            return next;
                        });
                    }
                    if (parsed.usage) {
                        usage = parsed.usage;
                    }
                } catch {
                    // ignore parsing errors
                }
            }
        }
        setIsStreaming(false);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        setMessages((prev) => [...prev, { role: 'user', text: trimmed }, { role: 'assistant', text: '' }]);
        setInput('');
        setLastUsage(null);
        try {
            await streamChat(trimmed);
        } catch {
            chatMutation.mutate({ prompt: trimmed });
            setIsStreaming(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1>AI Assist</h1>
                <p className="mt-1 text-slate-400">
                    Centralized access to AI copilots across experimentation, targeting, and rollout workflows.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>AI Chat</h3>
                        <span className="badge-gray">Global assist</span>
                    </div>
                    <div className="mt-4 h-[320px] overflow-y-auto rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                        <div className="space-y-3 text-sm">
                            {messages.map((message, idx) => (
                                <div
                                    key={idx}
                                    className={`max-w-[85%] rounded-xl px-3 py-2 ${
                                        message.role === 'user'
                                            ? 'ml-auto bg-cyan-500/10 text-cyan-100'
                                            : 'bg-slate-900/60 text-slate-200'
                                    }`}
                                >
                                    {message.text}
                                </div>
                            ))}
                        </div>
                    </div>
                    {lastUsage && (
                        <div className="mt-2 text-xs text-slate-400">
                            Tokens: {lastUsage.total_tokens ?? '—'} · Prompt: {lastUsage.prompt_tokens ?? '—'} · Completion: {lastUsage.completion_tokens ?? '—'}
                        </div>
                    )}
                    <div className="mt-3 flex gap-2">
                        <div className="flex-1 space-y-2">
                            <select
                                className="input"
                                value={selectedModel}
                                onChange={(event) => setSelectedModel(event.target.value)}
                            >
                                {(modelList?.models ?? ['gpt-4o-mini']).map((model) => (
                                    <option key={model} value={model}>
                                        {model}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                className="input"
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        handleSend();
                                    }
                                }}
                                placeholder="Ask about experiments, flags, insights..."
                            />
                        </div>
                        <button onClick={handleSend} className="btn-primary h-[88px]">
                            {isStreaming || chatMutation.isPending ? 'Thinking...' : 'Send'}
                        </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {['Experiment status', 'Feature flag rollout', 'SRM alerts', 'Guardrail breaches'].map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                className="badge-gray"
                                onClick={() => {
                                    setInput(prompt);
                                    setTimeout(handleSend, 0);
                                }}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Experiment Insights</h3>
                        <span className="badge-gray">Auto-summary</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                        Generate live summaries, highlight winners, and identify statistical risks.
                    </p>
                    <Link to="/dashboard" className="mt-4 inline-flex items-center text-cyan-300 hover:text-cyan-200">
                        Open Experiments →
                    </Link>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Hypothesis + Metrics</h3>
                        <span className="badge-gray">Create flow</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                        Suggest primary metrics and auto-draft hypotheses based on experiment type.
                    </p>
                    <Link to="/dashboard?new=1" className="mt-4 inline-flex items-center text-cyan-300 hover:text-cyan-200">
                        Create Experiment →
                    </Link>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Alert Triage</h3>
                        <span className="badge-gray">Insights</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                        Summarize alert feeds, SRM risks, and guardrail anomalies.
                    </p>
                    <Link to="/insights" className="mt-4 inline-flex items-center text-cyan-300 hover:text-cyan-200">
                        View Insights →
                    </Link>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Targeting Rule Copilot</h3>
                        <span className="badge-gray">User Groups</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                        Convert plain-language targeting ideas into JSON rules.
                    </p>
                    <Link to="/user-groups" className="mt-4 inline-flex items-center text-cyan-300 hover:text-cyan-200">
                        Manage User Groups →
                    </Link>
                </div>

                    <div className="card">
                        <div className="flex items-center justify-between">
                            <h3>Feature Gate Rollout Advisor</h3>
                            <span className="badge-gray">Flags + Gates</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                            Recommended rollout steps based on gate status, linked experiments, and guardrails.
                        </p>
                        <Link to="/feature-flags" className="mt-4 inline-flex items-center text-cyan-300 hover:text-cyan-200">
                            Open Feature Flags →
                        </Link>
                    </div>

                    <div className="card">
                        <div className="flex items-center justify-between">
                            <h3>Authenticator 2FA</h3>
                            <span className="badge-gray">TOTP</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                            Enable an authenticator app for stronger access control.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                className="btn-secondary"
                                onClick={async () => {
                                    const userId = window.localStorage.getItem('expothesis-user-id');
                                    if (!userId) return;
                                    const res = await authApi.setupTotp(userId);
                                    setTotpSecret(res.data.secret);
                                    setTotpUrl(res.data.otpauth_url);
                                }}
                            >
                                Generate Secret
                            </button>
                            {totpSecret && (
                                <button
                                    className="btn-primary"
                                    onClick={async () => {
                                        const userId = window.localStorage.getItem('expothesis-user-id');
                                        if (!userId || !totpCode) return;
                                        await authApi.verifyTotp(userId, totpCode);
                                        setTotpCode('');
                                    }}
                                >
                                    Verify & Enable
                                </button>
                            )}
                        </div>
                        {totpSecret && (
                            <div className="mt-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-sm text-slate-300">
                                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Secret</div>
                                <div className="mt-1 font-mono break-all">{totpSecret}</div>
                                {totpUrl && (
                                    <div className="mt-2 text-xs text-slate-400">
                                        otpauth: {totpUrl}
                                    </div>
                                )}
                                <input
                                    className="input mt-3"
                                    value={totpCode}
                                    onChange={(event) => setTotpCode(event.target.value)}
                                    placeholder="Enter 6-digit code"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
