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
  var stripeButton = document.getElementById("stripe-button");
  var submitButton = document.getElementById("submit-ad-button");
  var savedCardStatus = document.getElementById("saved-card-status");
  var retryServerButton = document.getElementById("retry-server-button");
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
  var stripeSessionKey = "hakol_kaan_ads_stripe_session";
  var draftKey = "hakol_kaan_ads_draft";
  var authKey = "hakol_kaan_ads_auth";
  var serverAvailable = false;
  var unavailableMessage = "Advertising requests are temporarily unavailable. Please try again later.";
  var authSession = loadAuthSession();
  var pendingAuthEmail = "";
  var pendingAuthPurpose = "signup";
  var pendingResetEmail = "";
  var cancelFeePercent = "4%";

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
      if (session && session.email && session.session_token) {
        return session;
      }
    } catch (error) {
      localStorage.removeItem(authKey);
    }
    return null;
  }

  function saveAuthSession(session) {
    authSession = session && session.email && session.session_token ? session : null;
    if (authSession) {
      localStorage.setItem(authKey, JSON.stringify(authSession));
    } else {
      localStorage.removeItem(authKey);
    }
    updateAuthUi();
    window.dispatchEvent(new CustomEvent("hakolAdsAuthChanged"));
  }

  function isSignedIn() {
    return Boolean(authSession && authSession.email && authSession.session_token);
  }

  function savedCard() {
    var profile = authSession && authSession.profile ? authSession.profile : {};
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
      form.elements.email.readOnly = false;
      return;
    }
    var profile = authSession.profile || {};
    form.elements.email.value = authSession.email;
    form.elements.email.readOnly = true;
    if (profile.full_name && !form.elements.advertiser_name.value) {
      form.elements.advertiser_name.value = profile.full_name;
    }
    if (form.elements.business_name && profile.business_name && !form.elements.business_name.value) {
      form.elements.business_name.value = profile.business_name;
    }
    if (profile.phone && !form.elements.phone.value) {
      form.elements.phone.value = profile.phone;
    }
  }

  function updateActionButtons() {
    var canUseSavedCard = Boolean(savedCard());
    stripeButton.disabled = !serverAvailable || !isSignedIn();
    stripeButton.textContent = canUseSavedCard ? "Update payment method" : "Set up payment with Stripe";
    submitButton.disabled = !serverAvailable || !isSignedIn() || (!canUseSavedCard && !sessionStorage.getItem(stripeSessionKey));
    if (savedCardStatus) {
      savedCardStatus.textContent = canUseSavedCard
        ? "Payment method ready: " + savedCardLabel() + ". It will be used for this ad."
        : "No payment method is set up yet. Set up payment with Stripe before submitting your ad.";
    }
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
      accountEmail.textContent = authSession.email;
      authEmailInput.value = authSession.email;
      applyAuthProfileToForm();
      setAuthMessage("You are signed in. You can place ads and view your dashboard.", "success");
    } else {
      form.elements.email.readOnly = false;
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
      slotSummary.textContent = slot.remaining_spots + " spot(s) currently available. Fixed price: " + money(slot.price) + " per spot. You are charged when the ad is accepted and the spot is reserved.";
      return;
    }
    bidField.classList.remove("hidden");
    bidAmount.required = true;
    bidAmount.min = slot.min_bid;
    bidAmount.placeholder = "At least " + money(slot.min_bid);
    var current = slot.highest_bid ? " Current highest bid: " + money(slot.highest_bid) + "." : "";
    slotSummary.textContent = "Starting bid: " + money(slot.min_bid) + "." + current + " No hold is placed for bids. Bidding closes five minutes before the scheduled send.";
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
      var adChoice = form.querySelector('input[name="creative_type"][value="' + draft.creative_type + '"]');
      if (adChoice) {
        adChoice.checked = true;
      }
    }
    if (form.elements.sms_consent) {
      form.elements.sms_consent.checked = Boolean(draft.sms_consent);
    }
    adTypeChanged();
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
      setMessage("Confirming your payment setup with Stripe...", "");
      requestJson("/ads/api/card-setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: authSession && authSession.session_token,
          stripe_session_id: sessionId,
          advertiser_name: form.elements.advertiser_name.value,
          business_name: form.elements.business_name ? form.elements.business_name.value : "",
          phone: form.elements.phone.value,
          website: form.elements.website.value
        })
      }).then(function (payload) {
        if (payload.profile && authSession) {
          authSession.profile = payload.profile;
          localStorage.setItem(authKey, JSON.stringify(authSession));
          applyAuthProfileToForm();
        }
        sessionStorage.removeItem(stripeSessionKey);
        updateActionButtons();
        setMessage("Your payment method is ready" + (savedCardLabel() ? " (" + savedCardLabel() + ")" : "") + ". If you selected a picture, reselect the image file and submit your ad.", "success");
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
      saveAuthSession({ email: payload.email, session_token: payload.session_token, profile: payload.profile || {} });
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
      saveAuthSession({ email: payload.email, session_token: payload.session_token, profile: payload.profile || {} });
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
      saveAuthSession({ email: payload.email, session_token: payload.session_token, profile: payload.profile || {} });
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
    sessionStorage.removeItem(stripeSessionKey);
    updateActionButtons();
    setAuthMessage("You are signed out.", "");
  });

  function reloadAuthSessionFromStorage() {
    authSession = loadAuthSession();
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
    if (!form.elements.advertiser_name.value || !form.elements.email.value || !form.elements.phone.value) {
      setMessage("Enter your name, email, and mobile number before setting up payment.", "error");
      return;
    }
    saveDraft();
    stripeButton.disabled = true;
    setMessage("Opening Stripe payment setup...", "");
    requestJson("/ads/api/card-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_token: authSession.session_token,
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
    if (!isSignedIn()) {
      setMessage("Sign in with your email before submitting an ad.", "error");
      openAccountModal("login");
      return;
    }
    var stripeSession = sessionStorage.getItem(stripeSessionKey);
    if (!stripeSession && !savedCard()) {
      setMessage("Set up payment with Stripe before submitting the ad.", "error");
      return;
    }
    if (slotBlockedByDate(selectedSlot())) {
      setMessage(dateRuleMessage(selectedSlot()), "error");
      return;
    }
    var data = new FormData(form);
    if (stripeSession) {
      data.append("stripe_session_id", stripeSession);
    }
    data.append("session_token", authSession.session_token);
    submitButton.disabled = true;
    setMessage("Submitting your ad...", "");
    requestJson("/ads/api/submit", { method: "POST", body: data })
      .then(function (payload) {
        sessionStorage.removeItem(stripeSessionKey);
        sessionStorage.removeItem(draftKey);
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
  slotSelect.addEventListener("change", drawSlotSummary);
  dateInput.addEventListener("change", loadSlots);
  form.querySelectorAll('input[name="creative_type"]').forEach(function (input) {
    input.addEventListener("change", adTypeChanged);
  });
  adTypeChanged();
  retryServerButton.addEventListener("click", loadSlots);
  window.addEventListener("storage", reloadAuthSessionFromStorage);
  window.addEventListener("hakolAdsAuthChanged", reloadAuthSessionFromStorage);
  restoreDraft().then(function () {
    if (!sessionStorage.getItem(draftKey)) {
      loadSlots();
    }
    cardSetupReturn();
    updateAuthUi();
    if (window.location.hash === "#ad-account") {
      openAccountModal(isSignedIn() ? "account" : "login");
    }
  });
}());
