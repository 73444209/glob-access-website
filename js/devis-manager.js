/* ==========================================================================
   DEVIS-MANAGER.JS
   Gestion du panier de cotation et synchronisation avec le formulaire HubSpot
   ========================================================================== */

"use strict";

const QUOTE_STORAGE_KEY = "globAccessQuote";

document.addEventListener("DOMContentLoaded", () => {
  renderQuoteItems();
  syncCartWithHubSpotForm();
});

/* ==========================================================================
   1. OUTILS DE SÉCURITÉ ET DE STOCKAGE
   ========================================================================== */

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function getQuoteList() {
  try {
    const data = JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erreur de lecture du panier :", error);
    return [];
  }
}

function saveQuoteList(list) {
  localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(list));
}

function updateQuoteCounter() {
  const quoteList = getQuoteList();
  const total = quoteList.reduce((sum, item) => {
    return sum + Math.max(0, Number(item.quantity) || 0);
  }, 0);

  document.querySelectorAll(
    "#header-quote-count, .quote-count, .quote-badge-count"
  ).forEach(element => {
    element.textContent = total;
  });
}

function getCartSummaryText() {
  const quoteList = getQuoteList();
  if (quoteList.length === 0) return "";

  const lines = quoteList.map(item => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    return `• ${item.nom || "Produit"} (${item.marque || "Lenovo"}) — Quantité : ${quantity}`;
  });

  return `ÉQUIPEMENTS SÉLECTIONNÉS :\n${lines.join("\n")}\n\nPrécisions complémentaires : `;
}

/* ==========================================================================
   2. AFFICHAGE DU PANIER DE COTATION
   ========================================================================== */

function renderQuoteItems() {
  const container = document.getElementById("quote-items-container");
  if (!container) return;

  const quoteList = getQuoteList();

  if (quoteList.length === 0) {
    container.innerHTML = `
      <p style="color:var(--color-text-muted);padding-block:1.5rem;">
        Aucun équipement sélectionné pour le moment.
        Vous pouvez tout de même nous décrire votre besoin dans le formulaire,
        ou <a href="produits.html"
        style="color:var(--color-primary);text-decoration:underline;">
        parcourir le catalogue</a>.
      </p>
    `;
    updateQuoteCounter();
    return;
  }

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
          <button type="button" class="qty-btn" data-action="decrease" data-index="${index}" aria-label="Diminuer la quantité">-</button>
          <span style="min-width:24px;text-align:center;font-weight:600;">${quantity}</span>
          <button type="button" class="qty-btn" data-action="increase" data-index="${index}" aria-label="Augmenter la quantité">+</button>
          <button type="button" data-action="remove" data-index="${index}" style="margin-left:.5rem;color:var(--color-accent);font-size:var(--text-xs);" aria-label="Supprimer le produit">✕</button>
        </div>
      </div>
    `;
  }).join("");

  updateQuoteCounter();
  injectCartIntoHubSpotTextarea();
}

/* ==========================================================================
   3. INJECTION AUTOMATIQUE DU PANIER DANS LE FORMULAIRE HUBSPOT
   ========================================================================== */

function injectCartIntoHubSpotTextarea() {
  const summary = getCartSummaryText();
  if (!summary) return;

  const textarea = document.querySelector('#hubspot-native-form-container textarea[name="message"]');
  if (textarea && !textarea.dataset.userEdited) {
    textarea.value = summary;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function syncCartWithHubSpotForm() {
  const container = document.getElementById("hubspot-native-form-container");
  if (!container) return;

  // Surveille l'apparition du formulaire HubSpot dans la page
  const observer = new MutationObserver(() => {
    const textarea = container.querySelector('textarea[name="message"]');
    if (textarea) {
      injectCartIntoHubSpotTextarea();
      textarea.addEventListener("input", () => {
        textarea.dataset.userEdited = "true";
      }, { once: true });
    }
  });

  observer.observe(container, { childList: true, subtree: true });

  // Vide le panier local dès que HubSpot confirme la soumission
  window.addEventListener("message", event => {
    if (
      event.data &&
      event.data.type === "hsFormCallback" &&
      event.data.eventName === "onFormSubmitted"
    ) {
      localStorage.removeItem(QUOTE_STORAGE_KEY);
      renderQuoteItems();
    }
  });
}

/* ==========================================================================
   4. MODIFICATION DES QUANTITÉS ET SUPPRESSION
   ========================================================================== */

function updateQuantity(index, delta) {
  const quoteList = getQuoteList();
  if (!quoteList[index]) return;

  const currentQuantity = Math.max(1, Number(quoteList[index].quantity) || 1);
  const newQuantity = currentQuantity + delta;

  if (newQuantity <= 0) {
    quoteList.splice(index, 1);
  } else {
    quoteList[index].quantity = newQuantity;
  }

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
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const index = Number(button.dataset.index);
  const action = button.dataset.action;
  if (!Number.isInteger(index)) return;

  if (action === "increase") {
    updateQuantity(index, 1);
  } else if (action === "decrease") {
    updateQuantity(index, -1);
  } else if (action === "remove") {
    removeItem(index);
  }
});