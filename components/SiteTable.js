// earlhamHWTable/components/SiteTable.js
// Renders the demand data grid as a dynamic multi-column table.
// Columns and their display names are driven by grid metadata.
// Columns with a {hidden} marker in their meta are skipped.
//
// Special column meta recognised by this renderer:
//   total          {marker}  — include this column in the totals footer row
//   background     {Str}     — CSS color to apply to cells in this column.
//                              Applied unconditionally unless highlightAbove
//                              is also set, in which case only cells whose
//                              value exceeds that threshold are coloured.
//   highlightAbove {Number}  — numeric threshold for background activation

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
   * Returns the numeric threshold from col.meta.highlightAbove, or null.
   * Accepts both a plain JS number and a Haystack {_kind:"number"} object.
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

    // Diagnostic: log column names, dis values, and any special meta flags
    console.log('[earlhamHWTable] Visible columns:',
      visibleCols.map(function (col) {
        var meta = col.meta || {};
        var info = col.name + ' -> "' + (meta.dis || '(no dis)') + '"';
        if (hasTotal(meta)) info += ' [total]';
        if (typeof meta.background === 'string') {
          info += ' [bg:' + meta.background;
          var thresh = getHighlightAbove(meta);
          if (thresh !== null) info += ' above ' + thresh;
          info += ']';
        }
        return info;
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
          var td      = document.createElement('td');
          var isIdCol = col.name === 'id';
          var rawVal  = row[col.name];
          var meta    = col.meta || {};

          td.textContent = cellText(rawVal, isIdCol);
          if (!isIdCol) td.className = 'hw-cell-number';

          // Apply background color from col.meta.background, optionally gated
          // by col.meta.highlightAbove (only colour cells that exceed threshold)
          var bgColor        = typeof meta.background === 'string' ? meta.background : null;
          var highlightAbove = getHighlightAbove(meta);

          if (bgColor !== null) {
            var applyBg = false;
            if (highlightAbove !== null) {
              // Conditional: only when cell value exceeds threshold
              var n = numericVal(rawVal);
              if (n !== null && n > highlightAbove) applyBg = true;
            } else {
              // Unconditional: colour every cell in this column
              applyBg = true;
            }
            if (applyBg) {
              td.style.backgroundColor = bgColor;
              td.style.color           = '#ffffff';
              td.style.fontWeight      = '700';
            }
          }

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
