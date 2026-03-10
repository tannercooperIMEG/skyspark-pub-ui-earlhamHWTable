// earlhamHWTable/evals/loadDemandData.js
// Axon eval wrapper — fetches 95th-percentile HW demand values for all sites

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.evals = window.earlhamHWTable.evals || {};

(function (evals) {
  var utils = window.earlhamHWTable.utils;

  /**
   * Fetch hot water demand stats for all sites using the report function.
   *
   * Axon: report_demandValCalcs_allSites(targets, dates)
   *
   * Returns a grid with columns: id (Site ref), point1 (HW Demand),
   * point2 (HW Flow), point3 (HW RT - hidden), point4 (HW ST - hidden).
   * Hidden columns carry a {hidden} marker in their col meta.
   *
   * @param {string} attestKey   - Session attest key
   * @param {string} projectName - SkySpark project name
   * @param {string} targets     - Axon expression for equipment set (e.g. "@nav:equip.all")
   * @param {string} dates       - Axon expression for date range (e.g. "pastMonth")
   * @returns {Promise<Object>}  - Haystack grid
   */
  evals.loadDemandData = function (attestKey, projectName, targets, dates) {
    var axon = 'report_demandValCalcs_allSites(' + targets + ', ' + dates + ')';
    console.log('[earlhamHWTable] Eval:', axon);
    return utils.evalAxon(axon, attestKey, projectName)
      .then(function (data) {
        console.log('[earlhamHWTable] Raw response:', JSON.stringify(data));
        var grid = utils.unwrapGrid(data);
        // SkySpark returns error grids with {err} in meta instead of throwing
        if (grid.meta && grid.meta.err) {
          var msg = (grid.meta.dis) ? String(grid.meta.dis) : 'SkySpark returned an error grid';
          throw new Error(msg);
        }
        console.log('[earlhamHWTable] Grid cols:', (grid.cols || []).map(function(c){return c.name;}),
                    '| rows:', (grid.rows || []).length);
        return grid;
      });
  };

})(window.earlhamHWTable.evals);
