import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_NAME = "LivePreviewMonitor";

// Every live monitor node currently in any graph (main graph or subgraph).
const monitors = new Set();
let sawMetadataEvents = false;

/* ---------- helpers ---------- */

function idsOf(meta) {
  return [meta.displayNodeId, meta.realNodeId, meta.nodeId]
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map(String);
}

function matchesFilter(filter, meta) {
  const f = (filter ?? "").trim();
  if (!f) return true;
  // "12" matches "12" and also "5:12" (node 12 inside subgraph node 5)
  return idsOf(meta).some((id) => id === f || id.endsWith(":" + f));
}

/* ---------- per-node monitor ---------- */

function createMonitor(node) {
  const widgetValue = (name) => node.widgets?.find((w) => w.name === name)?.value;

  // --- DOM ---
  const root = document.createElement("div");
  root.style.cssText =
    "display:flex;flex-direction:column;width:100%;height:100%;" +
    "box-sizing:border-box;gap:4px;pointer-events:auto;";

  const stage = document.createElement("div");
  stage.style.cssText =
    "flex:1 1 auto;min-height:0;position:relative;background:#111;" +
    "border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;";

  const img = document.createElement("img");
  img.draggable = false;
  img.style.cssText =
    "display:none;width:100%;height:100%;object-fit:contain;image-rendering:auto;";

  const placeholder = document.createElement("div");
  placeholder.textContent = "Waiting for a sampler preview…";
  placeholder.style.cssText = "color:#777;font:12px sans-serif;padding:8px;text-align:center;";

  const status = document.createElement("div");
  status.style.cssText =
    "flex:0 0 auto;font:11px monospace;color:#999;white-space:nowrap;" +
    "overflow:hidden;text-overflow:ellipsis;";

  stage.append(img, placeholder);
  root.append(stage, status);

  // --- state ---
  const state = {
    counts: new Map(), // previews seen per source node this run
    pending: null, // latest skipped frame, flushed at end of run
    forceNext: false, // set when the sampler reports its last step
    url: null,
    progress: null,
  };

  function setStatus(meta) {
    const p = state.progress;
    const src = meta ? idsOf(meta)[0] : null;
    const parts = [];
    if (p && p.max) parts.push(`step ${p.value}/${p.max}`);
    if (src) parts.push(`node ${src}`);
    const n = Math.max(1, widgetValue("update_every") || 1);
    if (n > 1) parts.push(`every ${n}`);
    status.textContent = parts.join("  ·  ");
  }

  function show(blob, meta) {
    const url = URL.createObjectURL(blob);
    const old = state.url;
    state.url = url;
    img.src = url;
    if (old) URL.revokeObjectURL(old);
    img.style.display = "block";
    placeholder.style.display = "none";
    setStatus(meta);
  }

  const monitor = {
    node,

    push(blob, meta) {
      if (!matchesFilter(widgetValue("source_node_id"), meta)) return;

      const every = Math.max(1, Math.floor(widgetValue("update_every") || 1));
      const key = idsOf(meta)[0] ?? "?";
      const seen = state.counts.get(key) ?? 0;
      state.counts.set(key, seen + 1);

      if (seen % every === 0 || state.forceNext) {
        state.forceNext = false;
        state.pending = null;
        show(blob, meta);
      } else {
        state.pending = { blob, meta };
      }
    },

    onProgress(detail) {
      state.progress = detail;
      if (detail && detail.max && detail.value >= detail.max) state.forceNext = true;
    },

    flush() {
      if (state.pending) {
        show(state.pending.blob, state.pending.meta);
        state.pending = null;
      }
    },

    resetRun() {
      state.counts.clear();
      state.pending = null;
      state.forceNext = false;
      state.progress = null;
    },

    destroy() {
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = null;
    },
  };

  return { monitor, root };
}

/* ---------- extension ---------- */

app.registerExtension({
  name: "LivePreviewMonitor",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_NAME) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);

      // Never send this node to the backend; it's purely a viewer.
      this.isVirtualNode = true;

      const { monitor, root } = createMonitor(this);
      this.__livePreview = monitor;
      monitors.add(monitor);

      this.addDOMWidget("live_preview", "live_preview", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => 160,
      });

      this.setSize([Math.max(this.size?.[0] ?? 0, 400), 460]);
    };

    const onRemoved = nodeType.prototype.onRemoved;
    nodeType.prototype.onRemoved = function () {
      onRemoved?.apply(this, arguments);
      if (this.__livePreview) {
        monitors.delete(this.__livePreview);
        this.__livePreview.destroy();
        this.__livePreview = null;
      }
    };
  },

  setup() {
    // Preferred: carries node ids, works for nodes inside subgraphs.
    api.addEventListener("b_preview_with_metadata", (e) => {
      sawMetadataEvents = true;
      const { blob, ...meta } = e.detail ?? {};
      if (!blob) return;
      for (const m of monitors) m.push(blob, meta);
    });

    // Fallback for older servers that only send plain previews.
    api.addEventListener("b_preview", (e) => {
      if (sawMetadataEvents) return; // already handled above
      const blob = e.detail;
      if (!blob) return;
      for (const m of monitors) m.push(blob, {});
    });

    api.addEventListener("progress", (e) => {
      for (const m of monitors) m.onProgress(e.detail);
    });

    api.addEventListener("execution_start", () => {
      for (const m of monitors) m.resetRun();
    });

    // Make sure the last skipped frame still gets shown when a run ends.
    for (const evt of ["execution_success", "execution_error", "execution_interrupted"]) {
      api.addEventListener(evt, () => {
        for (const m of monitors) m.flush();
      });
    }
  },
});
