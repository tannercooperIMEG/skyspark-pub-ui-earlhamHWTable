// earlhamHWTableEntry.js
//
// Deploy to: {var}/pub/ui/ ROOT on every server (local and cloud)
// SkySpark only auto-discovers JS at pub/ui/ root — subdirs are ignored.
// Modules are loaded dynamically so they can live in a subdirectory on the cloud.
//
// View record (trio) jsHandler should point to: earlhamHWTableHandler

console.log('[earlhamHWTable] Entry file parsed.');

var earlhamHWTableHandler = {};

(function () {
  var BASE_URL = '/pub/ui/earlhamHWTable/';
  var VERSION  = '20';  // bump this when deploying updated module files
  var modules = [
    'utils/api.js',
    'evals/loadDemandData.js',
    'components/SiteTable.js',
    'earlhamHWTableHandler.js'
  ];
  var loaded = false;
  var loading = false;
  var pendingCalls = [];

  function loadModules(cb) {
    var i = 0;
    function next() {
      if (i >= modules.length) { cb(); return; }
      var url = BASE_URL + modules[i] + '?v=' + VERSION;
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { i++; next(); };
      s.onerror = function () {
        console.error('[earlhamHWTable] Failed to load module:', url);
        i++;
        next();
      };
      document.head.appendChild(s);
    }
    next();
  }

  earlhamHWTableHandler.onUpdate = function (arg) {
    if (loaded) {
      if (window.earlhamHWTableApp && typeof window.earlhamHWTableApp.onUpdate === 'function') {
        window.earlhamHWTableApp.onUpdate(arg);
      }
      return;
    }
    pendingCalls.push(arg);
    if (!loading) {
      loading = true;
      loadModules(function () {
        loaded = true;
        loading = false;
        pendingCalls.forEach(function (a) {
          if (window.earlhamHWTableApp && typeof window.earlhamHWTableApp.onUpdate === 'function') {
            window.earlhamHWTableApp.onUpdate(a);
          }
        });
        pendingCalls = [];
      });
    }
  };
})();
