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
  var imageField = document.getElementById("ad-image-field");
  var textField = document.getElementById("ad-text-field");
  var imageInput = imageField ? imageField.querySelector("input") : null;
  var textInput = textField ? textField.querySelector("textarea") : null;
  var stripeButton = document.getElementById("stripe-button");
  var submitButton = document.getElementById("submit-ad-button");
  var savedCardStatus = document.getElementById("saved-card-status");
  var retryServerButton = document.getElementById("retry-server-button");
  var adPreviewGrid = document.getElementById("ad-preview-grid");
  var adPreviewNote = document.getElementById("ad-preview-note");
  var spotInput = document.getElementById("ad-spot-number");
  var previewTextButton = document.getElementById("send-preview-text-button");
  var previewTextStatus = document.getElementById("preview-text-status");
  var loginForm = document.getElementById("ad-login-form");
  var signupForm = document.getElementById("ad-signup-form");
  var otpForm = document.getElementById("ad-otp-form");
  var forgotPasswordForm = document.getElementById("forgot-password-form");
  var resetPasswordForm = document.getElementById("reset-password-form");
  var showLoginButton = document.getElementById("show-login-button");
  var showSignupButton = document.getElementById("show-signup-button");
  var forgotPasswordButton = document.getElementById("forgot-password-button");
  var backToLoginButton = document.getElementById("back-to-login-button");
  var accountModal = document.getElementById("ad-account");
  var accountModalClose = document.getElementById("account-modal-close");
  var accountModalBackdrop = document.getElementById("account-modal-backdrop");
  var authEmailInput = document.getElementById("auth-email");
  var authCodeInput = document.getElementById("auth-code");
  var forgotEmailInput = document.getElementById("forgot-email");
  var authStatus = document.getElementById("auth-status");
  var accountPanel = document.getElementById("account-panel");
  var accountEmail = document.getElementById("account-email");
  var heroAuthButton = document.getElementById("hero-auth-button");
  var signOutButton = document.getElementById("sign-out-button");
  var signedOutNote = document.getElementById("signed-out-note");
  var bookingContent = document.getElementById("booking-content");
  var layoutLightbox = document.getElementById("layout-lightbox");
  var layoutLightboxImage = document.getElementById("layout-lightbox-image");
  var layoutLightboxClose = document.getElementById("layout-lightbox-close");
  var layoutLightboxBackdrop = document.getElementById("layout-lightbox-backdrop");
  var slots = [];
  var authKey = "hakol_kaan_ads_auth";
  var serverAvailable = false;
  var unavailableMessage = "Advertising requests are temporarily unavailable. Please try again later.";
  var authSession = loadAuthSession();
  var authProfile = null;
  var pendingAuthEmail = "";
  var pendingAuthPurpose = "signup";
  var pendingResetEmail = "";
  var cancelFeePercent = "4%";
  var previewImageUrl = "";
  var selectedSpotNumber = 1;

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

  function setAuthMessage(message, type) {
    authStatus.textContent = message || "";
    authStatus.className = "form-status" + (type ? " is-" + type : "");
  }

  function updateCancelFeeText() {
    document.querySelectorAll("[data-cancel-fee]").forEach(function (item) {
      item.textContent = cancelFeePercent;
    });
  }

  function openLayoutLightbox(link) {
    if (!layoutLightbox || !layoutLightboxImage || !link) {
      return;
    }
    var previewImage = link.querySelector("img");
    layoutLightboxImage.src = link.href;
    layoutLightboxImage.alt = previewImage ? previewImage.alt : "Ad layout preview";
    layoutLightbox.classList.remove("hidden");
    layoutLightbox.setAttribute("aria-hidden", "false");
    body.classList.add("is-lightbox-open");
    if (layoutLightboxClose) {
      layoutLightboxClose.focus();
    }
  }

  function closeLayoutLightbox() {
    if (!layoutLightbox || !layoutLightboxImage) {
      return;
    }
    layoutLightbox.classList.add("hidden");
    layoutLightbox.setAttribute("aria-hidden", "true");
    layoutLightboxImage.removeAttribute("src");
    body.classList.remove("is-lightbox-open");
  }

  function openAccountModal(mode) {
    if (!accountModal) {
      return;
    }
    if (mode) {
      setAuthMode(mode);
    }
    accountModal.classList.remove("hidden");
    accountModal.setAttribute("aria-hidden", "false");
    body.classList.add("is-account-modal-open");
    if (!isSignedIn() && authEmailInput) {
      authEmailInput.focus();
    }
  }

  function closeAccountModal() {
    if (!accountModal) {
      return;
    }
    accountModal.classList.add("hidden");
    accountModal.setAttribute("aria-hidden", "true");
    body.classList.remove("is-account-modal-open");
  }

  function loadAuthSession() {
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

  function saveAuthSession(session) {
    authSession = session && session.session_token ? { session_token: session.session_token } : null;
    if (authSession) {
      localStorage.setItem(authKey, JSON.stringify({ session_token: authSession.session_token }));
    } else {
      localStorage.removeItem(authKey);
      authProfile = null;
    }
    updateAuthUi();
    window.dispatchEvent(new CustomEvent("hakolAdsAuthChanged"));
  }

  function isSignedIn() {
    return Boolean(authSession && authSession.session_token);
  }

  function savedCard() {
    var profile = authProfile || {};
    var card = profile.saved_card || {};
    return card && card.has_card ? card : null;
  }

  function savedCardLabel() {
    var card = savedCard();
    if (!card) {
      return "";
    }
    var parts = [];
    if (card.brand) {
      parts.push(card.brand);
    }
    if (card.last4) {
      parts.push("ending in " + card.last4);
    }
    return parts.join(" ") || "Payment method";
  }

  function setAuthMode(mode) {
    var signedIn = isSignedIn();
    loginForm.classList.toggle("hidden", signedIn || mode !== "login");
    signupForm.classList.toggle("hidden", signedIn || mode !== "signup");
    otpForm.classList.toggle("hidden", signedIn || mode !== "verify");
    forgotPasswordForm.classList.toggle("hidden", signedIn || mode !== "forgot");
    resetPasswordForm.classList.toggle("hidden", signedIn || mode !== "reset");
    showLoginButton.classList.toggle("is-active", mode === "login");
    showSignupButton.classList.toggle("is-active", mode === "signup");
  }

  function applyAuthProfileToForm() {
    if (!isSignedIn()) {
      return;
    }
    var profile = authProfile || {};
    if (profile.email) {
      form.elements.email.value = profile.email;
    }
    if (profile.full_name) {
      form.elements.advertiser_name.value = profile.full_name;
    }
    if (profile.phone) {
      form.elements.phone.value = profile.phone;
    }
  }

  function accountDetailsReady() {
    applyAuthProfileToForm();
    return Boolean(form.elements.advertiser_name.value && form.elements.email.value && form.elements.phone.value);
  }

  function accountDetailsMissingMessage() {
    if (!authProfile) {
      return "Your account details are still loading. Please try again in a moment.";
    }
    return "Your signed-in account is missing required contact information. Please contact Hakol Kaan to update it.";
  }

  function updateActionButtons() {
    var canUseSavedCard = Boolean(savedCard());
    stripeButton.disabled = !serverAvailable || !isSignedIn();
    stripeButton.textContent = canUseSavedCard ? "Update payment method" : "Set up payment";
    submitButton.disabled = !serverAvailable || !isSignedIn() || !canUseSavedCard;
    if (savedCardStatus) {
      savedCardStatus.textContent = canUseSavedCard
        ? "Payment method ready: " + savedCardLabel() + ". It will be used for this ad."
        : "No payment method is set up yet. Set up payment before submitting your ad.";
    }
    updatePreviewTextButton();
  }

  function setPreviewTextStatus(message, type) {
    if (!previewTextStatus) {
      return;
    }
    previewTextStatus.textContent = message || "";
    previewTextStatus.className = "form-status preview-text-status" + (type ? " is-" + type : "");
  }

  function previewCreativeReady() {
    if (selectedAdType() === "text") {
      return Boolean(textInput && textInput.value.trim());
    }
    return Boolean(imageInput && imageInput.files && imageInput.files[0]);
  }

  function updatePreviewTextButton() {
    if (!previewTextButton) {
      return;
    }
    previewTextButton.disabled = (
      !serverAvailable ||
      !isSignedIn() ||
      !accountDetailsReady() ||
      !selectedSlot() ||
      slotBlockedByDate(selectedSlot()) ||
      !previewCreativeReady()
    );
  }

  function updateAuthUi() {
    var signedIn = isSignedIn();
    if (signedIn) {
      setAuthMode("account");
    } else {
      setAuthMode("login");
    }
    accountPanel.classList.toggle("hidden", !signedIn);
    signedOutNote.classList.toggle("hidden", signedIn);
    bookingContent.classList.toggle("hidden", !signedIn);
    if (heroAuthButton) {
      heroAuthButton.textContent = "Place an ad";
      heroAuthButton.href = "#book-ad";
    }
    if (signedIn) {
      accountEmail.textContent = (authProfile && authProfile.email) || "your account";
      if (authProfile && authProfile.email) {
        authEmailInput.value = authProfile.email;
      }
      applyAuthProfileToForm();
      setAuthMessage("You are signed in. You can place ads and view your dashboard.", "success");
      if (!authProfile) {
        refreshAuthProfile();
      }
    }
    updateActionButtons();
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

  function refreshAuthProfile() {
    if (!isSignedIn()) {
      return Promise.resolve();
    }
    return requestJson("/ads/api/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: authSession.session_token })
    }).then(function (payload) {
      authProfile = payload.profile || {};
      applyAuthProfileToForm();
      updateActionButtons();
      if (accountEmail) {
        accountEmail.textContent = authProfile.email || "your account";
      }
      if (authEmailInput && authProfile.email) {
        authEmailInput.value = authProfile.email;
      }
    }).catch(function (error) {
      if (/sign in/i.test(error.message)) {
        saveAuthSession(null);
      }
    });
  }

  function selectedSlot() {
    var value = Number(slotSelect.value || 0);
    return slots.find(function (slot) { return Number(slot.hour) === value; }) || null;
  }

  function claimedSpots(slot) {
    return new Set((slot && Array.isArray(slot.claimed_spots) ? slot.claimed_spots : []).map(function (value) {
      return Number(value || 0);
    }).filter(function (value) {
      return value > 0;
    }));
  }

  function spotIsBooked(slot, spotNumber) {
    return Boolean(slot && slot.kind === "fixed" && claimedSpots(slot).has(Number(spotNumber || 0)));
  }

  function firstAvailableSpot(slot, boxes) {
    for (var number = 1; number <= boxes; number += 1) {
      if (!spotIsBooked(slot, number)) {
        return number;
      }
    }
    return 1;
  }

  function selectedSpotValue() {
    var slot = selectedSlot();
    var boxes = Math.max(1, Number(slot && slot.boxes ? slot.boxes : 1));
    var spot = Math.max(1, Math.min(boxes, Number(selectedSpotNumber || 1)));
    if (spotIsBooked(slot, spot)) {
      spot = firstAvailableSpot(slot, boxes);
    }
    selectedSpotNumber = spot;
    if (spotInput) {
      spotInput.value = String(spot);
    }
    return spot;
  }

  function chooseSpot(spotNumber) {
    var slot = selectedSlot();
    var boxes = Math.max(1, Number(slot && slot.boxes ? slot.boxes : 1));
    var spot = Math.max(1, Math.min(boxes, Number(spotNumber || 1)));
    if (spotIsBooked(slot, spot)) {
      return;
    }
    selectedSpotNumber = spot;
    if (spotInput) {
      spotInput.value = String(spot);
    }
    updateAdPreview();
  }

  function previewGridForCount(count) {
    var boxes = Number(count || 1);
    if (boxes <= 1) {
      return { columns: 1, rows: 1 };
    }
    if (boxes === 2) {
      return { columns: 2, rows: 1 };
    }
    if (boxes === 4) {
      return { columns: 2, rows: 2 };
    }
    if (boxes === 6) {
      return { columns: 3, rows: 2 };
    }
    if (boxes === 8) {
      return { columns: 4, rows: 2 };
    }
    if (boxes === 12) {
      return { columns: 4, rows: 3 };
    }
    return { columns: 4, rows: 4 };
  }

  function selectedAdType() {
    var selected = form.querySelector('input[name="creative_type"]:checked');
    return selected ? selected.value : "picture";
  }

  function textPreviewSize(text, boxes) {
    var length = String(text || "").trim().length;
    var base = boxes <= 1 ? 2.2 : boxes <= 4 ? 1.35 : boxes <= 8 ? 1.0 : 0.72;
    if (length > 120) {
      base *= 0.55;
    } else if (length > 70) {
      base *= 0.68;
    } else if (length > 35) {
      base *= 0.82;
    }
    return Math.max(0.48, base).toFixed(2) + "rem";
  }

  function renderPreviewCreative(cell, boxes) {
    var type = selectedAdType();
    if (type === "text") {
      var text = textInput ? textInput.value.trim() : "";
      if (!text) {
        cell.classList.add("is-placeholder");
        cell.textContent = "Type your ad text";
        return false;
      }
      var textWrap = document.createElement("div");
      textWrap.className = "ad-preview-text";
      textWrap.textContent = text;
      textWrap.dir = "auto";
      textWrap.style.fontSize = textPreviewSize(text, boxes);
      cell.appendChild(textWrap);
      return true;
    }
    if (!previewImageUrl) {
      cell.classList.add("is-placeholder");
      cell.textContent = "Upload your ad picture";
      return false;
    }
    var image = document.createElement("img");
    cell.classList.add("has-image");
    image.src = previewImageUrl;
    image.alt = "Your ad preview";
    cell.appendChild(image);
    return true;
  }

  function updateAdPreview() {
    if (!adPreviewGrid) {
      return;
    }
    var slot = selectedSlot();
    var boxes = Math.max(1, Number(slot && slot.boxes ? slot.boxes : 1));
    var layout = previewGridForCount(boxes);
    var hasCreative = false;
    adPreviewGrid.innerHTML = "";
    adPreviewGrid.dataset.spots = String(boxes);
    adPreviewGrid.style.gridTemplateColumns = "repeat(" + layout.columns + ", minmax(0, 1fr))";
    var selectedSpot = selectedSpotValue();
    var creativeWillShow = selectedAdType() === "text"
      ? Boolean(textInput && textInput.value.trim())
      : Boolean(previewImageUrl);
    for (var index = 0; index < boxes; index += 1) {
      var spotNumber = index + 1;
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "ad-preview-cell";
      cell.dataset.spotNumber = String(spotNumber);
      cell.setAttribute("aria-label", boxes > 1 ? "Choose spot " + spotNumber + " for your ad" : "Your ad spot");
      cell.setAttribute("aria-pressed", spotNumber === selectedSpot ? "true" : "false");
      if (spotIsBooked(slot, spotNumber)) {
        cell.classList.add("is-booked");
        cell.disabled = true;
        cell.textContent = "Booked";
      } else if (spotNumber === selectedSpot) {
        cell.classList.add("is-selected");
        hasCreative = renderPreviewCreative(cell, boxes);
      } else {
        cell.classList.add(creativeWillShow ? "is-other-ad" : "is-selectable-spot");
        cell.textContent = creativeWillShow ? "Other ad" : "Choose spot " + spotNumber;
        cell.addEventListener("click", function (event) {
          chooseSpot(event.currentTarget.dataset.spotNumber);
        });
      }
      if (!cell.disabled && spotNumber === selectedSpot) {
        cell.addEventListener("click", function (event) {
          chooseSpot(event.currentTarget.dataset.spotNumber);
        });
      }
      adPreviewGrid.appendChild(cell);
    }
    if (adPreviewNote) {
      if (!slot) {
        adPreviewNote.textContent = "Choose a placement, then choose the box where you want your ad to be.";
      } else if (hasCreative) {
        adPreviewNote.textContent = boxes > 1
          ? "This preview shows your ad in spot " + selectedSpot + ". Click another box if you want your ad there."
          : "This preview shows your ad in this layout.";
      } else if (selectedAdType() === "text") {
        adPreviewNote.textContent = boxes > 1
          ? "Choose the box where you want your ad to be, then type your ad text."
          : "Type your ad text to see it inside this layout.";
      } else {
        adPreviewNote.textContent = boxes > 1
          ? "Choose the box where you want your ad to be, then upload your picture."
          : "Upload your picture to see it inside this layout.";
      }
    }
    updatePreviewTextButton();
  }

  function drawSlotSummary() {
    var slot = selectedSlot();
    bidField.classList.add("hidden");
    bidAmount.required = false;
    if (!slot) {
      slotSummary.textContent = dateRuleMessage(null) || "Select a time to see availability and payment details.";
      updateAdPreview();
      return;
    }
    if (slotBlockedByDate(slot)) {
      slotSummary.textContent = dateRuleMessage(slot);
      updateAdPreview();
      return;
    }
    if (slot.kind === "fixed") {
      slotSummary.textContent = slot.remaining_spots + " spot(s) currently available. Fixed price: " + money(slot.price) + " per spot.";
      updateAdPreview();
      return;
    }
    bidField.classList.remove("hidden");
    bidAmount.required = true;
    bidAmount.min = slot.min_bid;
    bidAmount.placeholder = "At least " + money(slot.min_bid);
    var current = slot.highest_bid ? " Current highest bid: " + money(slot.highest_bid) + "." : "";
    slotSummary.textContent = "Starting bid: " + money(slot.min_bid) + "." + current + " No hold is placed for bids. Bidding closes five minutes before the scheduled send.";
    updateAdPreview();
  }

  function loadSlots() {
    var requestedDate = dateInput.value;
    slotSelect.innerHTML = '<option value="">Loading placements...</option>';
    return requestJson("/ads/api/slots?date=" + encodeURIComponent(requestedDate), { method: "GET" })
      .then(function (payload) {
        markServerAvailable();
        cancelFeePercent = payload.cancel_fee_percent || cancelFeePercent;
        updateCancelFeeText();
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

  function adTypeChanged() {
    var isText = selectedAdType() === "text";
    imageField.classList.toggle("hidden", isText);
    textField.classList.toggle("hidden", !isText);
    imageInput.required = !isText;
    textInput.required = isText;
    updateAdPreview();
  }

  function cardSetupReturn() {
    var query = new URLSearchParams(window.location.search);
    var stripeState = query.get("stripe");
    var sessionId = query.get("session_id");
    if (stripeState === "success" && sessionId) {
      updateActionButtons();
      setMessage("Confirming your payment setup...", "");
      refreshAuthProfile().then(function () {
        applyAuthProfileToForm();
        return requestJson("/ads/api/card-setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: authSession && authSession.session_token,
          stripe_session_id: sessionId,
          advertiser_name: form.elements.advertiser_name.value,
          business_name: "",
          phone: form.elements.phone.value,
          website: form.elements.website.value
        })
        });
      }).then(function (payload) {
        if (payload.profile && authSession) {
          authProfile = payload.profile;
          applyAuthProfileToForm();
        }
        updateActionButtons();
        setMessage("Your payment method is ready" + (savedCardLabel() ? " (" + savedCardLabel() + ")" : "") + ". Choose your placement and ad details, then submit your ad.", "success");
      }).catch(function (error) {
        updateActionButtons();
        setMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
      });
    } else if (stripeState === "canceled") {
      setMessage("Payment setup was canceled. No ad was submitted.", "error");
    }
    if (stripeState) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = (authEmailInput.value || "").trim();
    var password = loginForm.elements.password.value || "";
    if (!email || email.indexOf("@") < 0) {
      setAuthMessage("Enter a valid email address.", "error");
      return;
    }
    if (!password) {
      setAuthMessage("Enter your password.", "error");
      return;
    }
    setAuthMessage("Logging in...", "");
    requestJson("/ads/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password, website: loginForm.elements.website.value })
    }).then(function (payload) {
      if (payload.code_required) {
        pendingAuthEmail = payload.email || email;
        pendingAuthPurpose = "signup";
        setAuthMode("verify");
        setAuthMessage((payload.message || "Verification code sent.") + " Enter the code here to verify your email.", "success");
        authCodeInput.focus();
        return;
      }
      authProfile = payload.profile || {};
      saveAuthSession({ session_token: payload.session_token });
      loginForm.elements.password.value = "";
      closeAccountModal();
      document.getElementById("book-ad").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (error) {
      setAuthMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  });

  signupForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var password = signupForm.elements.password.value || "";
    var confirm = signupForm.elements.password_confirm.value || "";
    if (password !== confirm) {
      setAuthMessage("The passwords do not match.", "error");
      return;
    }
    setAuthMessage("Creating your account...", "");
    requestJson("/ads/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: signupForm.elements.full_name.value,
        email: signupForm.elements.email.value,
        phone: signupForm.elements.phone.value,
        password: password,
        website: signupForm.elements.website.value
      })
    }).then(function (payload) {
      pendingAuthEmail = payload.email || signupForm.elements.email.value;
      pendingAuthPurpose = "signup";
      setAuthMode("verify");
      setAuthMessage((payload.message || "Verification code sent.") + " Enter the code here to finish signing up.", "success");
      authCodeInput.focus();
    }).catch(function (error) {
      setAuthMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  });

  otpForm.addEventListener("submit", function (event) {
    event.preventDefault();
    requestJson("/ads/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingAuthEmail || authEmailInput.value, code: authCodeInput.value, purpose: pendingAuthPurpose })
    }).then(function (payload) {
      authProfile = payload.profile || {};
      saveAuthSession({ session_token: payload.session_token });
      authCodeInput.value = "";
      signupForm.reset();
      closeAccountModal();
      document.getElementById("book-ad").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (error) {
      setAuthMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  });

  forgotPasswordForm.addEventListener("submit", function (event) {
    event.preventDefault();
    pendingResetEmail = (forgotEmailInput.value || "").trim();
    setAuthMessage("Sending a reset code...", "");
    requestJson("/ads/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingResetEmail })
    }).then(function (payload) {
      pendingResetEmail = payload.email || pendingResetEmail;
      setAuthMode("reset");
      setAuthMessage((payload.message || "If that email has an account, a reset code was sent.") + " Enter the code and your new password here.", "success");
      document.getElementById("reset-code").focus();
    }).catch(function (error) {
      setAuthMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  });

  resetPasswordForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var password = resetPasswordForm.elements.password.value || "";
    var confirm = resetPasswordForm.elements.password_confirm.value || "";
    if (password !== confirm) {
      setAuthMessage("The passwords do not match.", "error");
      return;
    }
    setAuthMessage("Resetting your password...", "");
    requestJson("/ads/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingResetEmail, code: resetPasswordForm.elements.code.value, password: password })
    }).then(function (payload) {
      authProfile = payload.profile || {};
      saveAuthSession({ session_token: payload.session_token });
      resetPasswordForm.reset();
      closeAccountModal();
      document.getElementById("book-ad").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (error) {
      setAuthMessage(error.message === unavailableMessage ? unavailableMessage : error.message, "error");
    });
  });

  showLoginButton.addEventListener("click", function () {
    setAuthMode("login");
    setAuthMessage("", "");
  });

  showSignupButton.addEventListener("click", function () {
    setAuthMode("signup");
    setAuthMessage("", "");
  });

  forgotPasswordButton.addEventListener("click", function () {
    forgotEmailInput.value = authEmailInput.value || "";
    setAuthMode("forgot");
    setAuthMessage("Enter your account email and we will send a reset code. Check your Inbox or Spam folder.", "");
  });

  backToLoginButton.addEventListener("click", function () {
    setAuthMode("login");
    setAuthMessage("", "");
  });

  if (accountModalClose) {
    accountModalClose.addEventListener("click", closeAccountModal);
  }

  if (accountModalBackdrop) {
    accountModalBackdrop.addEventListener("click", closeAccountModal);
  }

  window.addEventListener("hakolOpenAdsAccount", function () {
    openAccountModal(isSignedIn() ? "account" : "login");
  });

  window.HakolAdsAuth = {
    openAccount: function () {
      openAccountModal(isSignedIn() ? "account" : "login");
    }
  };

  signOutButton.addEventListener("click", function () {
    saveAuthSession(null);
    updateActionButtons();
    setAuthMessage("You are signed out.", "");
  });

  function reloadAuthSessionFromStorage() {
    var previousToken = authSession && authSession.session_token;
    authSession = loadAuthSession();
    if (!authSession || authSession.session_token !== previousToken) {
      authProfile = null;
    }
    updateAuthUi();
  }

  stripeButton.addEventListener("click", function () {
    if (!serverAvailable) {
      markServerUnavailable();
      return;
    }
    if (!isSignedIn()) {
      setMessage("Sign in with your email before setting up payment.", "error");
      openAccountModal("login");
      return;
    }
    if (!accountDetailsReady()) {
      setMessage(accountDetailsMissingMessage(), "error");
      refreshAuthProfile();
      return;
    }
    stripeButton.disabled = true;
    setMessage("Opening secure payment setup...", "");
    requestJson("/ads/api/card-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_token: authSession.session_token,
        advertiser_name: form.elements.advertiser_name.value,
        business_name: "",
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
    if (!isSignedIn()) {
      setMessage("Sign in with your email before submitting an ad.", "error");
      openAccountModal("login");
      return;
    }
    if (!savedCard()) {
      setMessage("Set up payment before submitting the ad.", "error");
      return;
    }
    if (!accountDetailsReady()) {
      setMessage(accountDetailsMissingMessage(), "error");
      refreshAuthProfile();
      return;
    }
    if (slotBlockedByDate(selectedSlot())) {
      setMessage(dateRuleMessage(selectedSlot()), "error");
      return;
    }
    var data = new FormData(form);
    data.append("session_token", authSession.session_token);
    submitButton.disabled = true;
    setMessage("Submitting your ad...", "");
    requestJson("/ads/api/submit", { method: "POST", body: data })
      .then(function (payload) {
        setMessage("Your ad request was sent. Request ID: " + payload.ad_id + ". Opening your dashboard...", "success");
        setTimeout(function () {
          window.location.href = "/dashboard/";
        }, 1200);
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

  if (previewTextButton) {
    previewTextButton.addEventListener("click", function () {
      if (!serverAvailable) {
        markServerUnavailable();
        return;
      }
      if (!isSignedIn()) {
        setPreviewTextStatus("Sign in before requesting a preview text.", "error");
        openAccountModal("login");
        return;
      }
      if (!accountDetailsReady()) {
        setPreviewTextStatus(accountDetailsMissingMessage(), "error");
        refreshAuthProfile();
        return;
      }
      if (!selectedSlot()) {
        setPreviewTextStatus("Choose an ad placement first.", "error");
        return;
      }
      if (slotBlockedByDate(selectedSlot())) {
        setPreviewTextStatus(dateRuleMessage(selectedSlot()), "error");
        return;
      }
      if (!previewCreativeReady()) {
        setPreviewTextStatus(selectedAdType() === "text" ? "Enter your ad text first." : "Upload your ad picture first.", "error");
        return;
      }
      var data = new FormData(form);
      data.append("session_token", authSession.session_token);
      previewTextButton.disabled = true;
      setPreviewTextStatus("Sending your preview text...", "");
      requestJson("/ads/api/preview-text", { method: "POST", body: data })
        .then(function (payload) {
          var remaining = Number(payload.remaining);
          var remainingText = Number.isFinite(remaining)
            ? " You have " + remaining + " preview text" + (remaining === 1 ? "" : "s") + " left today."
            : "";
          setPreviewTextStatus("Preview text sent to your phone." + remainingText, "success");
          updatePreviewTextButton();
        })
        .catch(function (error) {
          if (error.message === unavailableMessage) {
            markServerUnavailable();
          } else {
            setPreviewTextStatus(error.message, "error");
            updatePreviewTextButton();
          }
        });
    });
  }

  document.querySelectorAll(".layout-preview-link").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openLayoutLightbox(link);
    });
  });
  if (layoutLightboxClose) {
    layoutLightboxClose.addEventListener("click", closeLayoutLightbox);
  }
  if (layoutLightboxBackdrop) {
    layoutLightboxBackdrop.addEventListener("click", closeLayoutLightbox);
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && layoutLightbox && !layoutLightbox.classList.contains("hidden")) {
      closeLayoutLightbox();
    }
    if (event.key === "Escape" && accountModal && !accountModal.classList.contains("hidden")) {
      closeAccountModal();
    }
  });
  stripeButton.disabled = true;
  submitButton.disabled = true;
  dateInput.min = today();
  dateInput.value = today();
  slotSelect.addEventListener("change", function () {
    selectedSpotNumber = 1;
    drawSlotSummary();
  });
  dateInput.addEventListener("change", function () {
    selectedSpotNumber = 1;
    loadSlots();
  });
  form.querySelectorAll('input[name="creative_type"]').forEach(function (input) {
    input.addEventListener("change", adTypeChanged);
  });
  adTypeChanged();
  retryServerButton.addEventListener("click", loadSlots);
  if (imageInput) {
    imageInput.addEventListener("change", function () {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        previewImageUrl = "";
      }
      var file = imageInput.files && imageInput.files[0];
      if (file) {
        previewImageUrl = URL.createObjectURL(file);
      }
      updateAdPreview();
    });
  }
  if (textInput) {
    textInput.addEventListener("input", updateAdPreview);
  }
  window.addEventListener("storage", reloadAuthSessionFromStorage);
  window.addEventListener("hakolAdsAuthChanged", reloadAuthSessionFromStorage);
  loadSlots().then(function () {
    cardSetupReturn();
    updateAuthUi();
    if (window.location.hash === "#ad-account") {
      openAccountModal(isSignedIn() ? "account" : "login");
    }
  });
}());
