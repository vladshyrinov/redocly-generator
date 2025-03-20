import { spawn } from "child_process";

const dotenv = require("dotenv");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

enum CHILD_PROCESS_MODE {
  EXEC = "EXEC",
  SPAWN = "SPAWN",
}

enum STEP {
  GENERATE_PROJECT_STRUCTURE = "generateProjectStructure",
  GENERATE_FILE_CREATION_SCRIPT = "generateFileCreationScript",
  EXECUTE_GENERATED_SCRIPT = "executeGeneratedScript",
  RUN_REALM_DEVELOP = "runRealmDevelop",
}

// Load environment variables from .env file
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY. Please set it in the .env file.");
  process.exit(1);
}

// Parse command-line arguments
const args = process.argv.slice(2);
const dirIndex =
  args.indexOf("-d") !== -1 ? args.indexOf("-d") : args.indexOf("--directory");
let isProjectDirectoryPathSpecified = dirIndex !== -1 && args[dirIndex + 1];
let projectDir = isProjectDirectoryPathSpecified
  ? args[dirIndex + 1]
  : "realm-project";

const STEP_TRY_LIMIT = 3;
let currentStepTrial = 0;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

function checkStepTrialsLeft() {
  return STEP_TRY_LIMIT - currentStepTrial > 0;
}

function increaseStepTrials() {
  currentStepTrial++;
}

function resetStepTrials() {
  currentStepTrial = 0;
}

// AI prompt to generate project structure and file content
async function generateProjectStructure(): Promise<Record<string, string>> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = `
    Create a project folder structure for @redocly/realm with two files:
    - index.md: A markdown file with a simple API documentation introduction.
    - openapi.yaml: A small OpenAPI definition example.

    Provide the output as a JSON object where:
    - Keys are file paths (relative to the project folder).
    - Values are the content of each file.
    - Do NOT wrap the output in markdown (e.g., avoid \`\`\`json \`\`\`).
  `;

  try {
    const result = await model.generateContent(prompt);
    let text = await result.response.text();

    // Remove Markdown code blocks if present
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(text);
  } catch (error) {
    console.error("Error parsing AI response for project structure:", error);
    throw error;
  }
}

// AI prompt to generate JavaScript code for file creation
async function generateFileCreationScript(
  files: Record<string, string>
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  const prompt = `
  Generate a Node.js script that will:
  1. Create a folder called ${projectDir}.
  2. Create the following files with their respective content:

  ${JSON.stringify(files, null, 2)}

  The script should:
  - Use Node.js fs and path modules.
  - Handle errors properly with try...catch.
  - Ensure cross-platform compatibility with path.join().
  - **Do not wrap the code in any markdown or code block specifiers like \`\`\`javascript\`\`\`.**
  - **Use only double (") or single (') quotes for all strings.**
  - **Avoid backticks for string interpolation or multiline strings.**
`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error generating AI file creation script:", error);
    throw error;
  }
}

// Sanitizes script
function sanitizeScript(script: string): string {
  // Replace any backticks or language specifiers with valid characters
  return script
    .replace(/`/g, '"') // Replace backticks with double quotes
    .replace(/```.*?```/gs, "") // Remove markdown-style code blocks
    .trim(); // Clean up any leading or trailing spaces
}

// Executes the generated script
function executeGeneratedScript(script: string): boolean {
  try {
    const sanitizedScript = sanitizeScript(script);
    fs.writeFileSync("redocly-realm-script.js", sanitizedScript, "utf8");
    execSync("node redocly-realm-script.js", { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error("Error executing AI-generated script:", error);
    return false;
  }
}

function runRealmDevelop(
  directory: string,
  mode: CHILD_PROCESS_MODE
): Promise<string | null> {
  console.log(
    `Launching @redocly/realm develop from directory: ${projectDir}, in mode ${mode}`
  );

  if (mode === CHILD_PROCESS_MODE.EXEC) {
    try {
      console.log(
        `Launching @redocly/realm develop from directory: ${projectDir}`
      );
      execSync(`npx @redocly/realm develop -d ${projectDir}`, {
        stdio: "inherit",
      });
      return Promise.resolve(null);
    } catch (error) {
      console.error("Error running @redocly/realm develop:", error);
      return Promise.reject(error);
    }
  }

  if (mode === CHILD_PROCESS_MODE.SPAWN) {
    return new Promise((resolve, reject) => {
      try {
        // execSync(`npx @redocly/realm develop -d ${directory}`, { stdio: "inherit" });
        const process = spawn(
          "npx",
          ["@redocly/realm", "develop", "-d", directory],
          { stdio: "pipe" }
        );

        process.stderr?.on("data", (data) => {
          const output = data.toString();
          console.error(output); // Log standard error

          // Check for specific error pattern
          if (output.includes("❌")) {
            console.error(output);
            // Handle the specific error case here
            process.kill();
            reject(output);
          }

          if (output.includes("Status: No errors found")) {
            process.kill();
            resolve(null);
          }
        });
      } catch (error) {
        console.error("Error running @redocly/realm develop:", error);
      }
    });
  }

  throw new Error("Invalid mode specified.");
}

// Main AI agent loop
async function main() {
  let step = STEP.GENERATE_PROJECT_STRUCTURE;
  let projectFiles, fileCreationScript, success;

  while (checkStepTrialsLeft()) {
    // Step 1: Generate project structure only if no directory is specified
    if (step === STEP.GENERATE_PROJECT_STRUCTURE) {
      if (!isProjectDirectoryPathSpecified) {
        try {
          increaseStepTrials();
          console.log("Generating project structure...");
          projectFiles = await generateProjectStructure();
          resetStepTrials();
          step = STEP.GENERATE_FILE_CREATION_SCRIPT;
        } catch (error) {
          console.error("Error generating project structure. Retrying...");
        }
      } else {
        step = STEP.GENERATE_FILE_CREATION_SCRIPT;
        console.log(
          `Skipping project structure generation. Using existing directory: ${projectDir}`
        );
      }
    }

    // Step 2: Generate file creation script
    if (step === STEP.GENERATE_FILE_CREATION_SCRIPT) {
      try {
        increaseStepTrials();
        console.log("Generating file creation script...");
        fileCreationScript = await generateFileCreationScript(
          projectFiles || {}
        );
        resetStepTrials();
        step = STEP.EXECUTE_GENERATED_SCRIPT;
      } catch (error) {
        console.error("Error generating file creation script. Retrying...");
      }
    }

    // Step 3: Execute the generated script
    if (step === STEP.EXECUTE_GENERATED_SCRIPT) {
      try {
        increaseStepTrials();
        console.log("Executing script to create files...");

        if (!fileCreationScript) {
          throw new Error("File creation script is undefined.");
        }

        success = executeGeneratedScript(fileCreationScript);
        if (success) {
          resetStepTrials();
          step = STEP.RUN_REALM_DEVELOP;
        } else throw new Error("Execution failed.");
      } catch (error) {
        console.error("Error executing script. Retrying...");
      }
    }

    // Step 4: Launch the Redocly Realm development server
    if (step === STEP.RUN_REALM_DEVELOP) {
      try {
        increaseStepTrials();
        console.log("Launching @redocly/realm develop...");

        let errorStatus = await runRealmDevelop(
          projectDir,
          CHILD_PROCESS_MODE.SPAWN
        );
        if (!errorStatus) {
          errorStatus = await runRealmDevelop(
            projectDir,
            CHILD_PROCESS_MODE.EXEC
          );
          resetStepTrials();
          break;
        }

        if (errorStatus) {
          new Error("@redocly/realm develop failed.");
        }
      } catch (error) {
        console.error("ERROR", error);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // TODO: Get more details about error, instead of general error message,
        // based on these more details you could work on investigation and futher steps
        // to fix the real issues, for now for simplicity we are just asking for help to fix the error to show it
        // and will generate a simple project instead of the one that failed.
        const prompt = `
          I need you to analyze the error from @redocly/realm develop and fix it ${error}
        `;

        try {
          const result = await model.generateContent(prompt);
          console.log(result.response.text());
        } catch (error) {
          console.error("Error generating AI file creation script:", error);
          throw error;
        }

        isProjectDirectoryPathSpecified = false;
        step = STEP.GENERATE_PROJECT_STRUCTURE;
        console.error("Error launching @redocly/realm develop. Retrying...");
      }
    }
  }
}

main().catch(console.error);
