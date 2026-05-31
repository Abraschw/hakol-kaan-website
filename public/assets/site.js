(function () {
  "use strict";

  var authKey = "hakol_kaan_ads_auth";
  var header = document.querySelector(".site-header");
  var accountLinks = Array.prototype.slice.call(document.querySelectorAll("[data-account-link]"));

  function readSession() {
    try {
      var session = JSON.parse(localStorage.getItem(authKey) || "{}");
      if (session && session.email && session.session_token) {
        return session;
      }
    } catch (error) {
      localStorage.removeItem(authKey);
    }
    return null;
  }

  function displayName(session) {
    var profile = session && session.profile ? session.profile : {};
    return profile.full_name || profile.business_name || session.email || "Profile";
  }

  function isAdsPage() {
    return window.location.pathname.replace(/\/+$/, "") === "/ads";
  }

  function updateAccountLinks() {
    var session = readSession();
    accountLinks.forEach(function (accountLink) {
      if (session) {
        accountLink.textContent = displayName(session);
        accountLink.href = "/dashboard/";
        accountLink.title = "Open advertiser profile and dashboard";
        accountLink.classList.add("is-signed-in");
      } else {
        accountLink.textContent = "Sign in";
        accountLink.href = "/ads/#ad-account";
        accountLink.title = "Sign in to your advertiser account";
        accountLink.classList.remove("is-signed-in");
      }
    });
    updateDrawer();
  }

  function openSignIn(event) {
    var session = readSession();
    if (session || !isAdsPage()) {
      return;
    }
    event.preventDefault();
    window.dispatchEvent(new CustomEvent("hakolOpenAdsAccount"));
  }

  accountLinks.forEach(function (accountLink) {
    accountLink.addEventListener("click", openSignIn);
  });

  var drawerShell;
  var drawerAccount;
  var drawerSignOut;

  function closeDrawer() {
    if (!drawerShell) {
      return;
    }
    drawerShell.classList.add("hidden");
    drawerShell.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-site-drawer-open");
  }

  function openDrawer() {
    if (!drawerShell) {
      return;
    }
    drawerShell.classList.remove("hidden");
    drawerShell.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-site-drawer-open");
  }

  function updateDrawer() {
    if (!drawerAccount) {
      return;
    }
    var session = readSession();
    if (session) {
      drawerAccount.innerHTML = "";
      var name = document.createElement("strong");
      name.textContent = displayName(session);
      var email = document.createElement("span");
      email.textContent = session.email || "";
      drawerAccount.appendChild(name);
      drawerAccount.appendChild(email);
      if (drawerSignOut) {
        drawerSignOut.classList.remove("hidden");
      }
    } else {
      drawerAccount.innerHTML = "<strong>Not signed in</strong><span>Sign in to manage ad details.</span>";
      if (drawerSignOut) {
        drawerSignOut.classList.add("hidden");
      }
    }
  }

  function createDrawer() {
    if (!header || document.getElementById("site-menu-button")) {
      return;
    }
    var menuButton = document.createElement("button");
    menuButton.className = "site-menu-button";
    menuButton.id = "site-menu-button";
    menuButton.type = "button";
    menuButton.setAttribute("aria-label", "Open menu");
    menuButton.innerHTML = "<span></span><span></span><span></span>";
    header.insertBefore(menuButton, header.firstElementChild);

    drawerShell = document.createElement("div");
    drawerShell.className = "site-drawer hidden";
    drawerShell.setAttribute("aria-hidden", "true");
    drawerShell.innerHTML =
      '<button class="site-drawer-backdrop" type="button" aria-label="Close menu"></button>' +
      '<aside class="site-drawer-panel" aria-label="Site menu">' +
      '  <button class="site-drawer-close" type="button">Close</button>' +
      '  <div class="site-drawer-account" data-drawer-account></div>' +
      '  <nav class="site-drawer-nav">' +
      '    <a href="/dashboard/#profile">Profile & details</a>' +
      '    <a href="/dashboard/">Ad dashboard</a>' +
      '    <a href="/ads/">Place ad</a>' +
      '    <a href="/">Home</a>' +
      '    <a href="/about/">About</a>' +
      '    <a href="/contact/">Contact</a>' +
      '    <a href="/terms/">Terms</a>' +
      '    <a href="/privacy/">Privacy</a>' +
      '  </nav>' +
      '  <button class="link-button drawer-sign-out hidden" type="button">Sign out</button>' +
      '</aside>';
    document.body.appendChild(drawerShell);
    drawerAccount = drawerShell.querySelector("[data-drawer-account]");
    drawerSignOut = drawerShell.querySelector(".drawer-sign-out");

    menuButton.addEventListener("click", openDrawer);
    drawerShell.querySelector(".site-drawer-backdrop").addEventListener("click", closeDrawer);
    drawerShell.querySelector(".site-drawer-close").addEventListener("click", closeDrawer);
    drawerShell.querySelectorAll(".site-drawer-nav a").forEach(function (link) {
      link.addEventListener("click", closeDrawer);
    });
    drawerSignOut.addEventListener("click", function () {
      localStorage.removeItem(authKey);
      window.dispatchEvent(new CustomEvent("hakolAdsAuthChanged"));
      closeDrawer();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDrawer();
      }
    });
  }

  createDrawer();
  updateAccountLinks();
  window.addEventListener("storage", updateAccountLinks);
  window.addEventListener("hakolAdsAuthChanged", updateAccountLinks);
}());
