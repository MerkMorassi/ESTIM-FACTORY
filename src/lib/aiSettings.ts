/**
 * AI Settings persistence layer
 */

export interface AiSettings {
  model: string;
  voice: string;
  fallbackVoice: string;
  useVoiceFeedback: boolean;
  /** Sent as x-copilot-token when the server sets COPILOT_ACCESS_TOKEN. */
  accessToken: string;
}

const DEFAULT_SETTINGS: AiSettings = {
  model: 'gemini-3.8-flash',
  voice: 'Kore',
  fallbackVoice: 'Google UK English Female',
  useVoiceFeedback: true,
  accessToken: '',
};

const SETTINGS_KEY = 'signal_telemetry_ai_settings';

/** Headers for /api/ai/* calls, including the co-pilot access token if set. */
export const aiHeaders = (): Record<string, string> => {
  const { accessToken } = aiSettingsStorage.get();
  return accessToken
    ? { 'Content-Type': 'application/json', 'x-copilot-token': accessToken }
    : { 'Content-Type': 'application/json' };
};

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
