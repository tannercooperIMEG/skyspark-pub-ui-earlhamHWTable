// earlhamHWTable/components/SiteTable.js
// Renders the demand data grid as a dynamic multi-column table.
// Columns and their display names are driven by grid metadata.
// Columns with a {hidden} marker in their meta are skipped.
//
// Special column meta recognised by this renderer:
//   total          {marker}  — include this column in the totals footer row
//   highlightAbove {Number}  — highlight cells whose value exceeds this number in red

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.components = window.earlhamHWTable.components || {};

(function (components) {
  var utils = window.earlhamHWTable.utils;

  /** Returns true if a column's meta carries the {hidden} marker. */
  function isHidden(colMeta) {
    if (!colMeta) return false;
    return colMeta.hidden && colMeta.hidden._kind === 'marker';
  }

  /** Returns true if a column's meta carries the {total} marker. */
  function hasTotal(colMeta) {
    if (!colMeta) return false;
    return colMeta.total && colMeta.total._kind === 'marker';
  }

  /**
   * Returns the numeric threshold for red-highlighting from col meta, or null.
   * Reads col.meta.highlightAbove (Haystack Number or plain JS number).
   */
  function getHighlightAbove(colMeta) {
    if (!colMeta || colMeta.highlightAbove === undefined || colMeta.highlightAbove === null) return null;
    return numericVal(colMeta.highlightAbove);
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

    // Diagnostic: log column names and their dis values
    console.log('[earlhamHWTable] Visible columns:',
      visibleCols.map(function (col) {
        return col.name + ' -> "' + ((col.meta && col.meta.dis) || '(no dis)') + '"' +
               (hasTotal(col.meta) ? ' [total]' : '') +
               (getHighlightAbove(col.meta) !== null ? ' [highlightAbove:' + getHighlightAbove(col.meta) + ']' : '');
      }));

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
    var tbody  = document.createElement('tbody');
    var totals = {};

    // Pre-initialize totals accumulator for columns marked with {total}
    visibleCols.forEach(function (col) {
      if (hasTotal(col.meta)) totals[col.name] = 0;
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
          var td             = document.createElement('td');
          var isIdCol        = col.name === 'id';
          var rawVal         = row[col.name];
          var highlightAbove = getHighlightAbove(col.meta);

          td.textContent = cellText(rawVal, isIdCol);

          var classes = [];
          if (!isIdCol) classes.push('hw-cell-number');

          // Red highlight when value exceeds the column's highlightAbove threshold
          if (highlightAbove !== null) {
            var n = numericVal(rawVal);
            if (n !== null && n > highlightAbove) classes.push('hw-cell-above-threshold');
          }

          if (classes.length) td.className = classes.join(' ');

          // Accumulate totals
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
    if (rows.length > 0 && Object.keys(totals).length > 0) {
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
