(function () {
  "use strict";

  var body = document.body;
  var apiBase = (body.dataset.adsApiBase || "").replace(/\/$/, "");
  var form = document.getElementById("ad-request-form");
  var statusBox = document.getElementById("form-status");
  var dateInput = document.getElementById("slot-date");
  var slotSelect = document.getElementById("ad-slot");
  var slotSummary = document.getElementById("slot-summary");
  var bidField = document.getElementById("bid-field");
  var bidAmount = document.getElementById("bid-amount");
  var imageField = document.getElementById("creative-image-field");
  var textField = document.getElementById("creative-text-field");
  var stripeButton = document.getElementById("stripe-button");
  var submitButton = document.getElementById("submit-ad-button");
  var retryServerButton = document.getElementById("retry-server-button");
  var trackingForm = document.getElementById("track-form");
  var trackingId = document.getElementById("tracking-id");
  var trackingToken = document.getElementById("tracking-token");
  var trackingResult = document.getElementById("tracking-result");
  var trackingCopy = document.getElementById("tracking-copy");
  var raiseForm = document.getElementById("raise-form");
  var raiseAmount = document.getElementById("raise-amount");
  var slots = [];
  var stripeSessionKey = "hakol_kaan_ads_stripe_session";
  var draftKey = "hakol_kaan_ads_draft";
  var trackKey = "hakol_kaan_ads_tracking";
  var serverAvailable = false;
  var unavailableMessage = "Advertising requests are temporarily unavailable. Please try again later.";

  if (!form || !apiBase) {
    return;
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function today() {
    var now = new Date();
    var local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function selectedDateObject() {
    var value = dateInput.value || "";
    var parts = value.split("-").map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return null;
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function selectedDateIsSaturday() {
    var date = selectedDateObject();
    return Boolean(date && date.getDay() === 6);
  }

  function selectedDateIsFriday() {
    var date = selectedDateObject();
    return Boolean(date && date.getDay() === 5);
  }

  function slotBlockedByDate(slot) {
    if (!slot) {
      return false;
    }
    return selectedDateIsSaturday() || (selectedDateIsFriday() && Number(slot.hour) > 12);
  }

  function dateRuleMessage(slot) {
    if (selectedDateIsSaturday()) {
      return "Ads are not available on Saturday. Please choose a different date.";
    }
    if (selectedDateIsFriday() && (!slot || Number(slot.hour) > 12)) {
      return "Friday ads are available only through 12 PM.";
    }
    return "";
  }

  function setMessage(message, type) {
    statusBox.textContent = message || "";
    statusBox.className = "form-status" + (type ? " is-" + type : "");
  }

  function updateActionButtons() {
    stripeButton.disabled = !serverAvailable;
    submitButton.disabled = !serverAvailable || !sessionStorage.getItem(stripeSessionKey);
  }

  function markServerUnavailable() {
    serverAvailable = false;
    updateActionButtons();
    retryServerButton.classList.remove("hidden");
    setMessage(unavailableMessage, "error");
  }

  function markServerAvailable() {
    serverAvailable = true;
    retryServerButton.classList.add("hidden");
    updateActionButtons();
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

  function selectedSlot() {
    var value = Number(slotSelect.value || 0);
    return slots.find(function (slot) { return Number(slot.hour) === value; }) || null;
  }

  function drawSlotSummary() {
    var slot = selectedSlot();
    bidField.classList.add("hidden");
    bidAmount.required = false;
    if (!slot) {
      slotSummary.textContent = dateRuleMessage(null) || "Select a time to see availability and payment details.";
      return;
    }
    if (slotBlockedByDate(slot)) {
      slotSummary.textContent = dateRuleMessage(slot);
      return;
    }
    if (slot.kind === "fixed") {
      slotSummary.textContent = slot.remaining_spots + " spot(s) currently available. Fixed price: " + money(slot.price) + " per spot. You are charged only after approval and successful reservation.";
      return;
    }
    bidField.classList.remove("hidden");
    bidAmount.required = true;
    bidAmount.min = slot.min_bid;
    bidAmount.placeholder = "At least " + money(slot.min_bid);
    var current = slot.highest_bid ? " Current highest approved bid: " + money(slot.highest_bid) + "." : "";
    slotSummary.textContent = "Starting bid: " + money(slot.min_bid) + "." + current + " Bidding closes five minutes before the scheduled send.";
  }

  function loadSlots() {
    var requestedDate = dateInput.value;
    slotSelect.innerHTML = '<option value="">Loading placements...</option>';
    return requestJson("/ads/api/slots?date=" + encodeURIComponent(requestedDate), { method: "GET" })
      .then(function (payload) {
        markServerAvailable();
        slots = payload.slots || [];
        slotSelect.innerHTML = '<option value="">Choose a placement</option>';
        slots.forEach(function (slot) {
          var option = document.createElement("option");
          option.value = slot.hour;
          var wrongDate = slot.slot_date !== requestedDate;
          var unavailable = slot.kind === "fixed" && Number(slot.remaining_spots) < 1;
          var blockedByDate = slotBlockedByDate(slot);
          option.disabled = wrongDate || unavailable || blockedByDate;
          if (blockedByDate) {
            option.textContent = slot.label + " - unavailable on this date";
          } else if (wrongDate) {
            option.textContent = slot.label + " - closed for this date";
          } else if (slot.kind === "fixed") {
            option.textContent = slot.label + " - " + slot.boxes + " spot layout - " + money(slot.price) + " - " + slot.remaining_spots + " left";
          } else {
            option.textContent = slot.label + " - " + slot.boxes + " spot layout - bids from " + money(slot.min_bid);
          }
          slotSelect.appendChild(option);
        });
        drawSlotSummary();
      })
      .catch(function () {
        slotSelect.innerHTML = '<option value="">Placements unavailable right now</option>';
        markServerUnavailable();
      });
  }

  function creativeChanged() {
    var selected = form.querySelector('input[name="creative_type"]:checked');
    var isText = selected && selected.value === "text";
    imageField.classList.toggle("hidden", isText);
    textField.classList.toggle("hidden", !isText);
    imageField.querySelector("input").required = !isText;
    textField.querySelector("textarea").required = isText;
  }

  function saveDraft() {
    var fields = ["slot_date", "hour", "business_name", "advertiser_name", "email", "phone", "creative_type", "ad_text", "bid_amount", "sms_consent"];
    var draft = {};
    fields.forEach(function (name) {
      var input = form.elements[name];
      if (!input) {
        return;
      }
      if (input instanceof RadioNodeList) {
        draft[name] = input.value;
      } else if (input.type === "checkbox") {
        draft[name] = input.checked;
      } else {
        draft[name] = input.value;
      }
    });
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }

  function restoreDraft() {
    var raw = sessionStorage.getItem(draftKey);
    if (!raw) {
      return Promise.resolve();
    }
    var draft;
    try {
      draft = JSON.parse(raw);
    } catch (error) {
      return Promise.resolve();
    }
    ["slot_date", "business_name", "advertiser_name", "email", "phone", "ad_text", "bid_amount"].forEach(function (name) {
      if (form.elements[name] && draft[name] !== undefined) {
        form.elements[name].value = draft[name];
      }
    });
    if (draft.creative_type) {
      var creative = form.querySelector('input[name="creative_type"][value="' + draft.creative_type + '"]');
      if (creative) {
        creative.checked = true;
      }
    }
    if (form.elements.sms_consent) {
      form.elements.sms_consent.checked = Boolean(draft.sms_consent);
    }
    creativeChanged();
    return loadSlots().then(function () {
      if (draft.hour) {
        slotSelect.value = draft.hour;
        drawSlotSummary();
      }
    });
  }

  function cardSetupReturn() {
    var query = new URLSearchParams(window.location.search);
    var stripeState = query.get("stripe");
    var sessionId = query.get("session_id");
    if (stripeState === "success" && sessionId) {
      sessionStorage.setItem(stripeSessionKey, sessionId);
      updateActionButtons();
      setMessage("Your card was securely saved with Stripe. If you selected a picture, reselect the image file and submit your ad for approval.", "success");
    } else if (stripeState === "canceled") {
      setMessage("Card setup was canceled. No ad was submitted.", "error");
    }
    if (stripeState) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }

  stripeButton.addEventListener("click", function () {
    if (!serverAvailable) {
      markServerUnavailable();
      return;
    }
    if (!form.elements.advertiser_name.value || !form.elements.email.value || !form.elements.phone.value) {
      setMessage("Enter your name, email, and mobile number before securely saving a card.", "error");
      return;
    }
    saveDraft();
    stripeButton.disabled = true;
    setMessage("Opening Stripe secure card setup...", "");
    requestJson("/ads/api/card-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advertiser_name: form.elements.advertiser_name.value,
        email: form.elements.email.value,
        phone: form.elements.phone.value,
        website: form.elements.website.value
      })
    }).then(function (payload) {
      window.location.href = payload.checkout_url;
    }).catch(function (error) {
      if (error.message === unavailableMessage) {
        markServerUnavailable();
      } else {
        updateActionButtons();
        setMessage(error.message, "error");
      }
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!serverAvailable) {
      markServerUnavailable();
      return;
    }
    var stripeSession = sessionStorage.getItem(stripeSessionKey);
    if (!stripeSession) {
      setMessage("Save your card securely with Stripe before submitting the ad.", "error");
      return;
    }
    if (slotBlockedByDate(selectedSlot())) {
      setMessage(dateRuleMessage(selectedSlot()), "error");
      return;
    }
    var data = new FormData(form);
    data.append("stripe_session_id", stripeSession);
    submitButton.disabled = true;
    setMessage("Submitting your ad for Hakol Kaan review...", "");
    requestJson("/ads/api/submit", { method: "POST", body: data })
      .then(function (payload) {
        var stored = { ad_id: payload.ad_id, manage_token: payload.manage_token };
        localStorage.setItem(trackKey, JSON.stringify(stored));
        trackingId.value = stored.ad_id;
        trackingToken.value = stored.manage_token;
        sessionStorage.removeItem(stripeSessionKey);
        sessionStorage.removeItem(draftKey);
        setMessage("Your ad request was sent for approval. Request ID: " + stored.ad_id + ". Your private tracking key is shown in the Request tracking section below; keep it to check status or increase a bid.", "success");
        trackingResult.classList.add("hidden");
        document.getElementById("track-bid").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (error) {
        if (error.message === unavailableMessage) {
          markServerUnavailable();
        } else {
          updateActionButtons();
          setMessage(error.message, "error");
        }
      });
  });

  function statusText(ad) {
    var statusNames = {
      pending_approval: "Pending Hakol Kaan approval",
      active_bid: "Approved and actively bidding",
      approved_paid: "Approved and paid",
      paid: "Approved, paid, and scheduled",
      won: "Winning bid selected",
      charged: "Winning bid charged and scheduled",
      sent: "Ad sent",
      rejected: "Not approved",
      lost: "Bid did not win",
      payment_failed: "Payment failed",
      sold_out: "Approved, but that fixed spot was already filled",
      reservation_failed: "Approved, but reservation could not be completed",
      hold_failed: "Approved, but the temporary card check failed"
    };
    var message = (statusNames[ad.status] || ad.status) + ". Placement: " + ad.slot + ".";
    if (ad.kind === "bid") {
      message += " Your bid: " + money(ad.bid_amount) + ". Current highest bid: " + money(ad.highest_bid) + ".";
      if (ad.rank) {
        message += " Current position: " + ad.rank + ".";
      }
    }
    return message;
  }

  function showAdStatus(ad) {
    trackingResult.classList.remove("hidden");
    trackingCopy.textContent = statusText(ad);
    raiseForm.classList.toggle("hidden", !ad.can_increase_bid);
    if (ad.can_increase_bid) {
      raiseAmount.min = String(Number(ad.bid_amount || 0) + 0.01);
    }
  }

  trackingForm.addEventListener("submit", function (event) {
    event.preventDefault();
    requestJson("/ads/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: trackingId.value, manage_token: trackingToken.value })
    }).then(function (payload) {
      showAdStatus(payload.ad);
    }).catch(function (error) {
      trackingResult.classList.remove("hidden");
      trackingCopy.textContent = error.message === unavailableMessage ? unavailableMessage : error.message;
      raiseForm.classList.add("hidden");
    });
  });

  raiseForm.addEventListener("submit", function (event) {
    event.preventDefault();
    requestJson("/ads/api/increase-bid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: trackingId.value, manage_token: trackingToken.value, amount: raiseAmount.value })
    }).then(function (payload) {
      showAdStatus(payload.status);
    }).catch(function (error) {
      trackingCopy.textContent = error.message === unavailableMessage ? unavailableMessage : error.message;
    });
  });

  stripeButton.disabled = true;
  submitButton.disabled = true;
  dateInput.min = today();
  dateInput.value = today();
  slotSelect.addEventListener("change", drawSlotSummary);
  dateInput.addEventListener("change", loadSlots);
  form.querySelectorAll('input[name="creative_type"]').forEach(function (input) {
    input.addEventListener("change", creativeChanged);
  });
  creativeChanged();
  retryServerButton.addEventListener("click", loadSlots);
  restoreDraft().then(function () {
    if (!sessionStorage.getItem(draftKey)) {
      loadSlots();
    }
    cardSetupReturn();
  });
  try {
    var tracking = JSON.parse(localStorage.getItem(trackKey) || "{}");
    trackingId.value = tracking.ad_id || "";
    trackingToken.value = tracking.manage_token || "";
  } catch (error) {
    localStorage.removeItem(trackKey);
  }
}());
