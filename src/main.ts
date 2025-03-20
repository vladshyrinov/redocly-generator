const dotenv = require("dotenv");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables from .env file
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY. Please set it in the .env file.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
  1. Create a folder called "realm-project".
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

// Runs the Redocly Realm development server
function runRealmDevelop(projectDir: string): boolean {
  try {
    console.log(
      `Launching @redocly/realm develop from directory: ${projectDir}`
    );
    execSync(`npx @redocly/realm develop -d ${projectDir}`, {
      stdio: "inherit",
    });
    return true;
  } catch (error) {
    console.error("Error running @redocly/realm develop:", error);
    return false;
  }
}

// Main AI agent loop
async function main() {
  let projectFiles, fileCreationScript, success, projectDir;
  
  // Step 1: Generate project structure
  while (true) {
    try {
      console.log("Generating project structure...");
      projectFiles = await generateProjectStructure();
      break;
    } catch (error) {
      console.error("Error generating project structure. Retrying...");
    }
  }

  // Step 2: Generate file creation script
  while (true) {
    try {
      console.log("Generating file creation script...");
      fileCreationScript = await generateFileCreationScript(projectFiles);
      break;
    } catch (error) {
      console.error("Error generating file creation script. Retrying...");
    }
  }

  // Step 3: Execute the generated script
  while (true) {
    try {
      console.log("Executing script to create files...");
      success = executeGeneratedScript(fileCreationScript);
      if (success) break;
      else throw new Error("Execution failed.");
    } catch (error) {
      console.error("Error executing script. Retrying...");
    }
  }

  // Step 4: Launch the Redocly Realm development server
  while (true) {
    try {
      console.log("Launching @redocly/realm develop...");
      projectDir = "realm-project"; // Directory where the files are created
      success = runRealmDevelop(projectDir);
      if (success) break;
      else throw new Error("@redocly/realm develop failed.");
    } catch (error) {
      console.error("Error launching @redocly/realm develop. Retrying...");
    }
  }

  console.log("Project successfully launched!");
}


main().catch(console.error);
