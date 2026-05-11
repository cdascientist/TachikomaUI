import React, { useState, useEffect } from 'react';

export interface ConfigField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'textarea' | 'number' | 'toggle' | 'select';
    value: any;
    placeholder?: string;
    options?: { label: string; value: string }[];
    hint?: string;
}

interface SystemConfigPanelProps {
    title: string;
    description: string;
    storageKey: string;
    fields: ConfigField[];
    accentColor?: string;
    onFieldsChange?: (fields: ConfigField[]) => void;
}

export const SystemConfigPanel: React.FC<SystemConfigPanelProps> = ({
    title,
    description,
    storageKey,
    fields: initialFields,
    accentColor = 'cyan',
    onFieldsChange
}) => {
    const [fields, setFields] = useState<ConfigField[]>(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return initialFields.map(f => ({
                    ...f,
                    value: parsed[f.key] !== undefined ? parsed[f.key] : f.value
                }));
            } catch {}
        }
        return initialFields;
    });
    const [saveMsg, setSaveMsg] = useState('');

    useEffect(() => {
        const data: Record<string, any> = {};
        fields.forEach(f => { data[f.key] = f.value; });
        localStorage.setItem(storageKey, JSON.stringify(data));
        if (onFieldsChange) onFieldsChange(fields);
    }, [fields, storageKey]);

    const updateField = (key: string, value: any) => {
        setFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
    };

    const handleSave = () => {
        const data: Record<string, any> = {};
        fields.forEach(f => { data[f.key] = f.value; });
        localStorage.setItem(storageKey, JSON.stringify(data));
        setSaveMsg('Saved at ' + new Date().toLocaleTimeString());
        setTimeout(() => setSaveMsg(''), 3000);
    };

    const exportConfig = () => {
        const data: Record<string, any> = {};
        fields.forEach(f => { data[f.key] = f.value; });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = storageKey + '.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const importConfig = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target?.result as string);
                    setFields(prev => prev.map(f => ({
                        ...f,
                        value: data[f.key] !== undefined ? data[f.key] : f.value
                    })));
                    setSaveMsg('Imported successfully');
                    setTimeout(() => setSaveMsg(''), 3000);
                } catch {
                    setSaveMsg('Invalid config file');
                    setTimeout(() => setSaveMsg(''), 3000);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const colorMap: Record<string, { border: string; text: string; glow: string; bg: string; btn: string }> = {
        cyan: { border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-[0_0_20px_rgba(0,255,255,0.1)]', bg: 'bg-cyan-900/10', btn: 'bg-cyan-600/20 hover:bg-cyan-600/40 border-cyan-500/50 text-cyan-400' },
        fuchsia: { border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', glow: 'shadow-[0_0_20px_rgba(255,0,255,0.1)]', bg: 'bg-fuchsia-900/10', btn: 'bg-fuchsia-600/20 hover:bg-fuchsia-600/40 border-fuchsia-500/50 text-fuchsia-400' },
        green: { border: 'border-green-500/30', text: 'text-green-400', glow: 'shadow-[0_0_20px_rgba(0,255,0,0.1)]', bg: 'bg-green-900/10', btn: 'bg-green-600/20 hover:bg-green-600/40 border-green-500/50 text-green-400' },
        yellow: { border: 'border-yellow-500/30', text: 'text-yellow-400', glow: 'shadow-[0_0_20px_rgba(255,255,0,0.1)]', bg: 'bg-yellow-900/10', btn: 'bg-yellow-600/20 hover:bg-yellow-600/40 border-yellow-500/50 text-yellow-400' },
        purple: { border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.1)]', bg: 'bg-purple-900/10', btn: 'bg-purple-600/20 hover:bg-purple-600/40 border-purple-500/50 text-purple-400' },
    };
    const c = colorMap[accentColor] || colorMap.cyan;

    return (
        <div className="flex flex-col h-full justify-center items-center p-4 md:p-8 text-left select-none w-full max-w-3xl mx-auto">
            <div className={`w-full backdrop-blur-xl bg-black/60 border ${c.border} rounded-3xl p-6 md:p-8 ${c.glow} pointer-events-auto`}>
                <div className="flex items-center justify-between mb-2">
                    <h2 className={`text-2xl md:text-3xl font-mono ${c.text} drop-shadow-md uppercase tracking-widest`}>
                        {title}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={importConfig} className="px-3 py-1.5 text-xs font-mono border border-gray-500/30 rounded-lg text-gray-400 hover:text-white hover:border-gray-400/50 transition-colors">
                            Import
                        </button>
                        <button onClick={exportConfig} className="px-3 py-1.5 text-xs font-mono border border-gray-500/30 rounded-lg text-gray-400 hover:text-white hover:border-gray-400/50 transition-colors">
                            Export
                        </button>
                    </div>
                </div>
                <p className="text-gray-400 font-mono text-xs mb-6 border-l-2 border-gray-500/30 pl-3">
                    {description}
                </p>

                <div className="flex flex-col gap-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                    {fields.map((field) => (
                        <div key={field.key} className={`p-4 rounded-xl ${c.bg} border ${c.border}`}>
                            <label className={`block ${c.text} font-mono text-xs uppercase tracking-widest mb-1.5`}>
                                {field.label}
                            </label>
                            {field.type === 'toggle' ? (
                                <button
                                    onClick={() => updateField(field.key, !field.value)}
                                    className={`w-14 h-7 rounded-full transition-colors relative ${field.value ? 'bg-green-500/80' : 'bg-gray-700'}`}
                                >
                                    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${field.value ? 'translate-x-7' : 'translate-x-0.5'}`} />
                                </button>
                            ) : field.type === 'select' ? (
                                <select
                                    value={field.value}
                                    onChange={(e) => updateField(field.key, e.target.value)}
                                    className="w-full bg-black/60 border border-gray-500/30 rounded-lg px-3 py-2 text-sm text-cyan-50 focus:outline-none focus:border-cyan-400 font-mono"
                                >
                                    {(field.options || []).map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            ) : field.type === 'textarea' ? (
                                <textarea
                                    value={field.value}
                                    onChange={(e) => updateField(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    rows={4}
                                    className="w-full bg-black/60 border border-gray-500/30 rounded-lg px-3 py-2 text-sm text-cyan-50 focus:outline-none focus:border-cyan-400 font-mono resize-none placeholder-gray-600"
                                />
                            ) : field.type === 'number' ? (
                                <input
                                    type="number"
                                    value={field.value}
                                    onChange={(e) => updateField(field.key, Number(e.target.value))}
                                    className="w-full bg-black/60 border border-gray-500/30 rounded-lg px-3 py-2 text-sm text-cyan-50 focus:outline-none focus:border-cyan-400 font-mono"
                                />
                            ) : (
                                <input
                                    type={field.type === 'password' ? 'password' : 'text'}
                                    value={field.value}
                                    onChange={(e) => updateField(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full bg-black/60 border border-gray-500/30 rounded-lg px-3 py-2 text-sm text-cyan-50 focus:outline-none focus:border-cyan-400 font-mono placeholder-gray-600"
                                />
                            )}
                            {field.hint && (
                                <p className="text-gray-500 font-mono text-[10px] mt-1">{field.hint}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-500/20">
                    <span className={`font-mono text-xs ${saveMsg ? 'text-green-400' : 'text-transparent'} transition-colors`}>
                        {saveMsg || '.'}
                    </span>
                    <button
                        onClick={handleSave}
                        className={`px-6 py-2.5 rounded-xl font-mono text-sm uppercase tracking-widest border ${c.btn} transition-all shadow-md active:scale-95`}
                    >
                        Save Configuration
                    </button>
                </div>
            </div>
        </div>
    );
};
