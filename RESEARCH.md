### Mac OS resources

**Take a screenshot with mouse select and save as clipboard.**
`screencapture -s -c`

```sh
usage: screencapture [-icMPmwsWxSCUtoa] [files]
  -c         force screen capture to go to the clipboard
  -C         capture the cursor as well as the screen. only in non-interactive modes
  -d         display errors to the user graphically
  -i         capture screen interactively, by selection or window
               control key - causes screen shot to go to clipboard
               space key   - toggle between mouse selection and
                             window selection modes
               escape key  - cancels interactive screen shot
  -m         only capture the main monitor, undefined if -i is set
  -M         screen capture output will go to a new Mail message
  -o         in window capture mode, do not capture the shadow of the window
  -P         screen capture output will open in Preview
  -s         only allow mouse selection mode
  -S         in window capture mode, capture the screen not the window
  -t<format> image format to create, default is png (other options include pdf, jpg, tiff and other formats)
  -T<seconds> Take the picture after a delay of <seconds>, default is 5
  -w         only allow window selection mode
  -W         start interaction in window selection mode
  -x         do not play sounds
  -a         do not include windows attached to selected windows
  -r         do not add dpi meta data to image
  -l<windowid> capture this windowsid
  -R<x,y,w,h> capture screen rect
  -B<bundleid> screen capture output will open in app with bundleidBS
  files   where to save the screen capture, 1 file per screen
```

### Module JPM
https://github.com/bit/subprocess

`subprocess.jsm` - start a process in your Firefox Extension and read/write data to/from it using stdin/stdout/stderr streams.


### JS resources

##### Save image from clipboard
```js
var image = "data:image/png;base64,...";

var io         = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
var channel    = io.newChannel(image, null, null);
var input      = channel.open();
var imgTools   = Components.classes["@mozilla.org/image/tools;1"].getService(Components.interfaces.imgITools);

var container  = {};
imgTools.decodeImageData(input, channel.contentType, container);

var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
trans.addDataFlavor("image/png");
trans.setTransferData("image/png", container.value, -1);

var clipid = Components.interfaces.nsIClipboard;
var clip   = Components.classes["@mozilla.org/widget/clipboard;1"].getService(clipid);
clip.setData(trans, null, clipid.kGlobalClipboard);
```


### MDN resources

https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Using_the_clipboard

https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIClipboard

https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIClipboardHelper

https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIFile
