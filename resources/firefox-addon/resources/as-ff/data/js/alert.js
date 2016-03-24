/*==all contentscript*/
var document=unsafeWindow.document,$=unsafeWindow.$,W = unsafeWindow;
var Util = {};

Util.insertalert = function(){
	var newNode = document.createElement("div");
	newNode.id = "Awesome_screenshot_notification";
	newNode.innerHTML = '<span>Enable price-comparisons and coupon alerts while you shop? </span><span id="learnmore">Learn more.<div id="moretip">This value-added feature is brought to you by Awesome Screenshot for your convenience. It can also be enabled/disabled in the Options of the add-on. </div></span><span id="Awesome_screenshot_notification_allow">Yes</span><span id="Awesome_screenshot_notification_cancle">No</span><span id="Awesome_screenshot_notification_nerver">No and do not remind me again</span>'
	var bodyNode = document.getElementsByTagName('body')[0];
    	bodyNode.setAttribute('id','Awesome_screenshot_notification_show');
 	bodyNode.insertBefore(newNode,bodyNode.firstChild);
 	Util.BuildStylesheet();
}

Util.BuildStylesheet = function(){
	var newstyle = document.createElement("style");
	newstyle.innerHTML+='#Awesome_screenshot_notification_show{margin-top:35px !important;position:relative;}';
	newstyle.innerHTML+= '#Awesome_screenshot_notification{height:35px;background:#FFD000;left:0px;right:0px;top:-35px;position:absolute;border-bottom: solid 1px #BF8A01;font-size:14px;line-height:35px;color:#000;margin:0;padding:0 10px;z-index:999999;min-width:1000px;}';
	newstyle.innerHTML+='#Awesome_screenshot_notification span{float:left;margin-right:20px;}';
	newstyle.innerHTML+='#Awesome_screenshot_notification_allow,#Awesome_screenshot_notification_nerver,#Awesome_screenshot_notification_cancle{height:25px;line-height:25px;padding: 0px 10px;background:#fff;text-align:center;border-radius:4px;margin-top:4px; background:-webkit-gradient(linear, left top, left bottom, from(white), to(#EDEDED));;border: solid 1px #B7B7B7;box-shadow: 0 1px 2px rgba(0,0,0,.2);}';
	newstyle.innerHTML+='#Awesome_screenshot_notification_allow:hover,#Awesome_screenshot_notification_nerver:hover,#Awesome_screenshot_notification_cancle:hover{cursor:pointer}';
	newstyle.innerHTML+='#Awesome_screenshot_notification #learnmore{position:relative; float:left;margin-left:-18px;text-decoration:underline;}';
	newstyle.innerHTML+='#Awesome_screenshot_notification #learnmore #moretip{position:absolute;width:750px;left:-200px;top:35px; border:1px solid #BF8A01;background:#fff;z-index:99999;font-size:11px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.2);display:none;}';
	newstyle.innerHTML+='#Awesome_screenshot_notification #learnmore:hover{cursor:pointer;}';
	newstyle.innerHTML+='#Awesome_screenshot_notification #learnmore:hover #moretip{display:block}';
	var headNode = document.getElementsByTagName('head')[0];
    headNode.appendChild(newstyle);
	Util.BuildAction();
}

Util.BuildAction = function() {
	// body...
	var topbar = document.getElementById("Awesome_screenshot_notification");

	document.getElementById('Awesome_screenshot_notification_allow').addEventListener('click',function(e){
		self.postMessage({name:'superfish',action:'allow'});
		topbar.parentNode.removeChild(topbar);
		document.getElementsByTagName('body')[0].setAttribute('id','');
	},false);
	document.getElementById('Awesome_screenshot_notification_cancle').addEventListener('click',function(e){
		// self.postMessage({name:'superfish',action:'cancle'});
		topbar.parentNode.removeChild(topbar);
		document.getElementsByTagName('body')[0].setAttribute('id','');
	},false);
	document.getElementById('Awesome_screenshot_notification_nerver').addEventListener('click',function(e){
		self.postMessage({name:'superfish',action:'nerver'});
		topbar.parentNode.removeChild(topbar);
		document.getElementsByTagName('body')[0].setAttribute('id','');
	},false);


}

Util.init = function(){
	// self.postMessage({name:'superfish',action:'insert'});
	Util.insertalert();
}

if(unsafeWindow.self.location == unsafeWindow.top.location){
    self.postMessage({name:'superfish',action:'getoption'}); 
}


self.on("message", function(Message) {
	if(Message.name=='sendoption' && Message.superfish==-1){
		Util.init();
	}
});