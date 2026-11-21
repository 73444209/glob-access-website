// =========================================================
// GLOB ACCESS — ANIMATION ET FONCTIONS PRINCIPALES
// Fichier : js/main.js
// =========================================================

// Fonction globale accessible depuis catalogue-engine.js et devis-manager.js
window.updateHeaderQuoteCount = function () {
  const countElements = document.querySelectorAll(
    ".quote-count, .quote-badge-count, #header-quote-count"
  );

  let quoteItems = [];

  try {
    quoteItems = JSON.parse(
      localStorage.getItem("globAccessQuote") || "[]"
    );

    if (!Array.isArray(quoteItems)) {
      quoteItems = [];
    }
  } catch (error) {
    quoteItems = [];
  }

  // Calcule le nombre total d'équipements (somme des quantités)
  const totalItems = quoteItems.reduce(function (sum, item) {
    return sum + (Number(item.quantity) || 1);
  }, 0);

  countElements.forEach(function (element) {
    element.textContent = totalItems;
  });
};

document.addEventListener("DOMContentLoaded", function () {

  // 1. MENU MOBILE
  // -------------------------------------------------------
  const menuButton = document.querySelector(".mobile-menu-toggle");
  const navigation = document.querySelector(".main-nav");

  if (menuButton && navigation) {
    menuButton.addEventListener("click", function () {
      const isOpen = navigation.classList.toggle("open");

      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.setAttribute(
        "aria-label",
        isOpen ? "Fermer le menu" : "Ouvrir le menu"
      );

      menuButton.textContent = isOpen ? "✕" : "☰";
    });

    navigation.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Ouvrir le menu");
        menuButton.textContent = "☰";
      });
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 820) {
        navigation.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.textContent = "☰";
      }
    });
  }


  // 2. COMPTEUR DU PANIER DE DEVIS
  // -------------------------------------------------------
  window.updateHeaderQuoteCount();

  window.addEventListener("storage", function (event) {
    if (event.key === "globAccessQuote") {
      window.updateHeaderQuoteCount();
    }
  });


  // 3. ANNÉE AUTOMATIQUE
  // -------------------------------------------------------
  document.querySelectorAll(".current-year").forEach(function (element) {
    element.textContent = new Date().getFullYear();
  });


  // 4. APPARITION PROGRESSIVE DES SECTIONS
  // -------------------------------------------------------
  const revealElements = document.querySelectorAll(
    "main > section, .expertise-card, .technology-section, .cta-section"
  );

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.10
      }
    );

    revealElements.forEach(function (element) {
      element.classList.add("reveal");
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach(function (element) {
      element.classList.add("visible");
    });
  }


  // 5. ANIMATION MATRIX BLEUE (Sur le Hero de l'accueil)
  // -------------------------------------------------------
  const hero = document.querySelector(".hero");

  if (
    !hero ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "matrix-canvas";
  canvas.setAttribute("aria-hidden", "true");

  hero.prepend(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const characters = "010101010101アイウエオカキクケコ<>/{}[]01";
  const fontSize = 15;

  let columns = [];
  let width = 0;
  let height = 0;
  let animationFrame = null;
  let lastFrame = 0;

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    width = hero.clientWidth;
    height = hero.clientHeight;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const totalColumns = Math.ceil(width / fontSize);

    columns = Array.from(
      { length: totalColumns },
      function () {
        return Math.random() * -50;
      }
    );
  }

  function drawMatrix(timestamp) {
    // Limite à ~30 FPS pour préserver les performances et la batterie
    if (timestamp - lastFrame < 33) {
      animationFrame = requestAnimationFrame(drawMatrix);
      return;
    }

    lastFrame = timestamp;

    ctx.fillStyle = "rgba(5, 22, 48, 0.12)";
    ctx.fillRect(0, 0, width, height);

    ctx.font = fontSize + "px monospace";
    ctx.textAlign = "center";

    columns.forEach(function (position, index) {
      const character = characters.charAt(
        Math.floor(Math.random() * characters.length)
      );

      const x = index * fontSize;
      const y = position * fontSize;
      const isBright = Math.random() > 0.94;

      ctx.fillStyle = isBright
        ? "rgba(150, 245, 255, 0.95)"
        : "rgba(0, 194, 255, 0.65)";

      ctx.fillText(character, x, y);

      if (y > height && Math.random() > 0.975) {
        columns[index] = 0;
      } else {
        columns[index] += 0.45 + Math.random() * 0.55;
      }
    });

    animationFrame = requestAnimationFrame(drawMatrix);
  }

  resizeCanvas();
  animationFrame = requestAnimationFrame(drawMatrix);

  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeCanvas();
    }, 150);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(animationFrame);
    } else {
      lastFrame = 0;
      animationFrame = requestAnimationFrame(drawMatrix);
    }
  });

});