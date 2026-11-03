/**
 * AI Settings persistence layer
 */

export interface AiSettings {
  model: string;
  voice: string;
  fallbackVoice: string;
  useVoiceFeedback: boolean;
}

const DEFAULT_SETTINGS: AiSettings = {
  model: 'gemini-3.8-flash',
  voice: 'Kore',
  fallbackVoice: 'Google UK English Female',
  useVoiceFeedback: true,
};

const SETTINGS_KEY = 'signal_telemetry_ai_settings';

export const aiSettingsStorage = {
  get: (): AiSettings => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  save: (settings: AiSettings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
};
