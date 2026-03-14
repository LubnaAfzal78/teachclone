import express from "express";
import cors from "cors";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const app = express();
const PORT = process.env.PORT || 8787;
const REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || "amazon.nova-micro-v1:0";

const client = new BedrockRuntimeClient({ region: REGION });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const extractResponseText = (response) => {
  const blocks = response?.output?.message?.content || [];
  return blocks
    .map((block) => (typeof block?.text === "string" ? block.text : ""))
    .join("\n")
    .trim();
};

const buildHistoryMessages = (history = []) =>
  history.map((msg) => ({
    role: msg.role === "model" ? "assistant" : "user",
    content: [{ text: msg.text }],
  }));

const getImageFormat = (mimeType = "", name = "") => {
  const value = `${mimeType} ${name}`.toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpeg";
  if (value.includes("webp")) return "webp";
  return null;
};

const emergencyAnalysisFallback = (subject) =>
  JSON.stringify({
    teacher_gender: "Male",
    teaching_style: "Clear, supportive, and step by step.",
    common_phrases: ["Let's do this together", "Step by step", "Check your understanding"],
    tone_and_energy: { level: 6, description: "Warm and encouraging" },
    pacing: "moderate",
    teaching_methodology: "Explains the idea first and then gives guided examples.",
    example_types: "Classroom-style examples connected to daily life.",
    voice_characteristics: "Clear and steady voice.",
    unique_traits: ["Uses simple explanations", "Encourages participation"],
    lesson_topics: [subject || "General lesson"],
    key_concepts: ["Main topic understanding", "Worked practice"],
    definitions: ["Key term explained in simple English"],
    worked_examples: ["One guided example solved step by step"],
    misconceptions: ["Common mistake students usually make"],
    quiz_questions: ["Explain the concept in your own words."],
    lesson_summary: "A supportive lesson with clear explanations and one worked example.",
  });

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, region: REGION, modelId: MODEL_ID, service: "TeachNova Bedrock API" });
});

app.post("/api/nova/generate", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });

    const response = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 700, temperature: 0.4 },
      })
    );

    res.json({ text: extractResponseText(response) });
  } catch (error) {
    console.error("[TeachNova] Generate failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Generate failed" });
  }
});

app.post("/api/nova/chat", async (req, res) => {
  try {
    const systemPrompt = String(req.body?.systemPrompt || "");
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const newMessage = String(req.body?.newMessage || "");
    const attachment = req.body?.attachment;

    if (!newMessage && !attachment) {
      return res.status(400).json({ error: "Message or attachment is required." });
    }

    const messages = [...buildHistoryMessages(history)];
    const latestContent = [];

    if (attachment?.base64) {
      const format = getImageFormat(attachment.mimeType, attachment.name);
      if (format) {
        latestContent.push({
          image: {
            format,
            source: { bytes: Buffer.from(String(attachment.base64), "base64") },
          },
        });
      }
    }

    if (newMessage) latestContent.push({ text: newMessage });
    messages.push({ role: "user", content: latestContent });

    const response = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages,
        inferenceConfig: { maxTokens: 900, temperature: 0.6 },
      })
    );

    res.json({ text: extractResponseText(response) });
  } catch (error) {
    console.error("[TeachNova] Chat failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Chat failed" });
  }
});

app.post("/api/nova/analyze", async (req, res) => {
  const metadata = req.body?.metadata || {};
  const prompt = `You are analyzing a teacher lesson for TeachNova, an Amazon Nova hackathon demo.

Subject: ${metadata.subject || "Unknown"}
Grade Level: ${metadata.gradeLevel || "Unknown"}
Title: ${metadata.title || "Untitled"}
File Name: ${metadata.fileName || "Unknown"}
Approx File Size MB: ${metadata.fileSizeMb || 0}

Return strict JSON only with this schema:
{
  "teacher_gender": "Male or Female",
  "teaching_style": "...",
  "common_phrases": ["..."],
  "tone_and_energy": { "level": 1, "description": "..." },
  "pacing": "slow, moderate, or fast",
  "teaching_methodology": "...",
  "example_types": "...",
  "voice_characteristics": "...",
  "unique_traits": ["..."],
  "lesson_topics": ["..."],
  "key_concepts": ["..."],
  "definitions": ["..."],
  "worked_examples": ["..."],
  "misconceptions": ["..."],
  "quiz_questions": ["..."],
  "lesson_summary": "..."
}

Make the response realistic for a ${metadata.subject || "general"} lesson at ${metadata.gradeLevel || "school"} level.`;

  try {
    const response = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 1200, temperature: 0.4 },
      })
    );

    res.json({ text: extractResponseText(response) });
  } catch (error) {
    console.error("[TeachNova] Analyze failed, returning fallback", error);
    res.json({ text: emergencyAnalysisFallback(metadata.subject) });
  }
});

app.listen(PORT, () => {
  console.log(`TeachNova Bedrock API running on http://localhost:${PORT}`);
  console.log(`Region: ${REGION}`);
  console.log(`Model ID: ${MODEL_ID}`);
});
