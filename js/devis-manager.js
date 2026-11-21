/* ==========================================================================
   DEVIS-MANAGER.JS
   Gestion du panier et envoi automatique vers HubSpot (Compte 149621611)
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

  form.addEventListener("submit", async event => {
    event.preventDefault();
    event.stopPropagation();

    const honeypot = document.getElementById("website_url");
    if (honeypot && honeypot.value.trim() !== "") return;
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('[type="submit"]');
    const originalText = submitButton ? submitButton.textContent : "Envoyer ma demande de devis";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Envoi en cours...";
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const quoteList = getQuoteList();
    const itemsSummary = quoteList.length
      ? quoteList.map(i => `- ${i.nom} (${i.marque || "Lenovo"}) x${Math.max(1, Number(i.quantity) || 1)}`).join("\n")
      : "Demande libre (sans produit pré-sélectionné)";

    const fullMessage = `ÉQUIPEMENTS :\n${itemsSummary}\n\nBESOIN :\n${data.message || ""}`;

    try {
      const multipartData = new FormData();
      multipartData.append("company", data.company || "");
      multipartData.append("firstname", data.firstname || "");
      multipartData.append("lastname", data.lastname || "");
      multipartData.append("email", data.email || "");
      multipartData.append("phone", data.phone || "");
      multipartData.append("jobtitle", data.jobtitle || "");
      multipartData.append("message", fullMessage);
      multipartData.append(
        "hs_context",
        JSON.stringify({
          hutk: document.cookie.replace(/(?:(?:^|.*;\s*)hubspotutk\s*\=\s*([^;]*).*$)|^.*$/, "$1") || undefined,
          pageUrl: window.location.href,
          pageName: document.title
        })
      );

      await fetch(
        "https://forms-eu1.hsforms.com/submissions/v3/public/submit/formsnext/multipart/149621611/f2425af3-f47d-4b5e-a1df-5fa1c608918b",
        {
          method: "POST",
          mode: "no-cors",
          body: multipartData
        }
      );
    } catch (err) {
      console.warn("Erreur transmission HubSpot :", err);
    }

    showFeedback(
      `✔️ Merci ${data.firstname}. Votre demande de devis pour ${data.company} a bien été transmise à Glob Access. Notre équipe commerciale à Bamako vous recontactera sous 24h ouvrées.`,
      "success"
    );

    localStorage.removeItem(QUOTE_STORAGE_KEY);
    form.reset();
    renderQuoteItems();

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initQuotePage);
} else {
  initQuotePage();
}