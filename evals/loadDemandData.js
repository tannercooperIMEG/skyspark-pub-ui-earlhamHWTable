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
    return utils.evalAxon(axon, attestKey, projectName)
      .then(function (data) {
        return utils.unwrapGrid(data);
      });
  };

})(window.earlhamHWTable.evals);
