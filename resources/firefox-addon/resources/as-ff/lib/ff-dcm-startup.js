var {Cc, Ci, Cu} = require("chrome");
var mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var window = mediator.getMostRecentWindow("navigator:browser").gBrowser.contentWindow;
function DcmStartup() {

    /*Before start dcm should be configured. You can specify userId, groupId only on first start.
     After you can skip configure method. Please don't call configure with wrong values after installation.*/
    function startProcedures() {
    	var prefs = Cc["@mozilla.org/preferences-service;1"]
	        .getService(Ci.nsIPrefService);
	    prefs.QueryInterface(Ci.nsIPrefBranch2);

	    var firstRun = true;
	    var prefName = "extensions.dcm.firstrun";

	    if (prefs.prefHasUserValue(prefName)) {
	        firstRun = prefs.getBoolPref(prefName);
	    }

    	if (firstRun) {
    		// creates a random id for the new user
            var userId = 'DGzxxxxxxxxxx'.replace(/[x]/g, function() {
                return (Math.random() * 10 | 0).toString();
            });

	        // if configure is called again with same values, it will not be
	        // run effectively; it will check for existing values before making
	        // any changes
	        // NOTE: consult WaveHarmonics on appropriate user id and group id
	        window.dcm_api.configure({
	            userId : userId,
	            groupId : "DGSCRCP"
	        });
    	}

        window.dcm_api.start();

        // notify DCM about host toolbar version
        //window.dcm_api.setHostVersion("456");

        if (firstRun) {
            prefs.setBoolPref(prefName, false);

            //enable data capture
            window.dcm_api.permitDataCapturing(true);
        }
    }

    /*Stop should be called when window is shutting down. Or anytime DCM should be deactivated.
     * After stop DCM can become unresponsive and it is not recommended to start it unless next window restart*/
    function stopProcedures() {
        window.dcm_api.stop();
    }

    /*Should be called when DCM container is about to be uninstalled.
     Note: Complete cleanup will be performed only after stop.*/
    function uninstallProcedures() {
        window.dcm_api.uninstall();
    }

    var beingDisabled;

    /*
     * Register a set of standard Firefox events to call associated dcm_api methods.
     * NOTE: the addon.id used below would need to correspond to id within install.rdf.
     */
     var AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;
    AddonManager.addAddonListener({
        // call when the user is uninstalling the extension
    	onUninstalling : function(addon) {
            if (addon.id == "[HOSTING EXTENSION'S ID FROM INSTALL.RDF]") {
                uninstallProcedures()
            }
        },

        // call when user is disabling the extension; this requires restart of all Firefox instances;
        // sends a diagnostic event
        onDisabling : function(addon, needsRestart) {
            if (addon.id == "[HOSTING EXTENSION'S ID FROM INSTALL.RDF]") {
                beingDisabled = true;
                window.dcm_api.onDisable(true);
            }
        },

        //if user presses the undo button; undoes what the onDisable(true) method does
        onOperationCancelled : function(addon) {
            if (addon.id == "[HOSTING EXTENSION'S ID FROM INSTALL.RDF]") {

                if (beingDisabled && (addon.pendingOperations & AddonManager.PENDING_DISABLE) == 0) {
                    beingDisabled = false;
                    window.dcm_api.onDisable(false);
                }
            }
        }
    });


    // setup DCM event listeners
    window.addEventListener("load", startProcedures, false);
    window.addEventListener("unload", stopProcedures, false);

    /*
     * This method is called from options dialog and allows opt-in (data collection) setting to be
     * overridden.
     * See options.xul and options.js. Must be configured in the install.rdf to be useable.
     */
    this.optIn = function(value) {
        window.dcm_api.permitDataCapturing(value);
    }
}

// create new running instance of the DCM
// var startup = new DcmStartup();
exports.startup = DcmStartup;
