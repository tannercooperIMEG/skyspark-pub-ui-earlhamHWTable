// earlhamHWTable/components/SiteTable.js
// Renders the demand data grid as a dynamic multi-column table.
// Columns and their display names are driven by grid metadata.
// Columns with a {hidden} marker in their meta are skipped.

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.components = window.earlhamHWTable.components || {};

(function (components) {
  var utils = window.earlhamHWTable.utils;

  // Column whose cells get red-highlighted when the value exceeds the threshold
  var THRESHOLD_COL = 'Max Measured Load Vs. Campus Average Building (%)';
  var THRESHOLD_VAL = 200;

  // Column display names (or substrings) that receive a numeric total in the footer
  function shouldTotal(dis) {
    if (!dis) return false;
    if (dis.indexOf('Building Area') >= 0) return true;
    if (dis === 'Measured Max Load (MBH)') return true;
    if (dis === 'Estimated Maximum Load (MBH)') return true;
    if (dis.indexOf('Measured Max Flow') >= 0) return true;
    if (dis.indexOf('Predicted Max Flow') >= 0) return true;
    return false;
  }

  /** Returns true if a column's meta carries the {hidden} marker. */
  function isHidden(colMeta) {
    if (!colMeta) return false;
    return colMeta.hidden && colMeta.hidden._kind === 'marker';
  }

  /** Extract the raw JS number from a Haystack cell value, or null. */
  function numericVal(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val._kind === 'number') return val.val;
    return null;
  }

  /** Format a Haystack number: 0 decimals for integers, 1 decimal otherwise. */
  function formatNumber(val) {
    if (val === null || val === undefined) return '\u2014';
    var num  = (typeof val === 'object') ? val.val  : val;
    var unit = (typeof val === 'object') ? val.unit : null;
    if (typeof num !== 'number') return String(num);
    var decimals = (Math.abs(num - Math.round(num)) < 0.05) ? 0 : 1;
    return num.toFixed(decimals) + (unit ? '\u00a0' + unit : '');
  }

  /** Extract a display string from a single cell value. */
  function cellText(val, isIdCol) {
    if (val === null || val === undefined) return '\u2014';
    if (isIdCol) {
      if (typeof val === 'object' && val._kind === 'ref') return val.dis || val.val;
      return utils.extractValue(val) || '\u2014';
    }
    if (typeof val === 'object' && val._kind === 'number') return formatNumber(val);
    return String(utils.extractValue(val) || '\u2014');
  }

  /**
   * Render the demand data grid into the given container element.
   *
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object}      gridData  - Haystack grid returned by loadDemandData
   */
  components.renderSiteTable = function (container, gridData) {
    container.innerHTML = '';

    var cols = gridData.cols || [];
    var rows = gridData.rows || [];

    var visibleCols = cols.filter(function (col) {
      return !isHidden(col.meta);
    });

    var table = document.createElement('table');
    table.className = 'hw-site-table';

    // ── Header ───────────────────────────────────────────────────────────────
    var thead     = document.createElement('thead');
    var headerRow = document.createElement('tr');
    visibleCols.forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = (col.meta && col.meta.dis) ? col.meta.dis : col.name;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ── Body ─────────────────────────────────────────────────────────────────
    var tbody = document.createElement('tbody');

    // Pre-initialize totals accumulator for each totalable column
    var totals = {};
    visibleCols.forEach(function (col) {
      if (shouldTotal(col.meta && col.meta.dis)) totals[col.name] = 0;
    });

    if (rows.length === 0) {
      var emptyRow  = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.colSpan     = visibleCols.length;
      emptyCell.textContent = 'No data found.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        visibleCols.forEach(function (col) {
          var td      = document.createElement('td');
          var isIdCol = col.name === 'id';
          var rawVal  = row[col.name];
          var dis     = col.meta && col.meta.dis;

          td.textContent = cellText(rawVal, isIdCol);

          var classes = [];
          if (!isIdCol) classes.push('hw-cell-number');

          // Red highlight when % vs campus average exceeds threshold
          if (dis === THRESHOLD_COL) {
            var n = numericVal(rawVal);
            if (n !== null && n > THRESHOLD_VAL) classes.push('hw-cell-above-threshold');
          }

          if (classes.length) td.className = classes.join(' ');

          // Accumulate total
          if (totals.hasOwnProperty(col.name)) {
            var nv = numericVal(rawVal);
            if (nv !== null) totals[col.name] += nv;
          }

          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);

    // ── Totals footer ─────────────────────────────────────────────────────────
    if (rows.length > 0) {
      var tfoot    = document.createElement('tfoot');
      var totalRow = document.createElement('tr');

      visibleCols.forEach(function (col, idx) {
        var td = document.createElement('td');

        if (idx === 0) {
          td.textContent = 'Total';
          td.className   = 'hw-total-label';
        } else if (totals.hasOwnProperty(col.name)) {
          // Borrow the unit string from the first row that has one
          var unit = null;
          for (var r = 0; r < rows.length; r++) {
            var v = rows[r][col.name];
            if (v && typeof v === 'object' && v._kind === 'number' && v.unit) {
              unit = v.unit;
              break;
            }
          }
          td.textContent = totals[col.name].toFixed(0) + (unit ? '\u00a0' + unit : '');
          td.className   = 'hw-cell-number hw-total-value';
        } else {
          td.textContent = '';
        }

        totalRow.appendChild(td);
      });

      tfoot.appendChild(totalRow);
      table.appendChild(tfoot);
    }

    container.appendChild(table);
  };

})(window.earlhamHWTable.components);
