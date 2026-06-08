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

  function closeBidSuccessPopup(popup) {
    if (!popup) {
      return;
    }
    popup.remove();
    body.classList.remove("is-account-modal-open");
  }

  function showBidSuccessPopup(details) {
    var previousBid = Number(details.previousBid || 0);
    var newBid = Number(details.newBid || 0);
    var increaseAmount = newBid - previousBid;
    var popup = document.createElement("div");
    popup.className = "account-modal bid-success-modal";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    popup.setAttribute("aria-labelledby", "bid-success-title");

    var backdrop = document.createElement("button");
    backdrop.className = "account-modal-backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Close bid update popup");
    popup.appendChild(backdrop);

    var panel = document.createElement("div");
    panel.className = "account-modal-panel bid-success-panel";
    popup.appendChild(panel);

    var closeButton = document.createElement("button");
    closeButton.className = "account-modal-close";
    closeButton.type = "button";
    closeButton.textContent = "Close";
    panel.appendChild(closeButton);

    var heading = document.createElement("div");
    heading.className = "section-heading";
    var kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = "Bid updated";
    var title = document.createElement("h2");
    title.id = "bid-success-title";
    title.textContent = "Your bid was increased successfully.";
    heading.appendChild(kicker);
    heading.appendChild(title);
    panel.appendChild(heading);

    var summary = document.createElement("div");
    summary.className = "bid-success-details";
    addDetail(summary, "Previous bid", money(previousBid));
    addDetail(summary, "New bid", money(newBid));
    addDetail(summary, "Increased by", money(increaseAmount));
    panel.appendChild(summary);

    var note = document.createElement("p");
    note.className = "fine-print bid-success-note";
    note.textContent = "Small note: if you win this bid, your card will be charged 5 minutes before the ad goes live.";
    panel.appendChild(note);

    var okButton = document.createElement("button");
    okButton.className = "button";
    okButton.type = "button";
    okButton.textContent = "OK";
    panel.appendChild(okButton);

    function close() {
      closeBidSuccessPopup(popup);
    }

    backdrop.addEventListener("click", close);
    closeButton.addEventListener("click", close);
    okButton.addEventListener("click", close);
    document.addEventListener("keydown", function onKeyDown(event) {
      if (event.key === "Escape" && document.body.contains(popup)) {
        close();
        document.removeEventListener("keydown", onKeyDown);
      }
    });

    body.appendChild(popup);
    body.classList.add("is-account-modal-open");
    okButton.focus();
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

  function statusLabel(status) {
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
    return statusNames[status] || status || "Status unavailable";
  }

  function statusText(ad) {
    var message = statusLabel(ad.status) + ". Placement: " + (ad.slot || "not set") + ".";
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
    name.textContent = (ad.business_name || "Ad request") + (ad.ad_id ? " - " + ad.ad_id : "");
    var status = document.createElement("span");
    status.textContent = statusLabel(ad.status);
    titleWrap.appendChild(name);
    titleWrap.appendChild(status);
    summary.appendChild(titleWrap);

    var meta = document.createElement("span");
    meta.className = "dashboard-card-summary-meta";
    addSummaryPart(meta, displayDate(ad.slot_date));
    addSummaryPart(meta, displayHour(ad.hour));
    addSummaryPart(meta, ad.slot || "");
    addSummaryPart(meta, ad.kind === "bid" ? "Bid " + money(ad.bid_amount) : "Price " + money(ad.price));
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
      if (ad.cancel_fee_percent) {
        cancelFeePercent = ad.cancel_fee_percent;
        updateCancelFeeText();
      }
      var card = document.createElement("details");
      card.className = "dashboard-card";
      card.appendChild(createAdSummary(ad));

      var cardContent = document.createElement("div");
      cardContent.className = "dashboard-card-content";

      var title = document.createElement("h3");
      title.textContent = (ad.business_name || "Ad request") + " - " + (ad.ad_id || "");
      cardContent.appendChild(title);

      var meta = document.createElement("p");
      meta.className = "dashboard-meta";
      meta.textContent = (ad.kind === "bid" ? "Bidding ad" : "Fixed-price ad") + " | " + (ad.created_at || "created time unavailable");
      cardContent.appendChild(meta);

      var status = document.createElement("p");
      status.textContent = statusText(ad);
      cardContent.appendChild(status);

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
      cardContent.appendChild(details);

      if (ad.preview_url) {
        var image = document.createElement("img");
        image.className = "dashboard-preview";
        image.src = ad.preview_url;
        image.alt = "Ad preview for " + (ad.business_name || ad.ad_id || "request");
        cardContent.appendChild(image);
      }

      if (ad.can_increase_bid) {
        cardContent.appendChild(createIncreaseBidForm(ad));
      }
      if (ad.can_cancel) {
        cardContent.appendChild(createCancelButton(ad));
      }
      card.appendChild(cardContent);
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
    var currentBid = Number(ad.bid_amount || 0);
    input.type = "number";
    input.min = currentBid.toFixed(2);
    input.step = "1";
    input.value = currentBid.toFixed(2);
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
      var chosenBid = Number(input.value || 0);
      if (chosenBid <= currentBid) {
        setDashboardMessage("Increase the bid amount first, then submit it.", "error");
        input.focus();
        return;
      }
      if (chosenBid < currentBid + 1) {
        setDashboardMessage("Increase the bid by at least $1.00, then submit it.", "error");
        input.focus();
        return;
      }
      button.disabled = true;
      requestJson("/ads/api/increase-bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: authSession.session_token,
          ad_id: ad.ad_id,
          amount: input.value
        })
      }).then(function () {
        return loadDashboard().then(function () {
          showBidSuccessPopup({
            previousBid: currentBid,
            newBid: chosenBid
          });
          setDashboardMessage(
            "Bid updated to " + money(chosenBid) + ". If nobody outbids you, your card will be charged " + money(chosenBid) + " 5 minutes before the ad goes live.",
            "success"
          );
        });
      }).catch(function (error) {
        button.disabled = false;
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
