import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Mic2, 
  ShieldCheck, 
  Save, 
  RotateCcw,
  Globe,
  WifiOff,
  Database,
  ExternalLink,
  Key
} from 'lucide-react';
import { aiSettingsStorage, AiSettings } from '../lib/aiSettings';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AiSettings>(aiSettingsStorage.get());
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [availableWebVoices, setAvailableWebVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableWebVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleSave = () => {
    setSaveStatus('saving');
    aiSettingsStorage.save(settings);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleReset = () => {
    const defaults = {
      model: 'gemini-3.8-flash',
      voice: 'Kore',
      fallbackVoice: 'Google UK English Female',
      useVoiceFeedback: true,
    };
    setSettings(defaults);
    aiSettingsStorage.save(defaults);
  };

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl flex flex-col h-[500px] font-mono overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-[#131b26] border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="text-xs font-black text-slate-100 uppercase tracking-widest">System Preferences</span>
            <div className="text-[8px] text-cyan-600 font-bold uppercase">Signal Telemetry Configuration</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleReset}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            title="Reset to Defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button 
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${
              saveStatus === 'saved' ? 'bg-emerald-600 text-white' : 'bg-cyan-600 text-white hover:bg-cyan-500'
            }`}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-[radial-gradient(circle_at_center,_#0c141d_0%,_#070b0f_100%)]">
        
        {/* API Key Notice */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-[#1e293b] pb-2">
            <Key className="w-4 h-4 text-amber-500" />
            Gemini Neural Interface
          </div>
          <div className="bg-amber-950/20 border border-amber-900/50 rounded-lg p-4 space-y-3">
            <div className="text-[10px] text-amber-200 leading-relaxed">
              For security, API keys are managed at the platform level. To update or check your key, please use the <strong>Settings &gt; Secrets</strong> panel in the AI Studio environment.
            </div>
            <div className="flex items-center gap-2 text-[9px] text-amber-500/70 font-bold italic uppercase">
              <ShieldCheck className="w-3 h-3" />
              Secure Proxy Architecture Active
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-[#1e293b] pb-2">
            <Cpu className="w-4 h-4 text-cyan-500" />
            Neural Engine Model
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Active LLM Instance</label>
              <select 
                value={settings.model}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
                className="w-full bg-[#101720] border border-[#1e293b] rounded-lg py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-cyan-800 transition-colors cursor-pointer appearance-none"
              >
                <option value="gemini-3.8-flash">Gemini 3.8 Flash (Optimized for Speed)</option>
                <option value="gemini-4-argon">Gemini 4 Argon (Advanced Reasoning)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Efficiency)</option>
              </select>
              <p className="text-[9px] text-slate-600 italic">Select the neural model responsible for protocol analysis and command generation.</p>
            </div>
          </div>
        </div>

        {/* Voice Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest border-b border-[#1e293b] pb-2">
            <Mic2 className="w-4 h-4 text-purple-500" />
            Synthesis Configuration
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-cyan-600" />
                Gemini Neural Voice (Online)
              </label>
              <select 
                value={settings.voice}
                onChange={(e) => setSettings({...settings, voice: e.target.value})}
                className="w-full bg-[#101720] border border-[#1e293b] rounded-lg py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-cyan-800 transition-colors cursor-pointer"
              >
                <option value="Kore">Kore (Balanced)</option>
                <option value="Puck">Puck (Cheerful)</option>
                <option value="Charon">Charon (Professional)</option>
                <option value="Fenrir">Fenrir (Deep)</option>
                <option value="Zephyr">Zephyr (Bright)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <WifiOff className="w-3 h-3 text-rose-600" />
                Browser Fallback (Offline)
              </label>
              <select 
                value={settings.fallbackVoice}
                onChange={(e) => setSettings({...settings, fallbackVoice: e.target.value})}
                className="w-full bg-[#101720] border border-[#1e293b] rounded-lg py-2.5 px-4 text-xs text-slate-200 focus:outline-none focus:border-cyan-800 transition-colors cursor-pointer"
              >
                {availableWebVoices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
                {availableWebVoices.length === 0 && <option value="Google UK English Female">Google UK English Female (Default)</option>}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#101720]/50 p-3 rounded-lg border border-[#1e293b]">
            <input 
              type="checkbox"
              id="voiceFeedback"
              checked={settings.useVoiceFeedback}
              onChange={(e) => setSettings({...settings, useVoiceFeedback: e.target.checked})}
              className="w-4 h-4 accent-cyan-500 cursor-pointer"
            />
            <label htmlFor="voiceFeedback" className="text-[10px] font-bold text-slate-400 uppercase cursor-pointer">
              Enable Autonomous Neural Feedback (Voice)
            </label>
          </div>
        </div>

        {/* Persistence Notice */}
        <div className="pt-4 border-t border-[#1e293b] flex items-center gap-2 text-[9px] text-slate-600 font-bold uppercase italic">
          <Database className="w-3 h-3" />
          Settings persisted via LocalStorage
        </div>
      </div>
    </div>
  );
};
