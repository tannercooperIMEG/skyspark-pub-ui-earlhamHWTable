// earlhamHWTable/evals/loadSites.js
// Axon eval wrapper — fetches all site records sorted by display name

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.evals = window.earlhamHWTable.evals || {};

(function (evals) {
  var utils = window.earlhamHWTable.utils;

  /**
   * Fetch all site records, retaining only the 'dis' column, sorted alphabetically.
   *
   * Axon: readAll(site).reorderCols(["dis"]).sort("dis")
   *
   * @param {string} attestKey   - Session attest key
   * @param {string} projectName - SkySpark project name
   * @returns {Promise<Object>}  - Haystack grid with site rows
   */
  evals.loadSites = function (attestKey, projectName) {
    var axon = 'readAll(site).reorderCols(["dis"]).sort("dis")';
    return utils.evalAxon(axon, attestKey, projectName)
      .then(function (data) {
        return utils.unwrapGrid(data);
      });
  };

})(window.earlhamHWTable.evals);
