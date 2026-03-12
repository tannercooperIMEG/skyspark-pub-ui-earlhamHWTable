// earlhamHWTable/earlhamHWTableHandler.js
//
// Main handler module — orchestrates stylesheet injection, variable reading,
// data loading, and table rendering. Loaded dynamically by earlhamHWTableEntry.js.
//
// At startup this file exposes window.earlhamHWTableApp, which the entry
// file delegates to. The name MUST differ from the entry file's jsHandler
// global ("earlhamHWTableHandler") to avoid collision.
//
// Re-render behaviour:
//   onUpdate is called by SkySpark on every view refresh (including variable
//   changes). The DOM scaffold is built once; refreshData is called on every
//   onUpdate so variable changes always trigger a new fetch. A fetch-generation
//   counter ensures stale in-flight responses are silently discarded.

window.earlhamHWTable = window.earlhamHWTable || {};

(function (app) {
  var utils      = window.earlhamHWTable.utils;
  var evals      = window.earlhamHWTable.evals;
  var components = window.earlhamHWTable.components;

  var APP_ID   = 'earlhamHWTable-root';
  var CSS_ID   = 'earlhamHWTable-styles';
  var CSS_PATH = '/pub/ui/earlhamHWTable/earlhamHWTableStyles.css';

  // Incremented on every new fetch; callbacks compare against this to discard
  // responses that were superseded by a later variable change.
  var _fetchGen = 0;

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Inject the stylesheet once, idempotently. */
  function loadStyles() {
    if (document.getElementById(CSS_ID)) return;
    var link  = document.createElement('link');
    link.id   = CSS_ID;
    link.rel  = 'stylesheet';
    link.href = CSS_PATH;
    document.head.appendChild(link);
  }

  /**
   * Safely read a named variable from the SkySpark view (or its parent).
   * Logs the raw value and any exception for diagnostics.
   * Returns the Axon string representation, or null if not set.
   */
  function tryReadVar(view, varName) {
    try {
      var val = view.get(varName);
      console.log('[earlhamHWTable] tryReadVar', varName, '->', val,
                  '| type:', typeof val,
                  '| toStr?', !!(val && val.toStr),
                  '| toAxon?', !!(val && val.toAxon));
      if (val == null) return null;
      if (val.toAxon) return val.toAxon();   // prefer Axon encoding if available
      if (val.toStr)  return val.toStr();
      return String(val);
    } catch (e) {
      console.log('[earlhamHWTable] tryReadVar', varName, 'threw:', e.message);
    }
    return null;
  }

  /**
   * Clear tableContainer, show a loading indicator, fetch data, then render.
   * Skips the fetch entirely if the targets+dates key matches the last
   * successful fetch — prevents redundant API calls when SkySpark fires
   * onUpdate multiple times for the same view state.
   * Uses a generation counter so stale in-flight responses are discarded.
   */
  function refreshData(tableContainer, attestKey, projectName, targets, dates) {
    var fetchKey = targets + '\x00' + dates;
    if (tableContainer.getAttribute('data-fetch-key') === fetchKey) {
      return; // same parameters already fetched — skip
    }
    tableContainer.setAttribute('data-fetch-key', fetchKey);

    var gen = ++_fetchGen;

    tableContainer.innerHTML = '';
    var loadingEl = document.createElement('div');
    loadingEl.className   = 'hw-table-loading';
    loadingEl.textContent = 'Loading\u2026';
    tableContainer.appendChild(loadingEl);

    evals.loadDemandData(attestKey, projectName, targets, dates)
      .then(function (result) {
        if (gen !== _fetchGen) return; // superseded — discard
        tableContainer.removeChild(loadingEl);
        components.renderSiteTable(tableContainer, result.siteGrid, result.totalsGrid);
      })
      .catch(function (err) {
        if (gen !== _fetchGen) return;
        tableContainer.removeChild(loadingEl);
        var errEl = document.createElement('div');
        errEl.className   = 'hw-table-error';
        errEl.textContent = 'Error loading data: ' + err.message;
        tableContainer.appendChild(errEl);
        console.error('[earlhamHWTable] Error:', err);
      });
  }

  // ── Public handler ─────────────────────────────────────────────────────────

  /**
   * Entry point called by SkySpark (via the entry file stub) on each view update.
   * Called on first load and whenever any view variable changes.
   *
   * The scaffold (title + tableContainer) is built once on the first call.
   * refreshData is called on every onUpdate so that variable changes always
   * trigger a re-fetch. The _fetchGen counter in refreshData discards any
   * in-flight responses that were superseded by a later call.
   *
   * @param {Object} arg - SkySpark view argument ({ view, elem })
   */
  app.onUpdate = function (arg) {
    var view = arg.view;
    var elem = arg.elem;

    loadStyles();

    // Force elem to fill the SkySpark view pane
    elem.style.width  = '100%';
    elem.style.height = '100%';

    // ── One-time API diagnostic ───────────────────────────────────────────────
    // Dumps the structure of arg and view so we can find the right variable path.
    // Remove once variable reading is confirmed working.
    if (!window._hwTableDiagDone) {
      window._hwTableDiagDone = true;
      try {
        console.log('[HW DIAG] arg keys:', Object.keys(arg || {}));
        var proto = Object.getPrototypeOf(view);
        console.log('[HW DIAG] view proto methods:',
          Object.getOwnPropertyNames(proto || {}).filter(function(k){ return k !== 'constructor'; }));
        var tryGet = function(label, fn) {
          try { var v = fn(); console.log('[HW DIAG]', label, '->', v); }
          catch(e) { console.log('[HW DIAG]', label, 'threw:', e.message); }
        };
        tryGet('view.rec',         function(){ return view.rec; });
        tryGet('view.model',       function(){ return view.model; });
        tryGet('view.vars()',      function(){ return view.vars(); });
        tryGet('view.cur()',       function(){ return view.cur(); });
        tryGet('view.data()',      function(){ return view.data(); });
        tryGet('view.ctx()',       function(){ return view.ctx(); });
        tryGet('view.nav()',       function(){ return view.nav(); });
        tryGet('arg.model',        function(){ return arg.model; });
        tryGet('arg.vars',         function(){ return arg.vars; });
        tryGet('arg.ctx',          function(){ return arg.ctx; });
        var sess = view.session();
        var sessProto = Object.getPrototypeOf(sess);
        console.log('[HW DIAG] session proto methods:',
          Object.getOwnPropertyNames(sessProto || {}).filter(function(k){ return k !== 'constructor'; }));
        tryGet('session.nav()',    function(){ return sess.nav(); });
        tryGet('session.ctx()',    function(){ return sess.ctx(); });
        tryGet('session.dates()',  function(){ return sess.dates(); });
      } catch(diagErr) {
        console.log('[HW DIAG] diagnostic threw:', diagErr.message);
      }
    }
    // ── End diagnostic ────────────────────────────────────────────────────────

    // ── Session credentials ──────────────────────────────────────────────────
    var session     = view.session();
    var attestKey   = session.attestKey();
    var projectName = session.proj().name();

    // ── View variables ───────────────────────────────────────────────────────
    // targets: equipment set ref (e.g. "@nav:equip.all")
    // dates:   date range expression (e.g. "pastMonth" or "2025-01-01..2025-01-31")
    var parentView = null;
    try { parentView = view.parent(); } catch (e) {}

    var targets = tryReadVar(view, 'targets') || (parentView && tryReadVar(parentView, 'targets')) || '@nav:equip.all';
    var dates   = tryReadVar(view, 'dates')   || (parentView && tryReadVar(parentView, 'dates'))   || 'pastMonth';

    console.log('[earlhamHWTable] onUpdate — targets:', targets, '| dates:', dates);

    // ── Build scaffold once, then always refresh data ─────────────────────────
    var root = elem.querySelector('#' + APP_ID);
    var tableContainer;

    if (!root) {
      root    = document.createElement('div');
      root.id = APP_ID;
      elem.appendChild(root);

      var title = document.createElement('div');
      title.className   = 'hw-table-title';
      title.textContent = 'Hot Water Meter \u2014 95% Demand Values';
      root.appendChild(title);

      tableContainer = document.createElement('div');
      tableContainer.className = 'hw-table-container';
      root.appendChild(tableContainer);
    } else {
      tableContainer = root.querySelector('.hw-table-container');
    }

    refreshData(tableContainer, attestKey, projectName, targets, dates);
  };

})(window.earlhamHWTable);

// Expose the app global that the entry file delegates to.
// CRITICAL: must differ from the entry file's jsHandler global name.
window.earlhamHWTableApp = window.earlhamHWTable;
console.log('[earlhamHWTable] Handler ready. window.earlhamHWTableApp exposed.');
