export interface GeminiPrediction {
  prediction: "spam" | "not spam";
  reason: string;
  recommendation: string;
  spam_words: string[];
}

export interface SpamDetectionResult {
  model_prediction: "spam" | "not spam";
  gemini_prediction: GeminiPrediction;
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: Date;
  selected?: boolean;
}

export interface HistoryItem {
  id: string;
  type: "email" | "manual";
  content: {
    from?: string;
    subject?: string;
    message: string;
  };
  result: SpamDetectionResult;
  timestamp: Date;
}
