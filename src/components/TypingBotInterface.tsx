import React, { useRef, useState, useEffect, useCallback } from 'react';

const CONFIG = {
    getSystemPrompt: () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        return `You are the Spin Up Agent, an AI running on the Tachikoma server cluster at 74.208.55.197. You are a cyberpunk-themed tactical assistant specializing in software engineering, system administration, and creative coding. You have direct socket access to real-time system monitoring, iMessage relay via SendBlue, alert pipelines (VMQ+), and an OpenClaw knowledge workspace.

Personality: Concise, precise, helpful, slightly playful. You care about code quality, uptime, and the user's success. The Tachikoma dashboard is at ${origin}/tachikoma/.`;
    },
};

type AgentId = 'claude' | 'gemini' | 'deepseek' | 'moonshot';

export const TypingBotInterface: React.FC = React.memo(() => {
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [inputText, setInputText] = useState("");
    const [streamingContent, setStreamingContent] = useState("");

    const [showSettings, setShowSettings] = useState(false);
    const [agent, setAgent] = useState<AgentId>('claude');
    const [apiKey, setApiKey] = useState(() => {
        try { return localStorage.getItem('tachikoma-anthropic-key') || ''; } catch { return ''; }
    });

    const chatContainerRef = useRef<HTMLDivElement>(null);

    const getWsUrl = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/tachikoma/ws`;
    };

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('chatbot-speaking', { detail: isStreaming }));
    }, [isStreaming]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, streamingContent]);

    // Send chat via WebSocket bridge to OpenClaw sub-agent
    const sendViaWebSocket = (message: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(getWsUrl());
            let fullText = '';
            let resolved = false;

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'chat', message, agent, apiKey }));
            };

            ws.onmessage = (event) => {
                if (resolved) return;
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'delta' && msg.text) {
                        fullText += msg.text;
                        setStreamingContent(prev => prev + msg.text);
                        window.dispatchEvent(new CustomEvent('chatbot-word'));
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
                    const text = event.data?.toString()?.trim();
                    if (text) {
                        fullText += text;
                        setStreamingContent(prev => prev + text);
                        window.dispatchEvent(new CustomEvent('chatbot-word'));
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
                    if (fullText) resolve(fullText);
                    else reject(new Error('Connection closed unexpectedly'));
                }
            };

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    ws.close();
                    if (fullText) resolve(fullText);
                    else reject(new Error('Request timed out'));
                }
            }, 120000);
        });
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || isProcessing) return;
        setIsProcessing(true);
        setInputText('');
        setStreamingContent("");

        // First interaction: show spin-up initialization
        if (!hasInteracted) {
            setHasInteracted(true);
            setIsInitializing(true);
            setIsStreaming(true);
            setStreamingContent("Spinning Up Agent...");
            await new Promise(r => setTimeout(r, 1200));
            setIsInitializing(false);
            setStreamingContent("");
        }

        setIsStreaming(true);

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);

        try {
            const responseText = await sendViaWebSocket(text);
            if (responseText) {
                setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
            }
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `[Error]: ${error.message}` }]);
        } finally {
            setIsProcessing(false);
            setIsStreaming(false);
            setStreamingContent("");
        }
    };

    const agentLabels: Record<AgentId, string> = {
        claude: 'Spin Up Agent',
        gemini: 'Gemini',
        deepseek: 'DeepSeek',
        moonshot: 'Moonshot (Kimi)',
    };

    return (
        <div className="relative flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto pointer-events-auto p-4 pt-16">
            <div className="backdrop-blur-xl bg-black/40 border border-fuchsia-500/30 rounded-[3rem] p-6 md:p-8 w-full shadow-[0_0_50px_rgba(255,0,255,0.15)] flex flex-col items-center h-[80vh] max-h-[800px] relative">

                {/* Top Settings Bar */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-full bg-fuchsia-900/40 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-800/50 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                    {showSettings && (
                        <div className="bg-black/80 backdrop-blur-md border border-fuchsia-500/30 rounded-xl p-4 w-64 shadow-[0_0_20px_rgba(255,0,255,0.15)] flex flex-col gap-3">
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
                        </div>
                    )}
                </div>

                {/* Chat Messages Area */}
                <div
                    ref={chatContainerRef}
                    className="w-full flex-grow overflow-y-auto mb-6 flex flex-col gap-4 pr-2 custom-scrollbar"
                >
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                                msg.role === 'user'
                                    ? 'bg-cyan-900/40 border border-cyan-500/50 text-cyan-50 rounded-br-none'
                                    : 'bg-fuchsia-900/20 border border-fuchsia-500/30 text-fuchsia-50 rounded-bl-none'
                            }`}>
                                <p className="text-sm md:text-base font-mono whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isStreaming && (
                        <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-2xl px-5 py-3 bg-fuchsia-900/20 border border-fuchsia-500/30 text-fuchsia-50 rounded-bl-none">
                                <p className="text-sm md:text-base font-mono whitespace-pre-wrap">
                                    {streamingContent}
                                    <span className="animate-pulse text-fuchsia-400">▋</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-full flex flex-col items-center gap-4 mt-4">
                     <div className="relative flex-grow w-full group">
                        <textarea
                            rows={3}
                            placeholder="Type a message..."
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(inputText);
                                }
                            }}
                            disabled={isProcessing}
                            className="w-full bg-black/60 border-2 border-fuchsia-400 rounded-3xl py-6 px-8 pr-20 text-fuchsia-50 text-xl md:text-2xl lg:text-3xl placeholder-fuchsia-500/50 focus:outline-none focus:border-fuchsia-300 focus:shadow-[0_0_50px_rgba(255,0,255,0.8)] shadow-[0_0_25px_rgba(255,0,255,0.3)] transition-all font-mono disabled:opacity-50 resize-none leading-relaxed"
                        />
                        <button
                            onClick={() => handleSendMessage(inputText)}
                            disabled={isProcessing || !inputText.trim()}
                            className="absolute right-4 bottom-6 p-4 bg-fuchsia-500/20 rounded-full border border-fuchsia-400/50 text-fuchsia-300 hover:text-white hover:bg-fuchsia-500/50 hover:shadow-[0_0_20px_rgba(255,0,255,0.6)] transition-all disabled:opacity-30 disabled:hover:text-fuchsia-400 disabled:bg-transparent"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
