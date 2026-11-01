(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORE = "cyberscope-nextgen-investigations";

  function loadItems() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveItems(items) {
    localStorage.setItem(STORE, JSON.stringify(items));
  }

  function addStyle() {
    if ($("csModulesStyle")) return;
    const style = document.createElement("style");
    style.id = "csModulesStyle";
    style.textContent = `
      .cs-tool{margin-top:18px;padding:20px;border:1px solid #292d49;
        border-radius:14px;background:#111426;color:#e5e7f5}
      .cs-tool h3{margin:0 0 12px;font-size:16px}
      .cs-tool p{color:#aab2ce;font-size:12px;line-height:1.6}
      .cs-form{display:flex;gap:9px;flex-wrap:wrap;margin:12px 0}
      .cs-form input,.cs-form select,.cs-form textarea{flex:1;min-width:180px;
        padding:11px;border:1px solid #343956;border-radius:8px;
        background:#090c18;color:#f1f5f9}
      .cs-form button,.cs-action{padding:10px 14px;border:1px solid #6254a5;
        border-radius:8px;background:#34265f;color:white;cursor:pointer}
      .cs-output{margin-top:12px;padding:12px;border-radius:8px;
        background:#090c18;overflow-wrap:anywhere;font-size:12px}
      .cs-item{padding:10px;margin-top:8px;border:1px solid #292d49;
        border-radius:8px;overflow-wrap:anywhere}
      .cs-item button{margin-left:8px}
      .cs-note{color:#aab2ce;font-size:11px}
    `;
    document.head.appendChild(style);
  }

  function makeTool(id, title, description) {
    const card = $(id);
    if (!card || $(id + "Tool")) return null;

    card.querySelector(".module-state")?.replaceChildren(
      document.createTextNode("DISPONIBLE")
    );

    const panel = document.createElement("div");
    panel.id = id + "Tool";
    panel.className = "cs-tool";
    panel.innerHTML = `<h3>${title}</h3><p>${description}</p>`;
    card.appendChild(panel);
    return panel;
  }

  function emailTool() {
    const panel = makeTool(
      "email",
      "Analyse d’adresse e-mail",
      "Vérification locale de la syntaxe et examen du domaine. Ce contrôle ne confirme ni l’existence de la boîte ni la réputation réelle du domaine."
    );
    if (!panel) return;

    panel.insertAdjacentHTML("beforeend", `
      <form class="cs-form" id="csEmailForm">
        <input id="csEmailInput" type="email" required maxlength="254"
          placeholder="exemple@domaine.com" aria-label="Adresse e-mail">
        <button type="submit">Examiner</button>
      </form>
      <div class="cs-output" id="csEmailOutput" aria-live="polite">
        En attente d’une adresse.
      </div>
    `);

    $("csEmailForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = $("csEmailInput").value.trim();
      const at = value.lastIndexOf("@");
      const domain = at > 0 ? value.slice(at + 1).toLowerCase() : "";
      const labels = domain.split(".");
      const validDomain = labels.length >= 2 &&
        labels.every((part) =>
          /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)
        ) && labels.every((part) => part.length <= 63);
      const valid = at > 0 && at === value.indexOf("@") &&
        value.length <= 254 && !/\s/.test(value) && validDomain;

      $("csEmailOutput").textContent = valid
        ? `Syntaxe acceptable. Domaine examiné : ${domain}. Aucune vérification de réputation ni de livraison n’a été effectuée.`
        : "Adresse ou domaine de syntaxe incorrecte. Vérifie la saisie.";
    });
  }

  function threatTool() {
    const panel = makeTool(
      "threats",
      "Registre d’indicateurs",
      "Ajoute des indicateurs à examiner. Ils sont enregistrés uniquement dans le stockage local de ce navigateur."
    );
    if (!panel) return;

    panel.insertAdjacentHTML("beforeend", `
      <form class="cs-form" id="csThreatForm">
        <select id="csThreatType" aria-label="Type d’indicateur">
          <option value="IP">Adresse IP</option>
          <option value="Domaine">Domaine</option>
          <option value="URL">URL</option>
          <option value="E-mail">E-mail</option>
          <option value="Autre">Autre</option>
        </select>
        <input id="csThreatValue" required maxlength="500"
          placeholder="Valeur de l’indicateur" aria-label="Indicateur">
        <button type="submit">Ajouter</button>
      </form>
      <div id="csThreatList" aria-live="polite"></div>
    `);

    function render() {
      const items = loadItems();
      const list = $("csThreatList");
      list.replaceChildren();

      if (!items.length) {
        list.textContent = "Aucun indicateur enregistré.";
        return;
      }

      items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "cs-item";
        const text = document.createElement("span");
        text.textContent = `${item.type} — ${item.value} — ${item.date}`;
        row.appendChild(text);

        const remove = document.createElement("button");
        remove.className = "cs-action";
        remove.type = "button";
        remove.textContent = "Retirer";
        remove.addEventListener("click", () => {
          const latest = loadItems();
          latest.splice(index, 1);
          saveItems(latest);
          render();
        });
        row.appendChild(remove);
        list.appendChild(row);
      });
    }

    $("csThreatForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const value = $("csThreatValue").value.trim();
      if (!value) return;

      const items = loadItems();
      items.unshift({
        type: $("csThreatType").value,
        value,
        date: new Date().toLocaleString("fr-FR")
      });
      saveItems(items);
      $("csThreatValue").value = "";
      render();
    });

    render();
  }

  function reportsTool() {
    const panel = makeTool(
      "reports",
      "Export des investigations",
      "Télécharge un rapport JSON des indicateurs enregistrés dans ce navigateur. Il ne contient pas automatiquement les résultats des autres modules."
    );
    if (!panel) return;

    panel.insertAdjacentHTML("beforeend", `
      <p id="csReportCount">Indicateurs enregistrés : 0</p>
      <div class="cs-form">
        <button class="cs-action" id="csExportReport" type="button">
          Télécharger le rapport JSON
        </button>
      </div>
      <div class="cs-note" id="csReportStatus" aria-live="polite"></div>
    `);

    function updateCount() {
      $("csReportCount").textContent =
        `Indicateurs enregistrés : ${loadItems().length}`;
    }

    $("csExportReport").addEventListener("click", () => {
      const report = {
        product: "CYBERSCOPE NEXT GEN",
        generated_at: new Date().toISOString(),
        report_type: "local_indicator_register",
        indicators: loadItems(),
        note: "Registre local uniquement ; ne constitue pas une preuve de compromission."
      };

      const blob = new Blob(
        [JSON.stringify(report, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cyberscope-rapport-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      $("csReportStatus").textContent = "Export demandé.";
      updateCount();
    });

    window.addEventListener("storage", updateCount);
    updateCount();
  }

  function init() {
    addStyle();
    emailTool();
    threatTool();
    reportsTool();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
