"use strict";

(() => {
  const STORAGE_KEY = "cyberscope-nextgen-history";
  const MAX_ENTRIES = 300;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function save(type, title, details = {}) {
    try {
      const entries = read();
      entries.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        date: new Date().toISOString(),
        type: String(type),
        title: String(title),
        details
      });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(entries.slice(0, MAX_ENTRIES))
      );
      return true;
    } catch (error) {
      console.warn("Historique non enregistré :", error);
      return false;
    }
  }

  window.CyberScopeHistory = { save, read, storageKey: STORAGE_KEY };
})();
