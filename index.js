define(
["d3", "baobab", "jsondiffpatch"],
function(d3, Baobab, jsondiffpatch){

var jdp = jsondiffpatch.create({textDiff: {minLength: 2}});

var nbdiffstream = function(){
/* END BOILERPLATE*/

// functional stuff
var not = function(fn){ return function(d){ return !fn(d)}},
  src = function(d){ return d.src; },
  data = function(e){ return e.data.currentData; },
  label = function(d){ return d.label; }
  screen = function(frame){
    var w = frame ? frame.contentWindow : window,
      d = frame ? frame.contentDocument : document,
      e = d.documentElement,
      g = d.getElementsByTagName('body')[0],
      x = w.innerWidth || e.clientWidth || g.clientWidth,
      y = w.innerHeight|| e.clientHeight|| g.clientHeight;
    return [x, y];
  },
  uniqueSubstring = function(needle, haystacks){
    var diffs = haystacks.map(function(stack){
      return jdp.diff(stack, needle);
    })
    .filter(function(diff){ return diff; })
    .map(function(diff){
      return diff[0].split("\n")
        .filter(function(d){ return d[0] === "+"; })
    });
    return d3.max(diffs)[0].slice(1);
  };

// a baobab tree
var _tree,
  // baobab cursors
  _cur;

var api = function(){ return api; };

api.init = function(){
  api.init.tree()
    .listeners();

  // fire it up
  api.onCursor.hash(window.location.hash);

  return api;
};

api.init.tree = function(){
  _tree = new Baobab({
    notebooks: {}
  });

  // cursors
  _cur = ["hash", "screen", "panes", "notebooks", "scroll"]
    .reduce(function(memo, name){
      memo[name] = _tree.select(name);
      // auto-install update events
      api.onCursor[name] && memo[name].on("update", function(e){
        api.onCursor[name](data(e), e);
      });
      return memo;
    }, {});

  return api.init;
};

api.init.listeners = function(){
  // set up the window event listeners
  d3.select(window)
    .on("hashchange", function(){ _cur.hash.set(window.location.hash); })
    .on("resize", function(){ _cur.screen.set(screen()); });

  return api.init;
};

// magic-named baobab cursor update methods... no return methods
api.onCursor = function(){};


// when the window has changes
api.onCursor.hash = function(hash){
  var notebooks = hash.split("#").slice(1)
    .filter(function(url){
      return url && url.indexOf("/") === 0;
    });

  _cur.panes.set(notebooks.reduce(function(memo, d, i){
    memo.push({
      src: d,
      label: decodeURI(uniqueSubstring(d, notebooks))
    });
    if(i + 1 < notebooks.length){
      memo.push({left: d, right: notebooks[i + 1]});
    }
    return memo;
  }, []));
};


// when panes are added or removed
api.onCursor.panes = function(panes){
  var pane = d3.select(".main")
    .selectAll("div")
    .data(panes, function(d){ return src(d) || "" + [d.left, d.right]; });

  var enter = pane
    .enter()
    .append("div")
    .classed({pane: 1, notebook: src, diff: not(src)});

  enter.filter(src).call(api.enter.notebook);
  enter.filter(not(src)).call(api.enter.diff);

  pane.exit().remove();

  // main typed selectors, handles init
  // pane.filter(src).call(api.update.notebook),
  pane.filter(not(src)).call(api.update.diff);
};


api.onCursor.scroll = function(scroll){
  var frame = api.frame(scroll.src),
    height = scroll.screen[1],
    middle = scroll.y + (height / 2),
    parts = _cur.notebooks.get([scroll.src, "parts"]),
    best,
    bottom,
    midOffset;

  // scan for the middlemost part
  for(var i=0; i < parts.length; i++){
    bottom = parts[i].y + parts[i].h;
    if(middle >= parts[i].y && middle <= bottom ||
      (i && (middle <= parts[i].y))){
      best = parts[i];
      break;
    }
  }

  midOffset = ((best.y + (best.h / 2)) - middle) / best.h;

  api.frame()
    .filter(function(d){ return d.src !== scroll.src; })
    .each(function(d){
      // TODO: resolve add/remove cells
      var part = _cur.notebooks.get([d.src, "parts", i]),
        doc = this.contentDocument.documentElement,
        y = part.y + (part.h / 2) + (doc.clientHeight / -2) + (-midOffset * part.h);

      y = y < 0 ? 0 : y;

      this.contentWindow.scrollTo(0, y);
      _cur.notebooks.set([d.src, "scroll"], y);
    });

  api.update.diff();
};

api.onCursor.notebooks = function(){
  api.update.diff();
};


// d3 selection.enter().call's. no return.
api.enter = function(){};


api.enter.notebook = function(pane){
  pane.append("div")
    .classed({"doc-info": 1})
  .append("div")
    .classed({"doc-info-inner": 1})
    .text(label);

  pane.append("iframe")
    .attr({
      src: src,
      sandbox: "allow-same-origin allow-scripts"
    })
    .on("load", function(d){ api.frame.load(d, this); });
};


api.enter.diff = function(pane){
  pane.append("svg");

  // TODO: re-add this when routes are available
  // d3.json(patch(d), function(changes){
  //   tree.set(["changes", d.left, d.right], changes);
  // });
};


// d3 selection.calls's. no return.
api.update = function(){};


api.update.diff = function(pane){
  pane = pane ? pane : d3.selectAll(".main .pane.diff");

  pane.each(function(d){
    var width = this.clientWidth,
      diff = d3.select(this),
      svg = diff.select("svg")
        .attr({width: width}),
      left = _cur.notebooks.get([d.left]),
      right = _cur.notebooks.get([d.right]);

    if(!(left && right)){
      return;
    }

    var path = svg.selectAll("path.part")
      .data(d3.zip(left.parts, right.parts));

    path.enter().append("path")
      .attr({"class": function(d){ return d[0].part; }})
      .classed({part: 1})
      .style({opacity: 0})
      .transition()
      .style({opacity: 1});

    path.attr({
      d: function(d){
        var yl0 = d[0].y - (left.scroll || 0),
          yr0 = d[1].y - (right.scroll || 0),
          yr1 = d[1].y + d[1].h - (right.scroll || 0),
          yl1 = d[0].y + d[0].h - (left.scroll || 0),
          points = [
            "M", // moveto
              [0, yl0],
            "C", // curveto
              [width * 0.5, yl0],
              [width * 0.5, yr0],
              [width, yr0],
            "L", // lineto
              [width, yr1],
            "C",
              [width * 0.5, yr1],
              [width * 0.5, yl1],
              [0, yl1],
            "Z"
          ];

        return points.join(" ");
      }
    });

    path.exit().remove();

  });
};

// special iframe stuff
api.frame = function(src){
  return d3.selectAll("iframe" + (src ? "[src='" + src + "']" : ""));
};


api.frame.load = function(d, frame){
  var body = d3.select(frame.contentDocument.body);

  d3.select(frame.contentWindow)
    .on("scroll", function(){
      api.frame.scroll(d, frame);
    })
    .on("resize", function(){
      api.frame.resize(d, frame);
    });

  // TODO: just don't inject this at tmeplate level
  body.style({padding: "100px 0"})
    .selectAll("#menubar, .container-main > ol, footer")
    .remove();

  // trigger a frame resize
  api.frame.resize(d, frame);
};

// TODO: is this even needed?
var _scrollLock;

/*
  factory for a linked scroll updater based on data without binding

  keep the middlemost parts lined up, relative to their middles
*/
api.frame.scroll = function(d, frame){
  _cur.scroll.set({
    src: d.src,
    y: frame.contentWindow.scrollY,
    screen: screen(frame)
  });
};

api.frame.resize = function(d, frame){
  var parts = [];

  d3.select(frame.contentDocument)
    .selectAll(".inner_cell, .output_wrapper")
      .each(function(_d, i){
        var bb = this.getBoundingClientRect();
        parts.push({
          x: bb.left,
          y: bb.top,
          w: bb.width,
          h: bb.height,
          part: d3.select(this).classed("inner_cell") ?
            "source" : "output"
        });
      });

  _cur.notebooks.set([d.src, "parts"], parts);
};


// d3-style getter/setters
api.cursor = function(name){
  return _cur[name];
};

/* BOILERPLATE */
return api; }; return nbdiffstream; });
