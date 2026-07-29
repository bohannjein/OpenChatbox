/*
 * Chat widget for embedding an assistant into any website:
 *
 *   <script src="https://chat.firma.de/embed.js" data-key="ocb_pk_…" defer></script>
 *
 * Dependency-free and unbuilt on purpose — it has to drop into a CMS, an
 * intranet page or a static site without a toolchain.
 *
 * Two deliberate constraints:
 *  - Everything lives in a shadow root, so the host page's CSS cannot deform the
 *    widget and the widget cannot leak styles into the page.
 *  - Model output is inserted as textContent, never innerHTML. The answer is
 *    untrusted text on someone else's domain; rendering it as markup would put an
 *    XSS hole on every embedding site.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  if (!key) {
    console.error("[assistant] data-key fehlt am <script>-Tag.");
    return;
  }
  // Default to the origin the script came from; overridable for reverse proxies.
  var api = (script.getAttribute("data-api") || new URL(script.src).origin).replace(/\/+$/, "");
  var position = script.getAttribute("data-position") === "left" ? "left" : "right";

  var ACCENT = "#4f46e5";
  var CSS =
    ':host{all:initial}' +
    "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}" +
    ".fab{position:fixed;bottom:20px;" +
    position +
    ":20px;width:56px;height:56px;border-radius:28px;border:0;cursor:pointer;" +
    "background:var(--a);color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.28);z-index:2147483000;" +
    "display:flex;align-items:center;justify-content:center;transition:transform .15s ease}" +
    ".fab:hover{transform:scale(1.06)}.fab:active{transform:scale(.96)}" +
    ".fab svg{width:26px;height:26px}" +
    ".panel{position:fixed;bottom:88px;" +
    position +
    ":20px;width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);" +
    "background:#fff;color:#18181b;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.28);" +
    "z-index:2147483000;display:none;flex-direction:column;overflow:hidden}" +
    ".panel.open{display:flex}" +
    ".hd{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--a);color:#fff;flex:0 0 auto}" +
    ".hd b{font-size:15px;font-weight:600}" +
    ".hd button{margin-left:auto;background:transparent;border:0;color:#fff;cursor:pointer;font-size:20px;line-height:1;padding:0 4px}" +
    ".log{flex:1 1 auto;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}" +
    ".m{max-width:85%;padding:8px 11px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}" +
    ".m.u{align-self:flex-end;background:var(--a);color:#fff;border-bottom-right-radius:4px}" +
    ".m.a{align-self:flex-start;background:#f4f4f5;border-bottom-left-radius:4px}" +
    ".m.e{align-self:stretch;background:#fef2f2;color:#b91c1c;font-size:13px}" +
    ".src{align-self:flex-start;font-size:11px;color:#71717a;display:flex;flex-wrap:wrap;gap:6px}" +
    ".src a{color:var(--a)}" +
    ".ft{flex:0 0 auto;display:flex;gap:8px;padding:10px;border-top:1px solid #e4e4e7}" +
    ".ft textarea{flex:1;resize:none;border:1px solid #e4e4e7;border-radius:10px;padding:8px 10px;font-size:14px;" +
    "max-height:96px;outline:none}" +
    ".ft textarea:focus{border-color:var(--a)}" +
    ".ft button{background:var(--a);color:#fff;border:0;border-radius:10px;padding:0 14px;cursor:pointer;font-size:14px}" +
    ".ft button:disabled{opacity:.5;cursor:default}" +
    ".dots span{display:inline-block;width:5px;height:5px;margin-right:3px;border-radius:50%;background:#a1a1aa;" +
    "animation:b 1s infinite}" +
    ".dots span:nth-child(2){animation-delay:.15s}.dots span:nth-child(3){animation-delay:.3s}" +
    "@keyframes b{0%,60%,100%{opacity:.3}30%{opacity:1}}" +
    "@media (prefers-color-scheme:dark){.panel{background:#1c1c1f;color:#f4f4f5}" +
    ".m.a{background:#27272a}.ft{border-top-color:#3f3f46}" +
    ".ft textarea{background:#27272a;color:#f4f4f5;border-color:#3f3f46}}";

  var host = document.createElement("div");
  host.setAttribute("data-assistant-widget", "");
  var root = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var fab = el("button", "fab");
  fab.title = "Chat öffnen";
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 ' +
    "8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 " +
    '0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  var panel = el("div", "panel");
  var head = el("div", "hd");
  var title = el("b", null, "Assistent");
  var close = el("button", null, "×");
  close.title = "Schließen";
  head.appendChild(title);
  head.appendChild(close);

  var log = el("div", "log");
  var foot = el("div", "ft");
  var input = el("textarea");
  input.rows = 1;
  input.placeholder = "Frage stellen…";
  var send = el("button", null, "Senden");
  foot.appendChild(input);
  foot.appendChild(send);
  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(foot);
  root.appendChild(fab);
  root.appendChild(panel);
  // The accent lives on the host element so both the button and the panel inside
  // the shadow root read it; `all:initial` doesn't reset custom properties.
  host.style.setProperty("--a", ACCENT);

  function mount() {
    (document.body || document.documentElement).appendChild(host);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  // ── State ────────────────────────────────────────────────────────────────
  var history = [];
  var busy = false;
  var showSources = true;

  function bubble(cls, text) {
    var n = el("div", "m " + cls, text);
    log.appendChild(n);
    log.scrollTop = log.scrollHeight;
    return n;
  }

  function typing() {
    var n = el("div", "m a dots");
    n.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(n);
    log.scrollTop = log.scrollHeight;
    return n;
  }

  function sources(list) {
    if (!showSources || !list || !list.length) return;
    var wrap = el("div", "src");
    wrap.appendChild(el("span", null, "Quellen:"));
    list.slice(0, 6).forEach(function (s) {
      if (!s || !s.url) return;
      var a = el("a", null, s.title || s.url);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      wrap.appendChild(a);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  // Metadata: name, greeting and the instance's accent. Also the "is this key
  // still valid from this origin" check — a failure here is worth surfacing
  // immediately rather than on the visitor's first question.
  fetch(api + "/api/v1/assistant", { headers: { "X-Assistant-Key": key } })
    .then(function (r) {
      return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
    })
    .then(function (d) {
      title.textContent = d.name || "Assistent";
      fab.title = (d.name || "Assistent") + " öffnen";
      showSources = d.showSources !== false;
      if (d.brand && d.brand.accentColor) {
        ACCENT = d.brand.accentColor;
        host.style.setProperty("--a", ACCENT);
      }
      if (d.greeting) bubble("a", d.greeting);
    })
    .catch(function (e) {
      console.error("[assistant] Konfiguration nicht abrufbar:", e.message);
      bubble("e", "Der Assistent ist derzeit nicht erreichbar.");
    });

  function toggle(open) {
    panel.classList.toggle("open", open);
    if (open) input.focus();
  }
  fab.addEventListener("click", function () {
    toggle(!panel.classList.contains("open"));
  });
  close.addEventListener("click", function () {
    toggle(false);
  });

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(96, input.scrollHeight) + "px";
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  });
  send.addEventListener("click", ask);

  function ask() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    input.style.height = "auto";
    busy = true;
    send.disabled = true;
    bubble("u", text);
    history.push({ role: "user", content: text });
    var wait = typing();

    fetch(api + "/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Assistant-Key": key },
      body: JSON.stringify({ messages: history, stream: true }),
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(
            function (d) {
              throw new Error((d && d.error && d.error.message) || "HTTP " + res.status);
            },
            function () {
              throw new Error("HTTP " + res.status);
            }
          );
        }
        wait.remove();
        var node = bubble("a", "");
        var answer = "";
        var srcs = null;
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = "";

        return (function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              // Text, not markup: the answer is untrusted content running on a
              // third party's page.
              if (!answer) node.textContent = "(keine Antwort)";
              history.push({ role: "assistant", content: answer });
              sources(srcs);
              return;
            }
            buf += dec.decode(r.value, { stream: true });
            var parts = buf.split("\n\n");
            buf = parts.pop();
            parts.forEach(function (block) {
              block.split("\n").forEach(function (line) {
                if (line.indexOf("data:") !== 0) return;
                var payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") return;
                try {
                  var obj = JSON.parse(payload);
                } catch (_) {
                  return;
                }
                if (obj.x_sources) srcs = obj.x_sources;
                var d = obj.choices && obj.choices[0] && obj.choices[0].delta;
                // reasoning_content is intentionally not shown — visitors want
                // the answer, not the model thinking out loud.
                if (d && typeof d.content === "string" && d.content) {
                  answer += d.content;
                  node.textContent = answer;
                  log.scrollTop = log.scrollHeight;
                }
              });
            });
            return pump();
          });
        })();
      })
      .catch(function (e) {
        wait.remove();
        bubble("e", e.message || "Es ist ein Fehler aufgetreten.");
      })
      .then(function () {
        busy = false;
        send.disabled = false;
        input.focus();
      });
  }
})();
