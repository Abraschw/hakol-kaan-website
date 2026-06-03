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
  var authSession = readSession();
  var accountEmail = "";
  var cancelFeePercent = "4%";

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
        if (Object.keys(session).length !== 1) {
          localStorage.setItem(authKey, JSON.stringify({ session_token: session.session_token }));
        }
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
      localStorage.setItem(authKey, JSON.stringify({ session_token: authSession.session_token }));
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
        ? "Here you can see your ad requests, active bids, payment status, cancellation options, and advertiser details."
        : "Sign in to see your ad requests, active bids, payment status, cancellation options, and advertiser details.";
    }
    signinPanel.classList.toggle("hidden", signedIn);
    profileSection.classList.toggle("hidden", !signedIn);
    dashboardSection.classList.toggle("hidden", !signedIn);
  }

  function updateCancelFeeText() {
    document.querySelectorAll("[data-cancel-fee]").forEach(function (item) {
      item.textContent = cancelFeePercent;
    });
  }

  function requestJson(url, options) {
    return fetch(apiBase + url, options).catch(function () {
      throw new Error(unavailableMessage);
    }).then(function (response) {
      return response.json().catch(function () {
        return { ok: false, error: "The server returned an unreadable response." };
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

  function displayHour(value) {
    var hour = Number(value);
    if (!hour) {
      return "";
    }
    var suffix = hour >= 12 ? "PM" : "AM";
    return (hour % 12 || 12) + " " + suffix + " ET";
  }

  function statusText(ad) {
    var statusNames = {
      pending_approval: "Pending",
      active_bid: "Actively bidding",
      approved_paid: "Paid",
      paid: "Paid and scheduled",
      won: "Winning bid selected",
      charged: "Winning bid charged and scheduled",
      sent: "Ad sent",
      rejected: "Not accepted",
      lost: "Bid did not win",
      payment_failed: "Payment failed",
      sold_out: "That fixed spot was already filled",
      reservation_failed: "Reservation could not be completed",
      hold_failed: "Payment setup failed",
      canceled: "Canceled",
      cancel_pending: "Cancel pending"
    };
    var message = (statusNames[ad.status] || ad.status || "Status unavailable") + ". Placement: " + (ad.slot || "not set") + ".";
    if (ad.kind === "bid") {
      message += " Your bid: " + money(ad.bid_amount) + ". Current highest bid: " + money(ad.highest_bid) + ".";
      if (ad.rank) {
        message += " Current position: " + ad.rank + ".";
      }
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
    if (card.has_card) {
      addDetail(profileDetails, "Payment method", [card.brand, card.last4 ? "ending in " + card.last4 : ""].filter(Boolean).join(" "));
    } else {
      addDetail(profileDetails, "Payment method", "Not set up yet");
    }
  }

  function renderAds(ads) {
    dashboardList.innerHTML = "";
    if (!ads || !ads.length) {
      setDashboardMessage("You do not have any website ad requests yet.", "");
      return;
    }
    setDashboardMessage("Showing " + ads.length + " ad request(s)" + (accountEmail ? " for " + accountEmail : "") + ".", "success");
    ads.forEach(function (ad) {
      if (ad.cancel_fee_percent) {
        cancelFeePercent = ad.cancel_fee_percent;
        updateCancelFeeText();
      }
      var card = document.createElement("article");
      card.className = "dashboard-card";

      var title = document.createElement("h3");
      title.textContent = (ad.business_name || "Ad request") + " - " + (ad.ad_id || "");
      card.appendChild(title);

      var meta = document.createElement("p");
      meta.className = "dashboard-meta";
      meta.textContent = (ad.kind === "bid" ? "Bidding ad" : "Fixed-price ad") + " | " + (ad.created_at || "created time unavailable");
      card.appendChild(meta);

      var status = document.createElement("p");
      status.textContent = statusText(ad);
      card.appendChild(status);

      var details = document.createElement("div");
      details.className = "dashboard-details";
      addDetail(details, "Request ID", ad.ad_id || "");
      addDetail(details, "Date", displayDate(ad.slot_date));
      addDetail(details, "Send time", displayHour(ad.hour));
      addDetail(details, "Placement", ad.slot || "");
      addDetail(details, "Spots in layout", ad.boxes ? String(ad.boxes) : "");
      addDetail(details, "Contact name", ad.advertiser_name || "");
      addDetail(details, "Contact email", ad.email || "");
      addDetail(details, "Contact phone", ad.phone || "");
      addDetail(details, "Ad type", ad.creative_type || "");
      addDetail(details, "Fixed price", ad.kind === "fixed" ? money(ad.price) : "");
      addDetail(details, "Your bid", ad.kind === "bid" ? money(ad.bid_amount) : "");
      addDetail(details, "Highest bid", ad.kind === "bid" ? money(ad.highest_bid) : "");
      addDetail(details, "Bid position", ad.kind === "bid" && ad.rank ? String(ad.rank) : "");
      if (Number(ad.cancel_fee || 0) > 0) {
        addDetail(details, "Cancel fee", money(ad.cancel_fee) + " (" + (ad.cancel_fee_percent || cancelFeePercent) + ")");
      }
      card.appendChild(details);

      if (ad.preview_url) {
        var image = document.createElement("img");
        image.className = "dashboard-preview";
        image.src = ad.preview_url;
        image.alt = "Ad preview for " + (ad.business_name || ad.ad_id || "request");
        card.appendChild(image);
      }

      if (ad.can_increase_bid) {
        card.appendChild(createIncreaseBidForm(ad));
      }
      if (ad.can_cancel) {
        card.appendChild(createCancelButton(ad));
      }
      dashboardList.appendChild(card);
    });
  }

  function createIncreaseBidForm(ad) {
    var formEl = document.createElement("form");
    formEl.className = "raise-form dashboard-raise-form";
    var label = document.createElement("label");
    label.className = "field";
    label.textContent = "Increase your bid to";
    var input = document.createElement("input");
    input.type = "number";
    input.min = String(Number(ad.bid_amount || 0) + 0.01);
    input.step = "0.01";
    input.required = true;
    label.appendChild(input);
    var button = document.createElement("button");
    button.className = "button";
    button.type = "submit";
    button.textContent = "Increase bid";
    formEl.appendChild(label);
    formEl.appendChild(button);
    formEl.addEventListener("submit", function (event) {
      event.preventDefault();
      requestJson("/ads/api/increase-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: authSession.session_token,
          ad_id: ad.ad_id,
          amount: input.value
        })
      }).then(function () {
        setDashboardMessage("Bid updated.", "success");
        loadDashboard();
      }).catch(function (error) {
        setDashboardMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
      });
    });
    return formEl;
  }

  function createCancelButton(ad) {
    var wrap = document.createElement("div");
    wrap.className = "dashboard-actions";
    if (Number(ad.cancel_fee || 0) > 0) {
      var note = document.createElement("p");
      note.className = "fine-print";
      note.textContent = "Canceling this paid ad costs " + (ad.cancel_fee_percent || cancelFeePercent) + " of the ad price.";
      wrap.appendChild(note);
    }
    var button = document.createElement("button");
    button.className = "button secondary";
    button.type = "button";
    button.textContent = "Cancel ad";
    button.addEventListener("click", function () {
      var feeNote = Number(ad.cancel_fee || 0) > 0
        ? " Canceling this paid ad costs " + (ad.cancel_fee_percent || cancelFeePercent) + " of the ad price."
        : "";
      if (!window.confirm("Cancel ad " + ad.ad_id + "?" + feeNote)) {
        return;
      }
      button.disabled = true;
      requestJson("/ads/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: authSession.session_token,
          ad_id: ad.ad_id
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
      if (payload.profile && authSession) {
        accountEmail = payload.profile.email || payload.email || accountEmail;
      }
      renderProfile(payload.profile || {});
      renderAds(payload.ads || []);
    }).catch(function (error) {
      if (/sign in/i.test(error.message)) {
        saveSession(null);
        updateVisibility();
      }
      setDashboardMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", loadDashboard);
  }
  if (signOutButton) {
    signOutButton.addEventListener("click", function () {
      saveSession(null);
      updateVisibility();
    });
  }
  window.addEventListener("storage", loadDashboard);
  window.addEventListener("hakolAdsAuthChanged", loadDashboard);
  loadDashboard();
}());
