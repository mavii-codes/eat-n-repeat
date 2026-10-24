"use strict";

// DOM elements
var btnStart = document.getElementById("btn-start");
var btnStop = document.getElementById("btn-stop");
var btnPortal = document.getElementById("btn-portal");
var btnClearLog = document.getElementById("btn-clear-log");
var btnLocate = document.getElementById("btn-locate");
var projectRootEl = document.getElementById("project-root");

var pillInternet = document.getElementById("pill-internet");
var pillDatabase = document.getElementById("pill-database");
var pillSystem = document.getElementById("pill-system");
var lanInfoEl = document.getElementById("lan-info");

var logArea = document.getElementById("log-area");

var currentLanIP = "127.0.0.1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setStatusPill(el, status) {
  el.classList.remove("active", "warning", "error");
  if (status === "ok") el.classList.add("active");
  else if (status === "warn") el.classList.add("warning");
  else if (status === "error") el.classList.add("error");
}

function appendLogLine(line) {
  var div = document.createElement("div");
  div.className = "log-line";
  div.textContent = line;
  logArea.appendChild(div);
  // Keep at most 300 DOM elements
  while (logArea.children.length > 300) {
    logArea.removeChild(logArea.firstChild);
  }
  logArea.scrollTop = logArea.scrollHeight;
}

function setButtons(state) {
  if (state === "running") {
    btnStart.disabled = true;
    btnStop.disabled = false;
    btnPortal.disabled = false;
  } else if (state === "starting") {
    btnStart.disabled = true;
    btnStop.disabled = false;
    btnPortal.disabled = true;
  } else {
    btnStart.disabled = false;
    btnStop.disabled = true;
    btnPortal.disabled = true;
  }
}

// ---------------------------------------------------------------------------
// Initial status fetch
// ---------------------------------------------------------------------------
async function refreshStatus() {
  try {
    var status = await window.electronAPI.getStatus();
    updateUI(status);
  } catch (e) {
    console.error("Failed to get status:", e);
  }
  try {
    var proj = await window.electronAPI.getProjectRoot();
    if (proj && proj.valid) {
      projectRootEl.textContent = proj.root;
    } else {
      projectRootEl.textContent = "not set — click Locate...";
      appendLogLine("[UI] Project folder not set. Click Locate... and select the Eat n RepEat folder, then START.");
    }
  } catch (e) {
    console.error("Failed to get project root:", e);
  }
}

function updateUI(status) {
  currentLanIP = status.lanIP || "127.0.0.1";
  setButtons(status.state);
  lanInfoEl.textContent = "LAN IP: " + currentLanIP;

  setStatusPill(pillInternet, status.internet ? "ok" : "error");
  setStatusPill(pillDatabase, status.mysql ? "ok" : "error");

  if (status.state === "running" && status.backend.ready && status.frontend.ready) {
    setStatusPill(pillSystem, "ok");
  } else if (status.state === "starting") {
    setStatusPill(pillSystem, "warn");
  } else {
    setStatusPill(pillSystem, status.state === "running" ? "warn" : "");
  }
}

// ---------------------------------------------------------------------------
// IPC listeners
// ---------------------------------------------------------------------------
window.electronAPI.onLogLine(function (line) {
  appendLogLine(line);
});

window.electronAPI.onStatusUpdate(function (status) {
  updateUI(status);
});

// ---------------------------------------------------------------------------
// Button handlers
// ---------------------------------------------------------------------------
btnStart.addEventListener("click", async function () {
  btnStart.disabled = true;
  btnStart.textContent = "STARTING...";
  try {
    var result = await window.electronAPI.startSystem();
    if (!result.ok) {
      appendLogLine("[UI] Error: " + result.message);
      if (result.needProjectRoot) {
        await locateProject();
      }
    }
  } catch (e) {
    appendLogLine("[UI] Start failed: " + e.message);
  }
  btnStart.textContent = "START";
  refreshStatus();
});

btnStop.addEventListener("click", async function () {
  btnStop.disabled = true;
  btnStop.textContent = "STOPPING...";
  try {
    var result = await window.electronAPI.stopSystem();
    if (!result.ok) {
      appendLogLine("[UI] Error: " + result.message);
    }
  } catch (e) {
    appendLogLine("[UI] Stop failed: " + e.message);
  }
  btnStop.textContent = "STOP";
  refreshStatus();
});

btnPortal.addEventListener("click", function () {
  var portalURL = "http://" + currentLanIP + ":3000/login";
  window.electronAPI.openURL(portalURL);
  appendLogLine("[UI] Opening staff/admin portal: " + portalURL);
});

async function locateProject() {
  try {
    var result = await window.electronAPI.chooseProjectRoot();
    if (result.ok) {
      projectRootEl.textContent = result.root;
      appendLogLine("[UI] Project folder set: " + result.root);
    } else {
      appendLogLine("[UI] Locate cancelled: " + result.message);
    }
  } catch (e) {
    appendLogLine("[UI] Locate failed: " + e.message);
  }
  refreshStatus();
}

btnLocate.addEventListener("click", locateProject);

btnClearLog.addEventListener("click", function () {
  logArea.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
refreshStatus();
