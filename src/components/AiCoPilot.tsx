import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  BrainCircuit, 
  Terminal,
  Activity,
  Zap,
  Loader2,
  XCircle,
  MessageSquare,
  Sparkles
} from 'lucide-react';

import { aiSettingsStorage, AiSettings, aiHeaders } from '../lib/aiSettings';
import { sanitizeAiResponse, SanitizedCommand, SanitizedProtocol } from '../lib/aiGuard';

interface AiCoPilotProps {
  currentState: any;
  onExecuteCommand: (command: SanitizedCommand) => void;
  onLoadProtocol: (protocol: SanitizedProtocol) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'command' | 'protocol' | 'analysis';
  /** Staged AI protocol: never auto-started, the user presses Run. */
  protocol?: SanitizedProtocol;
  guardNote?: string;
}

export const AiCoPilot: React.FC<AiCoPilotProps> = ({ currentState, onExecuteCommand, onLoadProtocol }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Systems initialized. AI Co-Pilot standby. How can I assist with your stimulation research today?" }
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(aiSettingsStorage.get());
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Sync settings on focus or mount
    const syncSettings = () => {
      setAiSettings(aiSettingsStorage.get());
    };
    window.addEventListener('focus', syncSettings);
    return () => window.removeEventListener('focus', syncSettings);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/ai/command', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ prompt: text, currentState })
      });

      if (response.status === 401) {
        const { error } = await response.json().catch(() => ({ error: 'Unauthorized' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `Co-pilot locked: ${error}`, type: 'analysis' }]);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Server already sanitizes; validate again here, right before applying.
      const result = sanitizeAiResponse(await response.json());
      const { dropped, adjusted } = result.report;
      const guardNote = dropped.length || adjusted.length
        ? `Safety guard: ${adjusted.length ? `clamped ${adjusted.join(', ')}` : ''}${adjusted.length && dropped.length ? '; ' : ''}${dropped.length ? `ignored ${dropped.join(', ')}` : ''}`
        : undefined;
      
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: result.message,
        type: result.type,
        protocol: result.type === 'protocol' ? (result.data as SanitizedProtocol) : undefined,
        guardNote,
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      if (result.type === 'command' && result.data) {
        onExecuteCommand(result.data as SanitizedCommand);
      }

      if (aiSettings.useVoiceFeedback) {
        speak(result.message);
      }
    } catch (error) {
      console.error('AI Processing Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Error communicating with neural link. Please check connectivity." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const speak = async (text: string) => {
    if (!aiSettings.useVoiceFeedback || !text || text.trim() === '') return;
    setIsSpeaking(true);

    // Fallback function for Web Speech API
    const webSpeechFallback = () => {
      console.log('Using Web Speech API Fallback');
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find the requested fallback voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes(aiSettings.fallbackVoice) || v.name.includes('English'));
      if (preferred) utterance.voice = preferred;
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    };

    if (!navigator.onLine) {
      webSpeechFallback();
      return;
    }

    try {
      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ 
          text, 
          voice: aiSettings.voice,
          model: aiSettings.model.includes('flash') ? 'gemini-3.8-flash-lite-tts' : 'gemini-3.8-flash-tts'
        })
      });
      
      if (!response.ok) throw new Error('TTS Service Unavailable');
      
      const { audio } = await response.json();
      if (audio) {
        const audioObj = new Audio(`data:audio/wav;base64,${audio}`);
        audioObj.onended = () => setIsSpeaking(false);
        audioObj.onerror = () => {
          console.warn('Audio element error, falling back to Web Speech');
          webSpeechFallback();
        };
        audioObj.play().catch(e => {
          console.warn('Audio play error, falling back to Web Speech:', e);
          webSpeechFallback();
        });
      } else {
        webSpeechFallback();
      }
    } catch (error) {
      console.error('TTS Error, attempting fallback:', error);
      webSpeechFallback();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await transcribeAndSend(base64Audio);
        };
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording start failed:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndSend = async (base64Audio: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/stt', {
        method: 'POST',
        headers: aiHeaders(),
        body: JSON.stringify({ audio: base64Audio, model: 'gemini-3.5-transcribe' })
      });
      const { text } = await response.json();
      if (text) {
        handleSend(text);
      }
    } catch (error) {
      console.error('STT Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl flex flex-col h-[500px] font-mono overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-[#131b26] border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <BrainCircuit className={`w-5 h-5 text-cyan-400 ${isProcessing ? 'animate-pulse' : ''}`} />
            {isProcessing && <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />}
          </div>
          <div>
            <span className="text-xs font-black text-slate-100 uppercase tracking-widest">Neural Co-Pilot</span>
              <div className="flex items-center gap-1.5 text-[8px] text-cyan-600 font-bold uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {aiSettings.model.toUpperCase()} Active
              </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const newSettings = { ...aiSettings, useVoiceFeedback: !aiSettings.useVoiceFeedback };
              setAiSettings(newSettings);
              aiSettingsStorage.save(newSettings);
            }}
            className={`p-1.5 rounded-lg transition-all ${aiSettings.useVoiceFeedback ? 'text-cyan-400 bg-cyan-950/30' : 'text-slate-600 hover:text-slate-400'}`}
            title="Toggle Voice Feedback"
          >
            {aiSettings.useVoiceFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <div className="text-[10px] text-slate-500 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
            {isSpeaking ? 'SPEAKING...' : 'STANDBY'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[radial-gradient(circle_at_center,_#0c141d_0%,_#070b0f_100%)]">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs relative ${
              msg.role === 'user' 
                ? 'bg-cyan-900/30 border border-cyan-800/50 text-cyan-100 rounded-tr-none' 
                : 'bg-[#15202c] border border-[#23384f] text-slate-200 rounded-tl-none'
            }`}>
              {msg.role === 'assistant' && (
                <div className="absolute -left-2 -top-2 bg-[#0b1016] border border-[#23384f] rounded-full p-1">
                  <Bot className="w-3 h-3 text-cyan-400" />
                </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.content}
              </div>
              {msg.guardNote && (
                <div className="mt-2 text-[9px] font-mono text-amber-300/80">{msg.guardNote}</div>
              )}
              {msg.protocol && (
                <button
                  onClick={() => msg.protocol && onLoadProtocol(msg.protocol)}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-purple-900/40 border border-purple-700/60 text-purple-200 text-[10px] font-bold uppercase tracking-widest hover:bg-purple-800/50"
                >
                  Run protocol ({Math.round(msg.protocol.totalDurationMs / 1000)} s)
                </button>
              )}
              {msg.type && (
                <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter">
                  {msg.type === 'command' && <Zap className="w-3 h-3 text-amber-400" />}
                  {msg.type === 'protocol' && <Sparkles className="w-3 h-3 text-purple-400" />}
                  {msg.type === 'analysis' && <Activity className="w-3 h-3 text-emerald-400" />}
                  <span className={
                    msg.type === 'command' ? 'text-amber-400' : 
                    msg.type === 'protocol' ? 'text-purple-400' : 'text-emerald-400'
                  }>
                    {msg.type === 'protocol' ? 'protocol STAGED' : `${msg.type} EXECUTED`}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-[#15202c] border border-[#23384f] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">Neural Processing...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-[#0b1016] border-t border-[#1e293b]">
        <div className="flex items-center gap-2">
          <button 
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            className={`p-3 rounded-full transition-all flex items-center justify-center ${
              isRecording 
                ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse scale-110' 
                : 'bg-[#15202c] text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30'
            }`}
            title="Hold to speak command"
          >
            {isRecording ? <Mic className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder={isRecording ? "Listening..." : "Neural link ready... type or speak command"}
              disabled={isProcessing}
              className="w-full bg-[#101720] border border-[#1e293b] rounded-full py-2.5 px-5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-800 transition-colors"
            />
            <button 
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isProcessing}
              className="absolute right-2 top-1.5 p-1.5 text-cyan-500 hover:text-cyan-400 disabled:text-slate-700 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Quick Commands */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          {[
            { label: "Analyze State", icon: Activity },
            { label: "Relax Protocol", icon: Sparkles },
            { label: "High Intensity", icon: Zap },
            { label: "Stop Stim", icon: XCircle }
          ].map((cmd, i) => (
            <button 
              key={i}
              onClick={() => handleSend(cmd.label)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#15202c] border border-[#1e293b] rounded-full text-[9px] font-black text-slate-400 hover:text-cyan-300 hover:border-cyan-800 transition-all whitespace-nowrap"
            >
              <cmd.icon className="w-2.5 h-2.5" />
              {cmd.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
