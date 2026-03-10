// earlhamHWTable/components/SiteTable.js
// Renders the demand data grid as a dynamic multi-column table.
// Columns and their display names are driven by grid metadata.
// Columns with a {hidden} marker in their meta are skipped.
//
// Cell background colors are read from gridData.meta.presentation, a sub-grid
// with columns {col, row, background} that maps 0-based row indices and column
// names to CSS color strings.
//
// Columns with a {total} marker in their col meta are summed in a footer row.
// Both Haystack Number objects and pre-formatted strings ("1,667") are parsed.

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
   * Extract a numeric value for totalling purposes.
   * Handles: plain JS number, Haystack {_kind:"number"}, and pre-formatted
   * strings like "1,667" or "136,139" by stripping commas before parsing.
   */
  function parseNumericVal(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val._kind === 'number') return val.val;
    if (typeof val === 'string') {
      var cleaned = val.replace(/,/g, '').replace(/[^\d.\-]/g, '');
      var n = parseFloat(cleaned);
      return isNaN(n) ? null : n;
    }
    return null;
  }

  /**
   * Build a cell-color lookup from gridData.meta.presentation.
   * The presentation sub-grid has rows like:
   *   { col: "columnName", row: 9, background: "red" }
   * Returns: { rowIndex: { colName: cssColorStr } }
   */
  function buildCellColors(gridData) {
    var colors = {};
    var pres = gridData.meta && gridData.meta.presentation;
    if (!pres || !pres.rows) return colors;
    pres.rows.forEach(function (pRow) {
      var rowIdx = pRow.row;
      var colName = pRow.col;
      var bg      = pRow.background;
      if (rowIdx === undefined || rowIdx === null || !colName || !bg) return;
      if (!colors[rowIdx]) colors[rowIdx] = {};
      colors[rowIdx][colName] = bg;
    });
    return colors;
  }

  /** Format a Haystack number object for display. */
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
      return String(utils.extractValue(val) || '\u2014');
    }
    // Haystack Number object — format with unit
    if (typeof val === 'object' && val._kind === 'number') return formatNumber(val);
    // Pre-formatted strings ("136,139", "17.2 %") — pass through as-is
    if (typeof val === 'string') return val;
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

    // Build per-cell background color map from presentation metadata
    var cellColors = buildCellColors(gridData);

    // Diagnostic: log visible columns and any presentation entries
    console.log('[earlhamHWTable] Visible columns:',
      visibleCols.map(function (col) {
        return col.name + ':' + ((col.meta && col.meta.dis) || '?') +
               (hasTotal(col.meta) ? ' [total]' : '');
      }));
    if (Object.keys(cellColors).length) {
      console.log('[earlhamHWTable] Presentation cell colors:', cellColors);
    }

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
      rows.forEach(function (row, rowIdx) {
        var tr = document.createElement('tr');

        visibleCols.forEach(function (col) {
          var td      = document.createElement('td');
          var isIdCol = col.name === 'id';
          var rawVal  = row[col.name];

          td.textContent = cellText(rawVal, isIdCol);
          if (!isIdCol) td.className = 'hw-cell-number';

          // Apply background color from presentation grid (no JS threshold logic)
          var bgColor = cellColors[rowIdx] && cellColors[rowIdx][col.name];
          if (bgColor) {
            td.style.backgroundColor = bgColor;
            td.style.color           = '#ffffff';
            td.style.fontWeight      = '700';
          }

          // Accumulate totals — parses both Haystack Numbers and "1,667" strings
          if (totals.hasOwnProperty(col.name)) {
            var nv = parseNumericVal(rawVal);
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
          td.textContent = totals[col.name].toLocaleString(undefined, { maximumFractionDigits: 0 });
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
