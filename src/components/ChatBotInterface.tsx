import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { GoogleGenAI } from '@google/genai';

const CONFIG = {
    TTS_ENGINE: 'neural',
    TTS_VOICE: 'Joanna',
    TTS_LANGUAGE: 'en-US',
    TTS_MAX_CHARS: 3000,
    STT_LANGUAGE: 'en-US',
    AUTO_SEND_ON_RELEASE: false,
    SPEAK_ON_COMPLETE: true
};

type AIProvider = 'gemini' | 'moonshot' | 'deepseek' | 'openclaw';

export const ChatBotInterface: React.FC = React.memo(() => {
    const [messages, setMessages] = useState<{ role: string, content: string }[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [inputText, setInputText] = useState("");
    const [statusText, setStatusText] = useState("Ready");
    const [streamingContent, setStreamingContent] = useState("");

    const [showSettings, setShowSettings] = useState(false);
    const [provider, setProvider] = useState<AIProvider>('gemini');
    const [customApiKey, setCustomApiKey] = useState("");
    const [customBaseUrl, setCustomBaseUrl] = useState("");

    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const recognitionRef = useRef<any>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputTextRef = useRef(inputText);
    const isRecordingRef = useRef(isRecording);

    useEffect(() => {
        inputTextRef.current = inputText;
    }, [inputText]);

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

            recognition.onstart = () => {
                setIsRecording(true);
                setStatusText('Listening...');
            };

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
                if (e.error === 'not-allowed') {
                    setStatusText('Mic access denied. Please allow microphone permissions.');
                } else {
                    setStatusText('STT Error: ' + e.error);
                }
            };

            // Wrap finalizeRecording in a scope that captures the latest deps or use ref
            recognition.onend = () => {
                if (isRecordingRef.current) {
                    try { recognition.start(); } catch(e) {}
                } else {
                    const text = inputTextRef.current.trim();
                    if (text && CONFIG.AUTO_SEND_ON_RELEASE) {
                        handleSendMessage(text);
                    } else {
                        setStatusText('Ready');
                    }
                }
            };

            recognitionRef.current = recognition;
        }

        // Cleanup
        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch(e) {}
            }
            stopSpeaking();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cleanupSpeech = useCallback(() => {
        setIsSpeaking(false);
        setIsStreaming(false);
        setStreamingContent("");
        setStatusText('Ready');
    }, []);

    const stopSpeaking = useCallback(() => {
        window.speechSynthesis.cancel();
        cleanupSpeech();
    }, [cleanupSpeech]);

    const speakText = async (text: string) => {
        if (isSpeaking) stopSpeaking();
        if (text.length > CONFIG.TTS_MAX_CHARS) text = text.slice(0, CONFIG.TTS_MAX_CHARS);

        return new Promise<void>((resolve) => {
            setIsSpeaking(true);
            setIsStreaming(true);
            setStreamingContent("");
            setStatusText('Speaking...');
            
            // Add a zero-width space or a short pause punctuation to prevent cut off
            const paddedText = text + " .";
            const utterance = new SpeechSynthesisUtterance(paddedText);
            currentUtteranceRef.current = utterance;
            utterance.lang = CONFIG.TTS_LANGUAGE;
            
            const voices = window.speechSynthesis.getVoices();
            const newerVoice = voices.find(v => 
                v.name.includes('Premium') ||
                v.name.includes('Enhanced') ||
                v.name.includes('Online') ||
                v.name.includes('Google US English')
            );
            if (newerVoice) {
                utterance.voice = newerVoice;
            } else {
                const fallbackVoice = voices.find(v => v.name.includes('Samantha') || v.name.includes('Zira'));
                if(fallbackVoice) utterance.voice = fallbackVoice;
            }

            let lastCharIndex = 0;
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    window.dispatchEvent(new CustomEvent('chatbot-word'));
                    
                    // Display word progress sequentially
                    const wordEnd = event.charIndex + (event.charLength || 5);
                    let currentSpokenText = text.slice(0, wordEnd);
                    // Just in case length is not supported by browser
                    if (!event.charLength) {
                        const nextSpace = text.indexOf(' ', event.charIndex);
                        currentSpokenText = text.slice(0, nextSpace === -1 ? text.length : nextSpace);
                    }
                    setStreamingContent(currentSpokenText);
                }
            };
            
            utterance.onend = () => {
                setIsStreaming(false);
                setStreamingContent("");
                cleanupSpeech();
                resolve();
            };
            
            utterance.onerror = (e) => {
                console.error('TTS error:', e);
                setIsStreaming(false);
                setStreamingContent("");
                cleanupSpeech();
                resolve();
            };

            window.speechSynthesis.speak(utterance);
        });
    };

    const getAIResponse = async (contextMessages: any[]) => {
        setStatusText('Thinking...');
        setIsStreaming(true);
        setStreamingContent("");

        try {
            if (provider === 'gemini') {
                const ai = new GoogleGenAI({ apiKey: customApiKey || process.env.GEMINI_API_KEY });
                
                // Format context history for Gemini Chat
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
                        // setStreamingContent(prev => prev + delta); // Moved to TTS
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
                                    // setStreamingContent(prev => prev + delta); // Moved to TTS
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
            setStatusText('Ready');
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!text.trim() || isProcessing) return;

        setIsProcessing(true);
        setInputText('');
        if (isSpeaking) stopSpeaking();

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);

        try {
            const responseText = await getAIResponse(newMessages);
            if (responseText) {
                if (CONFIG.SPEAK_ON_COMPLETE) {
                    await speakText(responseText);
                }
                setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
            }
        } catch (error: any) {
            setMessages(prev => [...prev, { role: 'assistant', content: `[Error]: ${error.message}` }]);
        } finally {
            setIsProcessing(false);
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

    // Keyboard escape listener
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

    return (
        <div className="relative flex flex-col items-center justify-end h-full w-full max-w-4xl mx-auto pointer-events-auto p-4 pb-20">
            {/* Top Settings Bar */}
            <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-3 rounded-full bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-800/50 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </button>
                {showSettings && (
                    <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 rounded-xl p-4 w-64 shadow-[0_0_20px_rgba(0,255,255,0.15)] flex flex-col gap-3">
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
                {/* Voice Input Container */}
                <div className="flex flex-col items-center flex-grow">
                    <p className={`text-lg md:text-xl font-mono transition-opacity duration-300 text-center mb-6 drop-shadow-md ${isRecording ? 'text-red-400 opacity-100 animate-pulse' : 'text-cyan-400 opacity-80'}`}>
                        {statusText}
                    </p>

                    <div className="flex flex-col items-center w-full gap-4 relative">
                        {/* Huge PTT Orb */}
                        <div 
                            className={`w-28 h-28 md:w-32 md:h-32 flex-shrink-0 cursor-pointer relative rounded-full overflow-hidden transition-all duration-300 border-2 flex items-center justify-center ${isRecording ? 'scale-90 shadow-[0_0_80px_rgba(255,0,0,0.8)] border-red-500 bg-red-500/20' : 'hover:scale-110 shadow-[0_0_60px_rgba(0,255,255,0.4)] border-cyan-500/80 bg-cyan-900/40'} ${isBusy ? 'opacity-50 pointer-events-none shadow-[0_0_40px_rgba(255,0,255,0.4)] border-fuchsia-500' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); startRecording(); }}
                            onMouseUp={(e) => { e.preventDefault(); stopRecording(); }}
                            onMouseLeave={(e) => { if (isRecording) stopRecording(); }}
                            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {!isBusy ? (
                                <svg className={`w-12 h-12 md:w-16 md:h-16 transition-colors ${isRecording ? 'text-red-400' : 'text-cyan-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                            ) : (
                                <svg className="w-12 h-12 md:w-16 md:h-16 text-fuchsia-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            )}
                        </div>
                        
                        <p className="text-xs text-cyan-500/60 font-mono tracking-widest mt-2">
                            {isBusy ? "PROCESSING..." : "HOLD TO SPEAK"}
                        </p>

                        {/* Optional text input fallback */}
                        <div className="w-full max-w-2xl mt-8 transition-opacity group relative">
                            {/* Outer Glow */}
                            <div className="absolute inset-0 bg-cyan-400 opacity-20 blur-xl rounded-3xl animate-pulse"></div>
                            <textarea
                                rows={3}
                                placeholder="Or type your message here..." 
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onFocus={() => { if (isSpeaking) stopSpeaking(); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(inputText);
                                    }
                                }}
                                disabled={isProcessing}
                                className="relative w-full bg-black/80 border-2 border-cyan-400 rounded-3xl py-6 px-8 text-center text-cyan-50 text-xl md:text-2xl lg:text-3xl placeholder-cyan-500/70 focus:outline-none focus:border-cyan-300 focus:shadow-[0_0_60px_rgba(0,255,255,0.8)] shadow-[0_0_30px_rgba(0,255,255,0.4)] transition-all font-mono disabled:opacity-50 resize-none leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

