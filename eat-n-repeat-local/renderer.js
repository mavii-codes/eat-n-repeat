"use strict";

// DOM elements
var btnStart = document.getElementById("btn-start");
var btnStop = document.getElementById("btn-stop");
var btnStaff = document.getElementById("btn-staff");
var btnAdmin = document.getElementById("btn-admin");
var btnQR = document.getElementById("btn-qr");
var btnClearLog = document.getElementById("btn-clear-log");
var btnCloseQR = document.getElementById("btn-close-qr");

var pillInternet = document.getElementById("pill-internet");
var pillDatabase = document.getElementById("pill-database");
var pillSystem = document.getElementById("pill-system");
var lanInfoEl = document.getElementById("lan-info");

var qrPanel = document.getElementById("qr-panel");
var qrImage = document.getElementById("qr-image");
var qrURL = document.getElementById("qr-url");

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
    btnStaff.disabled = false;
    btnAdmin.disabled = false;
    btnQR.disabled = false;
  } else if (state === "starting") {
    btnStart.disabled = true;
    btnStop.disabled = false;
    btnStaff.disabled = true;
    btnAdmin.disabled = true;
    btnQR.disabled = true;
  } else {
    btnStart.disabled = false;
    btnStop.disabled = true;
    btnStaff.disabled = true;
    btnAdmin.disabled = true;
    btnQR.disabled = true;
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
  qrPanel.style.display = "none";
  refreshStatus();
});

btnStaff.addEventListener("click", function () {
  var staffURL = "http://" + currentLanIP + ":3000/staff";
  window.electronAPI.openURL(staffURL);
  appendLogLine("[UI] Opening staff portal: " + staffURL);
});

btnAdmin.addEventListener("click", function () {
  var adminURL = "http://" + currentLanIP + ":3000/admin";
  window.electronAPI.openURL(adminURL);
  appendLogLine("[UI] Opening admin portal: " + adminURL);
});

btnQR.addEventListener("click", async function () {
  try {
    var result = await window.electronAPI.getQR();
    if (result.ok) {
      qrImage.src = result.dataURL;
      qrURL.textContent = result.url;
      qrPanel.style.display = "block";
    } else {
      appendLogLine("[UI] QR error: " + result.message);
    }
  } catch (e) {
    appendLogLine("[UI] QR failed: " + e.message);
  }
});

btnCloseQR.addEventListener("click", function () {
  qrPanel.style.display = "none";
});

btnClearLog.addEventListener("click", function () {
  logArea.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
refreshStatus();
