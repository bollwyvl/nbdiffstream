;(function(){
// asset sources to initially avoid toolchain
var cdn = "https://cdn.jsdelivr.net/",
  raw = "https://cdn.rawgit.com/";

// require config
var config = {
    paths: {
      "d3": cdn + "d3js/3.5.12/d3.min",
      "baobab": raw + "Yomguithereal/baobab/2.3.0/build/baobab.min",
    }
  };

// list of refs... would be provided some other way, probably URL
var notebooks = [
    "8b6065c",
    "9f0fa95",
    "HEAD"
  ];

// generate the pane ID information ("real" data lives in the tree)
var panes = notebooks.reduce(function(m, d, i){
  m.push({src: d});
  if(i + 1 < notebooks.length){
    m.push({
      left: d,
      right: notebooks[i + 1]
    });
  }
  return m;
}, []);

// functional stuff
var not = function(fn){ return function(d){ return !fn(d)}},
  src = function(d){ return d.src; },
  html = function(d){ return "notebooks/" + d.src + ".html"; },
  patch = function(d){
    return "patches/" + [d.left, d.right].join("-") + ".patch.json";
  };

// main function what has access to deps
function main(d3, Baobab){
  // the data bus
  var tree = window.tree = new Baobab({
    notebooks: {},
    patches: {}
  });

  tree.select("notebooks").on("update", updateParts);

  var pane = d3.select(".main")
    .selectAll("div")
    .data(panes)
    .enter()
    .append("div")
    .classed({
      pane: 1,
      notebook: src,
      diff: not(src)
    });

  // main typed selectors, handles init
  var notebookPane = pane.filter(src).each(initFrame),
    diffPane = pane.filter(not(src)).each(initDiff);

  // setup iframe and events
  function initFrame(d){
    var cellPath = ["notebooks", d.src, "parts"];
    var pane = d3.select(this);

    pane.append("div")
      .classed({"doc-info": 1})
      .append("div")
      .classed({"doc-info-inner": 1})
      .text(src);

    pane.append("iframe")
      .attr({
        src: html,
        sandbox: "allow-same-origin allow-scripts"
      })
      .node().onload = function(){
        d3.select(this.contentWindow).on("scroll", updateScroll(d));

        var frame = d3.select(this.contentDocument.body);

        frame
          .style({padding: "100px 0"})
          .selectAll("#menubar, .container-main > ol, footer")
          .remove();

        // wait for slow loading stuff
        setTimeout(function(){
          frame.selectAll(".inner_cell, .output_wrapper")
            .each(function(_d, i){
              var part = d3.select(this);
              var bb = this.getBoundingClientRect();
              bb = {
                x: bb.left,
                y: bb.top,
                w: bb.width,
                h: bb.height,
                part: part.classed("inner_cell") ? "source" : "output"
              };

              if(!tree.get(cellPath)){
                tree.set(cellPath, []);
              }

              tree.push(cellPath, bb);
            });
        }, 1000);

    }
  }

  var _scrollLock;

  /*
    factory for a linked scroll updater based on data without binding

    keep the middlemost parts lined up, relative to their middles
  */
  function updateScroll(d){
    return function(){
      if(_scrollLock){
        return;
      }
      var y = this.scrollY,
        height = this.document.documentElement.clientHeight,
        middle = y + (height / 2);

      tree.set(["notebooks", d.src, "scroll"], y);

      var parts = tree.get(["notebooks", d.src, "parts"]),
        best,
        bottom;

      // scan for the middlemost part
      for(var i=0; i < parts.length; i++){
        bottom = parts[i].y + parts[i].h;
        if(middle >= parts[i].y && middle <= bottom ||
          (i && (middle <= parts[i].y))){
          best = parts[i];
          break;
        }
      }

      var midOffset = ((best.y + (best.h / 2)) - middle) / best.h;

      _scrollLock = true;

      notebookPane.selectAll("iframe")
        .filter(function(dd){ return dd.src !== d.src; })
        .each(function(d){
          // TODO: resolve add/remove cells
          var part = tree.get(["notebooks", d.src, "parts", i]),
            doc = this.contentDocument.documentElement,
            y = part.y + (part.h / 2) + (doc.clientHeight / -2) + (-midOffset * part.h);

          y = y < 0 ? 0 : y;

          this.contentWindow.scrollTo(0, y);
          tree.set(["notebooks", d.src, "scroll"], y);
        });

      // gross... TODO: move to baobab?
      setTimeout(function(){
        _scrollLock = false;
      }, 0);
    }
  }


  function initDiff(d){
    var pane = d3.select(this);

    pane.append("svg");

    d3.json(patch(d), function(changes){
      tree.set(["changes", d.left, d.right], changes);
    });
  }


  function updateParts(){
    diffPane.each(function(d){
      var width = this.clientWidth,
        diff = d3.select(this),
        svg = diff.select("svg")
          .attr({width: width}),
        left = tree.get(["notebooks", d.left]),
        right = tree.get(["notebooks", d.right]);

      if(!(left && right)){
        return;
      }

      var path = svg
        .selectAll("path.part")
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

    })
  }
}

// do the require thing
require(config, ["d3", "baobab"], main);

}).call(this);
