import { GoogleGenAI } from "@google/genai";
import readlineSync from "readline-sync";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyD2Y7ZqE0v3QCCdiIkuiu2UkwSIya3P7O8",});



const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    history: [],
})


async function main() {
    const userProblem = readlineSync.question("Ask me anything-->");
    
    const response1 = await chat.sendMessage({
    message: userProblem,
  });

    console.log("\n");
    console.log(response1.text);

    main();
}

await main();
