// earlhamHWTable/earlhamHWTableHandler.js
//
// Main handler module — orchestrates stylesheet injection, data loading,
// and table rendering. Loaded dynamically by earlhamHWTableEntry.js.
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

    // ── Session credentials ──────────────────────────────────────────────────
    var session     = view.session();
    var attestKey   = session.attestKey();
    var projectName = session.proj().name();

    // ── DOM scaffold ─────────────────────────────────────────────────────────
    var root = document.createElement('div');
    root.id  = APP_ID;
    elem.appendChild(root);

    var title = document.createElement('div');
    title.className   = 'hw-table-title';
    title.textContent = 'Hot Water Meter — Sites';
    root.appendChild(title);

    var loadingEl = document.createElement('div');
    loadingEl.className   = 'hw-table-loading';
    loadingEl.textContent = 'Loading sites\u2026';
    root.appendChild(loadingEl);

    var tableContainer = document.createElement('div');
    root.appendChild(tableContainer);

    // ── Data fetch → render ───────────────────────────────────────────────────
    evals.loadSites(attestKey, projectName)
      .then(function (gridData) {
        root.removeChild(loadingEl);
        components.renderSiteTable(tableContainer, gridData);
      })
      .catch(function (err) {
        root.removeChild(loadingEl);
        var errEl = document.createElement('div');
        errEl.className   = 'hw-table-error';
        errEl.textContent = 'Error loading sites: ' + err.message;
        root.appendChild(errEl);
        console.error('[earlhamHWTable] Error loading sites:', err);
      });
  };

})(window.earlhamHWTable);

// Expose the app global that the entry file delegates to.
// CRITICAL: must differ from the entry file's jsHandler global name.
window.earlhamHWTableApp = window.earlhamHWTable;
console.log('[earlhamHWTable] Handler ready. window.earlhamHWTableApp exposed.');
