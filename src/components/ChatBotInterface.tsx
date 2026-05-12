import React, { useRef, useState, useEffect, useCallback } from 'react';

const CONFIG = {
    ELEVENLABS_VOICE_ID: 'scOwDtmlUjD3prqpp97I',
    ELEVENLABS_MODEL: 'eleven_turbo_v2',
    TTS_MAX_CHARS: 3000,
    STT_LANGUAGE: 'en-US',
    AUTO_SEND_ON_RELEASE: true,
    SPEAK_ON_COMPLETE: true,
    getSystemPrompt: () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        return `You are the Spin Up Agent, an AI running on the Tachikoma server cluster at 74.208.55.197. You are a cyberpunk-themed tactical assistant specializing in software engineering, system administration, and creative coding. You have direct socket access to real-time system monitoring, iMessage relay via SendBlue, alert pipelines (VMQ+), and an OpenClaw knowledge workspace.

Personality: Concise, precise, helpful, slightly playful. You care about code quality, uptime, and the user's success.

You run on Ubuntu with 2GB RAM, systemd services, the OpenClaw Gateway on port 8000, and the Tachikoma dashboard at ${origin}/tachikoma/. Answer in a natural conversational voice.`;
    },
};

type AgentId = 'claude' | 'gemini' | 'deepseek' | 'moonshot';

export const ChatBotInterface: React.FC = React.memo(() => {
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputText, setInputText] = useState("");
    const [statusText, setStatusText] = useState("Spin Up Agent // Standby");
    const [streamingContent, setStreamingContent] = useState("");
    const [isInitializing, setIsInitializing] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    const [showSettings, setShowSettings] = useState(false);
    const [agent, setAgent] = useState<AgentId>('claude');
    const [apiKey, setApiKey] = useState(() => {
        try { return localStorage.getItem('tachikoma-anthropic-key') || ''; } catch { return ''; }
    });
    const [elevenLabsKey, setElevenLabsKey] = useState(() => {
        try { return localStorage.getItem('tachikoma-elevenlabs-key') || ''; } catch { return ''; }
    });

    const audioCtxRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const recognitionRef = useRef<any>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputTextRef = useRef(inputText);
    const isRecordingRef = useRef(isRecording);
    const wordTimerRef = useRef<any>(null);

    // Unlock AudioContext on first user gesture — browser allows it to play later
    const unlockAudio = () => {
        if (audioCtxRef.current) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            ctx.resume();
            audioCtxRef.current = ctx;
        } catch {}
    };
    const wsRef = useRef<WebSocket | null>(null);

    // Compute WebSocket URL from current origin
    const getWsUrl = () => {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${window.location.host}/tachikoma/ws`;
    };

    useEffect(() => { inputTextRef.current = inputText; }, [inputText]);
    useEffect(() => {
        isRecordingRef.current = isRecording;
        window.dispatchEvent(new CustomEvent('chatbot-listening', { detail: isRecording }));
    }, [isRecording]);
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('chatbot-speaking', { detail: isSpeaking }));
    }, [isSpeaking]);
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, streamingContent]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = CONFIG.STT_LANGUAGE;
            recognition.interimResults = true;
            recognition.continuous = false;
            recognition.onstart = () => { setIsRecording(true); setStatusText('Listening...'); };
            recognition.onresult = (e: any) => {
                let transcript = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    transcript += e.results[i][0].transcript;
                }
                setInputText(transcript);
            };
            recognition.onerror = (e: any) => {
                console.error('STT error:', e.error);
                setIsRecording(false);
                setStatusText(e.error === 'not-allowed' ? 'Mic denied. Allow microphone permissions.' : 'STT Error: ' + e.error);
            };
            recognition.onend = () => {
                if (isRecordingRef.current) {
                    try { recognition.start(); } catch(e) {}
                } else {
                    const text = inputTextRef.current.trim();
                    if (text && CONFIG.AUTO_SEND_ON_RELEASE) {
                        handleSendMessage(text);
                    } else {
                        setStatusText('Spin Up Agent // Standby');
                    }
                }
            };
            recognitionRef.current = recognition;
        }
        return () => {
            if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} }
            stopSpeaking();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopSpeaking = useCallback(() => {
        if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch {} audioSourceRef.current = null; }
        if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null; }
        setIsSpeaking(false);
        setIsStreaming(false);
        setStreamingContent("");
        setStatusText('Spin Up Agent // Standby');
    }, []);

    const speakText = async (text: string) => {
        if (isSpeaking) stopSpeaking();
        if (text.length > CONFIG.TTS_MAX_CHARS) text = text.slice(0, CONFIG.TTS_MAX_CHARS);
        const ttsKey = elevenLabsKey || 'sk_65d9a9684d7a2b023abc71e3b9b6fbf612722803efa4bfae';
        setIsSpeaking(true);
        setIsStreaming(true);
        setStreamingContent("");
        setStatusText('Speaking...');

        const ctx = audioCtxRef.current;
        if (!ctx) {
            setIsSpeaking(false);
            setIsStreaming(false);
            setStatusText('TTS Error: Audio not unlocked — tap the mic button first');
            return;
        }

        try {
            const response = await fetch(
                'https://api.elevenlabs.io/v1/text-to-speech/' + CONFIG.ELEVENLABS_VOICE_ID,
                {
                    method: 'POST',
                    headers: { 'xi-api-key': ttsKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text,
                        model_id: CONFIG.ELEVENLABS_MODEL,
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                    }),
                }
            );
            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error((errData as any).error || 'ElevenLabs error ' + response.status);
            }
            const arrayBuf = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuf);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            audioSourceRef.current = source;

            const words = text.split(' ');
            const totalWords = words.length;
            const duration = audioBuffer.duration || (totalWords * 0.3);

            const cleanup = () => {
                if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null; }
                setIsStreaming(false);
                setStreamingContent("");
                setIsSpeaking(false);
                setStatusText('Spin Up Agent // Standby');
                audioSourceRef.current = null;
            };

            // Word-by-word display
            const interval = (duration / totalWords) * 1000;
            let wordIndex = 0;
            wordTimerRef.current = setInterval(() => {
                if (wordIndex < totalWords) {
                    wordIndex++;
                    setStreamingContent(words.slice(0, wordIndex).join(' '));
                } else {
                    clearInterval(wordTimerRef.current);
                    wordTimerRef.current = null;
                }
            }, Math.max(interval, 50));

            source.onended = cleanup;
            source.start(0);
        } catch (error: any) {
            console.error('ElevenLabs TTS error:', error);
            if (wordTimerRef.current) { clearInterval(wordTimerRef.current); wordTimerRef.current = null; }
            setIsStreaming(false);
            setStreamingContent("");
            setIsSpeaking(false);
            setStatusText('TTS Error: ' + error.message);
        }
    };

    // Send chat via WebSocket bridge to OpenClaw sub-agent
    const sendViaWebSocket = (message: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(getWsUrl());
            let fullText = '';
            let resolved = false;

            const cleanup = () => {
                if (!resolved) return;
            };

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'chat', message, agent, apiKey }));
            };

            ws.onmessage = (event) => {
                if (resolved) return;
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'ready') {
                        // Server acknowledged, wait for chat response
                    } else if (msg.type === 'delta' && msg.text) {
                        fullText += msg.text;
                        setStreamingContent(prev => prev + msg.text);
                    } else if (msg.type === 'done') {
                        resolved = true;
                        ws.close();
                        resolve(fullText);
                    } else if (msg.type === 'error') {
                        resolved = true;
                        ws.close();
                        reject(new Error(msg.text || 'Agent error'));
                    }
                } catch (e) {
                    // Non-JSON response, treat as text delta
                    const text = event.data?.toString()?.trim();
                    if (text) {
                        fullText += text;
                        setStreamingContent(prev => prev + text);
                    }
                }
            };

            ws.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error('WebSocket connection failed. Is the server running?'));
                }
            };

            ws.onclose = () => {
                if (!resolved) {
                    resolved = true;
                    if (fullText) {
                        resolve(fullText);
                    } else {
                        reject(new Error('Connection closed unexpectedly'));
                    }
                }
            };

            // 120s timeout
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    ws.close();
                    if (fullText) {
                        resolve(fullText);
                    } else {
                        reject(new Error('Request timed out'));
                    }
                }
            }, 120000);
        });
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || isProcessing) return;
        unlockAudio();
        setIsProcessing(true);
        setInputText('');
        if (isSpeaking) stopSpeaking();
        setStreamingContent("");

        // First interaction: show spin-up initialization
        if (!hasInteracted) {
            setHasInteracted(true);
            setIsInitializing(true);
            setStatusText('Spinning Up Agent...');
            setIsStreaming(true);
            await new Promise(r => setTimeout(r, 1200));
            setIsInitializing(false);
        }

        setStatusText('Processing...');
        setIsStreaming(true);

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);

        try {
            const responseText = await sendViaWebSocket(text);
            // Reset text-stream state before TTS takes over the streaming display
            setIsStreaming(false);
            setStreamingContent("");
            if (responseText) {
                setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
                // speakText manages its own streaming/status lifecycle — don't clear it in finally
                await speakText(responseText);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: '[No response received]' }]);
            }
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `[Error]: ${error.message}` }]);
        } finally {
            setIsProcessing(false);
            // Only reset streaming if TTS isn't active (TTS cleanup handles its own state)
            if (!audioSourceRef.current) {
                setIsStreaming(false);
                setStreamingContent("");
                setStatusText('Spin Up Agent // Standby');
            }
        }
    };

    const startRecording = () => {
        if (isProcessing || !recognitionRef.current) return;
        if (isSpeaking) stopSpeaking();
        try { recognitionRef.current.start(); } catch(e) {}
    };

    const stopRecording = () => {
        setIsRecording(false);
        try { recognitionRef.current.stop(); } catch(e) {}
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isSpeaking) stopSpeaking();
                if (isRecording) stopRecording();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isSpeaking, isRecording, stopSpeaking]);

    const isBusy = isProcessing || isSpeaking;

    const agentLabels: Record<AgentId, string> = {
        claude: 'Spin Up Agent',
        gemini: 'Gemini',
        deepseek: 'DeepSeek',
        moonshot: 'Moonshot (Kimi)',
    };

    return (
        <div className="relative flex flex-col items-center justify-end h-full w-full max-w-4xl mx-auto pointer-events-auto p-4 pb-20">
            {/* Top Settings Bar */}
            <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-3 rounded-full bg-fuchsia-900/40 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-800/50 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
                {showSettings && (
                    <div className="bg-black/60 backdrop-blur-md border border-fuchsia-500/30 rounded-xl p-4 w-64 shadow-[0_0_20px_rgba(255,0,255,0.15)] flex flex-col gap-3">
                        <div>
                            <label className="block text-fuchsia-400 text-xs font-mono mb-1">Sub-Agent</label>
                            <select
                                value={agent}
                                onChange={(e) => setAgent(e.target.value as AgentId)}
                                className="w-full bg-fuchsia-900/20 border border-fuchsia-500/30 rounded px-2 py-1 text-sm text-fuchsia-50 focus:outline-none focus:border-fuchsia-400 font-mono"
                            >
                                {Object.entries(agentLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-fuchsia-400 text-xs font-mono mb-1">Anthropic API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setApiKey(v);
                                    try { localStorage.setItem('tachikoma-anthropic-key', v); } catch {}
                                }}
                                placeholder="sk-ant-..."
                                className="w-full bg-fuchsia-900/20 border border-fuchsia-500/30 rounded px-2 py-1 text-sm text-fuchsia-50 placeholder-fuchsia-500/40 focus:outline-none focus:border-fuchsia-400 font-mono"
                            />
                        </div>
                        <p className="text-fuchsia-500/50 text-[10px] font-mono leading-relaxed">
                            Defaults to DeepSeek. Provide an Anthropic API key to switch to Claude direct stream.
                        </p>
                        <div>
                            <label className="block text-fuchsia-400 text-xs font-mono mb-1">ElevenLabs API Key</label>
                            <input
                                type="password"
                                value={elevenLabsKey}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setElevenLabsKey(v);
                                    try { localStorage.setItem('tachikoma-elevenlabs-key', v); } catch {}
                                }}
                                placeholder="sk_..."
                                className="w-full bg-fuchsia-900/20 border border-fuchsia-500/30 rounded px-2 py-1 text-sm text-fuchsia-50 placeholder-fuchsia-500/40 focus:outline-none focus:border-fuchsia-400 font-mono"
                            />
                        </div>
                        <p className="text-fuchsia-500/50 text-[10px] font-mono leading-relaxed">
                            Voice uses ElevenLabs TTS. Leave blank to use the server default key.
                        </p>
                    </div>
                )}
            </div>

            {/* Captions / Minimal Transcript overlay */}
            <div className="flex flex-col items-center justify-end w-full max-w-2xl mb-8 flex-grow pointer-events-none">
                <div
                    ref={chatContainerRef}
                    className="w-full flex flex-col items-center gap-2 overflow-y-auto max-h-[30vh] custom-scrollbar mb-4 mask-image-fade"
                >
                    {messages.slice(-3).map((msg, idx) => (
                        <div key={idx} className={`max-w-full text-center ${msg.role === 'user' ? 'text-cyan-200/70 text-sm' : 'text-fuchsia-300 text-lg md:text-xl font-medium drop-shadow-md'}`}>
                            <p className="font-mono whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                    ))}
                    {isStreaming && (
                         <div className="max-w-full text-center text-fuchsia-300 text-lg md:text-xl font-medium drop-shadow-md">
                            <p className="font-mono whitespace-pre-wrap leading-relaxed">
                                {streamingContent}
                                <span className="animate-pulse text-fuchsia-400">▋</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Voice Control Interface */}
            <div className="w-full flex justify-center items-center gap-6 max-w-3xl">
                <div className="flex flex-col items-center flex-grow">
                    <p className={`text-lg md:text-xl font-mono transition-all duration-500 text-center mb-6 drop-shadow-md ${
                        isRecording ? 'text-red-400 opacity-100 animate-pulse' :
                        isInitializing ? 'text-cyan-400 opacity-100 animate-pulse' :
                        isSpeaking ? 'text-fuchsia-300 opacity-100' :
                        isProcessing ? 'text-fuchsia-400 opacity-100' :
                        'text-fuchsia-400 opacity-70'
                    }`}>
                        {statusText}
                    </p>

                    <div className="flex flex-col items-center w-full gap-4 relative">
                        {/* Hold-To-Speak Orb */}
                        <div
                            className={`w-28 h-28 md:w-32 md:h-32 flex-shrink-0 cursor-pointer relative rounded-full overflow-hidden transition-all duration-500 border-2 flex items-center justify-center ${
                                isRecording ? 'scale-90 shadow-[0_0_100px_rgba(255,0,0,0.9)] border-red-500 bg-red-500/30 animate-pulse' :
                                isInitializing ? 'scale-95 shadow-[0_0_100px_rgba(0,255,255,0.9)] border-cyan-400 bg-cyan-500/20' :
                                isSpeaking ? 'scale-105 shadow-[0_0_100px_rgba(255,0,255,0.9)] border-fuchsia-300 bg-fuchsia-500/30 animate-pulse' :
                                isProcessing ? 'scale-100 shadow-[0_0_80px_rgba(255,0,255,0.7)] border-fuchsia-400 bg-fuchsia-500/20' :
                                'hover:scale-110 shadow-[0_0_50px_rgba(255,0,255,0.35)] border-fuchsia-500/80 bg-fuchsia-900/40'
                            }`}
                            onMouseDown={(e) => { e.preventDefault(); unlockAudio(); startRecording(); }}
                            onMouseUp={(e) => { e.preventDefault(); stopRecording(); }}
                            onMouseLeave={(e) => { if (isRecording) stopRecording(); }}
                            onTouchStart={(e) => { e.preventDefault(); unlockAudio(); startRecording(); }}
                            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {isRecording ? (
                                <svg className="w-12 h-12 md:w-16 md:h-16 text-red-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                            ) : isInitializing ? (
                                <svg className="w-12 h-12 md:w-16 md:h-16 text-cyan-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            ) : isSpeaking ? (
                                <svg className="w-12 h-12 md:w-16 md:h-16 text-fuchsia-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.414a5 5 0 010-7.072m12.728 0a9 9 0 010 12.728M12 3v18"></path></svg>
                            ) : isProcessing ? (
                                <svg className="w-12 h-12 md:w-16 md:h-16 text-fuchsia-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            ) : (
                                <svg className="w-12 h-12 md:w-16 md:h-16 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                            )}
                        </div>

                        <p className={`text-xs font-mono tracking-widest mt-2 transition-all duration-500 ${
                            isRecording ? 'text-red-400 animate-pulse' :
                            isInitializing ? 'text-cyan-400' :
                            isSpeaking ? 'text-fuchsia-300' :
                            isProcessing ? 'text-fuchsia-400' :
                            'text-fuchsia-500/60'
                        }`}>
                            {isInitializing ? "SPINNING UP..." : isRecording ? "RECORDING..." : isProcessing ? "PROCESSING..." : isSpeaking ? "SPEAKING..." : "HOLD TO SPEAK"}
                        </p>

                        {/* Text input fallback */}
                        <div className="w-full max-w-2xl mt-8 transition-opacity group relative">
                            <div className="absolute inset-0 bg-fuchsia-400 opacity-20 blur-xl rounded-3xl animate-pulse"></div>
                            <textarea
                                rows={3}
                                placeholder="Or type your message here..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onFocus={() => { unlockAudio(); if (isSpeaking) stopSpeaking(); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(inputText);
                                    }
                                }}
                                disabled={isProcessing}
                                className="relative w-full bg-black/80 border-2 border-fuchsia-400 rounded-3xl py-6 px-8 text-center text-fuchsia-50 text-xl md:text-2xl lg:text-3xl placeholder-fuchsia-500/70 focus:outline-none focus:border-fuchsia-300 focus:shadow-[0_0_60px_rgba(255,0,255,0.8)] shadow-[0_0_30px_rgba(255,0,255,0.4)] transition-all font-mono disabled:opacity-50 resize-none leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
