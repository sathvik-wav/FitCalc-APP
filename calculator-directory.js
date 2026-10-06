(function () {
  "use strict";

  var directory = document.getElementById("calculator-directory");
  if (!directory) return;

  var search = document.getElementById("calculator-search-input");
  var rows = Array.prototype.slice.call(directory.querySelectorAll(".calculator-directory-row"));
  var filters = Array.prototype.slice.call(directory.querySelectorAll(".calculator-filter"));
  var emptyState = document.getElementById("calculator-no-results");
  var selectedCategory = "all";

  function updateResults() {
    var term = search.value.trim().toLocaleLowerCase();
    var visibleCount = 0;

    rows.forEach(function (row) {
      var matchesCategory = selectedCategory === "all" || row.dataset.category === selectedCategory;
      var matchesSearch = !term || row.textContent.toLocaleLowerCase().indexOf(term) !== -1;
      row.hidden = !(matchesCategory && matchesSearch);
      if (!row.hidden) visibleCount++;
    });

    if (emptyState) emptyState.hidden = visibleCount > 0;
  }

  filters.forEach(function (filter) {
    filter.addEventListener("click", function () {
      selectedCategory = filter.dataset.category || "all";
      filters.forEach(function (item) {
        var active = item === filter;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      updateResults();
    });
  });

  if (search) search.addEventListener("input", updateResults);
  updateResults();
})();
