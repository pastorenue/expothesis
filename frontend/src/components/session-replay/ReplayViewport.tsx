import React from 'react';
import { Replayer } from 'rrweb';
import type { ReplayEvent } from '../../types';

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

type ReplayViewportProps = {
    replayEvents: ReplayEvent[];
    onMissingSnapshot: () => void;
};

export const ReplayViewport: React.FC<ReplayViewportProps> = ({ replayEvents, onMissingSnapshot }) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const replayerRef = React.useRef<Replayer | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);

    React.useEffect(() => {
        if (!containerRef.current || replayEvents.length < 2) {
            return;
        }
        if (replayEvents[0]?.type !== 2) {
            onMissingSnapshot();
            return;
        }

        const config = {
            speed: 1,
            skipInactive: true,
            mouseTail: false,
        };

        try {
            const replayer = new Replayer(
                replayEvents as unknown as ConstructorParameters<typeof Replayer>[0],
                config,
            );
            replayerRef.current = replayer;

            const wrapper = document.createElement('div');
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(wrapper);
            wrapper.appendChild(replayer.wrapper);

            const iframe = replayer.wrapper.querySelector('iframe');
            if (iframe) {
                iframe.setAttribute('scrolling', 'yes');
                iframe.style.overflow = 'auto';
            }

            const applyScale = () => {
                if (!containerRef.current || !replayer.wrapper) return;
                const containerRect = containerRef.current.getBoundingClientRect();
                const wrapperRect = replayer.wrapper.getBoundingClientRect();
                if (!containerRect.width || !containerRect.height || !wrapperRect.width || !wrapperRect.height) {
                    return;
                }
                const scale = Math.min(
                    containerRect.width / wrapperRect.width,
                    containerRect.height / wrapperRect.height,
                    1,
                );
                replayer.wrapper.style.transformOrigin = 'top left';
                replayer.wrapper.style.transform = `scale(${scale})`;
            };

            const resizeObserver = new ResizeObserver(() => applyScale());
            resizeObserver.observe(containerRef.current);
            resizeObserver.observe(replayer.wrapper);
            requestAnimationFrame(() => applyScale());

            const meta = replayer.getMetaData();
            setDuration(meta.totalTime);
            setCurrentTime(0);
            setIsPlaying(false);
            replayer.pause();

            const interval = window.setInterval(() => {
                if (replayerRef.current) {
                    const time = replayerRef.current.getCurrentTime();
                    setCurrentTime(time);
                    if (time >= meta.totalTime) {
                        setIsPlaying(false);
                        replayerRef.current.pause();
                    }
                }
            }, 250);

            return () => {
                window.clearInterval(interval);
                resizeObserver.disconnect();
                if (replayerRef.current) {
                    replayerRef.current.pause();
                    replayerRef.current = null;
                }
            };
        } catch (error) {
            console.error('Failed to initialize rrweb replayer:', error);
        }
    }, [replayEvents, onMissingSnapshot]);

    const handlePlayPause = () => {
        if (!replayerRef.current) return;
        if (isPlaying) {
            replayerRef.current.pause();
            setIsPlaying(false);
        } else {
            if (currentTime === 0) {
                replayerRef.current.play(0);
            } else {
                replayerRef.current.play();
            }
            setIsPlaying(true);
        }
    };

    const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!replayerRef.current) return;
        const time = Number(event.target.value);
        replayerRef.current.pause();
        replayerRef.current.play(time);
        setCurrentTime(time);
        if (!isPlaying) {
            setTimeout(() => replayerRef.current?.play(), 0);
            setIsPlaying(true);
        }
    };

    const handleRestart = () => {
        if (!replayerRef.current) return;
        replayerRef.current.pause();
        replayerRef.current.play(0);
        setCurrentTime(0);
        setIsPlaying(true);
    };

    return (
        <div className="custom-replay-container">
            <div className="custom-replay-viewport" ref={containerRef} />
            <div className="custom-replay-controls">
                <button onClick={handleRestart} className="replay-btn" title="Restart">
                    ⟲
                </button>
                <button
                    onClick={handlePlayPause}
                    className="replay-btn replay-btn-main"
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? '❚❚' : '▶'}
                </button>
                <span className="replay-time">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min={0}
                    max={Math.max(duration, 1)}
                    value={currentTime}
                    onChange={handleSeek}
                    className="replay-slider"
                />
                <span className="replay-time">{formatTime(duration)}</span>
            </div>
        </div>
    );
};
