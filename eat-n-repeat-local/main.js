"use strict";

const { app, BrowserWindow, ipcMain, shell, net, dialog } = require("electron");
const path = require("path");
const os = require("os");
const net2 = require("net");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const QRCode = require("qrcode");

// ---------------------------------------------------------------------------
// Project root resolution.
// When installed (Program Files / LocalAppData), __dirname no longer sits
// beside the project, so the root is resolved in order:
//   1. persisted user choice (userData/settings.json)
//   2. sibling lookup (dev / repo checkout layout)
//   3. null -> renderer prompts staff to locate the folder once.
// ---------------------------------------------------------------------------
let projectRoot = null;
let BACKEND_DIR = "";
let FRONTEND_DIR = "";
let STAMP_FILE = "";

function isValidProjectRoot(dir) {
  try {
    return (
      typeof dir === "string" &&
      dir.length > 0 &&
      fs.existsSync(path.join(dir, "eat-n-repeat-backend", "package.json")) &&
      fs.existsSync(path.join(dir, "eat-n-repeat-frontend", "package.json"))
    );
  } catch (e) {
    return false;
  }
}

function settingsFile() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadPersistedRoot() {
  try {
    const raw = fs.readFileSync(settingsFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.projectRoot === "string") return parsed.projectRoot;
  } catch (e) {
    // No settings yet — first run.
  }
  return null;
}

function persistRoot(dir) {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify({ projectRoot: dir }, null, 2));
  } catch (e) {
    log("WARNING: could not persist project folder: " + e.message);
  }
}

function setProjectDirs(root) {
  projectRoot = root;
  BACKEND_DIR = path.join(root, "eat-n-repeat-backend");
  FRONTEND_DIR = path.join(root, "eat-n-repeat-frontend");
  STAMP_FILE = path.join(root, ".initialized");
}

// Returns the resolved root, or null when staff must locate it.
function getProjectRoot() {
  if (projectRoot && isValidProjectRoot(projectRoot)) return projectRoot;
  const persisted = loadPersistedRoot();
  if (persisted && isValidProjectRoot(persisted)) {
    setProjectDirs(persisted);
    return projectRoot;
  }
  const sibling = path.resolve(__dirname, "..");
  if (isValidProjectRoot(sibling)) {
    setProjectDirs(sibling);
    return projectRoot;
  }
  return null;
}

const BACKEND_PORT = 4000;
const FRONTEND_PORT = 3000;
const HEALTH_TIMEOUT_MS = 120000; // 120 seconds
const HEALTH_POLL_MS = 1500;
const INTERNET_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------
const STATE = { STOPPED: "stopped", STARTING: "starting", RUNNING: "running" };
let systemState = STATE.STOPPED;
let backendProcess = null;
let frontendProcess = null;
let backendReady = false;
let frontendReady = false;
let logLines = [];
const MAX_LOG_LINES = 200;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
function log(msg) {
  const ts = new Date().toLocaleTimeString();
  const line = "[" + ts + "] " + msg;
  logLines.push(line);
  if (logLines.length > MAX_LOG_LINES) logLines.shift();
  console.log(line);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log-line", line);
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 760,
    title: "Eat n RepEat - Local System",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

// ---------------------------------------------------------------------------
// LAN IP detection
// ---------------------------------------------------------------------------
const SKIP_IFACES = /^(veth|docker|wsl|virtual|vbox|vmware|vpn|lo)/i;
const SKIP_NAMES = /^(veth|docker|wsl|virtual|vbox|vmware|vpn|loopback)/i;
const PREFERRED_NAMES = /(wi-?fi|wlan|eth|en)/i;
const SKIP_PREFIXES = ["169.254.", "192.168.56."];

function detectLANIP() {
  const interfaces = os.networkInterfaces();
  let fallback = null;

  for (const name of Object.keys(interfaces)) {
    if (SKIP_IFACES.test(name) || SKIP_NAMES.test(name)) continue;

    const addrs = interfaces[name];
    if (!addrs) continue;

    for (const addr of addrs) {
      if (addr.internal) continue;
      if (addr.family !== "IPv4") continue;

      let skip = false;
      for (const prefix of SKIP_PREFIXES) {
        if (addr.address.startsWith(prefix)) {
          skip = true;
          break;
        }
      }
      if (skip) continue;

      if (PREFERRED_NAMES.test(name)) {
        return addr.address;
      }
      if (!fallback) {
        fallback = addr.address;
      }
    }
  }

  // Second pass: exclude MAC-like virtual addresses
  if (!fallback) {
    for (const name of Object.keys(interfaces)) {
      const addrs = interfaces[name];
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.internal || addr.family !== "IPv4") continue;
        let skip = false;
        for (const prefix of SKIP_PREFIXES) {
          if (addr.address.startsWith(prefix)) {
            skip = true;
            break;
          }
        }
        if (!skip) fallback = addr.address;
      }
    }
  }

  return fallback || "127.0.0.1";
}

// ---------------------------------------------------------------------------
// TCP / HTTP probes
// ---------------------------------------------------------------------------
function checkPort(host, port, timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  return new Promise(function (resolve) {
    const socket = new net2.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);
    socket.once("connect", function () {
      resolved = true;
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", function () {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });
    socket.once("error", function () {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

function checkHTTP(url, timeoutMs) {
  timeoutMs = timeoutMs || 5000;
  return new Promise(function (resolve) {
    const req = net.request({ url: url, method: "GET" });
    let resolved = false;
    const timer = setTimeout(function () {
      if (!resolved) {
        resolved = true;
        req.abort();
        resolve(false);
      }
    }, timeoutMs);

    req.on("response", function () {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(true);
      }
    });
    req.on("error", function () {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(false);
      }
    });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Internet probe
// ---------------------------------------------------------------------------
function checkInternet() {
  return new Promise(function (resolve) {
    const dns = require("dns");
    const https = require("https");
    let resolved = false;

    dns.resolve("google.com", function (err) {
      if (err) {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
        return;
      }
      // DNS succeeded, try HTTPS
      const req = https.request(
        {
          hostname: "www.google.com",
          port: 443,
          path: "/generate_204",
          method: "HEAD",
          timeout: INTERNET_TIMEOUT_MS,
        },
        function () {
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        }
      );
      req.on("error", function () {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });
      req.on("timeout", function () {
        if (!resolved) {
          resolved = true;
          req.destroy();
          resolve(false);
        }
      });
      req.end();
    });

    // Global timeout
    setTimeout(function () {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, INTERNET_TIMEOUT_MS + 1000);
  });
}

// ---------------------------------------------------------------------------
// MySQL check
// ---------------------------------------------------------------------------
async function checkMySQL() {
  const connected = await checkPort("127.0.0.1", 3306, 3000);
  return connected;
}

// ---------------------------------------------------------------------------
// Readiness polling
// ---------------------------------------------------------------------------
function waitForHTTP(url, timeoutMs) {
  timeoutMs = timeoutMs || HEALTH_TIMEOUT_MS;
  return new Promise(function (resolve) {
    const start = Date.now();

    function poll() {
      if (Date.now() - start > timeoutMs) {
        resolve(false);
        return;
      }
      checkHTTP(url, 3000).then(function (ok) {
        if (ok) {
          resolve(true);
        } else {
          setTimeout(poll, HEALTH_POLL_MS);
        }
      });
    }
    poll();
  });
}

// ---------------------------------------------------------------------------
// Bootstrap (first run)
// ---------------------------------------------------------------------------
function backendNodeModulesExist() {
  try {
    return fs.existsSync(path.join(BACKEND_DIR, "node_modules"));
  } catch (e) {
    return false;
  }
}

function frontendNodeModulesExist() {
  try {
    return fs.existsSync(path.join(FRONTEND_DIR, "node_modules"));
  } catch (e) {
    return false;
  }
}

function runCommand(cmd, cwd, timeoutMs) {
  timeoutMs = timeoutMs || 120000;
  return new Promise(function (resolve, reject) {
    log("Running: " + cmd + " (in " + cwd + ")");
    const parts = cmd.split(/\s+/);
    const child = spawn(parts[0], parts.slice(1), {
      cwd: cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", function (d) {
      stdout += d.toString();
    });
    child.stderr.on("data", function (d) {
      stderr += d.toString();
    });

    child.on("close", function (code) {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error("Command failed (exit " + code + "): " + (stderr || stdout)));
      }
    });
    child.on("error", function (err) {
      reject(err);
    });
  });
}

async function ensureNodeModules() {
  if (!backendNodeModulesExist()) {
    log("Installing backend dependencies...");
    await runCommand("npm install", BACKEND_DIR, 180000);
  }
  if (!frontendNodeModulesExist()) {
    log("Installing frontend dependencies...");
    await runCommand("npm install", FRONTEND_DIR, 180000);
  }
}

async function runBootstrap() {
  const stampExists = fs.existsSync(STAMP_FILE);
  const modulesExist = backendNodeModulesExist();

  if (stampExists && modulesExist) {
    log("Bootstrap stamp found and node_modules present. Skipping bootstrap.");
    return;
  }

  log("First-run bootstrap starting...");
  await ensureNodeModules();

  log("Running prisma generate...");
  await runCommand("npx prisma generate", BACKEND_DIR);

  log("Repairing orphaned order references (safe, idempotent)...");
  await runCommand("node prisma/repair-orphans.cjs", BACKEND_DIR);

  log("Running prisma db push...");
  await runCommand("npx prisma db push", BACKEND_DIR);

  log("Running prisma db seed...");
  await runCommand("npx prisma db seed", BACKEND_DIR);

  fs.writeFileSync(STAMP_FILE, new Date().toISOString());
  log("Bootstrap complete. Stamp written.");
}

// ---------------------------------------------------------------------------
// Process tree kill (Windows)
// ---------------------------------------------------------------------------
function killProcessTree(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === "win32") {
      execSync("taskkill /PID " + child.pid + " /T /F", { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  } catch (e) {
    // Process may already be dead
  }
}

// ---------------------------------------------------------------------------
// Spawn backend & frontend
// ---------------------------------------------------------------------------
function spawnBackend(lanIP) {
  log("Starting backend on port " + BACKEND_PORT + "...");
  const env = Object.assign({}, process.env, {});

  backendProcess = spawn("npm", ["run", "dev"], {
    cwd: BACKEND_DIR,
    shell: true,
    env: env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", function (d) {
    const text = d.toString().trim();
    if (text) log("[backend] " + text);
  });
  backendProcess.stderr.on("data", function (d) {
    const text = d.toString().trim();
    if (text) log("[backend] " + text);
  });
  backendProcess.on("close", function (code) {
    log("Backend process exited (code " + code + ").");
    backendProcess = null;
    if (systemState === STATE.RUNNING) {
      broadcastStatus();
    }
  });
  backendProcess.on("error", function (err) {
    log("Backend spawn error: " + err.message);
  });
}

function spawnFrontend(lanIP) {
  log("Starting frontend on port " + FRONTEND_PORT + "...");
  const env = Object.assign({}, process.env, {
    NEXTAUTH_URL: "http://" + lanIP + ":" + FRONTEND_PORT,
    NEXT_PUBLIC_API_URL: "http://" + lanIP + ":" + BACKEND_PORT,
  });

  frontendProcess = spawn("npm", ["run", "dev", "--", "--hostname", "0.0.0.0"], {
    cwd: FRONTEND_DIR,
    shell: true,
    env: env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  frontendProcess.stdout.on("data", function (d) {
    const text = d.toString().trim();
    if (text) log("[frontend] " + text);
  });
  frontendProcess.stderr.on("data", function (d) {
    const text = d.toString().trim();
    if (text) log("[frontend] " + text);
  });
  frontendProcess.on("close", function (code) {
    log("Frontend process exited (code " + code + ").");
    frontendProcess = null;
    if (systemState === STATE.RUNNING) {
      broadcastStatus();
    }
  });
  frontendProcess.on("error", function (err) {
    log("Frontend spawn error: " + err.message);
  });
}

// ---------------------------------------------------------------------------
// Broadcast status to renderer
// ---------------------------------------------------------------------------
function broadcastStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const lanIP = detectLANIP();
  mainWindow.webContents.send("status-update", {
    state: systemState,
    lanIP: lanIP,
    backend: {
      port: BACKEND_PORT,
      url: "http://" + lanIP + ":" + BACKEND_PORT,
      ready: backendReady,
    },
    frontend: {
      port: FRONTEND_PORT,
      url: "http://" + lanIP + ":" + FRONTEND_PORT,
      ready: frontendReady,
    },
  });
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
ipcMain.handle("get-status", async function () {
  const lanIP = detectLANIP();
  let internet = false;
  let mysql = false;
  try {
    internet = await checkInternet();
  } catch (e) {
    internet = false;
  }
  try {
    mysql = await checkMySQL();
  } catch (e) {
    mysql = false;
  }
  return {
    state: systemState,
    lanIP: lanIP,
    internet: internet,
    mysql: mysql,
    backend: {
      port: BACKEND_PORT,
      url: "http://" + lanIP + ":" + BACKEND_PORT,
      ready: backendReady,
    },
    frontend: {
      port: FRONTEND_PORT,
      url: "http://" + lanIP + ":" + FRONTEND_PORT,
      ready: frontendReady,
    },
    logs: logLines,
  };
});

ipcMain.handle("start-system", async function () {
  if (systemState === STATE.STARTING || systemState === STATE.RUNNING) {
    return { ok: false, message: "System is already " + systemState };
  }

  systemState = STATE.STARTING;
  backendReady = false;
  frontendReady = false;
  broadcastStatus();

  try {
    // 0. Project folder must resolve (installed apps don't sit beside it).
    const root = getProjectRoot();
    if (!root) {
      log("ERROR: Project folder not set. Ask staff to locate it first.");
      systemState = STATE.STOPPED;
      broadcastStatus();
      return { ok: false, needProjectRoot: true, message: "Project folder not set. Use Locate to select the Eat n RepEat folder." };
    }
    log("Project folder: " + root);

    // 1. Bootstrap
    await runBootstrap();

    // 2. Check MySQL
    const mysqlOk = await checkMySQL();
    if (!mysqlOk) {
      log("WARNING: MySQL not reachable on port 3306.");
      log("Please start MySQL via XAMPP Control Panel.");
      log("Continuing startup anyway...");
    }

    const lanIP = detectLANIP();
    log("Detected LAN IP: " + lanIP);

    // 3. Spawn backend
    spawnBackend(lanIP);

    // 4. Wait for backend readiness
    log("Waiting for backend readiness (http://127.0.0.1:" + BACKEND_PORT + "/api/health)...");
    const backendOk = await waitForHTTP(
      "http://127.0.0.1:" + BACKEND_PORT + "/api/health",
      HEALTH_TIMEOUT_MS
    );
    if (!backendOk) {
      log("ERROR: Backend did not become ready within timeout.");
      systemState = STATE.STOPPED;
      broadcastStatus();
      return { ok: false, message: "Backend failed to start within timeout." };
    }
    backendReady = true;
    log("Backend is ready.");
    broadcastStatus();

    // 5. Spawn frontend
    spawnFrontend(lanIP);

    // 6. Wait for frontend readiness
    log("Waiting for frontend readiness (http://127.0.0.1:" + FRONTEND_PORT + "/)...");
    const frontendOk = await waitForHTTP(
      "http://127.0.0.1:" + FRONTEND_PORT + "/",
      HEALTH_TIMEOUT_MS
    );
    if (!frontendOk) {
      log("WARNING: Frontend did not become ready within timeout. It may still be building.");
    } else {
      frontendReady = true;
      log("Frontend is ready.");
    }

    systemState = STATE.RUNNING;
    log("System is now RUNNING.");
    broadcastStatus();

    return { ok: true, message: "System started successfully.", lanIP: lanIP };
  } catch (err) {
    log("Error starting system: " + err.message);
    systemState = STATE.STOPPED;
    broadcastStatus();
    return { ok: false, message: "Startup error: " + err.message };
  }
});

ipcMain.handle("stop-system", async function () {
  if (systemState === STATE.STOPPED) {
    return { ok: true, message: "System already stopped." };
  }

  log("Stopping system...");
  systemState = STATE.STOPPED;
  backendReady = false;
  frontendReady = false;

  killProcessTree(frontendProcess);
  frontendProcess = null;

  killProcessTree(backendProcess);
  backendProcess = null;

  log("System stopped.");
  broadcastStatus();
  return { ok: true, message: "System stopped." };
});

ipcMain.handle("get-qr", async function () {
  const lanIP = detectLANIP();
  const customerURL = "http://" + lanIP + ":" + FRONTEND_PORT + "/customer";

  try {
    const dataURL = await QRCode.toDataURL(customerURL, {
      width: 300,
      margin: 2,
      color: {
        dark: "#800000",
        light: "#FFFDD0",
      },
    });
    return {
      ok: true,
      dataURL: dataURL,
      url: customerURL,
    };
  } catch (err) {
    return { ok: false, message: "QR generation failed: " + err.message };
  }
});

ipcMain.handle("get-project-root", async function () {
  const root = getProjectRoot();
  return { root: root, valid: !!root };
});

ipcMain.handle("choose-project-root", async function () {
  const result = await dialog.showOpenDialog({
    title: "Select the Eat n RepEat project folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { ok: false, message: "No folder selected." };
  }
  const dir = result.filePaths[0];
  if (!isValidProjectRoot(dir)) {
    log("Rejected project folder (missing backend/frontend): " + dir);
    return {
      ok: false,
      message: "That folder does not contain eat-n-repeat-backend and eat-n-repeat-frontend. Please select the Eat n RepEat project folder.",
    };
  }
  setProjectDirs(dir);
  persistRoot(dir);
  log("Project folder set: " + dir);
  return { ok: true, root: dir };
});

ipcMain.handle("open-url", function (event, url) {
  if (typeof url !== "string") return { ok: false, message: "Invalid URL" };

  // Only allow http/https
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { ok: false, message: "Only http/https URLs are allowed." };
  }

  shell.openExternal(url);
  return { ok: true };
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(function () {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  // Clean up spawned processes
  if (systemState !== STATE.STOPPED) {
    killProcessTree(frontendProcess);
    killProcessTree(backendProcess);
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", function () {
  if (systemState !== STATE.STOPPED) {
    killProcessTree(frontendProcess);
    killProcessTree(backendProcess);
  }
});
