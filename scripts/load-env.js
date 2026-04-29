const fs = require("fs");
const path = require("path");
const { parseEnv } = require("node:util");

function parseEnvFallback(fileContents) {
  return fileContents.split(/\r?\n/).reduce((accumulator, rawLine) => {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      return accumulator;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex === -1) {
      return accumulator;
    }

    const key = line.slice(0, equalsIndex).trim().replace(/^export\s+/, "");
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trimEnd();
      }
    }

    if (key) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

function loadEnvFileIfExists(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const fileContents = fs.readFileSync(absolutePath, "utf8");
  const parsedVariables =
    typeof parseEnv === "function"
      ? parseEnv(fileContents)
      : parseEnvFallback(fileContents);

  for (const [key, value] of Object.entries(parsedVariables)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadEnvFiles(...relativePaths) {
  for (const relativePath of relativePaths) {
    loadEnvFileIfExists(relativePath);
  }
}

module.exports = {
  loadEnvFiles,
};
