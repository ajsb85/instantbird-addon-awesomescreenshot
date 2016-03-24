var isContentScriptLoaded = true;
var doc, html, 
	docW, docH,
	initScrollTop, initScrollLeft,
	clientH, clientW;
var scrollBar = {};
var counter = 1; //horizontal scroll counter
var menu = {visible:{enable:'false', key:'V'}, selected:{enable:'false', key:'S'}, entire:{enable:'false', key:'E'}};
var fixedElements = [];

var wrapperHTML = '<div id="awesome_screenshot_wrapper"><div id="awesome_screenshot_top"></div><div id="awesome_screenshot_right"></div><div id="awesome_screenshot_bottom"></div><div id="awesome_screenshot_left"></div><div id="awesome_screenshot_center" class="drsElement drsMoveHandle"><div id="awesome_screenshot_size"><span>0 X 0</span></div><div id="awesome_screenshot_action"><a href="javascript:void(0)" id="awesome_screenshot_capture"><span></span>Capture</a><a href="javascript:void(0)" id="awesome_screenshot_cancel"><span></span>Cancel</a></div></div></div>';
var wrapper,
	dragresize; //dragresize object
var isSelected = false;

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
	switch(request.action) {
		case 'update_shortcuts':
			bindShortcuts(request);
			break;
		case 'init_entire_capture':
			initEntireCapture();
			break;
		case 'init_selected_capture':
			initSelectedCapture();
			break;
		case 'scroll_next':
			scrollNext();
			break;
		case 'destroy_selected':
			removeSelected();
			break;
	}
});

function initEntireCapture() {
	enableFixedPosition(true);
	counter = 1;
	getDocumentNode();
	
	html = doc.documentElement;
	initScrollTop = doc.body.scrollTop; 
	initScrollLeft = doc.body.scrollLeft; 
	clientH = getClientH();
	clientW = html.clientWidth;
	console.log(clientH+' '+clientW);
	doc.body.scrollTop = 0;
	doc.body.scrollLeft = 0;
	
	checkScrollBar();
	window.onresize = checkScrollBar; //no need, integrate with selected
	if (!scrollBar.x && !scrollBar.y) {
		sendRequest({action:'visible'});
		return;
	}
	
	//http://help.dottoro.com/ljlskbkk.php
	setTimeout(sendRequest, 300, {action:'scroll_next_done'});
}

/************** selected capture start **************/
function initSelectedCapture() {
	getDocumentNode();
	getDocumentDimension();
	if(!doc.getElementById('awesome_screenshot_wrapper')) {
		doc.body.innerHTML += wrapperHTML;
	}
	wrapper = doc.getElementById('awesome_screenshot_wrapper');
	updateWrapper();
	window.addEventListener('resize', windowResize, false);
	doc.body.addEventListener('keydown', selectedKeyDown, false);
	
	wrapper.addEventListener('mousedown', wrapperMouseDown, false);
}

function wrapperMouseDown(e) {
	if (e.button == 0) {
		var initX = e.pageX,
			initY = e.pageY;
		var asSize = doc.getElementById('awesome_screenshot_size');
		
		wrapper.addEventListener('mousemove', wrapperMouseMove, false);
		wrapper.addEventListener('mouseup', wrapperMouseUp, false);
		
		
		function wrapperMouseMove(e) {
			setStyle(wrapper, 'background-color', 'rgba(0,0,0,0)');
			var centerW = e.pageX-initX,
				centerH = e.pageY-initY;
			asSize.children[0].innerHTML = Math.abs(centerW)+' X '+Math.abs(centerH);
			
			updateCorners(initX, initY, centerW, centerH);
			updateCenter(initX, initY, centerW, centerH);
			autoScroll(e);
		}
		
		function wrapperMouseUp(e) {
			wrapper.removeEventListener('mousedown', wrapperMouseDown, false);
			wrapper.removeEventListener('mousemove', wrapperMouseMove, false);
			wrapper.removeEventListener('mouseup', wrapperMouseUp, false);
			setStyle(doc.getElementById('awesome_screenshot_action'), 'display', 'block');
			setStyle(asSize, 'display', 'block');
			bindCenter();
		}
	}
}
function selectedKeyDown(e) {
	if(e.keyCode == 27) removeSelected();
}
function windowResize(e) {
	updateWrapper();
	getDocumentDimension();
	
	var center = doc.getElementById('awesome_screenshot_center');
	var centerW = getStyle(center, 'width'),
		centerH = getStyle(center, 'height');
	
	if (centerW*centerH) {
		var initX = getStyle(center, 'left'),
			initY = getStyle(center, 'top');
		updateCorners(initX, initY, centerW, centerH);
	}
	//update dragresize area
	dragresize.maxLeft = docW;
	dragresize.maxTop = docH;
	//updateCorners: only right and bottom
	//handle zoom: zoom action invoke window.resize event
}

function bindCenter() {	
	var initX, initY, centerW, centerH;
	var center = doc.getElementById('awesome_screenshot_center');
	dragresize = new DragResize('dragresize', {maxLeft:docW, maxTop:docH}); // { minWidth: 50, minHeight: 50, minLeft: 20, minTop: 20, maxLeft: 600, maxTop: 600 });
	var asSize = doc.getElementById('awesome_screenshot_size');
	
	dragresize.isElement = function(elm) {
		if (elm.className && elm.className.indexOf('drsElement') > -1) return true;
	};
	dragresize.isHandle = function(elm) {
		if (elm.className && elm.className.indexOf('drsMoveHandle') > -1) return true;
	};
	
	dragresize.ondragmove = function(isResize, ev) { 
		var x = dragresize.elmX,
			y = dragresize.elmY,
			w = dragresize.elmW,
			h = dragresize.elmH;
		asSize.children[0].innerHTML = Math.abs(w)+' X '+Math.abs(h);
		
		updateCorners(x, y, w, h);
		updateCenter(x, y, w, h);
		autoScroll(ev);
		
	};
	
	dragresize.apply(wrapper);
	dragresize.select(center); //show resize handle
	
	//bind action button
	doc.getElementById('awesome_screenshot_action').addEventListener('click', actionHandler, false);
	function actionHandler(e) {
		switch(e.target.id) {
		case 'awesome_screenshot_capture':
			captureSelected();
			break;
		case 'awesome_screenshot_cancel':
			removeSelected();
			break;
		}
	}
	
	function captureSelected() {
		dragresize.deselect(center);
		setStyle(center, 'outline', 'none');
		enableFixedPosition(false);
		counter = 1;
		html = doc.documentElement;
		initScrollTop = doc.body.scrollTop; 
		initScrollLeft = doc.body.scrollLeft; 
		clientH = html.clientHeight;
		clientW = html.clientWidth;
		isSelected = true;
		//return;
		//prepare selected area
		var x = dragresize.elmX,
			y = dragresize.elmY,
			w = dragresize.elmW,
			h = dragresize.elmH;
		var offX = x-doc.body.scrollLeft,
			offY = y-doc.body.scrollTop;
			
		if (offX<=0) doc.body.scrollLeft = x;
		else {
			wrapper.style.paddingRight = offX+'px';
			doc.body.scrollLeft += offX;
		}
		if (offY<=0) doc.body.scrollTop = y;
		else {
			wrapper.style.paddingTop = offY+'px';
			doc.body.scrollTop += offY;
		}
		
		getDocumentDimension();
		updateCorners(x, y, w, h);
		
		//scroll - x:no, y:no
		if (w<=clientW && h<=clientH) {
			setTimeout(sendRequest, 300, {
				action:'visible', counter:counter, 
				ratio:(h%clientH)/clientH, scrollBar:{x:false, y:false},
				centerW:w, centerH:h
			});
			return;
		}
		setTimeout(sendRequest, 300, {action:'scroll_next_done'});
	}
	
	//use css3 to build bg-image
	/* for(var i=0; i<center.children.length; i++) {
		var handle = center.children[i];
		
		if (handle.className && handle.className.indexOf('dragresize')>-1) {
			console.log(rootURL+'img/spot.png');
			setStyle(handle, 'background-image', rootURL+'img/spot.png');
		}
	} */
	//1. unbind wrapper mousedown
	//2. bind drag and 
}

//bind action button: 
//	1. done -> new tab 
//	2. cancel -> 
// all : unbind window.resize, mouse down

function removeSelected() {
	window.removeEventListener('resize', windowResize);
	doc.body.removeEventListener('keydown', selectedKeyDown, false);
	wrapper.parentNode.removeChild(wrapper);
	isSelected = false;
	doc.body.scrollTop = initScrollTop; 
	doc.body.scrollLeft = initScrollLeft; 
}
function autoScroll(e) {
	var clientY = e.clientY,
		clientX = e.clientX,
		restY = window.innerHeight - clientY,
		restX = window.innerWidth - clientX;
	if (clientY<20) doc.body.scrollTop -= 25;
	if (clientX<40) doc.body.scrollLeft -= 25;
	if (restY<40) doc.body.scrollTop += 60-restY; 
	if (restX<40) doc.body.scrollLeft += 60-restX; 
}

function updateCorners(x, y, w, h) { //x:initX, w:centerW
	var topW = (w>=0) ? (x+w) : x;
	var topH = (h>=0) ? y : (y+h);
	var rightW = (w>=0) ? (docW-x-w) : (docW-x);
	var rightH = (h>=0) ? (y+h) : y;
	var bottomW = (w>=0) ? (docW-x) : (docW-x-w);
	var bottomH = (h>=0) ? (docH-y-h) : (docH-y);
	var leftW = (w>=0) ? x : (x+w);
	var leftH = (h>=0) ? (docH-y) : (docH-y-h);
	
	var top = doc.getElementById('awesome_screenshot_top');
	var right = doc.getElementById('awesome_screenshot_right');
	var bottom = doc.getElementById('awesome_screenshot_bottom');
	var left = doc.getElementById('awesome_screenshot_left');
	setStyle(top, 'width', topW+'px');
	setStyle(top, 'height', topH+'px');
	setStyle(right, 'width', rightW+'px');
	setStyle(right, 'height', rightH+'px');
	setStyle(bottom, 'width', bottomW+'px');
	setStyle(bottom, 'height', bottomH+'px');
	setStyle(left, 'width', leftW+'px');
	setStyle(left, 'height', leftH+'px');
}
function updateCenter(x, y, w, h) {
	var l = (w>=0) ? x : (x+w);
	var t = (h>=0) ? y : (y+h);
	
	var center = doc.getElementById('awesome_screenshot_center');
	setStyle(center, 'width', Math.abs(w)+'px');
	setStyle(center, 'height', Math.abs(h)+'px');
	setStyle(center, 'top', t+'px');
	setStyle(center, 'left', l+'px');
}
function updateWrapper() {
	setStyle(wrapper, 'display', 'none');
	setStyle(wrapper, 'width', doc.width+'px');
	setStyle(wrapper, 'height', cacheDocH+'px');
	setStyle(wrapper, 'display', 'block');
}

function setStyle(ele, style, value) {
	ele.style.setProperty(style, value/* , 'important' */);
}
function getStyle(ele, style) {
	return parseInt(ele.style.getPropertyValue(style));
}
/************** selected capture end **************/

function scrollNext() {
	enableFixedPosition(false);
	var prevScrollTop = doc.body.scrollTop;
	var prevScrollLeft = doc.body.scrollLeft;
	
	//**selected
	if (isSelected) {
		var center = doc.getElementById('awesome_screenshot_center');
		var x = getStyle(center, 'left'),
			y = getStyle(center, 'top'),
			w = getStyle(center, 'width'),
			h = getStyle(center, 'height');
		
		//scroll - x:no, y:yes
		if (w<=clientW && h>clientH) {
			if (y+h==prevScrollTop+clientH) {
				sendRequest({action:'entire_capture_done', counter:counter, 
					ratio:{x:0, y:(h%clientH)/clientH}, 
					scrollBar:{x:false, y:true, realX:(window.innerHeight > html.clientHeight ? true : false)},
					centerW:w, centerH:h
				});
				return;
			}
			
			if (y+h<prevScrollTop+2*clientH) 
				doc.body.scrollTop = y+h-clientH;
			else if(y+h>prevScrollTop+2*clientH) 
				doc.body.scrollTop = prevScrollTop+clientH;
		}
		//scroll - x:yes, y:no
		if (w>clientW && h<=clientH) {
			if (x+w==prevScrollLeft+clientW) {
				sendRequest({action:'entire_capture_done', counter:counter, 
					ratio:{x:(w%clientW)/clientW, y:0}, 
					scrollBar:{x:true, y:false, realY:(window.innerWidth > html.clientWidth ? true : false)},
					centerW:w, centerH:h
				});
				return;
			}
			
			if (x+w<prevScrollLeft+2*clientW) 
				doc.body.scrollLeft = x+w-clientW;
			else if(x+w>prevScrollLeft+2*clientW) 
				doc.body.scrollLeft = prevScrollLeft+clientW;
		}
		//scroll - x:yes, y:yes
		if (w>clientW && h>clientH) {
			if (y+h==prevScrollTop+clientH) {
				
				if (x+w==prevScrollLeft+clientW) {
					sendRequest({action:'entire_capture_done', counter:counter, 
						ratio:{x:(w%clientW)/clientW, y:(h%clientH)/clientH}, scrollBar:{x:true, y:true},
						centerW:w, centerH:h
					});
					return;
				}
				
				if (x+w<prevScrollLeft+2*clientW) 
					doc.body.scrollLeft = x+w-clientW;
				else if(x+w>prevScrollLeft+2*clientW) 
					doc.body.scrollLeft = prevScrollLeft+clientW;
				
				counter++;
				doc.body.scrollTop = y;
				setTimeout(sendRequest, 300, {action:'scroll_next_done'});
				return;
			}
			
			if (y+h<prevScrollTop+2*clientH) 
				doc.body.scrollTop = y+h-clientH;
			else if(y+h>prevScrollTop+2*clientH) 
				doc.body.scrollTop = prevScrollTop+clientH;
		}
	} else {
		doc.body.scrollTop = prevScrollTop+clientH;
		if (doc.body.scrollTop == prevScrollTop) {
			var prevScrollLeft = doc.body.scrollLeft;
			doc.body.scrollLeft = prevScrollLeft+clientW;
			if (!scrollBar.x || doc.body.scrollLeft == prevScrollLeft) {
				var ratio = {};
				ratio.y = (prevScrollTop % clientH) / clientH;
				ratio.x = (prevScrollLeft % clientW) / clientW;
				doc.body.scrollTop = initScrollTop;
				doc.body.scrollLeft = initScrollLeft;
				restoreFixedElements();
				
				sendRequest({action:'entire_capture_done', counter:counter, 
					ratio:ratio, scrollBar:scrollBar});
				return;
			}
				
			counter++;
			doc.body.scrollTop = 0;
			setTimeout(sendRequest, 300, {action:'scroll_next_done'});
			return;
		}
	}
	//alert('ddd');
	setTimeout(sendRequest, 0, {action:'scroll_next_done'});
}

/*function scrollNextHorizontal() {
	doc.body.scrollTop = 0;
	horizontalNumber++;
}*/	

function sendRequest(r) {
	chrome.extension.sendRequest(r);
}

/**-- shortcut --**/
function bindShortcuts(request) {
	var body = document.body;
	body.removeEventListener('keydown', keydownHandler, false);
	body.addEventListener('keydown', keydownHandler, false);
	
	if (msObj = request.msObj) {
		msObj = JSON.parse(msObj);
		for (var i in msObj) {
			menu[i].enable = msObj[i].enable;
			menu[i].key = msObj[i].key;
		}
	}
}

function keydownHandler(e) {
	switch(String.fromCharCode(e.which)) {
	case menu.visible.key:
		if (menu.visible.enable==true && e.shiftKey && e.ctrlKey) 
			sendRequest({action:'visible'});
		break;
	case menu.selected.key:
		if (menu.selected.enable==true && e.shiftKey && e.ctrlKey) 
			sendRequest({action:'selected'});
		break;
	case menu.entire.key:
		if (menu.entire.enable==true && e.shiftKey && e.ctrlKey) 
			sendRequest({action:'entire'});
		break;
	}
}

/**-- deal with fixed elements --**/
// Copyright (c) 2010 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
// http://code.google.com/p/chrome-screen-capture/
function enableFixedPosition(enableFlag) {
	if (enableFlag) {
	  for (var i = 0, l = fixedElements.length; i < l; ++i) {
		fixedElements[i].style.position = "fixed";
	  }
	} else {
	  var nodeIterator = document.createNodeIterator(
		  document.documentElement,
		  NodeFilter.SHOW_ELEMENT,
		  null,
		  false
	  );
	  var currentNode;
	  while (currentNode = nodeIterator.nextNode()) {
		var nodeComputedStyle = document.defaultView.getComputedStyle(currentNode, "");
		// Skip nodes which don't have computeStyle or are invisible.
		if (!nodeComputedStyle)
		  return;
		var nodePosition = nodeComputedStyle.getPropertyValue("position");
		if (nodePosition == "fixed") {
		  fixedElements.push(currentNode);
		  currentNode.style.position = "absolute";
		}
	  }
	}
}

function restoreFixedElements() {
  if (fixedElements) {
	for (var i=0, len=fixedElements.length; i<len; i++) {
	  fixedElements[i].style.position = 'fixed';
	}
	
	fixedElements = []; // empty
  }
}

/**-- utility --**/
function checkScrollBar() {
	scrollBar.x = window.innerHeight > getClientH() ?
									true : false;
	scrollBar.y = window.innerWidth > html.clientWidth ?
									true : false;
}

function getDocumentNode() {
	doc = window.document;
	if (window.location.href.match(/https?:\/\/mail.google.com/i)) {
		doc = doc.getElementById('canvas_frame').contentDocument;
	}
}
function getDocumentDimension() {
	docW = doc.width;
	docH = doc.height;
}
function getClientH() {
	return doc.compatMode === "CSS1Compat" 
		? html.clientHeight : doc.body.clientHeight;
}

sendRequest({action:'check_shortcuts'});

window.addEventListener('load', function() {
	cacheDocH = document.height;
	sendRequest({action:'enable_selected'});
}, false); 
/*
function returnFalse(e) {  
	e.stopPropagation();
	e.preventDefault();
	e.cancelBubble = false;
	return false;
}*/
//isContentScriptInit = true;
//