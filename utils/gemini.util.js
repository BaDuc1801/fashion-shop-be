import { GoogleGenerativeAI } from "@google/generative-ai";

let _client = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY chưa được set trong file .env");
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export async function callAI(system, prompt, maxTokens = 300) {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.0-flash",   
    systemInstruction: system,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export default getClient;
