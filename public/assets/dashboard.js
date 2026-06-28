(function () {
  "use strict";

  var body = document.body;
  var apiBase = (body.dataset.adsApiBase || "").replace(/\/$/, "");
  var authKey = "hakol_kaan_ads_auth";
  var dashboardLead = document.getElementById("dashboard-lead");
  var signinPanel = document.getElementById("dashboard-signin");
  var profileSection = document.getElementById("profile");
  var dashboardSection = document.getElementById("ad-dashboard");
  var profileDetails = document.getElementById("profile-details");
  var dashboardStatus = document.getElementById("dashboard-status");
  var dashboardList = document.getElementById("dashboard-list");
  var refreshButton = document.getElementById("refresh-dashboard-button");
  var signOutButton = document.getElementById("dashboard-sign-out");
  var unavailableMessage = "Advertising dashboard is temporarily unavailable. Please try again later.";
  var blockedByFilterMessage = "The dashboard could not connect. If you use Meshimer or another web filter, please allow sms.hakolkaan.com and then refresh this page.";
  var authSession = readSession();
  var accountEmail = "";

  if (!apiBase || !dashboardList) {
    return;
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function readSession() {
    try {
      var session = JSON.parse(localStorage.getItem(authKey) || "{}");
      if (session && session.session_token) {
        return { session_token: session.session_token };
      }
    } catch (error) {
      localStorage.removeItem(authKey);
    }
    return null;
  }

  function saveSession(session) {
    authSession = session && session.session_token ? { session_token: session.session_token } : null;
    if (authSession) {
      localStorage.setItem(authKey, JSON.stringify(authSession));
    } else {
      localStorage.removeItem(authKey);
      accountEmail = "";
    }
    window.dispatchEvent(new CustomEvent("hakolAdsAuthChanged"));
  }

  function isSignedIn() {
    return Boolean(authSession && authSession.session_token);
  }

  function setDashboardMessage(message, type) {
    dashboardStatus.textContent = message || "";
    dashboardStatus.className = "form-status" + (type ? " is-" + type : "");
  }

  function updateVisibility() {
    var signedIn = isSignedIn();
    if (dashboardLead) {
      dashboardLead.textContent = signedIn
        ? "Here you can see your daily search ads, payment status, cancellation options, and advertiser details."
        : "Sign in to see your daily search ads, payment status, cancellation options, and advertiser details.";
    }
    signinPanel.classList.toggle("hidden", signedIn);
    profileSection.classList.toggle("hidden", !signedIn);
    dashboardSection.classList.toggle("hidden", !signedIn);
  }

  function requestJson(url, options) {
    return fetch(apiBase + url, options).catch(function () {
      throw new Error(blockedByFilterMessage);
    }).then(function (response) {
      return response.json().catch(function () {
        return { ok: false, error: blockedByFilterMessage };
      }).then(function (payload) {
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "That request could not be completed.");
        }
        return payload;
      });
    });
  }

  function addDetail(container, labelText, valueText) {
    if (!valueText) {
      return;
    }
    var item = document.createElement("div");
    item.className = "dashboard-detail";
    var label = document.createElement("span");
    label.textContent = labelText;
    var value = document.createElement("strong");
    value.textContent = valueText;
    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  }

  function displayDate(value) {
    if (!value) {
      return "";
    }
    var parts = String(value).split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    }
    return String(value);
  }

  function placementLabel(ad) {
    var kind = ad.placement_kind || ad.kind || "";
    if (kind === "search_footer_day") {
      return "Search picture bottom line";
    }
    if (kind === "search_image_day") {
      return "Search picture ad";
    }
    return ad.placement_label || "Search ad";
  }

  function statusLabel(status) {
    var statusNames = {
      pending_approval: "Pending approval",
      approved: "Approved",
      active: "Active",
      paid: "Paid and active",
      sent: "Active",
      rejected: "Not approved",
      payment_failed: "Payment failed",
      canceled: "Canceled"
    };
    return statusNames[status] || status || "Status unavailable";
  }

  function statusText(ad) {
    var message = statusLabel(ad.status) + ". ";
    message += placementLabel(ad) + " for " + (displayDate(ad.slot_date) || "the selected day") + ".";
    if (ad.status === "pending_approval") {
      message += " Hakol Kaan will review it before charging your card.";
    } else if (ad.status === "active" || ad.status === "paid" || ad.status === "sent") {
      message += " It can appear with Amazon and Walmart search-result pictures that day.";
    } else if (ad.status === "payment_failed") {
      message += " Please update your payment method and submit again.";
    }
    return message;
  }

  function renderProfile(profile) {
    profile = profile || {};
    profileDetails.innerHTML = "";
    accountEmail = profile.email || accountEmail || "";
    addDetail(profileDetails, "Signed-in email", accountEmail);
    addDetail(profileDetails, "Name", profile.full_name || "");
    addDetail(profileDetails, "Business", profile.business_name || "");
    addDetail(profileDetails, "Phone", profile.phone || "");
    var card = profile.saved_card || {};
    addDetail(profileDetails, "Payment method", card.has_card ? [card.brand, card.last4 ? "ending in " + card.last4 : ""].filter(Boolean).join(" ") : "Not set up yet");
  }

  function addSummaryPart(container, text) {
    if (!text) {
      return;
    }
    var item = document.createElement("span");
    item.textContent = text;
    container.appendChild(item);
  }

  function createAdSummary(ad) {
    var summary = document.createElement("summary");
    summary.className = "dashboard-card-summary";

    var titleWrap = document.createElement("span");
    titleWrap.className = "dashboard-card-summary-title";
    var name = document.createElement("strong");
    name.textContent = (ad.business_name || "Ad request") + (ad.id ? " - " + ad.id : "");
    var status = document.createElement("span");
    status.textContent = statusLabel(ad.status);
    titleWrap.appendChild(name);
    titleWrap.appendChild(status);
    summary.appendChild(titleWrap);

    var meta = document.createElement("span");
    meta.className = "dashboard-card-summary-meta";
    addSummaryPart(meta, displayDate(ad.slot_date));
    addSummaryPart(meta, placementLabel(ad));
    addSummaryPart(meta, money(ad.price));
    summary.appendChild(meta);
    return summary;
  }

  function renderAds(ads) {
    dashboardList.innerHTML = "";
    if (!ads || !ads.length) {
      setDashboardMessage("You do not have any website ad requests yet.", "");
      return;
    }
    setDashboardMessage("Showing " + ads.length + " ad request(s)" + (accountEmail ? " for " + accountEmail : "") + ".", "success");
    ads.forEach(function (ad) {
      var card = document.createElement("details");
      card.className = "dashboard-card";
      card.appendChild(createAdSummary(ad));

      var cardContent = document.createElement("div");
      cardContent.className = "dashboard-card-content";

      var status = document.createElement("p");
      status.className = "dashboard-expanded-status";
      status.textContent = statusText(ad);
      cardContent.appendChild(status);

      var details = document.createElement("div");
      details.className = "dashboard-details";
      addDetail(details, "Request ID", ad.id || "");
      addDetail(details, "Created", ad.created_at || "");
      addDetail(details, "Date", displayDate(ad.slot_date));
      addDetail(details, "Placement", placementLabel(ad));
      addDetail(details, "Price", money(ad.price));
      addDetail(details, "Charged", Number(ad.charged_amount || 0) > 0 ? money(ad.charged_amount) : "Not charged yet");
      addDetail(details, "Contact name", ad.advertiser_name || "");
      addDetail(details, "Contact email", ad.email || "");
      addDetail(details, "Contact phone", ad.phone || "");
      addDetail(details, "Creative", ad.creative_type || "");
      cardContent.appendChild(details);

      if (ad.text) {
        var text = document.createElement("p");
        text.className = "fine-print";
        text.textContent = "Ad text: " + ad.text;
        cardContent.appendChild(text);
      }
      if (ad.preview_url) {
        var image = document.createElement("img");
        image.className = "dashboard-preview";
        image.src = ad.preview_url;
        image.alt = "Ad preview for " + (ad.business_name || ad.id || "request");
        cardContent.appendChild(image);
      }
      if (ad.status !== "canceled" && ad.status !== "rejected") {
        cardContent.appendChild(createCancelButton(ad));
      }
      card.appendChild(cardContent);
      dashboardList.appendChild(card);
    });
  }

  function createCancelButton(ad) {
    var wrap = document.createElement("div");
    wrap.className = "dashboard-actions";
    var button = document.createElement("button");
    button.className = "button secondary";
    button.type = "button";
    button.textContent = "Cancel ad";
    button.addEventListener("click", function () {
      if (!window.confirm("Cancel ad " + (ad.id || "") + "?")) {
        return;
      }
      button.disabled = true;
      requestJson("/ads/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: authSession.session_token,
          ad_id: ad.id
        })
      }).then(function (payload) {
        setDashboardMessage(payload.message || "Ad canceled.", "success");
        loadDashboard();
      }).catch(function (error) {
        button.disabled = false;
        setDashboardMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
      });
    });
    wrap.appendChild(button);
    return wrap;
  }

  function loadDashboard() {
    authSession = readSession();
    updateVisibility();
    if (!isSignedIn()) {
      dashboardList.innerHTML = "";
      return Promise.resolve();
    }
    setDashboardMessage("Loading your dashboard...", "");
    return requestJson("/ads/api/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: authSession.session_token })
    }).then(function (payload) {
      renderProfile(payload.profile || {});
      renderAds(payload.ads || []);
    }).catch(function (error) {
      if (/sign in/i.test(error.message)) {
        saveSession(null);
        updateVisibility();
        setDashboardMessage("Please sign in again from the ad page.", "error");
        return;
      }
      setDashboardMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  }

  document.querySelectorAll("[data-account-link]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      window.location.href = "/ads/#ad-account";
    });
  });

  if (refreshButton) {
    refreshButton.addEventListener("click", loadDashboard);
  }
  if (signOutButton) {
    signOutButton.addEventListener("click", function () {
      saveSession(null);
      updateVisibility();
      dashboardList.innerHTML = "";
      setDashboardMessage("You are signed out.", "");
    });
  }
  window.addEventListener("storage", loadDashboard);
  window.addEventListener("hakolAdsAuthChanged", loadDashboard);
  loadDashboard();
}());
