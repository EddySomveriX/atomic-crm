/**
 * Website widget of the CRM (TZ section 5.2): a "Write / Book" button that
 * opens a panel where a visitor books a service or writes to the business.
 * Plain JavaScript in a shadow root, so it works on any site without
 * touching its styles. The site pastes:
 *   <script src="https://crm/widget/widget.js" data-key="<public key>"
 *           data-api="https://<project>/functions/v1/widget_api" async></script>
 * Texts come from texts.json next to this file (uk, en).
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || window.__crmWidgetLoaded) return;
  window.__crmWidgetLoaded = true;

  var KEY = script.getAttribute("data-key");
  var API = script.getAttribute("data-api");
  var BASE = script.src.replace(/widget\.js(\?.*)?$/, "");
  var POLL_MS = 5000;
  var VISITOR_KEY = "crmWidgetVisitor";

  var visitor = (function () {
    try {
      var stored = localStorage.getItem(VISITOR_KEY);
      if (stored) return stored;
      var id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
      return id;
    } catch (error) {
      return crypto.randomUUID();
    }
  })();

  var texts = {};
  var lang = "uk";
  var t = function (key) {
    return (texts[lang] && texts[lang][key]) || key;
  };

  var call = function (action, body) {
    var payload = Object.assign({ action: action, key: KEY, visitor: visitor }, body || {});
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          var error = new Error(data && data.message ? data.message : "failed");
          error.status = response.status;
          throw error;
        }
        return data;
      });
    });
  };

  var el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (name) {
      if (name === "text") node.textContent = attrs[name];
      else if (name.indexOf("on") === 0) node.addEventListener(name.slice(2), attrs[name]);
      else node.setAttribute(name, attrs[name]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  };

  var CSS =
    ":host{all:initial}" +
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;padding:14px 20px;" +
    "background:var(--accent,#0f766e);color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2)}" +
    ".launcher:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}" +
    ".panel{position:fixed;right:20px;bottom:84px;z-index:2147483000;width:min(380px,calc(100vw - 32px));max-height:min(620px,calc(100vh - 110px));" +
    "display:flex;flex-direction:column;background:#fff;color:#1c1917;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden}" +
    "@media (max-width:480px){.panel{right:16px;left:16px;width:auto;bottom:80px}}" +
    ".panel[hidden]{display:none}" +
    ".head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid #e7e5e4}" +
    ".title{flex:1;font-weight:700;font-size:16px}" +
    ".x{border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:#57534e;padding:4px 8px}" +
    ".tabs{display:flex;gap:4px;padding:8px 12px}" +
    ".tab{flex:1;border:0;border-radius:999px;padding:8px;background:#f5f5f4;color:#44403c;font-size:14px;cursor:pointer}" +
    ".tab[aria-selected=true]{background:var(--accent,#0f766e);color:#fff}" +
    ".body{padding:12px 16px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;font-size:14px}" +
    "label{font-weight:600;font-size:13px;color:#44403c}" +
    ".choices{display:flex;flex-wrap:wrap;gap:6px}" +
    ".choice{border:1px solid #d6d3d1;background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:14px;color:#1c1917}" +
    ".choice[aria-pressed=true]{border-color:var(--accent,#0f766e);background:#ccfbf1}" +
    "input,textarea{width:100%;border:1px solid #d6d3d1;border-radius:10px;padding:10px;font-size:15px;color:#1c1917;background:#fff}" +
    ".check{display:flex;gap:8px;align-items:flex-start;font-weight:400;font-size:13px}" +
    ".check input{width:auto;margin-top:2px}" +
    ".primary{border:0;border-radius:10px;padding:12px;background:var(--accent,#0f766e);color:#fff;font-size:15px;font-weight:600;cursor:pointer}" +
    ".primary:disabled{opacity:.5;cursor:default}" +
    ".note{color:#57534e}.error{color:#b91c1c}.ok{white-space:pre-wrap;background:#f0fdfa;border-radius:10px;padding:12px}" +
    ".messages{display:flex;flex-direction:column;gap:6px;min-height:160px}" +
    ".msg{max-width:85%;padding:8px 12px;border-radius:14px;white-space:pre-wrap;word-break:break-word}" +
    ".in{align-self:flex-end;background:var(--accent,#0f766e);color:#fff}.out{align-self:flex-start;background:#f5f5f4}" +
    ".row{display:flex;gap:6px}.row textarea{flex:1;resize:none}";

  var host = el("div");
  var root = host.attachShadow({ mode: "open" });
  root.appendChild(el("style", { text: CSS }));
  document.body.appendChild(host);

  var info = null;
  var state = { open: false, tab: "book", serviceId: null, salesId: null, day: null, slot: null, days: null, slots: null, done: null, error: null };
  var lastMessageId = 0;
  var messages = [];
  var pollTimer = null;

  var launcher = el("button", { class: "launcher", type: "button", "aria-expanded": "false", onclick: function () { toggle(); } });
  root.appendChild(launcher);
  var panel = el("div", { class: "panel", role: "dialog", hidden: "" });
  root.appendChild(panel);

  function toggle(force) {
    state.open = typeof force === "boolean" ? force : !state.open;
    launcher.setAttribute("aria-expanded", String(state.open));
    if (state.open) panel.removeAttribute("hidden");
    else panel.setAttribute("hidden", "");
    if (state.open && !info) load();
    else render();
    if (state.open && state.tab === "chat") startPolling();
    else stopPolling();
  }

  function load() {
    render();
    call("init")
      .then(function (data) {
        info = data;
        lang = data.language === "en" ? "en" : "uk";
        if (data.services.length === 1) chooseService(data.services[0].id);
        render();
      })
      .catch(function () {
        state.error = "failed";
        render();
      });
  }

  function chooseService(id) {
    state.serviceId = id;
    state.day = null;
    state.slot = null;
    state.slots = null;
    loadDays();
  }

  function loadDays() {
    state.days = null;
    render();
    call("days", { service_id: state.serviceId, sales_id: state.salesId })
      .then(function (data) {
        state.days = data.days;
        render();
      })
      .catch(function () {
        state.error = "failed";
        render();
      });
  }

  function chooseDay(day) {
    state.day = day;
    state.slot = null;
    state.slots = null;
    render();
    call("slots", { service_id: state.serviceId, sales_id: state.salesId, day: day }).then(function (data) {
      state.slots = data.slots;
      state.timezone = data.timezone;
      render();
    });
  }

  function formatDay(day) {
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "uk-UA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z"));
  }

  function formatTime(iso) {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: state.timezone || undefined }).format(new Date(iso));
  }

  function choice(label, pressed, onclick) {
    return el("button", { class: "choice", type: "button", "aria-pressed": String(Boolean(pressed)), text: label, onclick: onclick });
  }

  function renderBook(body) {
    if (state.done) {
      body.appendChild(el("div", { class: "ok", text: state.done }));
      body.appendChild(el("button", { class: "primary", type: "button", text: t("book_again"), onclick: function () {
        state.done = null; state.slot = null; state.day = null; state.slots = null; loadDays();
      } }));
      return;
    }
    if (!info.services.length) {
      body.appendChild(el("p", { class: "note", text: t("no_services") }));
      return;
    }
    body.appendChild(el("label", { text: t("service") }));
    body.appendChild(el("div", { class: "choices" }, info.services.map(function (service) {
      return choice(service.name + " · " + service.duration_minutes + " " + t("minutes"), service.id === state.serviceId, function () { chooseService(service.id); });
    })));
    if (!state.serviceId) return;
    if (info.specialists.length > 1) {
      body.appendChild(el("label", { text: t("specialist") }));
      body.appendChild(el("div", { class: "choices" }, [choice(t("any_specialist"), state.salesId == null, function () { state.salesId = null; loadDays(); })].concat(
        info.specialists.map(function (person) {
          return choice(person.name, person.id === state.salesId, function () { state.salesId = person.id; loadDays(); });
        }),
      )));
    }
    body.appendChild(el("label", { text: t("day") }));
    if (state.days == null) {
      body.appendChild(el("p", { class: "note", text: t("loading") }));
      return;
    }
    if (!state.days.length) {
      body.appendChild(el("p", { class: "note", text: t("no_days") }));
      return;
    }
    body.appendChild(el("div", { class: "choices" }, state.days.map(function (day) {
      return choice(formatDay(day), day === state.day, function () { chooseDay(day); });
    })));
    if (!state.day) return;
    body.appendChild(el("label", { text: t("time") }));
    if (state.slots == null) {
      body.appendChild(el("p", { class: "note", text: t("loading") }));
      return;
    }
    body.appendChild(el("div", { class: "choices" }, state.slots.map(function (slot) {
      var chosen = state.slot && state.slot.starts_at === slot.starts_at;
      return choice(formatTime(slot.starts_at), chosen, function () { state.slot = slot; render(); });
    })));
    if (!state.slot) return;

    var name = el("input", { id: "w-name", autocomplete: "name", maxlength: "100", value: state.name || "" });
    var phone = el("input", { id: "w-phone", type: "tel", autocomplete: "tel", maxlength: "32", value: state.phone || "" });
    var consent = el("input", { type: "checkbox", id: "w-consent" });
    var submit = el("button", { class: "primary", type: "submit", text: t("book") });
    var form = el("form", { onsubmit: function (event) {
      event.preventDefault();
      state.name = name.value.trim();
      state.phone = phone.value.trim();
      if (!state.name || !consent.checked) return;
      submit.disabled = true;
      state.error = null;
      call("book", { service_id: state.serviceId, slot: state.slot, name: state.name, phone: state.phone, consent: true })
        .then(function (data) {
          if (data.status === "taken") {
            state.error = "taken";
            chooseDay(state.day);
            return;
          }
          state.done = data.message;
          render();
        })
        .catch(function (error) {
          state.error = error.message === "invalid_phone" ? "invalid_phone" : "failed";
          render();
        });
    } }, [
      el("label", { for: "w-name", text: t("name") }), name,
      el("label", { for: "w-phone", text: t("phone") }), phone,
      el("label", { class: "check" }, [consent, el("span", { text: t("consent") })]),
      submit,
    ]);
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "8px";
    body.appendChild(form);
  }

  function renderChat(body) {
    body.appendChild(el("p", { class: "note", text: t("chat_hint") }));
    body.appendChild(el("div", { class: "messages", "aria-live": "polite" }, messages.map(function (message) {
      return el("div", { class: "msg " + message.direction, text: message.body });
    })));
    var input = el("textarea", { rows: "2", maxlength: "4096", "aria-label": t("message"), placeholder: t("message") });
    var send = el("button", { class: "primary", type: "submit", text: t("send") });
    var form = el("form", { class: "row", onsubmit: function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      send.disabled = true;
      call("send", { text: text, name: state.name || "" })
        .then(function () { input.value = ""; return fetchMessages(); })
        .catch(function (error) { state.error = error.status === 429 ? "too_many" : "failed"; render(); })
        .then(function () { send.disabled = false; });
    } }, [input, send]);
    body.appendChild(form);
  }

  function fetchMessages() {
    return call("messages", { after_id: lastMessageId }).then(function (data) {
      if (data.messages.length) {
        messages = messages.concat(data.messages);
        lastMessageId = data.messages[data.messages.length - 1].id;
        if (state.tab === "chat") render();
      }
    });
  }

  function startPolling() {
    stopPolling();
    fetchMessages().catch(function () {});
    pollTimer = setInterval(function () { fetchMessages().catch(function () {}); }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function render() {
    launcher.textContent = t("open");
    panel.textContent = "";
    panel.setAttribute("aria-label", info ? info.business : t("open"));
    panel.appendChild(el("div", { class: "head" }, [
      el("span", { class: "title", text: info ? info.business : "" }),
      el("button", { class: "x", type: "button", "aria-label": t("close"), text: "×", onclick: function () { toggle(false); } }),
    ]));
    panel.appendChild(el("div", { class: "tabs", role: "tablist" }, ["book", "chat"].map(function (tab) {
      return el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(state.tab === tab), text: t("tab_" + tab), onclick: function () {
        state.tab = tab;
        state.error = null;
        if (tab === "chat") startPolling(); else stopPolling();
        render();
      } });
    })));
    var body = el("div", { class: "body" });
    panel.appendChild(body);
    if (state.error) body.appendChild(el("p", { class: "error", role: "alert", text: t(state.error) }));
    if (!info) {
      body.appendChild(el("p", { class: "note", text: t("loading") }));
      return;
    }
    if (state.tab === "book") renderBook(body);
    else renderChat(body);
  }

  fetch(BASE + "texts.json")
    .then(function (response) { return response.json(); })
    .then(function (data) {
      texts = data;
      lang = (navigator.language || "uk").indexOf("uk") === 0 ? "uk" : "en";
      render();
    })
    .catch(function () { render(); });
})();
