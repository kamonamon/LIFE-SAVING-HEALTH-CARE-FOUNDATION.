/* Shared interactions, accessible navigation and the calm event notice. */
(function () {
  "use strict";
  const EVENT_END = new Date("2026-11-28T23:59:59+03:00");
  const noticeKey = "lhcf-event-dismissed-2026-11";
  const menu = document.getElementById("mobileMenu");
  // Place the fixed drawer directly under body so the backdrop stays behind it.
  if (menu) document.body.appendChild(menu);
  const menuIcon = document.getElementById("menuIcon");
  const menuTrigger = document.querySelector("[aria-controls='mobileMenu']");
  const backdrop = document.createElement("button");
  backdrop.id = "menuBackdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Close navigation menu");
  backdrop.hidden = true;
  document.body.appendChild(backdrop);
  const notice = document.getElementById("siteNotice");

  function closeMenu(restoreFocus) {
    if (!menu || !menu.classList.contains("open")) return;
    menu.classList.remove("open");
    menu.setAttribute("aria-hidden", "true");
    if (menuTrigger) menuTrigger.setAttribute("aria-expanded", "false");
    if (menuIcon) { menuIcon.classList.remove("fa-times"); menuIcon.classList.add("fa-bars"); }
    document.body.classList.remove("site-menu-open");
    backdrop.hidden = true;
    if (restoreFocus && menuTrigger) menuTrigger.focus();
  }
  window.toggleMobileMenu = function () {
    if (!menu) return;
    if (menu.classList.contains("open")) { closeMenu(true); return; }
    menu.classList.add("open");
    menu.setAttribute("aria-hidden", "false");
    if (menuTrigger) menuTrigger.setAttribute("aria-expanded", "true");
    if (menuIcon) { menuIcon.classList.remove("fa-bars"); menuIcon.classList.add("fa-times"); }
    document.body.classList.add("site-menu-open");
    backdrop.hidden = false;
    const first = menu.querySelector("button");
    if (first) first.focus();
  };
  backdrop.addEventListener("click", () => closeMenu(true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu(true);
      if (typeof window.closeMobileModal === "function") window.closeMobileModal();
    }
  });
  document.addEventListener("click", (event) => {
    if (menu && menu.classList.contains("open") && event.target.closest("#mobileMenu a")) closeMenu(false);
  });
  window.addEventListener("resize", () => { if (window.innerWidth >= 1024) closeMenu(false); });

  if (notice) {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(noticeKey) === "1"; } catch (_) {}
    if (dismissed || new Date() > EVENT_END) notice.hidden = true;
  }
  window.dismissNotice = function () {
    if (notice) notice.hidden = true;
    try { sessionStorage.setItem(noticeKey, "1"); } catch (_) {}
  };

  const topButton = document.getElementById("backToTop");
  const refreshTopButton = () => {
    if (topButton) topButton.classList.toggle("show", window.scrollY > 320);
  };
  window.addEventListener("scroll", refreshTopButton, {passive:true});
  refreshTopButton();
})();