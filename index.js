;(function(){
var cdn = "https://cdn.jsdelivr.net/",
  raw = "https://cdn.rawgit.com/",
  config = {
    paths: {
      "d3": cdn + "d3js/3.5.12/d3.min",
      "codemirror": cdn + "codemirror/4.5.0/codemirror.min",
      "baobab": raw + "Yomguithereal/baobab/2.3.0/build/baobab.min",
      "sankey": raw + "d3/d3-plugins/c64935b/sankey/sankey"
    }
  },
  deps = [
    "d3",
    "codemirror",
    "baobab"
  ],
  notebooks = [
    "notebooks/8b6065c.html",
    "notebooks/9f0fa95.html",
    "notebooks/HEAD.html"
  ],
  panes = notebooks.reduce(function(m, d, i){
    m.push({src: d});
    if(i + 1 < notebooks.length){
      m.push({
        left: d,
        right: notebooks[i + 1]
      });
    }
    return m;
  }, []);

var not = function(fn){ return function(d){ return !fn(d)}},
  src = function(d){ return d.src; };

require(config, deps, function(d3, CodeMirror, Baobab){
  require(config, ["sankey"], function(){
    init(d3, CodeMirror, Baobab);
  })
});

function init(d3, CodeMirror, Baobab){
  var tree = window.tree = new Baobab({
    notebooks: {}
  });

  tree.select("notebooks").on("update", updateSankey);

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

  var notebookPane = pane.filter(src)
    .append("iframe")
    .attr({src: src})
    .each(initFrame);

  var diffPane = pane.filter(not(src))
    .append("svg");

  function initFrame(d){
    var cellPath = ["notebooks", d.src, "cells"];
    this.onload = function(){
      d3.select(this.contentWindow).on("scroll", function(){
        tree.set(["notebooks", d.src, "scroll"], this.scrollY);
      });

      var frame = d3.select(this.contentDocument.body);

      frame
        .style({padding: 0})
        .selectAll("#menubar, .container-main > ol, footer")
        .remove();

      frame.selectAll(".cell")
        .each(function(_d, i){
          var bb = this.getBoundingClientRect();
          bb = {
            x: bb.left,
            y: bb.top,
            w: bb.width,
            h: bb.height
          };

          if(!tree.get(cellPath)){
            tree.set(cellPath, []);
          }

          tree.push(cellPath, bb);
        });
    }
  }

  var line = d3.svg.line();

  function updateSankey(){
    diffPane.each(function(d){
      var width = this.parentNode.clientWidth,
        diff = d3.select(this)
          .attr({width: width}),
        left = tree.get(["notebooks", d.left]),
        right = tree.get(["notebooks", d.right]);

      if(!(left && right)){
        return;
      }

      var path = diff
        .selectAll("path")
        .data(d3.zip(left.cells, right.cells));

      path.enter().append("path")
        .attr({
          fill: "rgba(0,0,0,0.1)",
        });

      var pad = 4;

      path.attr({
        d: function(d){
          return line([
            [0, d[0].y - (left.scroll || 0) + pad],
            [width, d[1].y - (right.scroll || 0) + pad],
            [width, d[1].y + d[1].h - (right.scroll || 0) - pad],
            [0, d[0].y + d[0].h - (left.scroll || 0) - pad]
          ])
        }
      });

      path.exit().remove();

    })
  }
}

}).call(this);
