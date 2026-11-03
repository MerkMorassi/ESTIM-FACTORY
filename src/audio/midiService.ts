/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MIDI Integration Service
 * Handles Web MIDI API access, device enumeration, and message routing
 * for external control of stimulation parameters.
 */

export type MidiMappingType = 
  'masterVolume' | 
  'carrierFreq' | 
  'modFreq' | 
  'modDepth' | 
  'carrierMorph' | 
  'carrierPhase' | 
  'masterBpm' | 
  'power' | 
  'mode' | 
  'sync' | 
  'channelFocus';

export interface MidiMapping {
  cc?: number;
  note?: number;
  param: MidiMappingType;
  channel: 'left' | 'right' | 'both';
}

export type MidiCallback = (param: MidiMappingType, value: number, channel: 'left' | 'right') => void;

export interface MidiLearnState {
  param: MidiMappingType;
  channel: 'left' | 'right' | 'both';
}

export type MidiLearnCallback = (param: MidiMappingType, id: { cc?: number, note?: number }) => void;

export class MidiService {
  private access: MIDIAccess | null = null;
  private inputs: MIDIInput[] = [];
  private onMessageCallback: MidiCallback | null = null;
  private onLearnCallback: MidiLearnCallback | null = null;
  private learningState: MidiLearnState | null = null;
  
  private mappings: MidiMapping[] = [
    // Bank A Knobs (CC)
    { cc: 3, param: 'masterVolume', channel: 'both' }, // Knob 1
    { cc: 9, param: 'carrierFreq', channel: 'both' },   // Knob 2
    { cc: 12, param: 'modFreq', channel: 'both' },     // Knob 3
    { cc: 13, param: 'modDepth', channel: 'both' },    // Knob 4
    { cc: 14, param: 'carrierMorph', channel: 'both' }, // Knob 5
    { cc: 15, param: 'masterBpm', channel: 'both' },   // Knob 6
    
    // Bank A Pads (Note)
    { note: 36, param: 'power', channel: 'both' },    // Pad 1
    { note: 37, param: 'mode', channel: 'both' },     // Pad 2
    { note: 38, param: 'sync', channel: 'both' },     // Pad 3
    { note: 39, param: 'channelFocus', channel: 'both' }, // Pad 4
  ];

  public async requestAccess(): Promise<boolean> {
    try {
      if (!navigator.requestMIDIAccess) return false;
      this.access = await navigator.requestMIDIAccess();
      this.updateInputs();
      this.access.onstatechange = () => this.updateInputs();
      return true;
    } catch (err) {
      console.error('MIDI Access Denied:', err);
      return false;
    }
  }

  private updateInputs(): void {
    if (!this.access) return;
    this.inputs = Array.from(this.access.inputs.values());
    this.inputs.forEach(input => {
      input.onmidimessage = (msg) => this.handleMidiMessage(msg);
    });
  }

  public getInputs(): MIDIInput[] {
    return this.inputs;
  }

  public setCallback(cb: MidiCallback): void {
    this.onMessageCallback = cb;
  }

  public setLearnCallback(cb: MidiLearnCallback): void {
    this.onLearnCallback = cb;
  }

  public startLearning(param: MidiMappingType, channel: 'left' | 'right' | 'both'): void {
    this.learningState = { param, channel };
  }

  public stopLearning(): void {
    this.learningState = null;
  }

  public isLearning(): boolean {
    return this.learningState !== null;
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data) return;
    const [status, data1, data2] = event.data;
    const command = status & 0xf0;

    if (command === 0xb0 || command === 0x90) { // Control Change or Note On
      const isCC = command === 0xb0;
      const id = data1;
      const value = data2; // 0-127
      
      // Handle MIDI Learn
      if (this.learningState) {
        const mappingId = isCC ? { cc: id } : { note: id };
        this.updateMapping(mappingId, this.learningState.param, this.learningState.channel);
        if (this.onLearnCallback) {
          this.onLearnCallback(this.learningState.param, mappingId);
        }
        this.learningState = null;
        return;
      }

      if (!this.onMessageCallback) return;

      const mapping = this.mappings.find(m => isCC ? m.cc === id : m.note === id);
      if (mapping) {
        // For notes, only trigger on Note On (velocity > 0)
        if (!isCC && value === 0) return;

        const normalizedValue = value / 127;
        
        if (mapping.channel === 'both' || mapping.channel === 'left') {
          this.onMessageCallback(mapping.param, normalizedValue, 'left');
        }
        if (mapping.channel === 'both' || mapping.channel === 'right') {
          this.onMessageCallback(mapping.param, normalizedValue, 'right');
        }
      }
    }
  }

  public updateMapping(id: { cc?: number, note?: number }, param: MidiMappingType, channel: 'left' | 'right' | 'both'): void {
    const existingIndex = this.mappings.findIndex(m => m.param === param && m.channel === channel);
    if (existingIndex !== -1) {
      this.mappings[existingIndex].cc = id.cc;
      this.mappings[existingIndex].note = id.note;
    } else {
      this.mappings.push({ ...id, param, channel });
    }
  }

  public getMappings(): MidiMapping[] {
    return [...this.mappings];
  }
}

export const midiService = new MidiService();
