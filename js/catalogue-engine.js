/* ============================================================
   GLOB ACCESS — CATALOGUE ENGINE
   Chargement, filtrage et panier de devis
   Fichier : js/catalogue-engine.js
   ============================================================ */

"use strict";

const QUOTE_STORAGE_KEY = "globAccessQuote";
const PLACEHOLDER_IMAGE = "assets/images/produits/placeholder.webp";

// Données de secours si le fichier est ouvert sans serveur local (file://)
const FALLBACK_CATALOGUE = {
  categories_produits: [
    { id: "tous", label: "Tous les équipements" },
    { id: "ordinateurs-portables", label: "Ordinateurs Portables" },
    { id: "ordinateurs-bureau", label: "Ordinateurs de Bureau" },
    { id: "imprimantes", label: "Imprimantes & Scanners" },
    { id: "accessoires", label: "Accessoires & Réseau" }
  ],
  produits: [
    {
      id: "lenovo-thinkpad-t14",
      marque: "Lenovo",
      categorie: "ordinateurs-portables",
      segment: "Direction & Mobilité",
      nom: "Lenovo ThinkPad Série T (14 pouces)",
      description_courte: "La référence professionnelle ultra-robuste pour cadres, dirigeants et équipes mobiles. Sécurité matérielle ThinkShield intégrée.",
      specs: [
        "Processeur Intel Core / AMD Ryzen Pro (selon configuration)",
        "Mémoire 16 Go RAM extensible • Stockage SSD NVMe rapide",
        "Châssis testé selon normes militaires MIL-STD-810H",
        "Garantie constructeur officielle via Glob Access"
      ],
      statut: "Disponible sur commande",
      image: "assets/images/produits/thinkpad-t14.webp"
    },
    {
      id: "lenovo-thinkbook-14-15",
      marque: "Lenovo",
      categorie: "ordinateurs-portables",
      segment: "PME & Bureautique avancée",
      nom: "Lenovo ThinkBook 14 / 15",
      description_courte: "Allie élégance aluminium et performances professionnelles pour équiper efficacement les collaborateurs d'entreprise et ONG.",
      specs: [
        "Écran Full HD antireflet 14 ou 15,6 pouces",
        "Connectivité complète (USB-C, HDMI, RJ45 Ethernet)",
        "Lecteur d'empreintes digitales intégré au bouton d'alimentation",
        "Configurations sur mesure selon le cahier des charges"
      ],
      statut: "Disponible sur commande",
      image: "assets/images/produits/thinkbook-14.webp"
    }
    
  ]
};

let allProducts = [];
let activeCategory = "tous";
let toastTimer = null;


/* 1. SÉCURISATION DES DONNÉES
   ------------------------------------------------------------ */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getSavedQuote() {
  try {
    const data = JSON.parse(
      localStorage.getItem(QUOTE_STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(data)) return [];

    return data.filter(item =>
      item &&
      typeof item.id === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
    );
  } catch (error) {
    console.error("Erreur panier :", error);
    return [];
  }
}


/* 2. INITIALISATION DU CATALOGUE
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", initCatalogue);

async function initCatalogue() {
  updateHeaderQuoteCount();

  const grid = document.getElementById("products-grid");
  if (!grid) return;

  try {
    const response = await fetch("data/catalogue.json");
    if (!response.ok) {
      throw new Error("Catalogue inaccessible");
    }

    const data = await response.json();
    if (
      !Array.isArray(data.produits) ||
      !Array.isArray(data.categories_produits)
    ) {
      throw new Error("Format du catalogue invalide");
    }

    allProducts = data.produits;
    renderFilters(data.categories_produits);
    renderProducts(allProducts);

  } catch (error) {
    console.warn("Basculé sur le catalogue de secours local :", error);
    allProducts = FALLBACK_CATALOGUE.produits;
    renderFilters(FALLBACK_CATALOGUE.categories_produits);
    renderProducts(allProducts);
  }
}


/* 3. FILTRES DES CATÉGORIES
   ------------------------------------------------------------ */
function renderFilters(categories) {
  const container = document.getElementById("category-filters");
  if (!container) return;

  container.innerHTML = categories.map(category => `
    <button
      type="button"
      class="filter-btn ${category.id === activeCategory ? "active" : ""}"
      data-category="${escapeHTML(category.id)}"
      aria-pressed="${category.id === activeCategory}"
    >
      ${escapeHTML(category.label)}
    </button>
  `).join("");

  container.addEventListener("click", event => {
    const button = event.target.closest(".filter-btn");
    if (!button || !container.contains(button)) return;

    activeCategory = button.dataset.category;

    container.querySelectorAll(".filter-btn").forEach(btn => {
      const selected = btn === button;
      btn.classList.toggle("active", selected);
      btn.setAttribute("aria-pressed", String(selected));
    });

    filterProducts();
  });
}


/* 4. FILTRAGE DES PRODUITS
   ------------------------------------------------------------ */
function filterProducts() {
  const filtered = activeCategory === "tous"
    ? allProducts
    : allProducts.filter(product =>
        product.categorie === activeCategory
      );

  renderProducts(filtered);
}


/* 5. AFFICHAGE DES CARTES PRODUITS
   ------------------------------------------------------------ */
function renderProducts(products) {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  if (!products.length) {
    grid.innerHTML = `
      <div class="catalogue-empty">
        <h3>Aucun équipement trouvé</h3>
        <p>Aucun produit dans cette catégorie pour le moment.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => {
    const status = String(product.statut || "");
    let statusClass = "status-on-request";

    if (/disponible/i.test(status)) {
      statusClass = "status-available";
    } else if (/indisponible|rupture|épuisé/i.test(status)) {
      statusClass = "status-unavailable";
    }

    const specs = Array.isArray(product.specs) ? product.specs : [];
    const imagePath = escapeHTML(product.image || PLACEHOLDER_IMAGE);
    const brandName = escapeHTML(product.marque || "GLOB ACCESS");

    return `
      <article class="product-card">
        <div class="product-image">
          <span class="brand-badge">${brandName}</span>
          <img
            src="${imagePath}"
            alt="${escapeHTML(product.nom)}"
            data-brand="${brandName}"
            loading="lazy"
          >
        </div>

        <div class="product-info">
          <span class="product-category">
            ${escapeHTML(product.segment || product.categorie || "Équipement IT")}
          </span>

          <h3>${escapeHTML(product.nom)}</h3>

          <p class="product-description">
            ${escapeHTML(product.description_courte)}
          </p>

          ${
            specs.length
              ? `
                <ul class="product-specs">
                  ${specs.map(spec => `<li>• ${escapeHTML(spec)}</li>`).join("")}
                </ul>
              `
              : ""
          }

          <div class="product-footer">
            <span class="status-pill ${statusClass}">
              ${escapeHTML(status || "Sur demande")}
            </span>

            <div class="product-actions">
              <button
                type="button"
                class="btn btn-secondary add-quote-btn"
                data-product-id="${escapeHTML(product.id)}"
              >
                + Ajouter au devis
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Gestion des images manquantes (double niveau de sécurité)
  grid.querySelectorAll(".product-image img").forEach(image => {
    image.addEventListener("error", function () {
      if (this.dataset.fallbackUsed !== "true") {
        this.dataset.fallbackUsed = "true";
        this.src = PLACEHOLDER_IMAGE;
      } else {
        // Si même placeholder.webp n'existe pas encore, on affiche un texte propre
        const brand = this.dataset.brand || "GLOB ACCESS";
        this.style.display = "none";
        this.parentElement.insertAdjacentHTML(
          "beforeend",
          `<div class="product-image-placeholder"><strong>${escapeHTML(brand)}</strong><br>Visuel produit à venir</div>`
        );
      }
    });
  });

  // Boutons d'ajout au devis
  grid.querySelectorAll(".add-quote-btn").forEach(button => {
    button.addEventListener("click", function () {
      addToQuote(this.dataset.productId);
    });
  });
}


/* 6. AJOUTER UN PRODUIT AU PANIER DE DEVIS
   ------------------------------------------------------------ */
function addToQuote(productId) {
  const product = allProducts.find(
    p => String(p.id) === String(productId)
  );

  if (!product) return;

  const quote = getSavedQuote();
  const existing = quote.find(
    item => item.id === String(productId)
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    quote.push({
      id: String(product.id),
      nom: product.nom,
      marque: product.marque,
      quantity: 1
    });
  }

  try {
    localStorage.setItem(
      QUOTE_STORAGE_KEY,
      JSON.stringify(quote)
    );
  } catch (error) {
    console.error("Erreur d'enregistrement :", error);
    showToast("Impossible d'enregistrer votre sélection.");
    return;
  }

  updateHeaderQuoteCount();
  showToast(`✔️ "${product.nom}" ajouté à votre demande de devis.`);
}


/* 7. COMPTEUR DU PANIER
   ------------------------------------------------------------ */
function updateHeaderQuoteCount() {
  const badges = document.querySelectorAll(
    "#header-quote-count, .quote-count, .quote-badge-count"
  );

  const total = getSavedQuote().reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  badges.forEach(badge => {
    badge.textContent = total;
  });
}


/* 8. NOTIFICATIONS
   ------------------------------------------------------------ */
function showToast(message) {
  const toast = document.getElementById("toast-msg");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}