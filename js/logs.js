"use strict";

const API_URL = "http://127.0.0.1:8765";
const MAX_SIZE = 2 * 1024 * 1024;

const logInput = document.getElementById("logInput");
const logFile = document.getElementById("logFile");
const thresholdInput = document.getElementById("threshold");
const engineVersionInput = document.getElementById("engineVersion");
const runButton = document.getElementById("runAnalysis");
const downloadButton = document.getElementById("downloadReport");
const statusBox = document.getElementById("logStatus");
const summaryBox = document.getElementById("logSummary");
const alertsBox = document.getElementById("logAlerts");
const limitationsBox = document.getElementById("logLimitations");

let latestReport = null;

function setStatus(message) {
  statusBox.textContent = message;
}

function addTextElement(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.appendChild(element);
  return element;
}

async function checkServer() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    if (!response.ok) {
      throw new Error("Réponse incorrecte du serveur.");
    }

    const data = await response.json();

    if (data.status === "ok") {
      setStatus("Moteur Python connecté. Tu peux lancer une analyse.");
    } else {
      setStatus("Le moteur Python ne confirme pas son état.");
    }
  } catch (error) {
    setStatus(
      "Serveur inaccessible. Vérifie que le moteur Python fonctionne sur le port 8765."
    );
  }
}

logFile.addEventListener("change", async () => {
  const file = logFile.files[0];

  if (!file) return;

  if (file.size > MAX_SIZE) {
    setStatus("Fichier trop volumineux : limite de 2 Mo.");
    logFile.value = "";
    return;
  }

  try {
    logInput.value = await file.text();
    setStatus(`Fichier chargé : ${file.name}`);
  } catch (error) {
    setStatus("Impossible de lire ce fichier.");
  }
});

runButton.addEventListener("click", async () => {
  const text = logInput.value;
  const threshold = Number(thresholdInput.value);

  if (!text.trim()) {
    setStatus("Ajoute d'abord le contenu d'un journal.");
    return;
  }

  if (new TextEncoder().encode(text).length > MAX_SIZE) {
    setStatus("Le journal dépasse la limite de 2 Mo.");
    return;
  }

  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 1000) {
    setStatus("Le seuil doit être un nombre entier entre 1 et 1000.");
    return;
  }

  runButton.disabled = true;
  downloadButton.disabled = true;
  latestReport = null;
  setStatus("Analyse en cours...");
  summaryBox.textContent = "Analyse en cours...";
  alertsBox.replaceChildren();
  limitationsBox.replaceChildren();

  try {
    const endpoint = engineVersionInput.value === "v2"
      ? "/api/analyze-v2"
      : "/api/analyze";

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, threshold })
    });

    const report = await response.json();

    if (!response.ok) {
      throw new Error(report.error || "Le serveur a refusé l'analyse.");
    }

    latestReport = report;
    if (window.CyberScopeHistory) {
      window.CyberScopeHistory.save("logs", "Analyse de journaux", {
        input_lines: report.input_lines ?? 0,
        alerts_count: report.alerts_count ?? 0,
        summary: report.summary || {}
      });
    }
    displayReport(report);
    downloadButton.disabled = false;
    setStatus("Analyse terminée. Vérifie les alertes avant toute conclusion.");
  } catch (error) {
    setStatus(
      `Échec de l'analyse : ${error.message} Vérifie le serveur et la connexion locale.`
    );
    summaryBox.textContent = "Aucun résultat disponible.";
  } finally {
    runButton.disabled = false;
  }
});

function displayReport(report) {
  const summary = report.summary || {};

  summaryBox.replaceChildren();

  addTextElement(
    summaryBox,
    "p",
    `Lignes examinées : ${report.input_lines ?? 0}`
  );

  addTextElement(
    summaryBox,
    "p",
    `Échecs d'authentification : ${summary.failed_authentication ?? 0}`
  );

  addTextElement(
    summaryBox,
    "p",
    `Connexions réussies : ${summary.successful_authentication ?? 0}`
  );

  addTextElement(
    summaryBox,
    "p",
    `Alertes détectées : ${report.alerts_count ?? 0}`
  );

  alertsBox.replaceChildren();

  const alerts = Array.isArray(report.alerts) ? report.alerts : [];

  if (alerts.length === 0) {
    addTextElement(alertsBox, "p", "Aucune alerte selon les règles actuelles.");
  }

  alerts.forEach((alert) => {
    const level = String(alert.severity || "medium").toLowerCase();
    const card = document.createElement("article");

    card.className = `log-alert ${
      level === "high" ? "high" : "medium"
    }`;

    addTextElement(
      card,
      "strong",
      `${String(alert.severity || "Information").toUpperCase()} — ${
        alert.title || alert.type || "Alerte"
      }`
    );

    if (alert.description) {
      addTextElement(card, "p", alert.description);
    }

    if (alert.source_ip) {
      addTextElement(card, "p", `Adresse source : ${alert.source_ip}`);
    }

    if (alert.count !== undefined) {
      addTextElement(card, "p", `Occurrences : ${alert.count}`);
    }

    if (alert.lines) {
      addTextElement(card, "p", `Lignes concernées : ${alert.lines}`);
    }

    addTextElement(
      card,
      "p",
      "Une alerte est un indice à vérifier, pas une preuve d'attaque."
    );
    const explainButton = document.createElement("button");
    explainButton.type = "button";
    explainButton.textContent = "🤖 Expliquer avec l'assistant";
    explainButton.addEventListener("click", () => {
      if (window.CyberScopeAssistant) {
        window.CyberScopeAssistant.explain({
          type: alert.type || "security_log_keyword",
          severity: alert.severity || "medium",
          reason: [
            alert.title || alert.type || "Alerte détectée",
            alert.description || "",
            alert.source_ip ? "Adresse source : " + alert.source_ip : "",
            alert.count !== undefined ? "Occurrences : " + alert.count : ""
          ].filter(Boolean).join(". ")
        });
      }
    });

    card.appendChild(explainButton);
    alertsBox.appendChild(card);
  });

  limitationsBox.replaceChildren();

  const limitations = Array.isArray(report.limitations)
    ? report.limitations
    : [];

  limitations.forEach((item) => {
    addTextElement(limitationsBox, "li", String(item));
  });

  if (limitations.length === 0) {
    addTextElement(
      limitationsBox,
      "li",
      "Les résultats dépendent du format du journal et des règles disponibles."
    );
  }
}

downloadButton.addEventListener("click", () => {
  if (!latestReport) return;

  const blob = new Blob(
    [JSON.stringify(latestReport, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cyberscope-rapport.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
});

checkServer();
