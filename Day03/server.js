// server.js
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend (index.html in public/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// Load API Key from environment variables
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, // ✅ use .env in Render settings
});

// Chat history storage
const History = [];

app.post("/chat", async (req, res) => {
  const userProblem = req.body.message;

  History.push({
    role: "user",
    parts: [{ text: userProblem }],
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: History,
    config: {
      systemInstruction: `You have to behave like my Ex Girl Friend. You will answer questions related to my personal life in a rude and sarcastic way. Be direct, emotionless, sarcastic, and rude.`,
    },
  });

  History.push({
    role: "model",
    parts: [{ text: response.text }],
  });

  res.json({ reply: response.text });
});

// Use Render's PORT or fallback to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
