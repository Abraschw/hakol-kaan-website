(function () {
  "use strict";

  var authKey = "hakol_kaan_ads_auth";
  var header = document.querySelector(".site-header");
  var accountLinks = Array.prototype.slice.call(document.querySelectorAll("[data-account-link]"));

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

  function isAdsPage() {
    return window.location.pathname.replace(/\/+$/, "") === "/ads";
  }

  function updateAccountLinks() {
    var session = readSession();
    accountLinks.forEach(function (accountLink) {
      if (session) {
        accountLink.textContent = "Dashboard";
        accountLink.href = "/dashboard/";
        accountLink.title = "Open advertiser dashboard";
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
      drawerAccount.innerHTML = "<strong>Signed in</strong><span>Open your dashboard to see your advertiser details.</span>";
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
      '    <a href="/dashboard/">Dashboard</a>' +
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

  function startWebsiteReplayRecorder() {
    var body = document.body;
    var apiBase = ((body && body.dataset.adsApiBase) || "https://sms.hakolkaan.com").replace(/\/$/, "");
    var sessionKey = "hakol_kaan_replay_session";
    var sensitiveNames = /password|code|otp|token|session|stripe|card|cookie|authorization/i;
    var replaySessionId = "";
    var eventIndex = 0;
    var queue = [];
    var flushTimer = null;
    var lastSnapshotAt = 0;
    var lastMouseSampleAt = 0;
    var lastScrollSampleAt = 0;
    var lastMutationAt = 0;
    var startedAt = Date.now();
    var lastPointer = { x: 0, y: 0 };
    var maxSnapshotLength = 650000;

    try {
      replaySessionId = sessionStorage.getItem(sessionKey) || "";
      if (!replaySessionId) {
        replaySessionId = "wr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(sessionKey, replaySessionId);
      }
    } catch (error) {
      replaySessionId = "wr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    function nowIso() {
      return new Date().toISOString();
    }

    function elapsedMs() {
      return Math.max(0, Date.now() - startedAt);
    }

    function cssSelector(element) {
      if (!element || element === document || element === window) {
        return "";
      }
      var parts = [];
      var current = element;
      while (current && current.nodeType === 1 && parts.length < 5) {
        var name = current.nodeName.toLowerCase();
        if (current.id) {
          parts.unshift(name + "#" + current.id);
          break;
        }
        if (current.className && typeof current.className === "string") {
          name += "." + current.className.trim().split(/\s+/).slice(0, 2).join(".");
        }
        parts.unshift(name);
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function cleanText(value, maxLength) {
      return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength || 500);
    }

    function shouldRedactElement(element) {
      if (!element) {
        return false;
      }
      var type = String(element.type || "").toLowerCase();
      var name = String(element.name || element.id || "").toLowerCase();
      return type === "password" || type === "hidden" || sensitiveNames.test(name);
    }

    function absoluteUrl(value) {
      var text = String(value || "").trim();
      if (!text || text.indexOf("data:") === 0 || text.indexOf("blob:") === 0 || text.indexOf("mailto:") === 0 || text.indexOf("tel:") === 0 || text.indexOf("#") === 0) {
        return text;
      }
      try {
        return new URL(text, window.location.href).href;
      } catch (error) {
        return text;
      }
    }

    function preserveStylesheets(clone) {
      var head = clone.querySelector("head");
      if (!head) {
        return;
      }
      var inlineStyle = clone.ownerDocument.createElement("style");
      inlineStyle.setAttribute("data-replay-inline-css", "true");
      var cssText = "";
      Array.prototype.slice.call(document.styleSheets || []).forEach(function (sheet) {
        try {
          Array.prototype.slice.call(sheet.cssRules || []).forEach(function (rule) {
            cssText += rule.cssText + "\n";
          });
        } catch (error) {
        }
      });
      if (cssText) {
        inlineStyle.textContent = cssText.slice(0, 240000);
        head.appendChild(inlineStyle);
      }
      clone.querySelectorAll("link[href],script[src],img[src],source[src],video[src],audio[src],iframe[src],a[href]").forEach(function (node) {
        if (node.hasAttribute("href")) {
          node.setAttribute("href", absoluteUrl(node.getAttribute("href")));
        }
        if (node.hasAttribute("src")) {
          node.setAttribute("src", absoluteUrl(node.getAttribute("src")));
        }
      });
    }

    function preserveCanvasFrames(clone) {
      var sourceCanvases = Array.prototype.slice.call(document.querySelectorAll("canvas"));
      var cloneCanvases = Array.prototype.slice.call(clone.querySelectorAll("canvas"));
      sourceCanvases.forEach(function (canvas, index) {
        var target = cloneCanvases[index];
        if (!target) {
          return;
        }
        try {
          var image = clone.ownerDocument.createElement("img");
          image.setAttribute("src", canvas.toDataURL("image/png"));
          image.setAttribute("data-replay-canvas", "true");
          image.setAttribute("width", canvas.width || canvas.clientWidth || "");
          image.setAttribute("height", canvas.height || canvas.clientHeight || "");
          image.setAttribute("style", target.getAttribute("style") || "");
          target.parentNode.replaceChild(image, target);
        } catch (error) {
          target.setAttribute("data-replay-canvas-error", "Canvas could not be captured");
        }
      });
    }

    function sanitizeClone(clone) {
      var head = clone.querySelector("head");
      if (head && !head.querySelector("base[data-replay-base]")) {
        var base = clone.ownerDocument.createElement("base");
        base.setAttribute("data-replay-base", "true");
        base.setAttribute("href", window.location.origin + "/");
        head.insertBefore(base, head.firstChild);
      }
      preserveStylesheets(clone);
      preserveCanvasFrames(clone);
      clone.querySelectorAll("script,noscript").forEach(function (node) {
        node.remove();
      });
      clone.querySelectorAll("input,textarea,select").forEach(function (field) {
        if (shouldRedactElement(field)) {
          field.setAttribute("value", "[redacted]");
          if (field.tagName.toLowerCase() === "textarea") {
            field.textContent = "[redacted]";
          }
          return;
        }
        if (field.tagName.toLowerCase() === "textarea") {
          field.textContent = field.value || "";
          return;
        }
        if (field.tagName.toLowerCase() === "select") {
          Array.prototype.slice.call(field.options || []).forEach(function (option) {
            if (option.selected) {
              option.setAttribute("selected", "selected");
            } else {
              option.removeAttribute("selected");
            }
          });
          return;
        }
        if (field.type === "checkbox" || field.type === "radio") {
          if (field.checked) {
            field.setAttribute("checked", "checked");
          } else {
            field.removeAttribute("checked");
          }
        } else {
          field.setAttribute("value", field.value || "");
        }
      });
      return "<!doctype html>\n" + clone.outerHTML;
    }

    function snapshotHtml(force) {
      var now = Date.now();
      if (!force && now - lastSnapshotAt < 450) {
        return "";
      }
      lastSnapshotAt = now;
      try {
        var clone = document.documentElement.cloneNode(true);
        var html = sanitizeClone(clone);
        return html.length > maxSnapshotLength ? html.slice(0, maxSnapshotLength) + "\n<!-- replay snapshot truncated -->" : html;
      } catch (error) {
        return "";
      }
    }

    function redactedValue(element) {
      if (shouldRedactElement(element)) {
        return "[redacted]";
      }
      return cleanText(element && element.value, 1000);
    }

    function enqueue(eventType, detail, options) {
      options = options || {};
      detail = detail || {};
      var event = {
        event_index: ++eventIndex,
        created_at_utc: nowIso(),
        elapsed_ms: elapsedMs(),
        event_type: eventType,
        page_url: window.location.href,
        target_text: cleanText(detail.target_text, 1000),
        target_selector: cleanText(detail.target_selector, 1000),
        mouse_x: Number(detail.x != null ? detail.x : lastPointer.x) || 0,
        mouse_y: Number(detail.y != null ? detail.y : lastPointer.y) || 0,
        scroll_x: window.scrollX || window.pageXOffset || 0,
        scroll_y: window.scrollY || window.pageYOffset || 0,
        viewport_width: window.innerWidth || 0,
        viewport_height: window.innerHeight || 0,
        detail: detail,
        dom_html: snapshotHtml(Boolean(options.forceSnapshot))
      };
      queue.push(event);
      scheduleFlush(false);
    }

    function flush(ended) {
      if (!queue.length && !ended) {
        return;
      }
      var payload = {
        replay_session_id: replaySessionId,
        created_at_utc: nowIso(),
        start_url: window.location.href,
        current_url: window.location.href,
        viewport_width: window.innerWidth || 0,
        viewport_height: window.innerHeight || 0,
        duration_ms: elapsedMs(),
        ended: Boolean(ended),
        events: queue.splice(0, 80)
      };
      var bodyText = JSON.stringify(payload);
      if (ended && navigator.sendBeacon) {
        try {
          navigator.sendBeacon(apiBase + "/website-replay/events", new Blob([bodyText], { type: "application/json" }));
          return;
        } catch (error) {
        }
      }
      fetch(apiBase + "/website-replay/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText,
        keepalive: Boolean(ended)
      }).catch(function () {});
    }

    function scheduleFlush(ended) {
      if (ended) {
        flush(true);
        return;
      }
      if (flushTimer) {
        return;
      }
      flushTimer = window.setTimeout(function () {
        flushTimer = null;
        flush(false);
      }, 1800);
    }

    enqueue("page_open", { title: document.title, target_text: window.location.pathname }, { forceSnapshot: true });

    document.addEventListener("mousemove", function (event) {
      lastPointer = { x: event.clientX, y: event.clientY };
      var now = Date.now();
      if (now - lastMouseSampleAt < 250) {
        return;
      }
      lastMouseSampleAt = now;
      enqueue("mouse_move", {
        target_selector: cssSelector(event.target),
        target_text: cleanText(event.target && (event.target.innerText || event.target.getAttribute("aria-label")), 300),
        x: event.clientX,
        y: event.clientY
      }, { forceSnapshot: false });
    }, true);

    document.addEventListener("click", function (event) {
      var target = event.target;
      lastPointer = { x: event.clientX, y: event.clientY };
      enqueue("click", {
        target_selector: cssSelector(target),
        target_text: cleanText(target && (target.innerText || target.value || target.getAttribute("aria-label")), 1000),
        x: event.clientX,
        y: event.clientY
      }, { forceSnapshot: true });
    }, true);

    window.addEventListener("scroll", function () {
      var now = Date.now();
      if (now - lastScrollSampleAt < 150) {
        return;
      }
      lastScrollSampleAt = now;
      enqueue("scroll", {
        target_text: "scroll",
        scroll_x: window.scrollX || window.pageXOffset || 0,
        scroll_y: window.scrollY || window.pageYOffset || 0
      }, { forceSnapshot: true });
    }, { passive: true });

    window.addEventListener("resize", function () {
      enqueue("resize", {
        target_text: "resize",
        viewport_width: window.innerWidth || 0,
        viewport_height: window.innerHeight || 0
      }, { forceSnapshot: true });
    });

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        var now = Date.now();
        if (now - lastMutationAt < 350) {
          return;
        }
        lastMutationAt = now;
        enqueue("dom_mutation", { target_text: "page changed" }, { forceSnapshot: true });
      });
      observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    window.setInterval(function () {
      if (document.hidden) {
        return;
      }
      enqueue("visual_tick", { target_text: "visual state sample" }, { forceSnapshot: true });
    }, 1200);

    document.addEventListener("input", function (event) {
      var target = event.target;
      enqueue("input", {
        target_selector: cssSelector(target),
        target_text: cleanText(target && (target.name || target.id || target.placeholder), 1000),
        value: redactedValue(target)
      }, { forceSnapshot: true });
    }, true);

    document.addEventListener("change", function (event) {
      var target = event.target;
      enqueue("change", {
        target_selector: cssSelector(target),
        target_text: cleanText(target && (target.name || target.id || target.innerText), 1000),
        value: redactedValue(target)
      }, { forceSnapshot: true });
    }, true);

    document.addEventListener("submit", function (event) {
      enqueue("submit", {
        target_selector: cssSelector(event.target),
        target_text: cleanText(event.target && (event.target.id || event.target.action), 1000)
      }, { forceSnapshot: true });
    }, true);

    var originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = function () {
        var args = arguments;
        var url = String(args[0] && args[0].url ? args[0].url : args[0] || "");
        var method = String((args[1] && args[1].method) || (args[0] && args[0].method) || "GET").toUpperCase();
        if (url.indexOf("/website-replay/events") !== -1) {
          return originalFetch.apply(window, args);
        }
        enqueue("request_start", { target_text: method + " " + url }, { forceSnapshot: false });
        return originalFetch.apply(window, args).then(function (response) {
          enqueue("request_done", {
            target_text: method + " " + url,
            status: response.status
          }, { forceSnapshot: true });
          return response;
        }).catch(function (error) {
          enqueue("request_error", {
            target_text: method + " " + url,
            error: cleanText(error && error.message, 500)
          }, { forceSnapshot: true });
          throw error;
        });
      };
    }

    window.addEventListener("pagehide", function () {
      enqueue("page_close", { target_text: window.location.pathname }, { forceSnapshot: true });
      scheduleFlush(true);
    });
  }

  startWebsiteReplayRecorder();
}());
