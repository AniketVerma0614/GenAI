// index.js
import { GoogleGenAI } from "@google/genai";
import readlineSync from "readline-sync";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import fs from "fs/promises";
import path from "path";

const platform = os.platform();
const asyncExecute = promisify(exec);

const History = [];
// Use environment variable for API key (safer)
const ai = new GoogleGenAI({ apiKey: process.env.GENAI_API_KEY || "AIzaSyADqkPPbAFMQNyZnzpBZVim5PAFzd1CBaE" });

/* -------------------------
   Tools
------------------------- */

/**
 * executeCommand: runs a shell command.
 * On Windows it uses PowerShell as the shell so PowerShell here-strings work.
 */
async function executeCommand({ command }) {
  try {
    const execOptions = platform === "win32" ? { shell: "powershell.exe" } : {};
    const { stdout, stderr } = await asyncExecute(command, execOptions);

    let out = "";
    if (stdout && stdout.toString().trim().length > 0) out += `Stdout: ${stdout.toString()}\n`;
    if (stderr && stderr.toString().trim().length > 0) out += `Stderr: ${stderr.toString()}\n`;
    if (out.trim().length === 0) out = "Success: (no CLI output)";

    return out;
  } catch (error) {
    const maybeStderr = error.stderr ?? error.stdout ?? error.message;
    return `Error: ${maybeStderr}`;
  }
}

const executeCommandDeclaration = {
  name: "executeCommand",
  description:
    "Execute a single terminal/shell command. Use executeCommand for filesystem and shell operations (mkdir, New-Item, dir, ls).",
  parameters: {
    type: "OBJECT",
    properties: {
      command: {
        type: "STRING",
        description: 'Single terminal command. Ex: "mkdir my-site" or PowerShell commands for Windows',
      },
    },
    required: ["command"],
  },
};

/**
 * writeFile: reliable direct Node file write. Use this for writing full HTML/CSS/JS content.
 */
async function writeFile({ path: filePath, content }) {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
    return `Wrote file: ${filePath}`;
  } catch (err) {
    return `Error writing file ${filePath}: ${err.message}`;
  }
}

const writeFileDeclaration = {
  name: "writeFile",
  description: "Write content into a specified file using Node fs (path, content).",
  parameters: {
    type: "OBJECT",
    properties: {
      path: { type: "STRING", description: "File path where content should be written (use backslashes on Windows)" },
      content: { type: "STRING", description: "Full file content to write" },
    },
    required: ["path", "content"],
  },
};

const availableTools = {
  executeCommand,
  writeFile,
};

/* -------------------------
   Helpers: retry + limits
------------------------- */

async function generateWithRetry(payload, maxRetries = 5) {
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(payload);
    } catch (e) {
      attempt++;
      const msg = e?.message ?? JSON.stringify(e);
      if (attempt <= maxRetries && (msg.toLowerCase().includes("overloaded") || e?.status === 503)) {
        const waitMs = 500 * Math.pow(2, attempt); // exponential backoff
        console.log(`Model overloaded (attempt ${attempt}). Retrying after ${waitMs}ms...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      // not retryable or exceeded retries
      throw e;
    }
  }
}

/* -------------------------
   Agent
------------------------- */

const filesWritten = new Set();

async function runAgent(userProblem) {
  History.push({
    role: "user",
    parts: [{ text: userProblem }],
  });

  // Add a rule forcing model to prefer writeFile for full contents
  const systemPreface = `IMPORTANT: When writing full file contents (HTML/CSS/JS), DO NOT use shell here-docs. Use the tool named "writeFile" with args {"path":"<path>", "content":"<full content>"}. Only use executeCommand for filesystem operations (mkdir, New-Item, dir, ls).`;

  const MAX_STEPS = 25;
  let stepCount = 0;

  while (true) {
    stepCount++;
    if (stepCount > MAX_STEPS) {
      console.log("Stopping: reached max steps for this run.");
      break;
    }

    // build payload
    const payload = {
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `${systemPreface}\nYou are an expert AI agent specializing in automated frontend web development. Your job is PLAN -> EXECUTE -> VALIDATE -> REPEAT.\nThe user's OS is ${platform}.\nFollow the single-command-per-step rule and validate results.`,
        tools: [
          {
            functionDeclarations: [executeCommandDeclaration, writeFileDeclaration],
          },
        ],
      },
    };

    let response;
    try {
      response = await generateWithRetry(payload);
    } catch (err) {
      console.log("Fatal error calling model:", err);
      break;
    }

    // If model requested a tool call
    if (response.functionCalls && response.functionCalls.length > 0) {
      console.log("MODEL FUNCTION CALL:", response.functionCalls[0]);

      const { name, args } = response.functionCalls[0];
      const toolFn = availableTools[name];

      if (typeof toolFn !== "function") {
        console.log("ERROR: No tool implemented with name:", name);
        History.push({
          role: "model",
          parts: [{ functionCall: response.functionCalls[0] }],
        });
        History.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name,
                response: { result: `Error: tool "${name}" not found` },
              },
            },
          ],
        });
        // continue to next iteration so model can react
        continue;
      }

      // Guard: avoid duplicate writes for the same path
      if (name === "writeFile" && args && args.path) {
        if (filesWritten.has(args.path)) {
          console.log(`SKIP: ${args.path} already written during this run.`);
          History.push({
            role: "model",
            parts: [{ functionCall: response.functionCalls[0] }],
          });
          History.push({
            role: "user",
            parts: [
              {
                functionResponse: {
                  name,
                  response: { result: `Skipped: ${args.path} already written` },
                },
              },
            ],
          });
          continue;
        }
      }

      // Execute the tool
      const result = await toolFn(args);
      console.log("TOOL RESULT:", result);

      // If writeFile succeeded, mark path as written
      if (name === "writeFile" && typeof result === "string" && result.startsWith("Wrote file:") && args && args.path) {
        filesWritten.add(args.path);
      }

      // Push functionCall and functionResponse into history
      History.push({
        role: "model",
        parts: [{ functionCall: response.functionCalls[0] }],
      });
      History.push({
        role: "user",
        parts: [{ functionResponse: { name, response: { result } } }],
      });

      // continue loop so model can validate and decide next step
      continue;
    }

    // No function calls -> final text reply from model
    const replyText =
      response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || "No response";
    History.push({
      role: "model",
      parts: [{ text: replyText }],
    });
    console.log("MODEL TEXT RESPONSE:\n", replyText);

    // After final text response, summarise what was created during this run
    if (filesWritten.size > 0) {
      console.log("\n=== Summary of files written in this run ===");
      for (const p of filesWritten) console.log("-", p);
      console.log("=========================================\n");
    } else {
      console.log("\nNo files were written by writeFile in this run.\n");
    }

    break; // done
  } // end while
}

/* -------------------------
   Main prompt loop (no recursion)
------------------------- */

async function main() {
  console.log("I am a cursor: let's create a website");
  while (true) {
    const userProblem = readlineSync.question("Ask me anything--> ");
    if (!userProblem || userProblem.trim().toLowerCase() === "exit") {
      console.log("Exiting.");
      break;
    }

    try {
      await runAgent(userProblem);
    } catch (err) {
      console.log("Error during runAgent:", err);
    }
    // continue to next prompt
  }
}

main();
