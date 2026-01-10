
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generatePlanSuggestion = async (input: string) => {
  if (!process.env.API_KEY) return null;

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
