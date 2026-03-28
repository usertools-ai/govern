// ── Scroll reveal via Intersection Observer ──
function initScrollReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const parent = entry.target.closest(".grid, #lifecycle, .flex");
          if (parent) {
            const siblings = Array.from(parent.querySelectorAll(".reveal"));
            const idx = siblings.indexOf(entry.target);
            entry.target.style.transitionDelay = `${idx * 0.1}s`;
          }
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  els.forEach((el) => observer.observe(el));
}

// ── Copy install command to clipboard ──
function initCopyCommand() {
  const btn = document.getElementById("install-cmd");
  const label = document.getElementById("copy-label");
  if (!btn || !label) return;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("npm install usertrust");
      label.textContent = "copied!";
      setTimeout(() => { label.textContent = "copy"; }, 2000);
    } catch {
      const range = document.createRange();
      const cmd = btn.querySelector(".font-mono:nth-child(2)");
      if (cmd) {
        range.selectNodeContents(cmd);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  });
}

// ── Hero Bliss fade on scroll ──
function initHeroFade() {
  const bg = document.getElementById("hero-bg");
  if (!bg) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const vh = window.innerHeight;
        // Start fading at 30% of viewport, fully gone by 90%
        const fadeStart = vh * 0.3;
        const fadeEnd = vh * 0.9;
        const progress = Math.min(Math.max((scrollY - fadeStart) / (fadeEnd - fadeStart), 0), 1);
        bg.style.opacity = 1 - progress;
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ── Nav background on scroll ──
function initNavScroll() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        nav.style.background = "transparent";
        nav.style.backdropFilter = "none";
      } else {
        nav.style.background = "rgba(10, 10, 26, 0.8)";
        nav.style.backdropFilter = "blur(12px)";
      }
    },
    { threshold: 0.1 }
  );

  const hero = document.querySelector("section");
  if (hero) observer.observe(hero);
}

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initCopyCommand();
  initHeroFade();
  initNavScroll();
});
