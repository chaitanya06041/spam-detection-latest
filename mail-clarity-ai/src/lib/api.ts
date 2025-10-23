import { Email, SpamDetectionResult, HistoryItem } from "@/types/spam";

const API_BASE_URL = "http://localhost:8000";

interface EmailData {
  sender: string;
  subject: string;
  content: string;
}

interface PredictResponse {
  sender: string;
  subject: string;
  naive_output: string;
  gemini_output: {
    prediction: "spam" | "not spam";
    reason: string;
    recommendation: string;
    spam_words: string[];
  };
}

interface FetchEmailsResponse {
  emails: Array<{
    id: string;
    from: string;
    subject: string;
    date: string;
    preview: string;
  }>;
}

interface HistoryResponse {
  history: Array<{
    id: string;
    type: "email" | "manual";
    content: {
      from?: string;
      subject?: string;
      message: string;
    };
    result: {
      model_prediction: "spam" | "not spam";
      gemini_prediction: {
        prediction: "spam" | "not spam";
        reason: string;
        recommendation: string;
        spam_words: string[];
      };
    };
    timestamp: string;
  }>;
}

export const fetchEmails = async (filter: string): Promise<Email[]> => {
  const response = await fetch(`${API_BASE_URL}/fetch-emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filter }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch emails");
  }

  const data: FetchEmailsResponse = await response.json();
  
  return data.emails.map((email) => ({
    id: email.id,
    from: email.from,
    subject: email.subject,
    preview: email.preview,
    date: new Date(email.date),
  }));
};

export const predictSpam = async (emails: EmailData[], type: "email" | "manual"): Promise<Map<string, SpamDetectionResult>> => {
  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ emails, type }),
  });

  if (!response.ok) {
    throw new Error("Failed to predict spam");
  }

  const data: PredictResponse[] = await response.json();
  const predictions = new Map<string, SpamDetectionResult>();

  data.forEach((item) => {
    const result: SpamDetectionResult = {
      model_prediction: item.naive_output as "spam" | "not spam",
      gemini_prediction: item.gemini_output,
    };
    predictions.set(item.sender + item.subject, result);
  });

  return predictions;
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  const response = await fetch(`${API_BASE_URL}/history`);

  if (!response.ok) {
    throw new Error("Failed to fetch history");
  }

  const data: HistoryResponse = await response.json();

  return data.history.map((item) => ({
    id: item.id,
    type: item.type,
    content: item.content,
    result: item.result,
    timestamp: new Date(item.timestamp),
  }));
};

export const deleteHistory = async (ids: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/delete-history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error("Failed to delete history");
  }
};

export const clearAllHistory = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/clear-history`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to clear history");
  }
};

interface GraphData {
  id: string;
  label: "spam" | "not spam";
  time: string;
}

interface GraphResponse {
  graphs: GraphData[];
}

export const getGraphs = async (): Promise<GraphData[]> => {
  const response = await fetch(`${API_BASE_URL}/graph`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch graph data");
  }

  const data: GraphResponse = await response.json();
  return data.graphs;
};
