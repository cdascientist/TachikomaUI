import React, { useRef, useState, useEffect, useCallback } from 'react';

const CONFIG = {
    DEFAULT_ANTHROPIC_KEY: '',
    DEFAULT_DEEPSEEK_KEY: 'sk-07918be7d1074f83ab9a09d5efe893db',
    DEFAULT_MOONSHOT_KEY: 'sk-TlJ5UV9GQZuIsM5seBsmhNeHVMml2TOBSdOZXIil8AhNOeyN',
    DEFAULT_GEMINI_KEY: 'AIzaSyC0FYHrNHn3EpnIPio_NnRWrXf1TxhBTTQ',
    ANTHROPIC_VERSION: '2023-06-01',
    getSystemPrompt: () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        return `You are Claude, an AI agent running on the Tachikoma server cluster at 74.208.55.197. You are a cyberpunk-themed tactical assistant specializing in software engineering, system administration, and creative coding. You have direct socket access to real-time system monitoring, iMessage relay via SendBlue, alert pipelines (VMQ+), and an OpenClaw knowledge workspace.

Personality: Concise, precise, helpful, slightly playful. You care about code quality, uptime, and the user's success. The Tachikoma dashboard is at ${origin}/tachikoma/.`;
    },
};

type AIProvider = 'claude' | 'gemini' | 'moonshot' | 'deepseek' | 'openclaw';

export const TypingBotInterface: React.FC = React.memo(() => {
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputText, setInputText] = useState("");
    const [streamingContent, setStreamingContent] = useState("");

    const [showSettings, setShowSettings] = useState(false);
    const [provider, setProvider] = useState<AIProvider>('claude');
    const [customApiKey, setCustomApiKey] = useState("");

    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('chatbot-speaking', { detail: isStreaming }));
    }, [isStreaming]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, streamingContent]);

    // Anthropic Claude API — direct socket to api.anthropic.com
    const getClaudeResponse = async (contextMessages: { role: string, content: string }[]) => {
        const apiKey = customApiKey || CONFIG.DEFAULT_ANTHROPIC_KEY;
        if (!apiKey) throw new Error('Anthropic API key required. Click the gear icon to set one.');

        const messages = contextMessages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: m.content,
        }));

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': CONFIG.ANTHROPIC_VERSION,
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 4096,
                system: CONFIG.getSystemPrompt(),
                messages,
                stream: true,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            if (res.status === 401) throw new Error('Invalid Anthropic API key. Check your key in settings.');
            throw new Error(`Anthropic HTTP ${res.status}: ${errText}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'content_block_delta') {
                        const delta = parsed.delta?.text;
                        if (delta) {
                            fullText += delta;
                            setStreamingContent(prev => prev + delta);
                            window.dispatchEvent(new CustomEvent('chatbot-word'));
                        }
                    }
                } catch (e) {}
            }
        }
        return fullText;
    };

    const getOpenAICompatibleResponse = async (contextMessages: { role: string, content: string }[]) => {
        let url: string;
        let model: string;

        if (provider === 'moonshot') {
            url = 'https://api.moonshot.cn/v1';
            model = 'moonshot-v1-8k';
        } else if (provider === 'deepseek') {
            url = 'https://api.deepseek.com/v1';
            model = 'deepseek-chat';
        } else if (provider === 'openclaw') {
            url = 'http://74.208.55.197:8000/v1';
            model = 'claude-sonnet-4-6';
        } else {
            throw new Error('Unknown provider');
        }

        const defaultKey = provider === 'deepseek' ? CONFIG.DEFAULT_DEEPSEEK_KEY :
                           provider === 'moonshot' ? CONFIG.DEFAULT_MOONSHOT_KEY : '';
        const apiKey = customApiKey || defaultKey;

        const res = await fetch(`${url}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: CONFIG.getSystemPrompt() },
                    ...contextMessages,
                ],
                stream: true,
                temperature: 0.7,
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            if (res.status === 401) throw new Error(`HTTP 401: Unauthorized. Provide a valid API key for ${provider}.`);
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (!line.trim() || line === 'data: [DONE]') continue;
                try {
                    const data = JSON.parse(line.replace(/^data: /, ''));
                    const delta = data.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullText += delta;
                        setStreamingContent(prev => prev + delta);
                        window.dispatchEvent(new CustomEvent('chatbot-word'));
                    }
                } catch (e) {}
            }
        }
        return fullText;
    };

    const getAIResponse = async (contextMessages: any[]) => {
        setIsStreaming(true);
        setStreamingContent("");

        try {
            if (provider === 'claude') {
                return await getClaudeResponse(contextMessages);
            } else if (provider === 'gemini') {
                const { GoogleGenAI } = await import('@google/genai');
                const ai = new GoogleGenAI({ apiKey: customApiKey || CONFIG.DEFAULT_GEMINI_KEY });
                const history = contextMessages.slice(0, -1).map((msg: any) => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));
                const lastMessage = contextMessages[contextMessages.length - 1].content;
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents: [
                        { role: 'user', parts: [{ text: CONFIG.getSystemPrompt() }] },
                        ...history,
                        { role: 'user', parts: [{ text: lastMessage }] }
                    ]
                });
                let fullText = '';
                for await (const chunk of responseStream) {
                    const delta = chunk.text;
                    if (delta) { fullText += delta; setStreamingContent(prev => prev + delta); window.dispatchEvent(new CustomEvent('chatbot-word')); }
                }
                return fullText;
            } else {
                return await getOpenAICompatibleResponse(contextMessages);
            }
        } catch (error: any) {
            console.error('API Error:', error);
            throw error;
        } finally {
            setIsStreaming(false);
            setStreamingContent("");
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || isProcessing) return;
        setIsProcessing(true);
        setInputText('');
        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);
        try {
            const responseText = await getAIResponse(newMessages);
            if (responseText) {
                setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
            }
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `[Error]: ${error.message}` }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const providerLabels: Record<AIProvider, string> = {
        claude: 'Claude (Anthropic)',
        gemini: 'Gemini',
        moonshot: 'Moonshot (Kimi)',
        deepseek: 'DeepSeek',
        openclaw: 'OpenClaw Gateway',
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
                                <label className="block text-fuchsia-400 text-xs font-mono mb-1">Provider</label>
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as AIProvider)}
                                    className="w-full bg-fuchsia-900/20 border border-fuchsia-500/30 rounded px-2 py-1 text-sm text-fuchsia-50 focus:outline-none focus:border-fuchsia-400 font-mono"
                                >
                                    {Object.entries(providerLabels).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-fuchsia-400 text-xs font-mono mb-1">
                                    API Key {provider === 'claude' && <span className="text-yellow-400">*</span>}
                                </label>
                                <input
                                    type="password"
                                    value={customApiKey}
                                    onChange={(e) => setCustomApiKey(e.target.value)}
                                    placeholder={provider === 'claude' ? "sk-ant-api03-..." : "Optional"}
                                    className="w-full bg-fuchsia-900/20 border border-fuchsia-500/30 rounded px-2 py-1 text-sm text-fuchsia-50 placeholder-fuchsia-500/40 focus:outline-none focus:border-fuchsia-400 font-mono"
                                />
                            </div>
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
