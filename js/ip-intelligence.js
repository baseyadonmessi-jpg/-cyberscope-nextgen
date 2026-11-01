"use strict";

const API_URL = "http://127.0.0.1:8765";

const form = document.getElementById("ipForm");
const input = document.getElementById("ipInput");
const button = document.getElementById("analyzeButton");
const statusBox = document.getElementById("ipStatus");
const resultsBox = document.getElementById("ipResults");
const badge = document.getElementById("ipBadge");
const downloadButton = document.getElementById("downloadReport");

let latestReport = null;

function showStatus(message) {
  statusBox.textContent = message;
}

function displayValue(id, value) {
  document.getElementById(id).textContent = value;
}

function yesNo(value) {
  return value ? "Oui" : "Non";
}

function renderReport(report) {
  latestReport = report;
  if (window.CyberScopeHistory) {
    window.CyberScopeHistory.save("ip", "Analyse IP: " + (report.input || "inconnue"), {
      valid: !!report.valid,
      classification: report.classification || "Inconnue",
      version: report.version || null,
      is_global: !!report.is_global,
      is_private: !!report.is_private,
      is_loopback: !!report.is_loopback,
      is_reserved: !!report.is_reserved
    });
  }

  resultsBox.classList.add("visible");

  badge.textContent = report.valid
    ? report.classification
    : "Adresse invalide";

  displayValue("resultAddress", report.input || "—");
  displayValue(
    "resultVersion",
    report.version ? `IPv${report.version}` : "Inconnue"
  );
  displayValue("resultGlobal", yesNo(report.is_global));
  displayValue("resultPrivate", yesNo(report.is_private));
  displayValue("resultLoopback", yesNo(report.is_loopback));
  displayValue("resultReserved", yesNo(report.is_reserved));

  const list = document.getElementById("ipRecommendations");
  list.replaceChildren();

  for (const recommendation of report.recommendations || []) {
    const item = document.createElement("li");
    item.textContent = recommendation;
    list.appendChild(item);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ip = input.value.trim();

  if (!ip) {
    showStatus("Saisis une adresse IP avant de lancer l'analyse.");
    return;
  }

  button.disabled = true;
  showStatus("Analyse en cours…");
  resultsBox.classList.remove("visible");

  try {
    const response = await fetch(`${API_URL}/api/ip-analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ip })
    });

    const report = await response.json();

    if (!response.ok) {
      throw new Error(report.error || "La requête a échoué.");
    }

    renderReport(report);
    showStatus(
      report.valid
        ? "Analyse terminée."
        : "Analyse terminée : l'adresse saisie n'est pas valide."
    );
  } catch (error) {
    showStatus(
      "Impossible de joindre le moteur. Vérifie que le serveur Python " +
      "fonctionne sur le port 8765. Détail : " + error.message
    );
  } finally {
    button.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!latestReport) {
    showStatus("Lance d'abord une analyse avant de télécharger un rapport.");
    return;
  }

  const blob = new Blob(
    [JSON.stringify(latestReport, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cyberscope-ip-report.json";
  link.click();

  URL.revokeObjectURL(url);
  showStatus("Téléchargement du rapport demandé.");
});
