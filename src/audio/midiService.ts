/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MIDI Integration Service
 * Handles Web MIDI API access, device enumeration, and message routing
 * for external control of stimulation parameters.
 */

export type MidiMappingType = 'masterVolume' | 'carrierFreq' | 'modFreq' | 'modDepth';

export interface MidiMapping {
  cc: number;
  param: MidiMappingType;
  channel: 'left' | 'right' | 'both';
}

export type MidiCallback = (param: MidiMappingType, value: number, channel: 'left' | 'right') => void;

export interface MidiLearnState {
  param: MidiMappingType;
  channel: 'left' | 'right' | 'both';
}

export type MidiLearnCallback = (param: MidiMappingType, cc: number) => void;

export class MidiService {
  private access: MIDIAccess | null = null;
  private inputs: MIDIInput[] = [];
  private onMessageCallback: MidiCallback | null = null;
  private onLearnCallback: MidiLearnCallback | null = null;
  private learningState: MidiLearnState | null = null;
  
  private mappings: MidiMapping[] = [
    { cc: 3, param: 'masterVolume', channel: 'both' }, // MPD218 Knob 1
    { cc: 9, param: 'carrierFreq', channel: 'both' },   // MPD218 Knob 2
    { cc: 14, param: 'modFreq', channel: 'both' },     // MPD218 Knob 3
    { cc: 15, param: 'modDepth', channel: 'both' },    // MPD218 Knob 4
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

    if (command === 0xb0) { // Control Change
      const cc = data1;
      const value = data2; // 0-127
      
      // Handle MIDI Learn
      if (this.learningState) {
        this.updateMapping(cc, this.learningState.param, this.learningState.channel);
        if (this.onLearnCallback) {
          this.onLearnCallback(this.learningState.param, cc);
        }
        this.learningState = null;
        return;
      }

      if (!this.onMessageCallback) return;

      const mapping = this.mappings.find(m => m.cc === cc);
      if (mapping) {
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

  public updateMapping(cc: number, param: MidiMappingType, channel: 'left' | 'right' | 'both'): void {
    // Remove existing mappings for this CC to avoid conflicts if needed, 
    // but usually multiple params can be mapped to one CC. 
    // Here we'll just update the specific param/channel combo.
    const existingIndex = this.mappings.findIndex(m => m.param === param && m.channel === channel);
    if (existingIndex !== -1) {
      this.mappings[existingIndex].cc = cc;
    } else {
      this.mappings.push({ cc, param, channel });
    }
  }

  public getMappings(): MidiMapping[] {
    return [...this.mappings];
  }
}

export const midiService = new MidiService();
