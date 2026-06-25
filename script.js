/* =========================================================
   Ani Muradyan — portfolio interactions
   Vanilla JS · IntersectionObserver + rAF, no dependencies
   ========================================================= */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- current year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal, .exh");
  if ("IntersectionObserver" in window && !prefersReduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }

  /* ---------- nav stuck state ---------- */
  const nav = document.getElementById("nav");
  const onNav = () => {
    if (window.scrollY > 40) nav.classList.add("is-stuck");
    else nav.classList.remove("is-stuck");
  };
  onNav();

  /* ---------- scroll progress + parallax (single rAF loop) ---------- */
  const progressBar = document.getElementById("progress-bar");
  const parallaxEls = prefersReduced ? [] : Array.from(document.querySelectorAll("[data-parallax], .blob"));
  let ticking = false;

  function frame() {
    const st = window.scrollY || window.pageYOffset;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = (docH > 0 ? (st / docH) * 100 : 0) + "%";

    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.dataset.speed || "2");
      const rect = el.getBoundingClientRect();
      // distance of element centre from viewport centre, normalised
      const offset = (rect.top + rect.height / 2 - vh / 2) / vh;
      const shift = -offset * speed * 16;
      el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    });
    ticking = false;
  }

  function requestFrame() {
    onNav();
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }
  window.addEventListener("scroll", requestFrame, { passive: true });
  window.addEventListener("resize", requestFrame, { passive: true });
  frame();

  /* ---------- smooth anchor scrolling (with header offset) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top: y, behavior: prefersReduced ? "auto" : "smooth" });
    });
  });
})();
