
import { GoogleGenAI, Type } from "@google/genai";

// Safely access process.env to avoid ReferenceError in browser environments that don't polyfill it globally
const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const generatePlanSuggestion = async (input: string) => {
  if (!apiKey) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest a planning flow for: ${input}. 
      Give me one Objective, one Task, and one Goal. 
      Keep descriptions brief.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            objective: { type: Type.STRING },
            task: { type: Type.STRING },
            goal: { type: Type.STRING }
          },
          required: ["objective", "task", "goal"]
        }
      }
    });

    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating suggestion:", error);
    return null;
  }
};
