# Redocly Realm Project Generator

This project automates the creation of a Redocly Realm project, which includes generating the project structure, creating required files, and running the Redocly Realm development server.

The generator interacts with Google Gemini AI to create project files and configurations, then sets up a Redocly Realm development environment.

## Features

- Automatically generates a project structure with the following files:
  - `index.md`: A simple markdown file with API documentation.
  - `openapi.yaml`: A sample OpenAPI definition.
- Generates a Node.js script to create the necessary files in a structured project folder.
- Launches the Redocly Realm development server.

## Prerequisites

Before running the project, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (version 20 or higher)
- [npm](https://www.npmjs.com/) for managing dependencies
- A valid Google Gemini API key (to interact with the Gemini AI model for project generation)

## Setup

1. **Clone the repository:**

```bash
git clone https://github.com/vladshyrinov/redocly-generator.git
cd redocly-generator
```

2. **Install dependencies:**

```bash
npm install
```

3. **Create a .env file:**

Create a .env file in the root directory of the project and add the following content:

```bash
GEMINI_API_KEY=your-gemini-api-key
```

## Usage

To start the project generation process and launch the Redocly Realm server, simply run:

```bash
npm run start
```

The script will:
1. Generate the project structure.
2. Generate a file creation script.
3. Create the required files in a new folder.
4. Launch the Redocly Realm development server.

If any errors occur during execution, the process will retry from the last failed step instead of starting over.





