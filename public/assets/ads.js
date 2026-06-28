(function () {
  "use strict";

  var body = document.body;
  var apiBase = (body.dataset.adsApiBase || "").replace(/\/$/, "");
  var form = document.getElementById("ad-request-form");
  var statusBox = document.getElementById("form-status");
  var dateInput = document.getElementById("slot-date");
  var placementSelect = document.getElementById("ad-slot");
  var slotSummary = document.getElementById("slot-summary");
  var imageField = document.getElementById("ad-image-field");
  var textField = document.getElementById("ad-text-field");
  var imageInput = imageField ? imageField.querySelector("input") : null;
  var textInput = textField ? textField.querySelector("textarea") : null;
  var stripeButton = document.getElementById("stripe-button");
  var submitButton = document.getElementById("submit-ad-button");
  var savedCardStatus = document.getElementById("saved-card-status");
  var paymentSetupNote = document.getElementById("payment-setup-note");
  var retryServerButton = document.getElementById("retry-server-button");
  var previewButton = document.getElementById("send-preview-text-button");
  var previewStatus = document.getElementById("preview-text-status");
  var previewGrid = document.getElementById("ad-preview-grid");
  var previewNote = document.getElementById("ad-preview-note");
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

  var authKey = "hakol_kaan_ads_auth";
  var unavailableMessage = "Advertising requests are temporarily unavailable. Please try again later.";
  var serverAvailable = false;
  var placements = [];
  var authSession = loadAuthSession();
  var authProfile = null;
  var pendingAuthEmail = "";
  var pendingAuthPurpose = "signup";
  var pendingResetEmail = "";
  var previewImageUrl = "";

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

  function setMessage(target, message, type) {
    if (!target) {
      return;
    }
    target.textContent = message || "";
    target.className = "form-status" + (type ? " is-" + type : "");
  }

  function setFormMessage(message, type) {
    setMessage(statusBox, message, type);
  }

  function setAuthMessage(message, type) {
    setMessage(authStatus, message, type);
  }

  function setPreviewMessage(message, type) {
    setMessage(previewStatus, message, type);
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

  function loadAuthSession() {
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

  function saveAuthSession(session) {
    authSession = session && session.session_token ? { session_token: session.session_token } : null;
    if (authSession) {
      localStorage.setItem(authKey, JSON.stringify(authSession));
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
    var card = (authProfile && authProfile.saved_card) || {};
    return card.has_card ? card : null;
  }

  function savedCardLabel() {
    var card = savedCard();
    var parts = [];
    if (!card) {
      return "";
    }
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

  function openAccountModal(mode) {
    if (!accountModal) {
      return;
    }
    setAuthMode(mode || (isSignedIn() ? "account" : "login"));
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

  function applyAuthProfileToForm() {
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

  function selectedPlacement() {
    var value = placementSelect.value || "";
    return placements.find(function (placement) {
      return (placement.placement_kind || placement.kind || "") === value;
    }) || null;
  }

  function isFooterPlacement() {
    var placement = selectedPlacement();
    return Boolean(placement && (placement.placement_kind || placement.kind) === "search_footer_day");
  }

  function selectedCreativeType() {
    if (isFooterPlacement()) {
      return "text";
    }
    var selected = form.querySelector('input[name="creative_type"]:checked');
    return selected ? selected.value : "picture";
  }

  function creativeReady() {
    if (selectedCreativeType() === "text") {
      return Boolean(textInput && textInput.value.trim());
    }
    return Boolean(imageInput && imageInput.files && imageInput.files[0]);
  }

  function updateButtons() {
    var hasCard = Boolean(savedCard());
    var placement = selectedPlacement();
    var ready = serverAvailable && isSignedIn();
    stripeButton.disabled = !ready;
    stripeButton.textContent = hasCard ? "Update payment method" : "Set up payment";
    submitButton.disabled = !ready || !hasCard || !placement || placement.available === false || !creativeReady();
    if (previewButton) {
      previewButton.disabled = !ready || !placement || placement.available === false || !creativeReady();
    }
    if (paymentSetupNote) {
      paymentSetupNote.classList.toggle("hidden", hasCard);
    }
    if (savedCardStatus) {
      savedCardStatus.textContent = hasCard
        ? "Payment method ready: " + savedCardLabel() + ". It will be charged only after approval."
        : "No payment method is set up yet. Set up payment before submitting your ad.";
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
      heroAuthButton.textContent = signedIn ? "Place an ad" : "Sign in to place an ad";
      heroAuthButton.href = signedIn ? "#book-ad" : "#ad-account";
    }
    if (signedIn) {
      accountEmail.textContent = (authProfile && authProfile.email) || "your account";
      applyAuthProfileToForm();
      if (!authProfile) {
        refreshAuthProfile();
      }
    }
    updateButtons();
  }

  function markServerUnavailable() {
    serverAvailable = false;
    retryServerButton.classList.remove("hidden");
    setFormMessage(unavailableMessage, "error");
    updateButtons();
  }

  function markServerAvailable() {
    serverAvailable = true;
    retryServerButton.classList.add("hidden");
    updateButtons();
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
      if (accountEmail) {
        accountEmail.textContent = authProfile.email || "your account";
      }
      applyAuthProfileToForm();
      updateButtons();
    }).catch(function (error) {
      if (/sign in/i.test(error.message)) {
        saveAuthSession(null);
      }
    });
  }

  function loadPlacements() {
    placementSelect.innerHTML = '<option value="">Loading placements...</option>';
    return requestJson("/ads/api/slots?date=" + encodeURIComponent(dateInput.value || today()), { method: "GET" })
      .then(function (payload) {
        placements = payload.slots || [];
        placementSelect.innerHTML = '<option value="">Choose a placement</option>';
        placements.forEach(function (placement) {
          var option = document.createElement("option");
          option.value = placement.placement_kind || placement.kind;
          option.disabled = placement.available === false;
          option.textContent = placement.label + " - " + money(placement.price || placement.price_amount) + " per day" + (placement.available === false ? " - booked" : "");
          placementSelect.appendChild(option);
        });
        markServerAvailable();
        updatePlacementUi();
      })
      .catch(markServerUnavailable);
  }

  function updatePlacementUi() {
    var placement = selectedPlacement();
    var isFooter = isFooterPlacement();
    imageField.classList.toggle("hidden", isFooter || selectedCreativeType() === "text");
    textField.classList.toggle("hidden", selectedCreativeType() !== "text");
    imageInput.required = !isFooter && selectedCreativeType() === "picture";
    textInput.required = selectedCreativeType() === "text";
    form.querySelectorAll('input[name="creative_type"]').forEach(function (input) {
      input.disabled = isFooter;
      if (isFooter && input.value === "text") {
        input.checked = true;
      }
    });
    if (!placement) {
      slotSummary.textContent = "Select one of the two daily ad options.";
    } else if (placement.available === false) {
      slotSummary.textContent = "This placement is already booked for the selected date. Choose the other option or another date.";
    } else {
      slotSummary.textContent = (placement.description || "Daily search ad placement.") + " Price: " + money(placement.price || placement.price_amount) + " for the day.";
    }
    renderPreview();
    updateButtons();
  }

  function renderPreview() {
    if (!previewGrid) {
      return;
    }
    var placement = selectedPlacement();
    var type = selectedCreativeType();
    previewGrid.innerHTML = "";
    previewGrid.style.gridTemplateColumns = "1fr";
    var cell = document.createElement("div");
    cell.className = "ad-preview-cell";
    if (!placement) {
      cell.classList.add("is-placeholder");
      cell.textContent = "Choose an ad placement";
      previewNote.textContent = "Choose a placement to preview the ad.";
    } else if (isFooterPlacement()) {
      cell.classList.add("is-placeholder");
      cell.innerHTML = "Search result picture<br><br><strong>" + escapeHtml(textInput.value.trim() || "Place your ad here for $5 a day") + "</strong><br>To place the ad go to Menu and then go to Hakol Kaan Ads";
      previewNote.textContent = "This line will appear at the bottom of Amazon and Walmart search-result pictures.";
    } else if (type === "text") {
      cell.classList.add("is-placeholder");
      cell.textContent = textInput.value.trim() || "Type your ad text";
      previewNote.textContent = "This text will be turned into an extra ad picture in the same search-result MMS.";
    } else if (previewImageUrl) {
      var image = document.createElement("img");
      image.src = previewImageUrl;
      image.alt = "Your ad preview";
      cell.classList.add("has-image");
      cell.appendChild(image);
      previewNote.textContent = "This picture will be added to the same MMS as Amazon and Walmart search-result pictures.";
    } else {
      cell.classList.add("is-placeholder");
      cell.textContent = "Upload your ad picture";
      previewNote.textContent = "Upload a picture to preview the $10/day search picture ad.";
    }
    previewGrid.appendChild(cell);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[character];
    });
  }

  function buildAdFormData() {
    var data = new FormData(form);
    var placement = selectedPlacement();
    data.set("placement_kind", placement ? (placement.placement_kind || placement.kind) : "");
    data.append("session_token", authSession.session_token);
    if (isFooterPlacement()) {
      data.set("creative_type", "footer");
    }
    return data;
  }

  function requireReadyForAd(messageTarget) {
    if (!serverAvailable) {
      markServerUnavailable();
      return false;
    }
    if (!isSignedIn()) {
      setMessage(messageTarget, "Sign in with your email first.", "error");
      openAccountModal("login");
      return false;
    }
    if (!selectedPlacement()) {
      setMessage(messageTarget, "Choose an ad placement first.", "error");
      return false;
    }
    if (selectedPlacement().available === false) {
      setMessage(messageTarget, "That placement is already booked for this date.", "error");
      return false;
    }
    if (!creativeReady()) {
      setMessage(messageTarget, "Add your ad picture or text first.", "error");
      return false;
    }
    return true;
  }

  function cardSetupReturn() {
    var query = new URLSearchParams(window.location.search);
    var stripeState = query.get("stripe");
    var sessionId = query.get("session_id");
    if (stripeState === "success" && sessionId) {
      setFormMessage("Confirming your payment setup...", "");
      refreshAuthProfile().then(function () {
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
        authProfile = payload.profile || authProfile;
        applyAuthProfileToForm();
        updateButtons();
        setFormMessage("Your payment method is ready. Choose your ad and submit when ready.", "success");
      }).catch(function (error) {
        setFormMessage(error.message, "error");
      });
    } else if (stripeState === "canceled") {
      setFormMessage("Payment setup was canceled. No ad was submitted.", "error");
    }
    if (stripeState) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = (authEmailInput.value || "").trim();
    var password = loginForm.elements.password.value || "";
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
        setAuthMessage((payload.message || "Verification code sent.") + " Enter the code here.", "success");
        authCodeInput.focus();
        return;
      }
      authProfile = payload.profile || {};
      saveAuthSession({ session_token: payload.session_token });
      loginForm.elements.password.value = "";
      closeAccountModal();
    }).catch(function (error) {
      setAuthMessage(error.message, "error");
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
      setAuthMessage((payload.message || "Verification code sent.") + " Enter the code here.", "success");
      authCodeInput.focus();
    }).catch(function (error) {
      setAuthMessage(error.message, "error");
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
    }).catch(function (error) {
      setAuthMessage(error.message, "error");
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
      setAuthMessage((payload.message || "If that email has an account, a reset code was sent.") + " Enter the code and your new password.", "success");
    }).catch(function (error) {
      setAuthMessage(error.message, "error");
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
    }).catch(function (error) {
      setAuthMessage(error.message, "error");
    });
  });

  stripeButton.addEventListener("click", function () {
    if (!serverAvailable) {
      markServerUnavailable();
      return;
    }
    if (!isSignedIn()) {
      setFormMessage("Sign in before setting up payment.", "error");
      openAccountModal("login");
      return;
    }
    if (!accountDetailsReady()) {
      setFormMessage("Your signed-in account is missing a name, phone, or email.", "error");
      refreshAuthProfile();
      return;
    }
    stripeButton.disabled = true;
    setFormMessage("Opening secure payment setup...", "");
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
      setFormMessage(error.message, "error");
      updateButtons();
    });
  });

  if (previewButton) {
    previewButton.addEventListener("click", function () {
      if (!requireReadyForAd(previewStatus)) {
        return;
      }
      previewButton.disabled = true;
      setPreviewMessage("Sending preview message...", "");
      requestJson("/ads/api/preview-text", { method: "POST", body: buildAdFormData() })
        .then(function () {
          setPreviewMessage("Preview message sent to your phone.", "success");
          updateButtons();
        })
        .catch(function (error) {
          setPreviewMessage(error.message, "error");
          updateButtons();
        });
    });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!requireReadyForAd(statusBox)) {
      return;
    }
    if (!savedCard()) {
      setFormMessage("Set up payment before submitting the ad.", "error");
      return;
    }
    if (!accountDetailsReady()) {
      setFormMessage("Your signed-in account is missing a name, phone, or email.", "error");
      refreshAuthProfile();
      return;
    }
    submitButton.disabled = true;
    setFormMessage("Submitting your ad...", "");
    requestJson("/ads/api/submit", { method: "POST", body: buildAdFormData() })
      .then(function (payload) {
        setFormMessage("Your ad request was sent. Request ID: " + (payload.ad_id || (payload.ad && payload.ad.id) || "") + ". Opening your dashboard...", "success");
        setTimeout(function () {
          window.location.href = "/dashboard/";
        }, 1200);
      })
      .catch(function (error) {
        setFormMessage(error.message, "error");
        updateButtons();
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
    setAuthMessage("Enter your account email and we will send a reset code.", "");
  });
  backToLoginButton.addEventListener("click", function () {
    setAuthMode("login");
    setAuthMessage("", "");
  });
  signOutButton.addEventListener("click", function () {
    saveAuthSession(null);
    setAuthMessage("You are signed out.", "");
  });

  if (accountModalClose) {
    accountModalClose.addEventListener("click", closeAccountModal);
  }
  if (accountModalBackdrop) {
    accountModalBackdrop.addEventListener("click", closeAccountModal);
  }
  document.querySelectorAll("[data-account-link]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      openAccountModal(isSignedIn() ? "account" : "login");
    });
  });
  window.HakolAdsAuth = {
    openAccount: function () {
      openAccountModal(isSignedIn() ? "account" : "login");
    }
  };

  placementSelect.addEventListener("change", updatePlacementUi);
  dateInput.addEventListener("change", loadPlacements);
  form.querySelectorAll('input[name="creative_type"]').forEach(function (input) {
    input.addEventListener("change", updatePlacementUi);
  });
  if (imageInput) {
    imageInput.addEventListener("change", function () {
      if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        previewImageUrl = "";
      }
      if (imageInput.files && imageInput.files[0]) {
        previewImageUrl = URL.createObjectURL(imageInput.files[0]);
      }
      updatePlacementUi();
    });
  }
  if (textInput) {
    textInput.addEventListener("input", updatePlacementUi);
  }
  retryServerButton.addEventListener("click", loadPlacements);
  window.addEventListener("storage", function () {
    authSession = loadAuthSession();
    authProfile = null;
    updateAuthUi();
  });

  stripeButton.disabled = true;
  submitButton.disabled = true;
  dateInput.min = today();
  dateInput.value = today();
  loadPlacements().then(function () {
    cardSetupReturn();
    updateAuthUi();
    if (window.location.hash === "#ad-account") {
      openAccountModal(isSignedIn() ? "account" : "login");
    }
  });
}());
