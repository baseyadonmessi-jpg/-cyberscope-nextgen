"use strict";

const assistantForm = document.getElementById("assistant-form");
const assistantStatus = document.getElementById("assistant-status");
const assistantResult = document.getElementById("assistant-result");

function addText(parent, tag, text, className = "") {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

async function explainWithAssistant(alert) {
  assistantResult.replaceChildren();
  assistantResult.hidden = true;
  assistantStatus.textContent = "Analyse de l'alerte en cours…";

  try {
    const response = await fetch("http://127.0.0.1:8765/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "La requête a échoué.");

    addText(assistantResult, "h3", data.title || "Résultat de l'analyse");
    addText(
      assistantResult,
      "p",
      "Priorité : " + (data.priority || "Non déterminée"),
      "assistant-priority"
    );
    addText(assistantResult, "p", data.explanation || "Aucune explication disponible.");

    if (data.observed_reason) {
      addText(assistantResult, "h4", "Éléments observés");
      addText(assistantResult, "p", data.observed_reason);
    }

    const sections = [
      ["evidence", "Éléments à examiner"],
      ["recommended_checks", "Vérifications recommandées"],
      ["limitations", "Limites de l'analyse"]
    ];

    for (const [key, title] of sections) {
      const values = data[key];
      if (!Array.isArray(values) || values.length === 0) continue;

      addText(assistantResult, "h4", title);
      const list = document.createElement("ul");

      for (const value of values) {
        addText(list, "li", String(value));
      }

      assistantResult.appendChild(list);
    }

    assistantResult.hidden = false;
    assistantStatus.textContent = "Analyse terminée.";

    document.getElementById("defensive-assistant")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

    return true;
  } catch (error) {
    assistantStatus.textContent =
      "Impossible de joindre l'API. Vérifie le serveur du port 8765. Détail : " +
      error.message;

    return false;
  }
}

window.CyberScopeAssistant = {
  explain: explainWithAssistant
};

assistantForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const alert = {
    type: document.getElementById("assistant-type").value,
    severity: document.getElementById("assistant-severity").value,
    reason: document.getElementById("assistant-reason").value.trim()
  };

  await explainWithAssistant(alert);
});

