const { spawn } = require("node:child_process");

const npmCommand = "npm";

async function isServiceHealthy(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

function startProcess(label, args) {
  const child = spawn(`${npmCommand} ${args.join(" ")}`, {
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code, signal) => {
    if (code === 0 || signal === "SIGINT") {
      return;
    }

    console.error(
      `${label} exited unexpectedly with code ${code ?? "unknown"}.`,
    );
    shutdown(1);
  });

  return child;
}

let processes = [];
let shuttingDown = false;

function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  }

  process.exit(exitCode);
}

async function main() {
  const apiRunning = await isServiceHealthy("http://127.0.0.1:3000/api/health");
  const devRunning = await isServiceHealthy("http://127.0.0.1:5173/");

  if (!apiRunning) {
    processes.push(startProcess("api", ["run", "api"]));
  } else {
    console.log("api already running on http://127.0.0.1:3000");
  }

  if (!devRunning) {
    processes.push(startProcess("dev", ["run", "dev"]));
  } else {
    console.log("dev already running on http://127.0.0.1:5173");
  }

  if (processes.length === 0) {
    console.log("Both services are already running.");
  }
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
