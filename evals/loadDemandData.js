// earlhamHWTable/evals/loadDemandData.js
// Axon eval wrapper — fetches 95th-percentile HW demand values for all sites,
// plus the pre-calculated campus-wide totals row (mode 2).

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.evals = window.earlhamHWTable.evals || {};

(function (evals) {
  var utils = window.earlhamHWTable.utils;

  /**
   * Unwrap and validate a grid returned from evalAxon.
   * Throws if the response is a SkySpark error grid.
   *
   * @param {Object} data - Raw JSON response
   * @param {string} label - Label used in error/log messages
   * @returns {Object} Unwrapped Haystack grid
   */
  function unwrapAndCheck(data, label) {
    var grid = utils.unwrapGrid(data);
    if (grid.meta && grid.meta.err) {
      var msg = (grid.meta.dis) ? String(grid.meta.dis) : 'SkySpark returned an error grid';
      throw new Error('[' + label + '] ' + msg);
    }
    return grid;
  }

  /**
   * Fetch hot water demand stats for all sites.
   *
   * Makes two parallel eval calls:
   *   1. report_demandValCalcs_allSites(targets, dates)
   *      → per-site detail rows
   *   2. report_demandValCalcs_allSites(targets, dates, 2)
   *      → single-row campus totals grid with columns:
   *        totalMeasuredMaxLoad, totalEstimatedMaximumLoad,
   *        totalActualHwFlow, totalEstimatedHwFlow
   *
   * @param {string} attestKey   - Session attest key
   * @param {string} projectName - SkySpark project name
   * @param {string} targets     - Axon expression for equipment set
   * @param {string} dates       - Axon expression for date range
   * @returns {Promise<{siteGrid: Object, totalsGrid: Object}>}
   */
  evals.loadDemandData = function (attestKey, projectName, targets, dates) {
    var siteAxon   = 'report_demandValCalcs_allSites(' + targets + ', ' + dates + ')';
    var totalsAxon = 'report_demandValCalcs_allSites(' + targets + ', ' + dates + ', 2)';

    console.log('[earlhamHWTable] Eval (site):', siteAxon);
    console.log('[earlhamHWTable] Eval (totals):', totalsAxon);

    return Promise.all([
      utils.evalAxon(siteAxon,   attestKey, projectName),
      utils.evalAxon(totalsAxon, attestKey, projectName)
    ]).then(function (results) {
      var siteGrid   = unwrapAndCheck(results[0], 'siteGrid');
      var totalsGrid = unwrapAndCheck(results[1], 'totalsGrid');

      console.log('[earlhamHWTable] Site grid cols:',
        (siteGrid.cols || []).map(function (c) { return c.name; }),
        '| rows:', (siteGrid.rows || []).length);
      console.log('[earlhamHWTable] Totals row:', totalsGrid.rows && totalsGrid.rows[0]);

      return { siteGrid: siteGrid, totalsGrid: totalsGrid };
    });
  };

})(window.earlhamHWTable.evals);
