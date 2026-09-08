(function(){
  "use strict";

  var DATA = window.HEADLINES || { items: [] };
  var ALL  = (DATA.items || []).slice();

  // Sort: pinned first, then newest first
  ALL.sort(function(a,b){
    var pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (a.title || "").localeCompare(b.title || "");
  });

  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Build filter option sets from data
  var TYPE_LABELS = {
    "News Release": "News Release",
    "Public Notice": "Public Notice",
    "Order": "Order",
    "Report and Order": "Report and Order",
    "NAL": "Notice of Apparent Liability",
    "Statement": "Statement",
    "Speech": "Speech",
    "Report": "Report",
    "Order of Revocation": "Order of Revocation",
    "Consumer Advisory": "Consumer Advisory",
    "Rule": "Rule",
    "Proposed Rule": "Proposed Rule",
    "Notice": "Notice"
  };

  var BUREAUS = [
    "Office of Chairman Carr",
    "Administrative Law Judges",
    "Communications Business Opportunities",
    "Consumer and Governmental Affairs",
    "Enforcement",
    "International",
    "Media",
    "Public Safety and Homeland Security",
    "Space",
    "Wireless Telecommunications",
    "Wireline Competition"
  ];

  // State
  var state = {
    year: "all",
    types: new Set(),
    bureaus: new Set(),
    query: "",
    page: 1,
    perPage: 25,
    sort: "newest"
  };

  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function fmtDate(iso){
    var p = String(iso).split("-");
    return MONTHS[parseInt(p[1],10)-1] + " " + parseInt(p[2],10) + ", " + p[0];
  }

  // Build query string for shareable URLs
  function readQuery(){
    var q = new URLSearchParams(location.search);
    if (q.get("year")) state.year = q.get("year");
    if (q.get("type"))  q.get("type").split(",").forEach(function(t){ if(t) state.types.add(t); });
    if (q.get("bureau")) q.get("bureau").split(",").forEach(function(t){ if(t) state.bureaus.add(t); });
    if (q.get("q"))     state.query = q.get("q");
    if (q.get("perPage")){ var pp = parseInt(q.get("perPage"),10); if (pp>0) state.perPage = pp; }
    if (q.get("page"))  { var pg = parseInt(q.get("page"),10); if (pg>0) state.page = pg; }
  }
  function writeQuery(){
    var q = new URLSearchParams();
    if (state.year !== "all") q.set("year", state.year);
    if (state.types.size) q.set("type", Array.from(state.types).join(","));
    if (state.bureaus.size) q.set("bureau", Array.from(state.bureaus).join(","));
    if (state.query) q.set("q", state.query);
    if (state.perPage !== 25) q.set("perPage", state.perPage);
    if (state.page !== 1) q.set("page", state.page);
    var s = q.toString();
    var url = location.pathname + (s ? "?" + s : "");
    history.replaceState(null, "", url);
  }

  function filter(){
    var q = state.query.trim().toLowerCase();
    return ALL.filter(function(it){
      if (state.year !== "all" && String(it.year) !== state.year) return false;
      if (state.types.size && !state.types.has(it.type)) return false;
      if (state.bureaus.size && !state.bureaus.has(it.bureau || "")) return false;
      if (q){
        var hay = (it.title + " " + (it.summary||"") + " " + it.type + " " + (it.doc_number||"")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderList(){
    var list = filter();
    var total = list.length;
    var perPage = state.perPage;
    var pages = Math.max(1, Math.ceil(total / perPage));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * perPage;
    var slice = list.slice(start, start + perPage);

    var html = slice.map(function(it){
      var detailHref = "article/" + encodeURIComponent(it.id) + ".html";
      return '<li class="hl-item">' +
        '<div class="hl-meta"><span class="hl-date">' + esc(fmtDate(it.date)) + '</span> &nbsp;-&nbsp; <span class="hl-type">' + esc(it.type) + '</span></div>' +
        '<h2 class="hl-title"><a href="' + esc(detailHref) + '" data-id="' + esc(it.id) + '">' + esc(it.title) + '</a></h2>' +
        '<div class="hl-related"><a href="' + esc(detailHref) + '">Related Materials &gt;</a></div>' +
      '</li>';
    }).join("");

    if (!html){
      html = '<li class="hl-item" style="text-align:center;color:#666">No headlines match your filters.</li>';
    }
    document.getElementById("hlList").innerHTML = html;

    renderPager(pages, total);
  }

  function renderPager(pages, total){
    var pager = document.getElementById("hlPager");
    if (total === 0){ pager.innerHTML = ""; return; }
    var cur = state.page;
    var html = "";
    function btn(label, page, opts){
      opts = opts || {};
      var cls = "page-btn" + (opts.active ? " active" : "") + (opts.disabled ? " disabled" : "");
      var dis = opts.disabled ? " disabled" : "";
      return '<button class="' + cls + '"' + dis + ' data-page="' + (page||"") + '" aria-label="' + esc(label) + '">' + esc(label) + '</button>';
    }
    // Prev
    html += btn("‹", Math.max(1, cur-1), { disabled: cur<=1 });
    // Smart pager: 1 ... cur-1 cur cur+1 ... last
    var last = pages;
    var around = [];
    for (var p = 1; p <= last; p++){
      if (p === 1 || p === last || (p >= cur-1 && p <= cur+1)) around.push(p);
      else if (p === cur-2 || p === cur+2) around.push("…");
    }
    // Dedup adjacent ellipsis
    var compact = [];
    around.forEach(function(p,i){
      if (p === "…" && compact[compact.length-1] === "…") return;
      compact.push(p);
    });
    compact.forEach(function(p){
      if (p === "…") html += '<span class="page-dots">…</span>';
      else html += btn(String(p), p, { active: p === cur });
    });
    // Next
    html += btn("›", Math.min(last, cur+1), { disabled: cur>=last });

    pager.innerHTML = html;
    pager.querySelectorAll("button.page-btn").forEach(function(b){
      b.addEventListener("click", function(){
        if (b.disabled) return;
        var p = parseInt(b.getAttribute("data-page"),10);
        if (!isNaN(p) && p>0){ state.page = p; writeQuery(); renderList(); window.scrollTo({top:0,behavior:"smooth"}); }
      });
    });
  }

  function renderTypeFilters(){
    var types = Array.from(new Set(ALL.map(function(i){return i.type}))).sort();
    var html = types.map(function(t){
      var lbl = TYPE_LABELS[t] || t;
      return '<li><input type="checkbox" id="t-' + esc(t) + '" value="' + esc(t) + '"' + (state.types.has(t)?" checked":"") + '>' +
        '<label for="t-' + esc(t) + '">' + esc(lbl) + '</label></li>';
    }).join("");
    document.getElementById("typeList").innerHTML = html;
    document.getElementById("typeList").querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("change", function(){
        if (inp.checked) state.types.add(inp.value); else state.types.delete(inp.value);
      });
    });
  }

  function renderBureauFilters(){
    var html = BUREAUS.map(function(b){
      return '<li><input type="checkbox" id="b-' + b.replace(/\W+/g,"_") + '" value="' + esc(b) + '"' + (state.bureaus.has(b)?" checked":"") + '>' +
        '<label for="b-' + b.replace(/\W+/g,"_") + '">' + esc(b) + '</label></li>';
    }).join("");
    document.getElementById("bureauList").innerHTML = html;
    document.getElementById("bureauList").querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("change", function(){
        if (inp.checked) state.bureaus.add(inp.value); else state.bureaus.delete(inp.value);
      });
    });
  }

  function bindUI(){
    // Year tabs
    document.querySelectorAll(".year-tab").forEach(function(b){
      b.addEventListener("click", function(){
        document.querySelectorAll(".year-tab").forEach(function(x){ x.classList.remove("active"); x.setAttribute("aria-selected","false"); });
        b.classList.add("active"); b.setAttribute("aria-selected","true");
        state.year = b.getAttribute("data-year");
        document.getElementById("yearSelect").value = state.year;
        state.page = 1; writeQuery(); renderList();
      });
    });
    // Year select
    document.getElementById("yearSelect").addEventListener("change", function(){
      state.year = this.value;
      var tab = document.querySelector('.year-tab[data-year="'+state.year+'"]');
      if (tab){
        document.querySelectorAll(".year-tab").forEach(function(x){ x.classList.remove("active"); });
        tab.classList.add("active");
      }
      state.page = 1; writeQuery(); renderList();
    });
    // Per page
    document.getElementById("perPage").addEventListener("change", function(){
      state.perPage = parseInt(this.value,10) || 25;
      state.page = 1; writeQuery(); renderList();
    });
    // Apply
    document.getElementById("applyBtn").addEventListener("click", function(){
      state.page = 1; writeQuery(); renderList();
    });
    // Search via header
    window.fccSearch = function(e){
      e.preventDefault();
      var v = document.getElementById("gsearch").value || "";
      state.query = v; state.page = 1; writeQuery(); renderList();
      document.getElementById("hlList").scrollIntoView({behavior:"smooth", block:"start"});
      return false;
    };
    // Year arrow nav (visual only — cycles the visible tabs in this static view)
    var tabKeys = ["all","2026","2025","2024"];
    document.getElementById("yearPrev").addEventListener("click", function(){
      var i = tabKeys.indexOf(state.year);
      if (i < tabKeys.length-1){
        var t = document.querySelector('.year-tab[data-year="'+tabKeys[i+1]+'"]'); if (t) t.click();
      }
    });
    document.getElementById("yearNext").addEventListener("click", function(){
      var i = tabKeys.indexOf(state.year);
      if (i > 0){
        var t = document.querySelector('.year-tab[data-year="'+tabKeys[i-1]+'"]'); if (t) t.click();
      }
    });
  }

  // init
  readQuery();
  document.getElementById("yearSelect").value = state.year;
  document.getElementById("perPage").value = state.perPage;
  document.getElementById("gsearch").value = state.query;
  // sync year tab to state
  document.querySelectorAll(".year-tab").forEach(function(t){
    if (t.getAttribute("data-year") === state.year){ t.classList.add("active"); }
    else { t.classList.remove("active"); }
  });
  renderTypeFilters();
  renderBureauFilters();
  bindUI();
  renderList();
})();
