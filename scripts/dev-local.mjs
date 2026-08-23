import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 3010;
const HOST = "127.0.0.1";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const portCheckHosts = ["::", "0.0.0.0", "127.0.0.1", "::1"];

const parsePort = () => {
  const rawPort = process.env.BELACLUB_DEV_PORT || process.env.PORT;

  if (!rawPort) return DEFAULT_PORT;

  const port = Number.parseInt(rawPort, 10);

  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }

  console.error(
    `Puerto invalido: ${rawPort}. Usa un numero entre 1 y 65535.`
  );
  process.exit(1);
};

const canListenOn = (port, host) =>
  new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen({ port, host, exclusive: true });
  });

const isPortFree = async (port) => {
  for (const host of portCheckHosts) {
    if (!(await canListenOn(port, host))) {
      return false;
    }
  }

  return true;
};

const readHttpSummary = (port, path) =>
  new Promise((resolve) => {
    const request = http.get(
      { host: HOST, port, path, timeout: 1000 },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          if (body.length < 6000) {
            body += chunk;
          }
        });
        response.on("end", () => {
          const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
          const lowerBody = body.toLowerCase();
          const likelyApp = lowerBody.includes("base de contactos")
            ? "herramienta de WhatsApp"
            : lowerBody.includes("belaclub")
              ? "BelaClub"
              : "";

          resolve({
            path,
            status: response.statusCode,
            title: title?.trim() || "",
            likelyApp,
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
    request.on("error", () => resolve(null));
  });

const getHttpSummary = async (port) => {
  const summaries = [];

  for (const path of ["/", "/prestadores", "/escorts"]) {
    const summary = await readHttpSummary(port, path);

    if (!summary) continue;
    if (summary.likelyApp || summary.title) return summary;

    summaries.push(summary);
  }

  return summaries[0] || null;
};

const describeSummary = (summary) => {
  if (!summary) return "otro proceso";

  const parts = [];

  if (summary.likelyApp) parts.push(summary.likelyApp);
  if (summary.title) parts.push(`titulo "${summary.title}"`);
  if (summary.status) parts.push(`HTTP ${summary.status}`);

  return parts.length ? parts.join(", ") : "otro servidor local";
};

const describePort = async (port) => {
  const summary = await getHttpSummary(port);

  return describeSummary(summary);
};

const normalizePath = (path) => resolve(path.trim()).toLowerCase();

const stripAnsi = (text) => text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");

const findExistingNextServer = (output) => {
  const cleanOutput = stripAnsi(output);

  if (!cleanOutput.includes("Another next dev server is already running")) {
    return null;
  }

  const pid = Number.parseInt(
    cleanOutput.match(/-\s*PID:\s*(\d+)/)?.[1] || "",
    10
  );
  const dir = cleanOutput.match(/-\s*Dir:\s*(.+)/)?.[1]?.trim();

  if (!Number.isInteger(pid) || !dir) return null;

  return { pid, dir };
};

const isThisProject = (dir) => normalizePath(dir) === normalizePath(projectRoot);

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const wait = (milliseconds) =>
  new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });

const stopOldDevServer = async (pid) => {
  if (pid === process.pid) {
    throw new Error("Next reporto este mismo proceso como servidor anterior.");
  }

  if (!isProcessAlive(pid)) return;

  console.warn(`Cerrando servidor anterior de BelaClub (PID ${pid})...`);
  process.kill(pid, "SIGTERM");

  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    if (!isProcessAlive(pid)) return;
    await wait(250);
  }

  if (isProcessAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
};

const warnIfDefaultPortIsBusy = async (port) => {
  if (port === 3000 || (await isPortFree(3000))) return;

  const owner = await describePort(3000);

  console.warn(
    [
      "",
      `Aviso: localhost:3000 ya esta ocupado por ${owner}.`,
      `BelaClub se abrira en http://localhost:${port}/prestadores para no cruzarse con ese proyecto.`,
      "",
    ].join("\n")
  );
};

const runNext = (port, allowRestart) =>
  new Promise((resolveRun) => {
    const nextBin = join(
      projectRoot,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next"
    );

    const env = {
      ...process.env,
      BELACLUB_DEV_PORT: String(port),
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
      PORT: String(port),
    };

    let output = "";

    console.log(`BelaClub local: http://localhost:${port}/prestadores`);

    const child = spawn(
      process.execPath,
      [nextBin, "dev", "-p", String(port)],
      {
        cwd: projectRoot,
        env,
        stdio: ["inherit", "pipe", "pipe"],
      }
    );

    const capture = (chunk, target) => {
      const text = chunk.toString();

      output += text;
      if (output.length > 40000) {
        output = output.slice(-40000);
      }

      target.write(chunk);
    };

    child.stdout.on("data", (chunk) => capture(chunk, process.stdout));
    child.stderr.on("data", (chunk) => capture(chunk, process.stderr));

    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => {
        if (!child.killed) child.kill(signal);
      });
    }

    child.on("exit", async (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      const existingServer = findExistingNextServer(output);

      if (
        allowRestart &&
        code !== 0 &&
        existingServer &&
        isThisProject(existingServer.dir)
      ) {
        try {
          await stopOldDevServer(existingServer.pid);
        } catch (error) {
          console.error("No pude cerrar el servidor anterior de BelaClub.");
          console.error(error);
          process.exit(1);
        }

        await wait(500);
        resolveRun("restart");
        return;
      }

      process.exit(code ?? 0);
    });
  });

const startNext = async () => {
  const port = parsePort();

  if (!(await isPortFree(port))) {
    const summary = await getHttpSummary(port);
    const owner = describeSummary(summary);

    if (summary?.likelyApp === "BelaClub") {
      console.warn(
        [
          "",
          `BelaClub ya esta corriendo en http://localhost:${port}/prestadores.`,
          "No arranque otro servidor para evitar duplicar el puerto.",
          "",
        ].join("\n")
      );
      process.exit(0);
    }

    console.error(
      [
        "",
        `No arranque BelaClub porque localhost:${port} esta ocupado por ${owner}.`,
        "Cierra ese servidor o usa otro puerto:",
        `  $env:BELACLUB_DEV_PORT=${port + 1}`,
        "  npm.cmd run dev",
        "",
      ].join("\n")
    );
    process.exit(1);
  }

  await warnIfDefaultPortIsBusy(port);

  const nextBin = join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );

  if (!existsSync(nextBin)) {
    console.error("No encontre Next en node_modules. Ejecuta npm install primero.");
    process.exit(1);
  }

  if ((await runNext(port, true)) === "restart") {
    await warnIfDefaultPortIsBusy(port);
    await runNext(port, false);
  }
};

startNext().catch((error) => {
  console.error(error);
  process.exit(1);
});
