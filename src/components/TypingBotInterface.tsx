import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

const CONFIG = {
    SPEAK_ON_COMPLETE: false // Typing interface might not speak, but wait, "when the ai speaks the orb should glow bright and pulsate according to the words"
};

type AIProvider = 'gemini' | 'moonshot' | 'deepseek' | 'openclaw';

export const TypingBotInterface: React.FC = React.memo(() => {
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputText, setInputText] = useState("");
    const [streamingContent, setStreamingContent] = useState("");

    const [showSettings, setShowSettings] = useState(false);
    const [provider, setProvider] = useState<AIProvider>('gemini');
    const [customApiKey, setCustomApiKey] = useState("");
    const [customBaseUrl, setCustomBaseUrl] = useState("");

    const chatContainerRef = useRef<HTMLDivElement>(null);

    // When the AI is streaming a response, we emit 'chatbot-speaking'
    // so the HolographicRoomScene makes the local orb glow bright and pulsate.
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('chatbot-speaking', { detail: isStreaming }));
    }, [isStreaming]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, streamingContent]);

    const getAIResponse = async (contextMessages: any[]) => {
        setIsStreaming(true);
        setStreamingContent("");

        try {
            if (provider === 'gemini') {
                const ai = new GoogleGenAI({ apiKey: customApiKey || process.env.GEMINI_API_KEY });
                
                const history = contextMessages.slice(0, -1).map(msg => ({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }]
                }));
                
                const lastMessage = contextMessages[contextMessages.length - 1].content;
                
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents: [
                        ...history,
                        { role: 'user', parts: [{ text: lastMessage }] }
                    ]
                });

                let fullText = '';
                for await (const chunk of responseStream) {
                    const delta = chunk.text;
                    if (delta) {
                        fullText += delta;
                        setStreamingContent(prev => prev + delta);
                        window.dispatchEvent(new CustomEvent('chatbot-word'));
                    }
                }
                
                return fullText;
            } else {
                let url = customBaseUrl;
                let model = '';
                if (provider === 'moonshot') {
                    url = url || 'https://api.moonshot.cn/v1';
                    model = 'moonshot-v1-8k';
                } else if (provider === 'deepseek') {
                    url = url || 'https://api.deepseek.com/v1';
                    model = 'deepseek-chat';
                } else if (provider === 'openclaw') {
                    url = url || 'http://localhost:8000/v1';
                    model = 'openclaw-agent';
                }

                const res = await fetch(`${url}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(customApiKey ? { 'Authorization': `Bearer ${customApiKey}` } : {})
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: contextMessages,
                        stream: true,
                        temperature: 0.7
                    })
                });

                if (!res.ok) {
                    const errText = await res.text();
                    if (res.status === 401) throw new Error(`HTTP 401: Unauthorized. Provide a valid API key for ${provider}.`);
                    throw new Error(`HTTP ${res.status}: ${errText}`);
                }

                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                if (reader) {
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
                }
                return fullText;
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

    return (
        <div className="relative flex flex-col items-center justify-center h-full w-full max-w-4xl mx-auto pointer-events-auto p-4 pt-16">
            <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/30 rounded-[3rem] p-6 md:p-8 w-full shadow-[0_0_50px_rgba(0,255,255,0.15)] flex flex-col items-center h-[80vh] max-h-[800px] relative">
                
                {/* Top Settings Bar */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-full bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-800/50 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </button>
                    {showSettings && (
                        <div className="bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 w-64 shadow-[0_0_20px_rgba(0,255,255,0.15)] flex flex-col gap-3">
                            <div>
                                <label className="block text-cyan-400 text-xs font-mono mb-1">Provider</label>
                                <select 
                                    value={provider} 
                                    onChange={(e) => setProvider(e.target.value as AIProvider)}
                                    className="w-full bg-cyan-900/20 border border-cyan-500/30 rounded px-2 py-1 text-sm text-cyan-50 focus:outline-none focus:border-cyan-400 font-mono"
                                >
                                    <option value="gemini">Gemini</option>
                                    <option value="moonshot">Moonshot (Kimi)</option>
                                    <option value="deepseek">DeepSeek</option>
                                    <option value="openclaw">OpenClaw</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-cyan-400 text-xs font-mono mb-1">API Key</label>
                                <input 
                                    type="password" 
                                    value={customApiKey}
                                    onChange={(e) => setCustomApiKey(e.target.value)}
                                    placeholder={provider === 'gemini' ? "Optional (Uses default)" : "Required"}
                                    className="w-full bg-cyan-900/20 border border-cyan-500/30 rounded px-2 py-1 text-sm text-cyan-50 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 font-mono"
                                />
                            </div>
                            {provider !== 'gemini' && (
                                <div>
                                    <label className="block text-cyan-400 text-xs font-mono mb-1">Base URL <span className="text-gray-500">(Optional)</span></label>
                                    <input 
                                        type="text" 
                                        value={customBaseUrl}
                                        onChange={(e) => setCustomBaseUrl(e.target.value)}
                                        placeholder="Default for provider"
                                        className="w-full bg-cyan-900/20 border border-cyan-500/30 rounded px-2 py-1 text-sm text-cyan-50 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 font-mono"
                                    />
                                </div>
                            )}
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
                            placeholder="Type an objective..." 
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage(inputText);
                                }
                            }}
                            disabled={isProcessing}
                            className="w-full bg-black/60 border-2 border-cyan-400 rounded-3xl py-6 px-8 pr-20 text-cyan-50 text-xl md:text-2xl lg:text-3xl placeholder-cyan-500/50 focus:outline-none focus:border-cyan-300 focus:shadow-[0_0_50px_rgba(0,255,255,0.8)] shadow-[0_0_25px_rgba(0,255,255,0.3)] transition-all font-mono disabled:opacity-50 resize-none leading-relaxed"
                        />
                        <button 
                            onClick={() => handleSendMessage(inputText)}
                            disabled={isProcessing || !inputText.trim()}
                            className="absolute right-4 bottom-6 p-4 bg-cyan-500/20 rounded-full border border-cyan-400/50 text-cyan-300 hover:text-white hover:bg-cyan-500/50 hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] transition-all disabled:opacity-30 disabled:hover:text-cyan-400 disabled:bg-transparent"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});
