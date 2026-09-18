"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getStatus: function () {
    return ipcRenderer.invoke("get-status");
  },
  startSystem: function () {
    return ipcRenderer.invoke("start-system");
  },
  stopSystem: function () {
    return ipcRenderer.invoke("stop-system");
  },
  getQR: function () {
    return ipcRenderer.invoke("get-qr");
  },
  openURL: function (url) {
    return ipcRenderer.invoke("open-url", url);
  },
  getProjectRoot: function () {
    return ipcRenderer.invoke("get-project-root");
  },
  chooseProjectRoot: function () {
    return ipcRenderer.invoke("choose-project-root");
  },
  onLogLine: function (callback) {
    ipcRenderer.on("log-line", function (_event, line) {
      callback(line);
    });
  },
  onStatusUpdate: function (callback) {
    ipcRenderer.on("status-update", function (_event, status) {
      callback(status);
    });
  },
});
