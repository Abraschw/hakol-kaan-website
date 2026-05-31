(function () {
  "use strict";

  var authKey = "hakol_kaan_ads_auth";
  var accountLink = document.querySelector("[data-account-link]");

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

  function updateAccountLink() {
    if (!accountLink) {
      return;
    }
    var session = readSession();
    if (session) {
      accountLink.textContent = displayName(session);
      accountLink.href = "/ads/#ad-dashboard";
      accountLink.title = "Open advertiser profile and dashboard";
      accountLink.classList.add("is-signed-in");
    } else {
      accountLink.textContent = "Sign in";
      accountLink.href = "/ads/#ad-account";
      accountLink.title = "Sign in to your advertiser account";
      accountLink.classList.remove("is-signed-in");
    }
  }

  updateAccountLink();
  window.addEventListener("storage", updateAccountLink);
  window.addEventListener("hakolAdsAuthChanged", updateAccountLink);
}());
