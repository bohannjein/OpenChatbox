import type { ProviderType } from "./types";

export interface ProviderPreset {
  name: string;
  type: ProviderType;
  baseUrl: string;
  /** true = braucht API-Key */
  needsKey: boolean;
  /** true = kein /models-Endpunkt → Modelle manuell eintragen */
  manualOnly?: boolean;
  /** Vorschläge für manuelle Modell-Eingabe */
  suggested?: string[];
  hint?: string;
}

/**
 * Katalog gängiger Anbieter. Die meisten sprechen das OpenAI-Wire-Format
 * (type "openai"); nur Anthropic weicht ab. Alles per API-Key einbindbar.
 */
export const PRESETS: ProviderPreset[] = [
  {
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
  },
  {
    name: "Anthropic (Claude)",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    needsKey: true,
  },
  {
    name: "Google Gemini",
    type: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    needsKey: true,
    hint: "OpenAI-kompatibler Gemini-Endpunkt.",
  },
  {
    name: "Mistral AI",
    type: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
  },
  {
    name: "Groq",
    type: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
  },
  {
    name: "OpenRouter",
    type: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
  },
  {
    name: "DeepSeek",
    type: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    needsKey: true,
  },
  {
    name: "xAI (Grok)",
    type: "openai",
    baseUrl: "https://api.x.ai/v1",
    needsKey: true,
  },
  {
    name: "Together AI",
    type: "openai",
    baseUrl: "https://api.together.xyz/v1",
    needsKey: true,
  },
  {
    name: "Fireworks AI",
    type: "openai",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    needsKey: true,
  },
  {
    name: "Hugging Face (Router)",
    type: "openai",
    baseUrl: "https://router.huggingface.co/v1",
    needsKey: true,
    hint: "OpenAI-kompatibler HF-Inference-Router.",
  },
  {
    name: "Perplexity",
    type: "openai",
    baseUrl: "https://api.perplexity.ai",
    needsKey: true,
    manualOnly: true,
    suggested: ["sonar", "sonar-pro", "sonar-reasoning"],
    hint: "Kein /models-Endpunkt — Modelle manuell eintragen.",
  },
  {
    name: "Ollama (Lokal)",
    type: "ollama",
    baseUrl: "http://localhost:11434",
    needsKey: false,
  },
  {
    name: "Eigener OpenAI-kompatibler Endpunkt (vLLM / TGI / LM Studio)",
    type: "openai",
    baseUrl: "http://localhost:8000/v1",
    needsKey: false,
    hint: "Für selbstgehostete Server. Base-URL anpassen.",
  },
];
