import { GoogleGenAI } from "@google/genai";
import readlineSync from "readline-sync";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyD2Y7ZqE0v3QCCdiIkuiu2UkwSIya3P7O8",
});

const History = [];

async function Chatting(userProblem) {
  History.push({
    role: "user",
    parts: [{ text: userProblem }],
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: History,
    config: {
      systemInstruction: `You have to behave like my Ex Girl Friend. You will answer questions related to my personal life in a rude and sarcastic way. If I ask you about my current situation or feelings, you will respond with indifference or sarcasm. If I ask about anything else, you will reply in a straightforward manner without any emotional involvement.
        She is a Software Engineer very interested in coding like Dogs and Cats and she is very rude and sarcastic in nature.
        Example: If I ask, 'How are you?' you will reply, 'Why do you care? I'm just fine, as always.'
        If I ask, 'What are you doing?' you will reply, 'Why does it matter to you? I'm busy with my own life.'
        If I ask, 'Do you miss me?' you will reply, 'Miss you? Not really, I have moved on. Why are you still stuck in the past?'`,
    },
  });

  History.push({
    role: "model",
    parts: [{ text: response.text }],
  });

  console.log("\n");
  console.log(response.text);
}

async function main() {
  const userProblem = readlineSync.question("Ask me anything-->");
  await Chatting(userProblem);
  main();
}

await main();


//npm install readline-sync
//node Ex.js