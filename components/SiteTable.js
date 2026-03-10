// earlhamHWTable/components/SiteTable.js
// Renders the sites data as a single-column table

window.earlhamHWTable = window.earlhamHWTable || {};
window.earlhamHWTable.components = window.earlhamHWTable.components || {};

(function (components) {
  var utils = window.earlhamHWTable.utils;

  /**
   * Render a single-column "Site" table into the given container element.
   *
   * @param {HTMLElement} container - DOM element to render into
   * @param {Object}      gridData  - Haystack grid returned by loadSites
   */
  components.renderSiteTable = function (container, gridData) {
    container.innerHTML = '';

    var rows = gridData.rows || [];

    // --- Table ---
    var table = document.createElement('table');
    table.className = 'hw-site-table';

    // Header
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    var th = document.createElement('th');
    th.textContent = 'Site';
    headerRow.appendChild(th);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement('tbody');

    if (rows.length === 0) {
      var emptyRow = document.createElement('tr');
      var emptyCell = document.createElement('td');
      emptyCell.textContent = 'No sites found.';
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');

        // dis may be a plain string or a Haystack-wrapped value
        var dis = row.dis;
        if (dis !== null && dis !== undefined && typeof dis === 'object') {
          dis = utils.extractValue(dis);
        }
        td.textContent = dis || '\u2014';

        tr.appendChild(td);
        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    container.appendChild(table);
  };

})(window.earlhamHWTable.components);
