/* ==========================================================================
   DEVIS-MANAGER.JS
   Capture native par le script de suivi HubSpot (Non-HubSpot Forms)
   ========================================================================== */

"use strict";

const QUOTE_STORAGE_KEY = "globAccessQuote";

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function getQuoteList() {
  try {
    const data = JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveQuoteList(list) {
  localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(list));
}

function updateQuoteCounter() {
  const quoteList = getQuoteList();
  const total = quoteList.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  document.querySelectorAll("#header-quote-count, .quote-count, .quote-badge-count").forEach(el => {
    el.textContent = total;
  });
}

function renderQuoteItems() {
  const container = document.getElementById("quote-items-container");
  const hiddenInput = document.getElementById("hubspot_quote_items");
  if (!container) return;

  const quoteList = getQuoteList();

  if (quoteList.length === 0) {
    container.innerHTML = `
      <p style="color:var(--color-text-muted);padding-block:1.5rem;">
        Aucun équipement sélectionné pour le moment.
        Vous pouvez tout de même nous décrire votre besoin dans le formulaire,
        ou <a href="produits.html" style="color:var(--color-primary);text-decoration:underline;">parcourir le catalogue</a>.
      </p>
    `;
    if (hiddenInput) hiddenInput.value = "Demande de devis libre (sans produit pré-sélectionné)";
    updateQuoteCounter();
    return;
  }

  const summaryText = quoteList.map(item => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    return `- ${item.nom || "Produit"} (${item.marque || "Lenovo"}) : Quantité ${qty}`;
  }).join("\n");

  if (hiddenInput) hiddenInput.value = summaryText;

  container.innerHTML = quoteList.map((item, index) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return `
      <div class="quote-item">
        <div>
          <span style="font-size:var(--text-xs);color:var(--color-secondary);font-weight:600;">
            ${escapeHtml(item.marque || "GLOB ACCESS")}
          </span>
          <div style="font-weight:600;color:var(--color-primary);">
            ${escapeHtml(item.nom || "Produit")}
          </div>
        </div>
        <div class="qty-controls">
          <button type="button" class="qty-btn" data-action="decrease" data-index="${index}">-</button>
          <span style="min-width:24px;text-align:center;font-weight:600;">${quantity}</span>
          <button type="button" class="qty-btn" data-action="increase" data-index="${index}">+</button>
          <button type="button" data-action="remove" data-index="${index}" style="margin-left:.5rem;color:var(--color-accent);font-size:var(--text-xs);">✕</button>
        </div>
      </div>
    `;
  }).join("");

  updateQuoteCounter();
}

function updateQuantity(index, delta) {
  const quoteList = getQuoteList();
  if (!quoteList[index]) return;
  const newQty = (Math.max(1, Number(quoteList[index].quantity) || 1)) + delta;
  if (newQty <= 0) quoteList.splice(index, 1);
  else quoteList[index].quantity = newQty;
  saveQuoteList(quoteList);
  renderQuoteItems();
}

function removeItem(index) {
  const quoteList = getQuoteList();
  if (!quoteList[index]) return;
  quoteList.splice(index, 1);
  saveQuoteList(quoteList);
  renderQuoteItems();
}

document.addEventListener("click", event => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;
  const index = Number(btn.dataset.index);
  if (!Number.isInteger(index)) return;

  if (btn.dataset.action === "increase") updateQuantity(index, 1);
  else if (btn.dataset.action === "decrease") updateQuantity(index, -1);
  else if (btn.dataset.action === "remove") removeItem(index);
});

function showFeedback(message, type = "success") {
  const feedback = document.getElementById("form-feedback");
  if (!feedback) return;
  feedback.className = `form-feedback ${type}`;
  feedback.textContent = message;
  feedback.style.display = "block";
  feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function initQuotePage() {
  renderQuoteItems();

  const form = document.getElementById("b2b-quote-form");
  if (!form || form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  // Création d'une cible iframe invisible sur le même domaine (évite l'erreur 405 et laisse HubSpot écouter le submit natif)
  let sinkFrame = document.getElementById("hs-capture-sink");
  if (!sinkFrame) {
    sinkFrame = document.createElement("iframe");
    sinkFrame.id = "hs-capture-sink";
    sinkFrame.name = "hs-capture-sink";
    sinkFrame.style.display = "none";
    document.body.appendChild(sinkFrame);
  }

  // On pointe le formulaire vers une page statique existante en GET dans l'iframe cachée
  form.method = "GET";
  form.action = "robots.txt";
  form.target = "hs-capture-sink";

  form.addEventListener("submit", event => {
    const honeypot = document.getElementById("website_url");
    if (honeypot && honeypot.value.trim() !== "") {
      event.preventDefault();
      return;
    }

    if (!form.reportValidity()) {
      event.preventDefault();
      return;
    }

    // Fusionne la liste des produits du panier dans le champ message pour qu'elle apparaisse dans HubSpot
    const quoteList = getQuoteList();
    const messageField = document.getElementById("message");
    if (quoteList.length > 0 && messageField && !messageField.value.includes("ÉQUIPEMENTS SÉLECTIONNÉS")) {
      const itemsText = quoteList
        .map(i => `- ${i.nom} (${i.marque || "Lenovo"}) : Quantité ${Math.max(1, Number(i.quantity) || 1)}`)
        .join("\n");
      messageField.value = `ÉQUIPEMENTS SÉLECTIONNÉS :\n${itemsText}\n\nPRÉCISIONS CLIENT :\n${messageField.value}`;
    }

    const firstName = document.getElementById("firstname")?.value || "";
    const companyName = document.getElementById("company")?.value || "";

    // Note : on NE fait PAS event.preventDefault() afin que le script HubSpot (hs-scripts.com)
    // détecte l'événement submit natif du navigateur et aspire tous les champs automatiquement !
    setTimeout(() => {
      showFeedback(
        `✔️ Merci ${firstName}. Votre demande de devis pour ${companyName} a bien été transmise à Glob Access. Notre équipe commerciale à Bamako vous recontactera sous 24h ouvrées.`,
        "success"
      );
      localStorage.removeItem(QUOTE_STORAGE_KEY);
      form.reset();
      renderQuoteItems();
    }, 600);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQuotePage);
} else {
  initQuotePage();
}