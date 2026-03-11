// earlhamHWTable/earlhamHWTableHandler.js
//
// Main handler module — orchestrates stylesheet injection, variable reading,
// data loading, and table rendering. Loaded dynamically by earlhamHWTableEntry.js.
//
// At startup this file exposes window.earlhamHWTableApp, which the entry
// file delegates to. The name MUST differ from the entry file's jsHandler
// global ("earlhamHWTableHandler") to avoid collision.

window.earlhamHWTable = window.earlhamHWTable || {};

(function (app) {
  var utils      = window.earlhamHWTable.utils;
  var evals      = window.earlhamHWTable.evals;
  var components = window.earlhamHWTable.components;

  var APP_ID   = 'earlhamHWTable-root';
  var CSS_ID   = 'earlhamHWTable-styles';
  var CSS_PATH = '/pub/ui/earlhamHWTable/earlhamHWTableStyles.css';

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
   * Returns the Axon string representation, or null if not set.
   */
  function tryReadVar(view, varName) {
    try {
      var val = view.get(varName);
      if (val) return val.toStr ? val.toStr() : String(val);
    } catch (e) {}
    return null;
  }

  // ── Public handler ─────────────────────────────────────────────────────────

  /**
   * Entry point called by SkySpark (via the entry file stub) on each view update.
   *
   * @param {Object} arg - SkySpark view argument ({ view, elem })
   */
  app.onUpdate = function (arg) {
    var view = arg.view;
    var elem = arg.elem;

    // Prevent duplicate initialization on re-render
    if (elem.querySelector('#' + APP_ID)) return;

    loadStyles();

    // Force elem to fill the SkySpark view pane
    elem.style.width  = '100%';
    elem.style.height = '100%';

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

    console.log('[earlhamHWTable] targets:', targets, '| dates:', dates);

    // ── DOM scaffold ─────────────────────────────────────────────────────────
    var root = document.createElement('div');
    root.id  = APP_ID;
    elem.appendChild(root);

    var title = document.createElement('div');
    title.className   = 'hw-table-title';
    title.textContent = 'Hot Water Meter \u2014 95% Demand Values';
    root.appendChild(title);

    var loadingEl = document.createElement('div');
    loadingEl.className   = 'hw-table-loading';
    loadingEl.textContent = 'Loading\u2026';
    root.appendChild(loadingEl);

    var tableContainer = document.createElement('div');
    root.appendChild(tableContainer);

    // ── Data fetch \u2192 render ───────────────────────────────────────────────────
    evals.loadDemandData(attestKey, projectName, targets, dates)
      .then(function (gridData) {
        root.removeChild(loadingEl);
        components.renderSiteTable(tableContainer, gridData);
      })
      .catch(function (err) {
        root.removeChild(loadingEl);
        var errEl = document.createElement('div');
        errEl.className   = 'hw-table-error';
        errEl.textContent = 'Error loading data: ' + err.message;
        root.appendChild(errEl);
        console.error('[earlhamHWTable] Error:', err);
      });
  };

})(window.earlhamHWTable);

// Expose the app global that the entry file delegates to.
// CRITICAL: must differ from the entry file's jsHandler global name.
window.earlhamHWTableApp = window.earlhamHWTable;
console.log('[earlhamHWTable] Handler ready. window.earlhamHWTableApp exposed.');
