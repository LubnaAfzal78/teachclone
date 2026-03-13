import { ChatAttachment, ChatMessage } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const MAX_ATTACHMENT_IMAGE_SIZE = 3.75 * 1024 * 1024;

export interface NovaResponse {
  success: boolean;
  text?: string;
  error?: string;
}

const fileToBase64 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const postJson = async (path: string, body: unknown): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
};

export const callNova = async (prompt: string): Promise<NovaResponse> => {
  try {
    const data = await postJson("/api/nova/generate", { prompt });
    return { success: true, text: data.text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown Nova error",
    };
  }
};

export const generateResponseWithContext = async (
  systemPrompt: string,
  history: ChatMessage[],
  newMessage: string,
  attachment?: ChatAttachment
): Promise<NovaResponse> => {
  try {
    let encodedAttachment:
      | {
          name: string;
          mimeType: string;
          base64: string;
        }
      | undefined;

    if (attachment?.file) {
      if (attachment.file.size > MAX_ATTACHMENT_IMAGE_SIZE) {
        return { success: false, error: "Image must be 3.75MB or smaller." };
      }

      encodedAttachment = {
        name: attachment.name,
        mimeType: attachment.mimeType,
        base64: await fileToBase64(attachment.file),
      };
    }

    const data = await postJson("/api/nova/chat", {
      systemPrompt,
      history,
      newMessage,
      attachment: encodedAttachment,
    });

    return { success: true, text: data.text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nova failed to respond",
    };
  }
};

export const analyzeVideoWithNova = async (
  videoSource: File | Blob,
  metadata?: { title: string; subject: string; gradeLevel: string; fileName?: string }
): Promise<NovaResponse> => {
  if (!metadata) {
    return { success: false, error: "Metadata is required for video analysis." };
  }

  try {
    const data = await postJson("/api/nova/analyze", {
      metadata: {
        ...metadata,
        fileSizeMb: Number((videoSource.size / 1024 / 1024).toFixed(2)),
      },
    });

    return { success: true, text: data.text };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Video analysis failed",
    };
  }
};
