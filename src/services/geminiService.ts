import { GoogleGenAI } from "@google/genai";
import { supabase } from "./supabaseClient";
import { dataService } from "./dataService";

// NOTE: In a real production app, ensure API_KEY is loaded safely from env
// For this environment, we assume process.env.API_KEY is available.
const apiKey = process.env.API_KEY || '';

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async logAiUsage(model: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Use central dataService for consistent logging
        await dataService.logActivity(user.id, 'ai_call', model, { provider: 'google-genai' });
      }
    } catch (e) {
      console.warn("Failed to log AI usage", e);
    }
  }

  async generateContent(prompt: string, model: string = 'gemini-2.5-flash') {
    if (!apiKey) throw new Error("API Key not found");
    
    try {
      // Log first
      await this.logAiUsage(model);
      
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  async generateStream(prompt: string, model: string = 'gemini-2.5-flash') {
     if (!apiKey) throw new Error("API Key not found");

     await this.logAiUsage(model);
     return await this.ai.models.generateContentStream({
       model: model,
       contents: prompt
     });
  }
}

export const geminiService = new GeminiService();