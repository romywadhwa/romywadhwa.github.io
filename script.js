// Hero chart: an illustration of data volume climbing while query cost drops after an optimization.
(function () {
  const svg = document.getElementById("chart");
  const tip = document.getElementById("tip");
  const pin = document.getElementById("pin");
  if (!svg) return;

  const NS = "http://www.w3.org/2000/svg";
  const W = 600, H = 340, PAD = { l: 8, r: 8, t: 24, b: 16 };
  const N = 40, DROP = 24; // the optimization lands at point 24
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Deterministic, gently noisy series (index values, 0 to 100).
  const wiggle = (i, a, b) => Math.sin(i * a) * 2.6 + Math.sin(i * b + 1.3) * 1.8;
  const rows = [], cost = [];
  for (let i = 0; i < N; i++) {
    rows.push(18 + i * 1.75 + wiggle(i, 0.9, 0.37));
    const base = 46 + i * 0.85;
    const after = i < DROP ? base : base * (0.3 + 0.7 * Math.exp(-(i - DROP) * 0.9)) + (i - DROP) * 0.15;
    cost.push(after + wiggle(i, 1.3, 0.51) * 0.7);
  }

  const x = i => PAD.l + (i / (N - 1)) * (W - PAD.l - PAD.r);
  const y = v => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // Smooth path through points using Catmull-Rom converted to cubic Beziers.
  function path(vals) {
    const p = vals.map((v, i) => [x(i), y(v)]);
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return d;
  }

  // Grid
  const grid = el("g", { class: "grid" });
  for (let g = 0; g <= 4; g++) grid.append(el("line", { x1: 0, x2: W, y1: y(g * 25), y2: y(g * 25) }));
  svg.append(grid);

  // Area under data volume
  const defs = el("defs", {});
  const grad = el("linearGradient", { id: "fillRows", x1: 0, y1: 0, x2: 0, y2: 1 });
  grad.append(el("stop", { offset: "0%", "stop-color": "#1FD6A5", "stop-opacity": 0.32 }), el("stop", { offset: "100%", "stop-color": "#1FD6A5", "stop-opacity": 0 }));
  defs.append(grad);
  svg.append(defs);
  const area = el("path", { d: `${path(rows)} L${x(N - 1)},${H - PAD.b} L${x(0)},${H - PAD.b} Z`, fill: "url(#fillRows)", opacity: reduce ? 1 : 0 });
  svg.append(area);

  const lineRows = el("path", { d: path(rows), class: "line rows" });
  const lineCost = el("path", { d: path(cost), class: "line cost" });
  svg.append(lineCost, lineRows);

  // Crosshair for hover
  const cross = el("line", { class: "cross", y1: PAD.t, y2: H - PAD.b, opacity: 0 });
  const mRows = el("circle", { r: 6, fill: "#1FD6A5", class: "marker", opacity: 0 });
  const mCost = el("circle", { r: 6, fill: "#FF6A3D", class: "marker", opacity: 0 });
  svg.append(cross, mRows, mCost);

  function placePin() {
    const r = svg.getBoundingClientRect(), s = r.width / W;
    // Keep the callout inside the chart on narrow screens and move its arrow to stay on the point.
    const target = x(DROP + 1) * s, left = Math.max(0, Math.min(r.width - pin.offsetWidth, target - 14));
    pin.style.left = left + "px";
    pin.style.setProperty("--arrow", (target - left - 7) + "px");
    pin.style.top = (y(cost[DROP + 1]) * s - pin.offsetHeight - 16) + "px";
  }

  // One orchestrated draw-in on load.
  function draw() {
    placePin();
    if (reduce) { pin.classList.add("show"); return; }
    const lines = [[lineRows, 0], [lineCost, 250]].map(([p, delay]) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      return { p, len, delay };
    });
    const DUR = 1800, ease = t => 1 - Math.pow(1 - t, 3);
    let start = null;
    function frame(now) {
      if (start === null) start = now;
      const t = now - start;
      let done = true;
      for (const l of lines) {
        const k = Math.min(1, Math.max(0, (t - l.delay) / DUR));
        l.p.style.strokeDashoffset = l.len * (1 - ease(k));
        if (k < 1) done = false;
      }
      area.setAttribute("opacity", Math.min(1, Math.max(0, (t - 1200) / 800)));
      if (t > 1700) pin.classList.add("show");
      if (!done || t < 2000) requestAnimationFrame(frame);
      else lines.forEach(l => { l.p.style.strokeDasharray = ""; l.p.style.strokeDashoffset = ""; });
    }
    requestAnimationFrame(frame);
  }

  function hover(evt) {
    const r = svg.getBoundingClientRect(), s = r.width / W;
    const px = (evt.clientX - r.left) / s;
    const i = Math.max(0, Math.min(N - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (N - 1))));
    cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("opacity", 1);
    mRows.setAttribute("cx", x(i)); mRows.setAttribute("cy", y(rows[i])); mRows.setAttribute("opacity", 1);
    mCost.setAttribute("cx", x(i)); mCost.setAttribute("cy", y(cost[i])); mCost.setAttribute("opacity", 1);
    tip.hidden = false;
    tip.innerHTML = `<b>${i < DROP ? "Before tuning" : "After tuning"}</b>Data volume ${Math.round(rows[i])}<br>Query cost ${Math.round(cost[i])}`;
    const left = x(i) * s, w = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(r.width - w, left - w / 2)) + "px";
    pin.style.opacity = "0.25";
  }
  function leave() {
    [cross, mRows, mCost].forEach(e => e.setAttribute("opacity", 0));
    tip.hidden = true; pin.style.opacity = "";
  }
  svg.addEventListener("pointermove", hover);
  svg.addEventListener("pointerleave", leave);
  window.addEventListener("resize", placePin);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw); else draw();
})();

document.getElementById("yr").textContent = new Date().getFullYear();

// Highlight the nav link for the section currently in view.
(function () {
  const links = [...document.querySelectorAll(".links a")];
  const sections = links.map(a => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach(a => {
        const on = a.getAttribute("href") === "#" + e.target.id;
        if (on) { a.setAttribute("aria-current", "true"); a.parentElement.scrollLeft = a.offsetLeft - a.parentElement.offsetLeft - 8; }
        else a.removeAttribute("aria-current");
      });
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(s => io.observe(s));
})();

// Copy email to clipboard, with a fallback for browsers that block the clipboard API.
(function () {
  const btn = document.getElementById("copyEmail"), msg = document.getElementById("copied");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const email = btn.dataset.email;
    let ok = false;
    try { await navigator.clipboard.writeText(email); ok = true; }
    catch {
      const t = document.createElement("textarea");
      t.value = email; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.append(t); t.select();
      try { ok = document.execCommand("copy"); } catch {}
      t.remove();
    }
    btn.textContent = ok ? "Copied" : "Copy email";
    msg.textContent = ok ? "Email copied. Paste it into your mail app." : "Copy did not work here. Select the email address and copy it.";
    setTimeout(() => { btn.textContent = "Copy email"; }, 2000);
  });
})();
