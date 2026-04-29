import fs from "fs";
import os from "os";
import path from "path";

const loadEnvModulePath = path.resolve(process.cwd(), "scripts/load-env.js");
const testKeys = [
  "BUDGETFLOW_TEST_ENV_PRIMARY",
  "BUDGETFLOW_TEST_ENV_EXISTING",
  "BUDGETFLOW_TEST_ENV_SECONDARY",
  "BUDGETFLOW_TEST_ENV_QUOTED",
  "BUDGETFLOW_TEST_ENV_COMMENTED",
];

describe("scripts/load-env.js", () => {
  const originalCwd = process.cwd();

  beforeEach(() => {
    jest.resetModules();

    for (const key of testKeys) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);

    for (const key of testKeys) {
      delete process.env[key];
    }
  });

  function createTempEnvDir(files: Record<string, string>) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetflow-env-"));

    for (const [fileName, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(tempDir, fileName), contents);
    }

    return tempDir;
  }

  it("loads .env.local before .env without overriding existing variables", async () => {
    const tempDir = createTempEnvDir({
      ".env.local": "BUDGETFLOW_TEST_ENV_PRIMARY=local\nBUDGETFLOW_TEST_ENV_EXISTING=local\n",
      ".env": "BUDGETFLOW_TEST_ENV_PRIMARY=env\nBUDGETFLOW_TEST_ENV_SECONDARY=env\n",
    });

    process.env.BUDGETFLOW_TEST_ENV_EXISTING = "existing";
    process.chdir(tempDir);

    const { loadEnvFiles } = await import(loadEnvModulePath);
    loadEnvFiles(".env.local", ".env");

    expect(process.env.BUDGETFLOW_TEST_ENV_PRIMARY).toBe("local");
    expect(process.env.BUDGETFLOW_TEST_ENV_EXISTING).toBe("existing");
    expect(process.env.BUDGETFLOW_TEST_ENV_SECONDARY).toBe("env");
  });

  it("preserves quoted values and inline comments with the bundled parser", async () => {
    const tempDir = createTempEnvDir({
      ".env.local":
        'BUDGETFLOW_TEST_ENV_QUOTED="bonjour monde"\nBUDGETFLOW_TEST_ENV_COMMENTED=value # comment\n',
      ".env": "BUDGETFLOW_TEST_ENV_QUOTED=env\nBUDGETFLOW_TEST_ENV_SECONDARY=secondary\n",
    });

    process.chdir(tempDir);

    jest.doMock("node:util", () => ({ parseEnv: undefined }));

    await jest.isolateModulesAsync(async () => {
      const { loadEnvFiles } = await import(loadEnvModulePath);
      loadEnvFiles(".env.local", ".env");
    });

    expect(process.env.BUDGETFLOW_TEST_ENV_QUOTED).toBe("bonjour monde");
    expect(process.env.BUDGETFLOW_TEST_ENV_COMMENTED).toBe("value");
    expect(process.env.BUDGETFLOW_TEST_ENV_SECONDARY).toBe("secondary");
  });
});
