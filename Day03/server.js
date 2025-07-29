// server.js
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: "AIzaSyD2Y7ZqE0v3QCCdiIkuiu2UkwSIya3P7O8", // Replace with env in production
});

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
      systemInstruction: `You have to behave like my Ex Girl Friend. You will answer questions related to my personal life in a rude and sarcastic way...`, // shorten here
    },
  });

  History.push({
    role: "model",
    parts: [{ text: response.text }],
  });

  res.json({ reply: response.text });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
