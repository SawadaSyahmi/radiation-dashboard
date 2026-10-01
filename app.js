(() => {
  "use strict";

  const cfg = window.RADIATION_CONFIG;
  const $ = (id) => document.getElementById(id);

  let readings = [];
  let selectedLimit = cfg.DEFAULT_LIMIT || 60;
  let doseChart = null;
  let refreshTimer = null;

  const fmt = (value, digits = 3) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : "—";
  };

  const fmtInt = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n).toString() : "—";
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const humanAge = (iso) => {
    if (!iso) return "—";
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms)) return "—";
    const sec = Math.max(0, Math.floor(ms / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    return `${hr}h`;
  };

  const humanDetectorTime = (seconds) => {
    const n = Number(seconds);
    if (!Number.isFinite(n)) return "—";
    if (n < 60) return `${n}s`;
    const min = Math.floor(n / 60);
    const sec = n % 60;
    if (min < 60) return `${min}m ${sec}s`;
    const h = Math.floor(min / 60);
    return `${h}h ${min % 60}m`;
  };

  function setClassState(el, state) {
    el.classList.remove("good", "warn", "danger", "neutral");
    el.classList.add(state);
  }

  function classifyReading(row) {
    if (!row) return { label: "Waiting for data", state: "neutral" };
    if (Number(row.warning) > 0) return { label: "Device warning", state: "danger" };

    const rate = Number(row.dose_rate);
    if (!Number.isFinite(rate)) return { label: "Unknown", state: "neutral" };

    if (rate <= cfg.DISPLAY_BANDS.GOOD_MAX) return { label: "Background band", state: "good" };
    if (rate <= cfg.DISPLAY_BANDS.ELEVATED_MAX) return { label: "Elevated band", state: "warn" };
    return { label: "High band", state: "danger" };
  }

  function updateConnectionState(ok, message) {
    const badge = $("connectionBadge");
    $("connectionText").textContent = message;
    setClassState(badge, ok ? "good" : "danger");
  }

  async function fetchReadings() {
    const url = new URL(`${cfg.SUPABASE_URL}/rest/v1/${cfg.TABLE}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", String(Math.max(selectedLimit, 100)));

    const headers = {
      apikey: cfg.SUPABASE_KEY
    };

    // Legacy anon JWTs can also be used as Bearer tokens.
    // Publishable keys only need the apikey header.
    if (cfg.SUPABASE_KEY.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${cfg.SUPABASE_KEY}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }

    return response.json();
  }

  function renderHero(latest) {
    $("doseRateValue").textContent = fmt(latest?.dose_rate, 3);
    $("doseValue").textContent = fmt(latest?.dose, 3);
    $("cpsValue").textContent = fmtInt(latest?.cps);
    $("cpmValue").textContent = fmtInt(latest?.cpm);
    $("averageValue").textContent = fmt(latest?.average, 3);
    $("deviceId").textContent = latest?.device_id || "—";
    $("lastUpdated").textContent = fmtTime(latest?.created_at);
    $("warningFlag").textContent = latest ? fmtInt(latest.warning ?? 0) : "—";

    $("detectorTime").textContent = humanDetectorTime(latest?.detector_time);
    $("detectorS").textContent = latest ? `${fmt(latest.detector_s, 3)} µSv` : "—";
    $("activityCps").textContent = fmtInt(latest?.cps);
    $("activityCpm").textContent = fmtInt(latest?.cpm);

    const state = classifyReading(latest);
    $("radiationState").textContent = state.label;
    setClassState($("radiationState"), state.state);

    const rate = Number(latest?.dose_rate);
    const cappedPercent = Number.isFinite(rate)
      ? Math.max(0, Math.min(100, (rate / 1.0) * 100))
      : 0;

    $("meterFill").style.width = `${cappedPercent}%`;
    $("meterMarker").style.left = `${cappedPercent}%`;
  }

  function renderHealth(latest) {
    const ageMs = latest?.created_at ? Date.now() - new Date(latest.created_at).getTime() : Infinity;
    const fresh = Number.isFinite(ageMs) && ageMs < 20000;

    $("feedStatus").textContent = latest ? (fresh ? "Live" : "Stale") : "No data";
    $("readingAge").textContent = latest ? humanAge(latest.created_at) : "—";
    $("sampleCount").textContent = String(readings.length);
    $("refreshSeconds").textContent = String(Math.round(cfg.REFRESH_MS / 1000));

    if (!latest) {
      $("healthTitle").textContent = "Waiting for first reading";
      setClassState($("healthIcon"), "neutral");
      return;
    }

    if (fresh) {
      $("healthTitle").textContent = "Monitoring active";
      setClassState($("healthIcon"), "good");
    } else {
      $("healthTitle").textContent = "Feed needs attention";
      setClassState($("healthIcon"), "warn");
    }
  }

  function createChart() {
    const ctx = $("doseChart");
    doseChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Dose rate (µSv/h)",
          data: [],
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.28,
          fill: true,
          borderColor: "#51d3ff",
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(81,211,255,.08)";
            const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, "rgba(81,211,255,.22)");
            g.addColorStop(1, "rgba(81,211,255,0)");
            return g;
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (ctx) => `${Number(ctx.parsed.y).toFixed(3)} µSv/h`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#708398", maxTicksLimit: 7 }
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,.08)" },
            ticks: {
              color: "#708398",
              callback: (v) => `${v}`
            },
            title: {
              display: true,
              text: "µSv/h",
              color: "#708398"
            }
          }
        }
      }
    });
  }

  function renderChart() {
    const subset = readings.slice(0, selectedLimit).slice().reverse();
    const values = subset
      .map(r => Number(r.dose_rate))
      .filter(Number.isFinite);

    doseChart.data.labels = subset.map(r => {
      const d = new Date(r.created_at);
      return Number.isNaN(d.getTime())
        ? ""
        : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    });

    doseChart.data.datasets[0].data = subset.map(r => Number(r.dose_rate));
    doseChart.update();

    const latest = values.length ? values[values.length - 1] : NaN;
    const peak = values.length ? Math.max(...values) : NaN;
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;

    $("chartLatest").textContent = fmt(latest, 3);
    $("chartPeak").textContent = fmt(peak, 3);
    $("chartMean").textContent = fmt(mean, 3);
    $("peakDose").textContent = fmt(peak, 3);
  }

  function renderTable() {
    const body = $("readingsBody");
    const rows = readings.slice(0, 20);

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty-cell">No readings found.</td></tr>`;
      return;
    }

    body.innerHTML = rows.map(row => {
      const warning = Number(row.warning || 0);
      return `
        <tr>
          <td>${escapeHtml(fmtTime(row.created_at))}</td>
          <td>${escapeHtml(row.device_id || "—")}</td>
          <td><strong>${escapeHtml(fmt(row.dose_rate, 3))}</strong> µSv/h</td>
          <td>${escapeHtml(fmt(row.dose, 3))} µSv</td>
          <td>${escapeHtml(fmtInt(row.cps))}</td>
          <td>${escapeHtml(fmtInt(row.cpm))}</td>
          <td>${escapeHtml(fmt(row.average, 3))} µSv/h</td>
          <td>${warning > 0 ? `<span class="danger">Flag ${warning}</span>` : `<span class="good">0</span>`}</td>
        </tr>
      `;
    }).join("");

    $("tableUpdated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function refresh() {
    try {
      $("errorPanel").classList.add("hidden");
      const data = await fetchReadings();
      readings = Array.isArray(data) ? data : [];

      const latest = readings[0] || null;
      renderHero(latest);
      renderHealth(latest);
      renderChart();
      renderTable();

      updateConnectionState(true, latest ? "Supabase connected" : "Connected • no data");
    } catch (error) {
      console.error(error);
      updateConnectionState(false, "Connection error");
      $("errorMessage").textContent = error.message;
      $("errorPanel").classList.remove("hidden");
    }
  }

  function exportCsv() {
    if (!readings.length) return;

    const columns = [
      "created_at", "device_id", "dose_rate", "dose",
      "cps", "cpm", "average", "detector_time",
      "detector_s", "warning"
    ];

    const quote = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.join(","),
      ...readings.map(row => columns.map(c => quote(row[c])).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `radiation-readings-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function initControls() {
    $("refreshButton").addEventListener("click", refresh);
    $("exportButton").addEventListener("click", exportCsv);

    document.querySelectorAll(".range-button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".range-button").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        selectedLimit = Number(button.dataset.range) || cfg.DEFAULT_LIMIT;
        renderChart();
      });
    });
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, cfg.REFRESH_MS);
  }

  createChart();
  initControls();
  refresh();
  startAutoRefresh();
})();
