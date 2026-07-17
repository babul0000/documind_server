import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not defined in environment variables. AI features will fail.');
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
