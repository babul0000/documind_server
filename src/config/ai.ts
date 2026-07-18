import { GoogleGenerativeAI } from '@google/generative-ai';

let activeInstance: GoogleGenerativeAI | null = null;

const getActiveInstance = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not defined or is default placeholder.');
  }
  if (!activeInstance) {
    activeInstance = new GoogleGenerativeAI(apiKey);
  }
  return activeInstance;
};

// Export genAI as a Proxy that resolves fields dynamically on first access
export const genAI: any = new Proxy({} as any, {
  get(target, prop, receiver) {
    try {
      const instance = getActiveInstance();
      const value = Reflect.get(instance, prop, receiver);
      if (typeof value === 'function') {
        return value.bind(instance);
      }
      return value;
    } catch (e) {
      return undefined;
    }
  }
});

/**
 * Checks if Gemini API Key is configured and is not the default placeholder.
 */
export const isAIConfigured = (): boolean => {
  const apiKey = process.env.GEMINI_API_KEY;
  return !!apiKey && apiKey !== 'your_gemini_api_key_here';
};

