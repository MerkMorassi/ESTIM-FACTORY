import React from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Activity, 
  Trash2, 
  Cpu,
  ChevronRight,
  Monitor
} from 'lucide-react';
import { midiService, MidiMapping } from '../audio/midiService';

interface MidiMappingOverviewProps {
  onRefresh: () => void;
}

export const MidiMappingOverview: React.FC<MidiMappingOverviewProps> = ({ onRefresh }) => {
  const mappings = midiService.getMappings();

  const getParamLabel = (param: string) => {
    switch (param) {
      case 'masterVolume': return 'Master Volume';
      case 'carrierFreq': return 'Carrier Frequency';
      case 'modFreq': return 'Modulation Frequency';
      case 'modDepth': return 'Modulation Depth';
      default: return param;
    }
  };

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl overflow-hidden flex flex-col h-full font-mono">
      <div className="p-4 bg-[#131b26] border-b border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black text-cyan-400 uppercase tracking-widest">
          <Settings className="w-4 h-4" />
          MIDI Control Assignment Audit
        </div>
        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
          Active Controller Map
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
        {mappings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2 italic">
            <Activity className="w-8 h-8 opacity-20" />
            <span className="text-[10px]">No active MIDI mappings found.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {mappings.map((mapping, idx) => (
              <motion.div 
                key={`${mapping.param}-${mapping.cc}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-[#0e141c] border border-[#1a2634] rounded-lg p-3 flex items-center justify-between hover:border-cyan-800/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  {/* Physical Representation */}
                  <div className="flex flex-col items-center justify-center bg-[#15202c] border border-cyan-900/50 rounded p-2 min-w-[50px]">
                    <span className="text-[8px] text-cyan-600 font-black uppercase">CC</span>
                    <span className="text-sm font-black text-cyan-400 tabular-nums">{mapping.cc}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500">
                    <ChevronRight className="w-4 h-4" />
                  </div>

                  {/* Software Representation */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {getParamLabel(mapping.param)}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] text-slate-500 uppercase font-black flex items-center gap-1">
                        <Monitor className="w-2.5 h-2.5" />
                        Channel: {mapping.channel.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-[2px] bg-slate-900 border border-slate-800 text-[8px] font-black text-slate-600 uppercase tracking-widest">
                    Live
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-[#070b0f] border-t border-[#1e293b] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[9px] text-slate-500">
          <Cpu className="w-3 h-3" />
          Hardware Polling: 12.5ms
        </div>
        <div className="text-[9px] text-slate-600 font-bold">
          TOTAL ASSIGNMENTS: {mappings.length}
        </div>
      </div>
    </div>
  );
};
