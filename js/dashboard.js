(() => {
  "use strict";

  const STORAGE_KEY = "cyberscope-nextgen-dashboard-events";
  const MAX_EVENTS = 100;

  function readEvents() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function addEvent(message, type = "INFO") {
    const events = readEvents();
    events.unshift({
      message,
      type,
      time: new Date().toLocaleTimeString("fr-FR")
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(events.slice(0, MAX_EVENTS))
    );
    renderEvents();
  }

  function createDashboard() {
    if (document.getElementById("cyber-dashboard")) return;

    const root = document.createElement("section");
    root.id = "cyber-dashboard";
    root.innerHTML = `
      <style>
        #cyber-dashboard {
          margin: 24px 0;
          color: #e5f4ff;
          font-family: system-ui, sans-serif;
        }
        #cyber-dashboard .cd-title {
          color: #00f0ff;
          letter-spacing: 2px;
          font-size: clamp(20px, 4vw, 30px);
          margin-bottom: 6px;
        }
        #cyber-dashboard .cd-subtitle {
          color: #8ba9c8;
          font-size: 13px;
          margin-bottom: 18px;
        }
        #cyber-dashboard .cd-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(145px,1fr));
          gap: 12px;
          margin: 18px 0;
        }
        #cyber-dashboard .cd-card {
          background: linear-gradient(145deg,#0c1a30,#070c18);
          border: 1px solid rgba(0,240,255,.24);
          border-radius: 12px;
          padding: 17px;
          box-shadow: 0 0 16px rgba(0,120,255,.06);
        }
        #cyber-dashboard .cd-label {
          color: #93abc5;
          font-size: 12px;
        }
        #cyber-dashboard .cd-number {
          display: block;
          color: #00f0ff;
          font-size: 27px;
          font-weight: 800;
          margin-top: 7px;
        }
        #cyber-dashboard .cd-terminal {
          background: #03070e;
          border: 1px solid rgba(0,240,255,.3);
          border-radius: 12px;
          overflow: hidden;
          margin-top: 16px;
        }
        #cyber-dashboard .cd-terminal-head {
          padding: 12px 15px;
          background: #0b1728;
          color: #00f0ff;
          font-size: 12px;
          letter-spacing: 1px;
        }
        #cyber-dashboard .cd-output {
          padding: 12px 15px;
          min-height: 90px;
          max-height: 210px;
          overflow: auto;
          font: 12px/1.8 ui-monospace,monospace;
          overflow-wrap: anywhere;
        }
        #cyber-dashboard .cd-line { color: #9cb6d0; }
        #cyber-dashboard .cd-line span { color: #00f0ff; }
        #cyber-dashboard .cd-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 0 15px 15px;
        }
        #cyber-dashboard .cd-actions button {
          background: #07172a;
          color: #00f0ff;
          border: 1px solid rgba(0,240,255,.35);
          border-radius: 7px;
          padding: 9px 12px;
          cursor: pointer;
        }
        #cyber-dashboard .cd-status {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00f0a0;
          box-shadow: 0 0 9px #00f0a0;
          margin-right: 7px;
        }
        @media(prefers-reduced-motion:no-preference) {
          #cyber-dashboard .cd-status {
            animation: cdPulse 1.8s infinite;
          }
          @keyframes cdPulse {
            50% { opacity: .35; }
          }
        }
      </style>
      <div class="cd-title">CYBERSCOPE // COMMAND CENTER</div>
      <div class="cd-subtitle">
        <span class="cd-status"></span>
        INTERFACE ACTIVE — statistiques locales du navigateur
      </div>
      <div class="cd-grid">
        <div class="cd-card">
          <div class="cd-label">ÉVÉNEMENTS DU TERMINAL</div>
          <span class="cd-number" id="cd-events">0</span>
        </div>
        <div class="cd-card">
          <div class="cd-label">INDICATEURS ENREGISTRÉS</div>
          <span class="cd-number" id="cd-indicators">0</span>
        </div>
        <div class="cd-card">
          <div class="cd-label">MODULES DU SITE</div>
          <span class="cd-number" id="cd-modules">6</span>
        </div>
      </div>
      <div class="cd-terminal">
        <div class="cd-terminal-head">ROOT@CYBERSCOPE:~# JOURNAL LOCAL</div>
        <div class="cd-output" id="cd-output" aria-live="polite"></div>
        <div class="cd-actions">
          <button type="button" id="cd-scan">Lancer un scan simulé</button>
          <button type="button" id="cd-refresh">Actualiser les statistiques</button>
        </div>
      </div>
    `;

    const firstCard = document.querySelector(".module-card, main, .container");
    if (firstCard && firstCard.parentNode) {
      firstCard.parentNode.insertBefore(root, firstCard);
    } else {
      document.body.prepend(root);
    }

    document.getElementById("cd-scan").addEventListener("click", () => {
      addEvent("Scan de démonstration terminé — aucun réseau externe interrogé.", "DEMO");
      refreshStats();
    });

    document.getElementById("cd-refresh").addEventListener("click", refreshStats);

    addEvent("Interface du tableau de bord initialisée.", "SYSTEM");
    renderEvents();
    refreshStats();
  }

  function renderEvents() {
    const output = document.getElementById("cd-output");
    const counter = document.getElementById("cd-events");
    if (!output || !counter) return;

    const events = readEvents();
    counter.textContent = String(events.length);
    output.replaceChildren();

    if (!events.length) {
      output.textContent = "Aucun événement local.";
      return;
    }

    events.slice(0, 12).forEach(event => {
      const line = document.createElement("div");
      line.className = "cd-line";
      const label = document.createElement("span");
      label.textContent = `[${event.time || "--:--:--"}] [${event.type || "INFO"}] `;
      line.append(label, document.createTextNode(event.message || ""));
      output.appendChild(line);
    });
  }

  function refreshStats() {
    const indicatorsKey = "cyberscope-nextgen-investigations";
    let indicators = [];

    try {
      const parsed = JSON.parse(localStorage.getItem(indicatorsKey) || "[]");
      if (Array.isArray(parsed)) indicators = parsed;
    } catch {}

    const indicatorCounter = document.getElementById("cd-indicators");
    const modulesCounter = document.getElementById("cd-modules");

    if (indicatorCounter) indicatorCounter.textContent = String(indicators.length);

    if (modulesCounter) {
      modulesCounter.textContent = String(
        document.querySelectorAll(".module-card").length || 6
      );
    }

    renderEvents();
  }

  function start() {
    createDashboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
