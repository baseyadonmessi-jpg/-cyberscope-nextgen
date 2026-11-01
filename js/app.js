"use strict";

const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  rows: [],
  fileCount: 0,
  alertCount: 0
};

const SENSITIVE_KEY =
  /password|passwd|pwd|token|secret|api[_-]?key|authorization|cookie|session|credential/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function displayValue(value) {
  if (value === null) return "null";
  if (typeof value === "object") {
    return Array.isArray(value) ? `Array (${value.length})` : "Objet";
  }
  return String(value);
}

function safeString(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function flattenJSON(value, path = "$", rows = []) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path, value: "Tableau vide", type: "array" });
    } else {
      value.forEach((item, index) => {
        flattenJSON(item, `${path}[${index}]`, rows);
      });
    }
    return rows;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      rows.push({ path, value: "Objet vide", type: "object" });
    } else {
      entries.forEach(([key, item]) => {
        const childPath = path === "$" ? key : `${path}.${key}`;

        if (SENSITIVE_KEY.test(key)) {
          rows.push({
            path: childPath,
            value: "[VALEUR MASQUÉE]",
            type: "sensible",
            sensitive: true
          });
        } else {
          flattenJSON(item, childPath, rows);
        }
      });
    }

    return rows;
  }

  rows.push({
    path,
    value: displayValue(value),
    type: value === null ? "null" : typeof value
  });

  return rows;
}

function collectAlerts(value, path = "$", alerts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectAlerts(item, `${path}[${index}]`, alerts);
    });
    return alerts;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const currentPath = path === "$" ? key : `${path}.${key}`;

      if (SENSITIVE_KEY.test(key)) {
        alerts.push({
          title: "Champ potentiellement sensible",
          detail: `${currentPath} : valeur masquée par précaution.`
        });
      } else if (
        typeof item === "string" &&
        EMAIL_PATTERN.test(item)
      ) {
        alerts.push({
          title: "Adresse email détectée",
          detail: `${currentPath} : une adresse email est présente.`
        });
      }

      collectAlerts(item, currentPath, alerts);
    }
  }

  return alerts;
}

function countItems(value) {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countItems(item), 0);
  }

  if (value !== null && typeof value === "object") {
    return Object.values(value).reduce(
      (sum, item) => sum + countItems(item),
      Object.keys(value).length
    );
  }

  return 1;
}

function renderTable() {
  const query = $("searchInput").value.trim().toLowerCase();

  const filtered = state.rows.filter((row) =>
    `${row.path} ${row.value} ${row.type}`.toLowerCase().includes(query)
  );

  const tbody = $("dataTable");

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" class="empty-cell">Aucun résultat trouvé.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((row) => `
    <tr>
      <td>${safeString(row.path)}</td>
      <td>${safeString(row.value)}</td>
      <td><span class="type-tag">${safeString(row.type)}</span></td>
    </tr>
  `).join("");
}

function renderAlerts(alerts) {
  const container = $("alertsList");

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="alert-item safe">
        <strong>Aucun champ sensible détecté</strong>
        <p>Cette vérification ne garantit pas que toutes les données sont sûres.</p>
      </div>`;
    return;
  }

  const visibleAlerts = alerts.slice(0, 30);

  container.innerHTML = visibleAlerts.map((alert) => `
    <div class="alert-item">
      <strong>⚠ ${safeString(alert.title)}</strong>
      <p>${safeString(alert.detail)}</p>
    </div>
  `).join("");

  if (alerts.length > visibleAlerts.length) {
    container.insertAdjacentHTML(
      "beforeend",
      `<p> ${alerts.length - visibleAlerts.length} alertes supplémentaires non affichées.</p>`
    );
  }
}

function analyzeJSON() {
  const raw = $("jsonInput").value.trim();

  if (!raw) {
    $("resultStatus").textContent = "DONNÉES MANQUANTES";
    $("summary").innerHTML = `
      <strong>Aucune donnée à analyser</strong>
      <p>Colle un JSON ou importe un fichier pour commencer.</p>`;
    return;
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    $("resultStatus").textContent = "JSON INVALIDE";
    $("summary").innerHTML = `
      <strong>Impossible de lire ce JSON</strong>
      <p>Vérifie les guillemets, les virgules et les accolades.</p>`;
    $("alertsList").innerHTML = `
      <div class="alert-item">
        <strong>Erreur de syntaxe</strong>
        <p>${safeString(error.message)}</p>
      </div>`;
    return;
  }

  state.data = parsed;
  state.rows = flattenJSON(parsed);
  const alerts = collectAlerts(parsed);
  state.alertCount = alerts.length;

  $("filesCount").textContent = state.fileCount;
  $("itemsCount").textContent = countItems(parsed);
  $("alertsCount").textContent = alerts.length;
  $("resultStatus").textContent = "ANALYSE TERMINÉE";

  $("summary").innerHTML = `
    <div class="empty-icon">✓</div>
    <strong>Analyse terminée</strong>
    <p>${state.rows.length} lignes analysées. ${alerts.length} signalements à vérifier.</p>`;

  renderAlerts(alerts);
  renderTable();
  if (window.CyberScopeHistory) {
    window.CyberScopeHistory.save("json", "Analyse JSON", {
      rows: state.rows.length,
      items: countItems(parsed),
      alerts: alerts.length
    });
  }
}

$("analyzeButton").addEventListener("click", analyzeJSON);
$("searchInput").addEventListener("input", renderTable);

$("jsonFile").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    $("resultStatus").textContent = "FICHIER TROP VOLUMINEUX";
    $("summary").innerHTML = `
      <strong>Fichier trop volumineux</strong>
      <p>Pour cette première version, la limite est de 2 Mo.</p>`;
    event.target.value = "";
    return;
  }

  try {
    $("jsonInput").value = await file.text();
    state.fileCount += 1;
    $("filesCount").textContent = state.fileCount;
    analyzeJSON();
  } catch {
    $("resultStatus").textContent = "ERREUR DE LECTURE";
    $("summary").innerHTML = `
      <strong>Lecture impossible</strong>
      <p>Le fichier n'a pas pu être lu.</p>`;
  }
});

console.log("CYBERSCOPE NEXT GEN : analyseur JSON prêt.");
