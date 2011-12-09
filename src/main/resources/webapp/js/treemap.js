/*
 * Copyright (C) 2009-2011 Antelink SAS
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License Version 3 as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License Version 3
 * for more details.
 *
 * You should have received a copy of the GNU Affero General Public License Version
 * 3 along with this program. If not, see http://www.gnu.org/licenses/agpl.html
 *
 * Additional permission under GNU AGPL version 3 section 7
 *
 * If you modify this Program, or any covered work, by linking or combining it with
 * Eclipse Java development tools (JDT) or Jetty (or a modified version of these
 * libraries), containing parts covered by the terms of Eclipse Public License 1.0,
 * the licensors of this Program grant you additional permission to convey the
 * resulting work. Corresponding Source for a non-source form of such a combination
 * shall include the source code for the parts of Eclipse Java development tools
 * (JDT) or Jetty used as well as that of the covered work.
 */
var currentNode;
var newNode;
var depth = 0;
var tm;
var element;
var jsonA;
var JsonB;

function goToNode(nodeId) {
	var node = tm.graph.getNode(nodeId);

	if (tm.busy)
		return;
	tm.busy = true;
	tm.events.hoveredNode = false;
	if (nodeId == tm.root) {
		var that = tm, config = tm.config, graph = tm.graph, parents = node
				.getParents(), parent = node, clickedNode = node, previousClickedNode = tm.clickedNode;
	} else {
		var that = tm, config = tm.config, graph = tm.graph, parents = node
				.getParents(), parent = parents[0], clickedNode = parent, previousClickedNode = tm.clickedNode;
	}

	// final plot callback
	callback = {
		onComplete : function() {
			that.clickedNode = parent;
			if (config.request) {
				that.requestNodes(parent, {
					onComplete : function() {
						that.compute();
						that.plot();
						that.busy = false;
					}
				});
			} else {
				that.compute();
				that.plot();
				that.busy = false;
			}
		}
	};
	// prune tree
	if (config.levelsToShow > 0)
		tm.geom.setRightLevelToShow(parent);
	// animate node positions
	pushNodeName(node);
	if (config.animate) {
		tm.clickedNode = clickedNode;
		tm.compute('end');
		// animate the visible subtree only
		tm.clickedNode = previousClickedNode;
		tm.fx.animate({
			modes : [ 'linear', 'node-property:width:height' ],
			duration : 1000,
			onComplete : function() {
				// animate the parent subtree
				that.clickedNode = clickedNode;
				// change nodes alpha
				graph.eachNode(function(n) {
					n.setDataset([ 'current', 'end' ], {
						'alpha' : [ 0, 1 ]
					});
				}, "ignore");
				previousClickedNode.eachSubgraph(function(node) {
					node.setData('alpha', 1);
				}, "ignore");
				that.fx.animate({
					duration : 500,
					modes : [ 'node-property:alpha' ],
					onComplete : function() {
						callback.onComplete();
					}
				});
			}
		});
	} else {
		callback.onComplete();
	}
}
function pushNodeName(node) {
	var names = "";
	var parents = node.getParents();
	while (parents.length != 0) {
		names = '<span class="locationElementEnd" onClick="goToNode('
				+ parents[0].id + ')">' + parents[0].name + '</span>' + names;
		parents = parents[0].getParents();
	}
	names = names + '<span class="locationElementEnd" onClick="goToNode('
			+ node.id + ')">' + node.name + '</span>';
	$("#location").replaceWith('<div id="location">' + names + '</div>');
	parents = node.getParents();

}

function getFullPath(node, clickedNode) {
	if (!node) {
		return null;
	}
	if (!clickedNode) {
		clickedNode = tm.graph.getNode(tm.root);
	}
	if (node.id == tm.root) {
		return tm.graph.getNode(tm.root).name;
	}
	var names = "";
	var parents = node.getParents();
	while (parents.length != 0) {
		if (clickedNode && clickedNode == parents[0]) {
			break;
		}
		names = parents[0].name + "/" + names;
		parents = parents[0].getParents();
	}
	names = names + node.name;

	return names;
}
function clone(obj) {
	// Handle the 3 simple types, and null or undefined
	if (null == obj || "object" != typeof obj)
		return obj;

	// Handle Date
	if (obj instanceof Date) {
		var copy = new Date();
		copy.setTime(obj.getTime());
		return copy;
	}

	// Handle Array
	if (obj instanceof Array) {
		var copy = [];
		for ( var i in obj) {
			copy[i] = clone(obj[i]);
		}
		return copy;
	}

	// Handle Object
	if (obj instanceof Object) {
		var copy = {};
		for ( var attr in obj) {
			if (obj.hasOwnProperty(attr))
				copy[attr] = clone(obj[attr]);
		}
		return copy;
	}

	throw new Error("Unable to copy obj! Its type isn't supported.");
}

function drawTreemap(json, option, nodeLevel) {
	/*
	 * prepare treemap
	 */
	var pjson = clone(json);
	var labelType, useGradients, nativeTextSupport, animate;
	(function() {
		var ua = navigator.userAgent, iStuff = ua.match(/iPhone/i)
				|| ua.match(/iPad/i), typeOfCanvas = typeof HTMLCanvasElement, nativeCanvasSupport = (typeOfCanvas == 'object' || typeOfCanvas == 'function'), textSupport = nativeCanvasSupport
				&& (typeof document.createElement('canvas').getContext('2d').fillText == 'function');
		// I'm setting this based on the fact that ExCanvas provides text
		// support for IE
		// and that as of today iPhone/iPad current text support is lame
		labelType = (!nativeCanvasSupport || (textSupport && !iStuff)) ? 'Native'
				: 'HTML';
		nativeTextSupport = labelType == 'Native';
		useGradients = nativeCanvasSupport;
		animate = !(iStuff || !nativeCanvasSupport);
	})();
	tm = new $jit.TM.Squarified({
		// where to inject the visualization
		injectInto : 'content-treemap',
		// parent box title heights
		titleHeight : 4,
		// show only one tree level
		levelsToShow : nodeLevel,
		// enable animations
		animate : animate,
		// box offsets
		offset : 0,
		// Attach left and right click events
		Events : {
			enable : true,
			onClick : function(node) {
				if (!node.data.isFileSet) {
					if (node) {
						pushNodeName(node);
						tm.enter(node);
					}
				}
				tm.refresh();
			},
			onRightClick : function() {
				if (tm.clickedNode) {
					var parents = tm.clickedNode.getParents();
					if (parents.length != 0) {
						tm.out();
						pushNodeName(parents[0]);
					}
				}
				tm.refresh();
			}
		},
		duration : 10,
		// Enable tips
		Tips : {
			enable : option,
			// add positioning offsets
			offsetX : 20,
			offsetY : 20,
			// implement the onShow method to
			// add content to the tooltip when a node
			// is hovered
			onShow : function(tip, node, isLeaf, domElement) {
				var html;
				var name;
				if (node.data.isFileSet) {
					var parents = node.getParents();
					name = getFullPath(parents[0], tm.clickedNode);
				} else {
					name = getFullPath(node, tm.clickedNode);
				}
				if (option) {
					var html = "<div>" + name + "</div>";
					tip.innerHTML = html;
				}
			},
			onHide : function() {

			}
		},

		request : function(nodeId, level, onComplete) {
			var subtree = $jit.json.getSubtree(clone(json), nodeId);
			$jit.json.prune(subtree, nodeLevel);
			onComplete.onComplete(nodeId, subtree);
		},

		onCreateLabel : function(domElement, node) {
			if (node.data.isFileSet) {
				var parents = node.getParents();
				var parent = parents[0];
				domElement.onmouseover = function() {
					element = document.getElementById(parents[0].id);
					element.style.border = '1px solid #9FD4FF';
				};
				domElement.onmouseout = function() {
					element = document.getElementById(parents[0].id);
					element.style.border = '0px solid transparent';
				};
				return;
			}
			var style = domElement.style;
			style.display = '';
			style.border = '0px solid transparent';
			domElement.onmouseover = function() {
				style.border = '1px solid #9FD4FF';
			};
			domElement.onmouseout = function() {
				style.border = '0px solid transparent';
			};
		}
	});
	jsonA = json;
	jsonB = pjson;
	$jit.json.prune(pjson, nodeLevel);
	tm.loadJSON(pjson);
	tm.refresh();
	pushNodeName(tm.graph.getNode(tm.root));
}