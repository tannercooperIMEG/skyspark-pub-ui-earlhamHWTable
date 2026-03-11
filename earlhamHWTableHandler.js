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
//   changes). The handler compares current targets/dates against the values
//   stored on the root element; it only re-fetches when they differ.
//   A fetch-generation counter ensures stale in-flight responses are discarded
//   if variables change again before the first request completes.

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
   * Returns the Axon string representation, or null if not set.
   */
  function tryReadVar(view, varName) {
    try {
      var val = view.get(varName);
      if (val) return val.toStr ? val.toStr() : String(val);
    } catch (e) {}
    return null;
  }

  /**
   * Clear tableContainer, show a loading indicator, fetch data, then render.
   * Uses a generation counter so stale responses from superseded fetches are
   * silently discarded.
   */
  function refreshData(tableContainer, attestKey, projectName, targets, dates) {
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
   * @param {Object} arg - SkySpark view argument ({ view, elem })
   */
  app.onUpdate = function (arg) {
    var view = arg.view;
    var elem = arg.elem;

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

    console.log('[earlhamHWTable] onUpdate — targets:', targets, '| dates:', dates);

    var root = elem.querySelector('#' + APP_ID);

    if (root) {
      // ── Subsequent call — check if variables changed ──────────────────────
      if (root.getAttribute('data-targets') === targets &&
          root.getAttribute('data-dates')   === dates) {
        return; // nothing changed; skip redundant fetch
      }
      console.log('[earlhamHWTable] Variables changed — re-fetching data.');
      root.setAttribute('data-targets', targets);
      root.setAttribute('data-dates',   dates);
      refreshData(root.querySelector('.hw-table-container'),
                  attestKey, projectName, targets, dates);
      return;
    }

    // ── First render — build DOM scaffold ────────────────────────────────────
    root    = document.createElement('div');
    root.id = APP_ID;
    root.setAttribute('data-targets', targets);
    root.setAttribute('data-dates',   dates);
    elem.appendChild(root);

    var title = document.createElement('div');
    title.className   = 'hw-table-title';
    title.textContent = 'Hot Water Meter \u2014 95% Demand Values';
    root.appendChild(title);

    var tableContainer = document.createElement('div');
    tableContainer.className = 'hw-table-container';
    root.appendChild(tableContainer);

    refreshData(tableContainer, attestKey, projectName, targets, dates);
  };

})(window.earlhamHWTable);

// Expose the app global that the entry file delegates to.
// CRITICAL: must differ from the entry file's jsHandler global name.
window.earlhamHWTableApp = window.earlhamHWTable;
console.log('[earlhamHWTable] Handler ready. window.earlhamHWTableApp exposed.');
