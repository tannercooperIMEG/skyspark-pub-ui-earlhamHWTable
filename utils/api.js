// earlhamHWTable/utils/api.js
// Utility functions for SkySpark Haystack API calls

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.utils = window.earlhamHWTable.utils || {};

(function (utils) {

  /**
   * Execute an Axon expression via the SkySpark eval endpoint.
   * Returns a Promise resolving to parsed JSON.
   *
   * @param {string} axonExpr    - Axon expression to evaluate
   * @param {string} attestKey   - Session attest key from view.session().attestKey()
   * @param {string} projectName - Project name from view.session().proj().name()
   * @returns {Promise<Object>}
   */
  utils.evalAxon = function (axonExpr, attestKey, projectName) {
    var body = 'ver: "3.0"\nexpr\n"' + axonExpr.replace(/"/g, '\\"') + '"';
    return fetch('/api/' + projectName + '/eval', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/zinc',
        'Accept': 'application/json',
        'Attest-Key': attestKey
      },
      body: body
    }).then(function (r) { return r.json(); });
  };

  /**
   * Unwrap a nested grid returned from the eval endpoint.
   * The endpoint sometimes wraps results in a single-row grid with a 'val' column.
   *
   * @param {Object} data - Raw JSON response from evalAxon
   * @returns {Object}    - Unwrapped Haystack grid
   */
  utils.unwrapGrid = function (data) {
    if (
      data.rows && data.rows.length === 1 &&
      data.cols && data.cols.length === 1 &&
      data.cols[0].name === 'val'
    ) {
      var inner = data.rows[0].val;
      if (inner && inner.rows && inner.cols) {
        return inner;
      }
    }
    return data;
  };

  /**
   * Extract the plain JavaScript value from a Haystack-wrapped value object.
   *
   * @param {*} val - Raw value from Haystack JSON (may be wrapped with _kind)
   * @returns {*}   - Unwrapped plain value
   */
  utils.extractValue = function (val) {
    if (!val) return null;
    if (val._kind === 'number') return val.val;
    if (val._kind === 'dateTime') return val.val;
    if (val._kind === 'ref') return val.dis || val.val;
    if (val.val !== undefined) return val.val;
    return val;
  };

})(window.earlhamHWTable.utils);
