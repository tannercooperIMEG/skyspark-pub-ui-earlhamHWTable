// earlhamHWTable/components/SiteTable.js
// Renders the demand data grid as a dynamic multi-column table.
// Columns and their display names are driven by grid metadata.
// Columns with a {hidden} marker in their meta are skipped.

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.components = window.earlhamHWTable.components || {};

(function (components) {
  var utils = window.earlhamHWTable.utils;

  /** Returns true if a column's meta carries the {hidden} marker. */
  function isHidden(colMeta) {
    if (!colMeta) return false;
    return colMeta.hidden && colMeta.hidden._kind === 'marker';
  }

  /** Format a Haystack number value as "X.X unit". */
  function formatNumber(val) {
    if (val === null || val === undefined) return '\u2014';
    var num  = (typeof val === 'object') ? val.val  : val;
    var unit = (typeof val === 'object') ? val.unit : null;
    if (typeof num !== 'number') return String(num);
    return num.toFixed(1) + (unit ? '\u00a0' + unit : '');
  }

  /** Extract a display string from a single cell value. */
  function cellText(val, isIdCol) {
    if (val === null || val === undefined) return '\u2014';
    // id column holds site refs — use the display name
    if (isIdCol) {
      if (typeof val === 'object' && val._kind === 'ref') return val.dis || val.val;
      return utils.extractValue(val) || '\u2014';
    }
    // Haystack number with unit
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

    // Only show columns that are NOT marked hidden
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

    if (rows.length === 0) {
      var emptyRow  = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.colSpan   = visibleCols.length;
      emptyCell.textContent = 'No data found.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        visibleCols.forEach(function (col) {
          var td      = document.createElement('td');
          var isIdCol = col.name === 'id';
          td.textContent = cellText(row[col.name], isIdCol);
          if (!isIdCol) td.className = 'hw-cell-number';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    container.appendChild(table);
  };

})(window.earlhamHWTable.components);
