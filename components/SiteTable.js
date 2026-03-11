// earlhamHWTable/components/SiteTable.js
// Renders the demand data grid as a dynamic multi-column table.
// Columns and their display names are driven by grid metadata.
//
// Supported col meta markers / fields:
//   {hidden}          — column is not rendered
//   {total}           — column is summed; value appears in KPI cards above the table
//   {emphasis}        — column header gets an orange accent, cells are bolded
//   doc: "string"     — info icon (ⓘ) appears in header with a hover tooltip
//
// Cell background colors are read from gridData.meta.presentation, a sub-grid
// with columns {col, row, background} that maps 0-based row indices and column
// names to CSS color strings.
//
// Both Haystack Number objects and pre-formatted strings ("1,667") are parsed
// for numeric operations (KPI totals).

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

  /** Returns true if a column's meta carries the {emphasis} marker. */
  function isEmphasis(colMeta) {
    if (!colMeta) return false;
    return colMeta.emphasis && colMeta.emphasis._kind === 'marker';
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

  // ── Tooltip portal ────────────────────────────────────────────────────────
  // Appended to document.body so it escapes sticky-header stacking contexts
  // and overflow:auto/hidden on scroll wrappers.
  var _tooltipPortal = null;

  function getTooltipPortal() {
    if (_tooltipPortal) return _tooltipPortal;
    _tooltipPortal = document.createElement('div');
    _tooltipPortal.className = 'hw-tooltip-portal';
    _tooltipPortal.style.display = 'none';
    document.body.appendChild(_tooltipPortal);
    return _tooltipPortal;
  }

  function showTooltip(text, anchor) {
    var tip = getTooltipPortal();
    tip.textContent = text;
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';

    var rect     = anchor.getBoundingClientRect();
    var tipW     = tip.offsetWidth  || 210;
    var tipH     = tip.offsetHeight || 40;
    var left     = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - tipW - 4));
    var top      = rect.top - tipH - 10;
    if (top < 4) top = rect.bottom + 10; // fallback: open below if no room above

    tip.style.left       = left + 'px';
    tip.style.top        = top  + 'px';
    tip.style.visibility = 'visible';
  }

  function hideTooltip() {
    if (_tooltipPortal) _tooltipPortal.style.display = 'none';
  }
  // ── End tooltip portal ────────────────────────────────────────────────────

  // Display labels for the campus-wide KPI cards, keyed by totals-grid column name.
  var KPI_LABELS = {
    totalMeasuredMaxLoad:      'Measured Peak Load',
    totalEstimatedMaximumLoad: 'Estimated Max Load',
    totalActualHwFlow:         'Actual HW Flow',
    totalEstimatedHwFlow:      'Estimated HW Flow'
  };

  /**
   * Render KPI summary cards from the pre-calculated campus totals grid
   * (report_demandValCalcs_allSites called with mode 2).
   *
   * @param {HTMLElement} container   - Parent element to append the strip to
   * @param {Object}      totalsGrid  - Single-row Haystack grid with campus totals
   */
  function renderKpiCards(container, totalsGrid) {
    if (!totalsGrid || !totalsGrid.rows || !totalsGrid.rows.length) return;

    var totalsRow = totalsGrid.rows[0];
    var cols      = totalsGrid.cols || [];
    if (!cols.length) return;

    var strip = document.createElement('div');
    strip.className = 'hw-kpi-strip';

    cols.forEach(function (col) {
      var rawVal = totalsRow[col.name];
      var nv     = parseNumericVal(rawVal);
      if (nv === null) return;   // skip non-numeric columns

      var card = document.createElement('div');
      card.className = 'hw-kpi-card';

      var valueEl = document.createElement('div');
      valueEl.className = 'hw-kpi-value';
      valueEl.textContent = nv.toLocaleString(undefined, { maximumFractionDigits: 0 });

      var labelEl = document.createElement('div');
      labelEl.className = 'hw-kpi-label';
      labelEl.textContent = KPI_LABELS[col.name] || col.name;

      card.appendChild(valueEl);
      card.appendChild(labelEl);
      strip.appendChild(card);
    });

    container.appendChild(strip);
  }

  // ── PLACEHOLDER CONFIG ───────────────────────────────────────────────────
  // Temporary: applied when Axon col meta doesn't carry {total} / doc yet.
  // Remove once report_demandValCalcs_allSites returns real markers.
  // Keys are column names; values mirror what Axon meta will eventually provide.
  var PLACEHOLDER_META = {
    id: {
      dis: 'Site'
    },
    percOfCampusSF: {
      dis: 'Campus SF %',
      doc: 'This building\'s conditioned area as a percentage of total campus square footage.'
    },
    point1: {
      dis: 'Peak Demand',
      total: true,
      emphasis: true,
      doc: '95th-percentile measured hot water demand over the selected date range.'
    },
    point1BtuPerSF: {
      dis: 'MBH / SF',
      doc: 'Measured peak load normalized by building area (MBH per ft²).'
    },
    avgBtuperSF: {
      dis: 'Campus Avg MBH/SF',
      doc: 'Campus-wide average of each building\'s measured peak load per square foot.'
    },
    maxMeasuredLoadVsAvgBldg: {
      dis: 'vs Avg Bldg',
      doc: 'How this building\'s peak load compares to the campus average building (100% = average).'
    },
    estMaxLoad: {
      dis: 'Est. Max Load',
      total: true,
      doc: 'Estimated design-day maximum load based on building area and system type.'
    },
    measuredVsMaxLoad: {
      dis: 'Meas. / Est.',
      doc: 'Measured peak as a percentage of estimated maximum — indicates how hard the system was pushed.'
    },
    point2: {
      dis: 'Peak Flow',
      total: true,
      emphasis: true,
      doc: '95th-percentile measured hot water flow rate over the selected date range.'
    },
    predictedMaxHwFlow: {
      dis: 'Pred. Max Flow',
      total: true,
      doc: 'Predicted maximum flow derived from estimated max load and design delta-T.'
    }
  };

  /** Produce a Haystack marker object — used by effectiveMeta to synthesize markers. */
  function marker() { return { _kind: 'marker' }; }

  /** Merge real Axon col meta with placeholder values; real meta always wins. */
  function effectiveMeta(col) {
    var real = col.meta || {};
    var ph   = PLACEHOLDER_META[col.name] || {};
    return {
      dis:      real.dis      || ph.dis,
      doc:      real.doc      || ph.doc      || null,
      total:    real.total    || (ph.total    ? marker() : undefined),
      emphasis: real.emphasis || (ph.emphasis ? marker() : undefined),
      hidden:   real.hidden
    };
  }
  // ── END PLACEHOLDER CONFIG ───────────────────────────────────────────────

  /**
   * Render the demand data grid into the given container element.
   *
   * @param {HTMLElement} container   - DOM element to render into
   * @param {Object}      gridData    - Per-site Haystack grid returned by loadDemandData
   * @param {Object}      totalsGrid  - Campus totals grid (mode 2) for KPI cards
   */
  components.renderSiteTable = function (container, gridData, totalsGrid) {
    container.innerHTML = '';

    var cols = gridData.cols || [];
    var rows = gridData.rows || [];

    // Filter hidden columns, then augment each col with effective (real + placeholder) meta
    var visibleCols = cols.filter(function (col) {
      return !isHidden(col.meta);
    }).map(function (col) {
      return { name: col.name, meta: effectiveMeta(col) };
    });

    // Build per-cell background color map from presentation metadata
    var cellColors = buildCellColors(gridData);

    // Diagnostic: log visible columns and active meta flags
    console.log('[earlhamHWTable] Visible columns:',
      visibleCols.map(function (col) {
        var flags = [];
        if (hasTotal(col.meta))           flags.push('total');
        if (isEmphasis(col.meta))         flags.push('emphasis');
        if (col.meta && col.meta.doc)     flags.push('doc');
        return col.name + ':' + ((col.meta && col.meta.dis) || '?') +
               (flags.length ? ' [' + flags.join(',') + ']' : '');
      }));

    // ── KPI cards (campus-wide totals strip) ─────────────────────────────────
    renderKpiCards(container, totalsGrid);

    // ── Scrollable wrapper (title + KPI strip stay pinned above) ────────────
    var scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'hw-table-scroll-wrapper';
    container.appendChild(scrollWrapper);

    var table = document.createElement('table');
    table.className = 'hw-site-table';
    scrollWrapper.appendChild(table);

    // ── Header ───────────────────────────────────────────────────────────────
    var thead     = document.createElement('thead');
    var headerRow = document.createElement('tr');

    visibleCols.forEach(function (col) {
      var th = document.createElement('th');
      if (isEmphasis(col.meta)) th.className = 'hw-col-emphasis';

      var labelText = (col.meta && col.meta.dis) ? col.meta.dis : col.name;
      var docText   = (col.meta && typeof col.meta.doc === 'string') ? col.meta.doc : null;

      if (docText) {
        // Label text node followed by an ⓘ icon wired to the body-level portal tooltip
        th.appendChild(document.createTextNode(labelText));

        var infoWrap = document.createElement('span');
        infoWrap.className = 'hw-col-info';
        infoWrap.appendChild(document.createTextNode('\u24d8')); // ⓘ

        // Immediately-invoked closure captures docText per column
        (function (text) {
          infoWrap.addEventListener('mouseenter', function (e) {
            showTooltip(text, e.currentTarget);
          });
          infoWrap.addEventListener('mouseleave', hideTooltip);
        })(docText);

        th.appendChild(infoWrap);
      } else {
        th.textContent = labelText;
      }

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // ── Body ─────────────────────────────────────────────────────────────────
    var tbody = document.createElement('tbody');

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

          // Build CSS class list
          var classes = [];
          if (!isIdCol)             classes.push('hw-cell-number');
          if (isEmphasis(col.meta)) classes.push('hw-col-emphasis-cell');
          if (classes.length) td.className = classes.join(' ');

          // Apply background color from presentation grid
          var bgColor = cellColors[rowIdx] && cellColors[rowIdx][col.name];
          if (bgColor) {
            td.style.backgroundColor = bgColor;
            td.style.color           = '#ffffff';
            td.style.fontWeight      = '700';
          }

          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);

    // Note: totals are displayed as KPI cards above the table.
    // The tfoot CSS rules remain available for optional use.
  };

})(window.earlhamHWTable.components);
