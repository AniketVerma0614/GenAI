import readlineSync from "readline-sync";
import { GoogleGenAI } from "@google/genai";

const History = [];
const ai = new GoogleGenAI({ apiKey: "AIzaSyD2Y7ZqE0v3QCCdiIkuiu2UkwSIya3P7O8" });

function sum({ num1, num2 }) {
  return num1 + num2;
}

function prime({ num }) {
  if (num < 2) return false;
  for (let i = 2; i <= Math.sqrt(num); i++) {
    if (num % i === 0) return false;
  }
  return true;
}

async function getCryptoPrice({ coin }) {
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin}`);
  const data = await response.json();
  return data;
}

const sumDeclaration = {
  name: "sum",
  description: "This function takes two numbers and returns their sum.",
  parameters: {
    type: "OBJECT",
    properties: {
      num1: {
        type: "NUMBER",
        description: "It will be the first number to addition ex: 10",
      },
      num2: {
        type: "NUMBER",
        description: "It will be the second number for addition ex: 10",
      },
    },
    required: ["num1", "num2"],
  },
};

const primeDeclaration = {
  name: "prime",
  description: "This function checks if a number is prime or not.",
  parameters: {
    type: "OBJECT",
    properties: {
      num: {
        type: "NUMBER",
        description: "It will be the number to check for primality ex: 7",
      },
    },
    required: ["num"],
  },
};

const getCryptoPriceDeclaration = {
  name: "getCryptoPrice",
  description: "This function fetches the current price of a cryptocurrency.",
  parameters: {
    type: "OBJECT",
    properties: {
      coin: {
        type: "STRING",
        description: 'The name of the cryptocurrency to fetch the price for, e.g., "bitcoin"',
      },
    },
    required: ["coin"],
  },
};

const availableTools = {
  sum: sum,
  prime: prime,
  getCryptoPrice: getCryptoPrice,
};

async function runAgent(userProblem) {
  History.push({
    role: "user",
    parts: [{ text: userProblem }],
  });

  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `You are an AI Agent. You have access to 3 available tools: sum of 2 numbers, get crypto price of any currency, and check if a number is prime.
Use these tools whenever required to answer user queries.
If the user asks a general question, answer directly if you don't need these tools.`,
        tools: [
          {
            functionDeclarations: [
              sumDeclaration,
              primeDeclaration,
              getCryptoPriceDeclaration,
            ],
          },
        ],
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      const { name, args } = response.functionCalls[0];
      const funCall = availableTools[name];
      const result = await funCall(args);

      const functionResponsePart = {
        name: name,
        response: {
          result: result,
        },
      };

      // Add function call to history
      History.push({
        role: "model",
        parts: [
          {
            functionCall: response.functionCalls[0],
          },
        ],
      });

      // Add function response to history
      History.push({
        role: "user",
        parts: [
          {
            functionResponse: functionResponsePart,
          },
        ],
      });
    } else {
      // Get model's text response
      const replyText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || "No response";
      History.push({
        role: "model",
        parts: [{ text: replyText }],
      });
      console.log(replyText);
      break;
    }
  }
}

async function main() {
  const userProblem = readlineSync.question("Ask me anything--> ");
  console.log(`You asked: ${userProblem}`); // <-- Move this here
  await runAgent(userProblem);
  main();
}

main();

// Note: The API key used here is a placeholder and should be replaced with a valid one.
// Ensure to handle API keys securely and not expose them in public repositories.
