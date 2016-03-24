var {Cc, Ci, Cu} = require("chrome");
var mediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
var window = mediator.getMostRecentWindow("navigator:browser").gBrowser.contentWindow;

        (function(window) {
        /**
 Interface for component. Every component should be derived from this interface
 @constructor
 */
function ComponentInterface() {
    /** Create the component
     * @param {Object} config of the application
     */
    this.create = function(config) {};

    /** Clear any data the component may create */
    this.cleanup = function() {};

    /** Destroy component */
    this.destroy = function() {};

    /* Notify component about options
    * @param {Object} options to use*/
    this.options = function(options) {};
}


/**
 Application context. Manages components (registration, creation, destroy, clean). Can work as another component
 @param {String} name of the context
 @extents ComponentInterface
 @constructor
 */
function DCMContext(name) {
    ComponentInterface.call(this);
    var configuration = {};
    var componentsMap = {};
    var logDump = [];

    function getComponent(name) {
        var component = componentsMap[name];
        if (!component) {
            throw "Unknwown Component with name: "+name;
        }
        return component;
    }

    function checkCircularReference(component) {
        if (component.progress) {
            throw "Circular reference detected on element: "+component.name;
        }
        component.progress = true;
    }

    function executeCreate(component, initializedMap) {
        try {
            if (typeof component.loader == "function") {
                component.loader = new component.loader();
            }
            component.loader.create(configuration);
            initializedMap[component.name] = true;
        } catch (e) {
            throw "Error during component load: "+e;
        }
    }

    function createDependencies(component, initializedMap) {
        for (var i = 0; i < component.dependencies.length; i++) {
            var dependentComponent = getComponent(component.dependencies[i]);
            createComponent(dependentComponent, initializedMap);
        }
    }

    function createComponent(component, initializedMap) {
        if (initializedMap[component.name]) {
            return;
        }

        try {
            checkCircularReference(component);
            createDependencies(component, initializedMap);
            executeCreate(component, initializedMap);
        } catch (e) {
            throw e+"\nCannot load component: "+component.name;
        }
    }

    function destroyChilds(component, destroyedMap) {
        var componentName = component.name;
        for (var childName in componentsMap) {
            var childComponent = getComponent(childName);
            if (childComponent.dependencies.indexOf(componentName) > -1 && !destroyedMap[componentName]) {
                destroyComponent(childComponent, destroyedMap);
            }
        }
    }

    function executeDestroy(component, destroyedMap) {
        try {
            component.loader.destroy();
        } catch (e) {
            //destruction errors. ignore
        }
        destroyedMap[component.name] = true;
    }

    function destroyComponent(component, destroyedMap) {
        if (destroyedMap[component.name]) {
            return;
        }

        destroyChilds(component, destroyedMap);
        executeDestroy(component, destroyedMap);
    }

    function cleanupUnitializedComponents(initializedMap) {
        for (var componentName in componentsMap) {
            if (!initializedMap[componentName]) {
                delete componentsMap[componentName];
            }
        }
    }

    /**
     Register component in application
     @param {String} name Unique name of current component
     @param {String[]} dependencies List of dependent components
     @param {ComponentInterface|Function} component Component object or constructor to create it.
     */
    this.addComponent = function(name, dependencies, component) {
        componentsMap[name] = {
            name: name,
            loader: component,
            dependencies: dependencies,
            progress: false
        }
    };

    function logStartupErrors(context) {
        if (logDump.length == 0) {
            return;
        }

        try {
            var logger = context.loggerFactory.getLogger("DCMContext");
            logger.error("Initialization errors:\n" + logDump.join("\n"));
        } catch (e) {
            //in case logging is broken anyway.
        }
        logDump = [];
    }

    /**
     Start Application
     @param {Object} config of the application
    */
    this.create = function(config) {
        configuration = config;
        var initializedMap = {};
        for (var name in componentsMap) {
            try {
                var component = getComponent(name);
                createComponent(component, initializedMap);
            } catch (e) {
                logDump.push(e.toString());
                //cannot initialize some component. good place for logging;
//                alert(e);
            }
        }
        cleanupUnitializedComponents(initializedMap);
        logStartupErrors(this);
    };

    /** Stop application*/
    this.destroy = function() {
        var destroyedMap = {};
        for (var name in componentsMap) {
            try {
                var component = getComponent(name);
                destroyComponent(component, destroyedMap);
            } catch (e) {
                //cannot destroy some component. ignore
            }
        }
    };

    /** Clean any data crated by components (Uninstall)*/
    this.cleanup = function() {
        for (var name in componentsMap) {
            try {
                var component = getComponent(name);
                component.loader.cleanup();
            } catch (e) {
                //error during data cleanup. good place for logging;
            }
        }
    };

    /** Notify components about new external options*/
    this.options = function(options) {
        for (var name in componentsMap) {
            try {
                var component = getComponent(name);
                component.loader.options(options);
            } catch (e) {
                //error during calling options. ignore
            }
        }
    };

    /** Return context name
     * @return String*/
    this.getName = function() {
        return name;
    }
}


/** Interface of the browser for DCM to interact with it.
 * @constructor */
function BrowserInterface() {
    /** Returns if privacy mode is currently enabled. Use messages to get state changes.
     * @param {Function(ignoreAll, tabs)} callback to notify about results
     * @param {Boolean} callback.ignoreAll Indicates whether the data from all tabs should be discarded
     * @param {Array} callback.tabs The array of tab ids for which privacy mode is enabled.
     * Do not use when callback.ignoreAll is true */
    this.isPrivacyModeEnabled = function(callback) {
    };

    /** Open Custom modal dialog in browser
     * @param {Object} config of the dialog
     * @param {String} config.title of the dialog
     * @param {String} config.text to display on dialog
     * @param {String} config.accept name of accept button
     * @param {String} config.reject name of reject button
     * @param {Function} [callback] The callback to be called when user closes dialog
     * @return {Boolean} If user accepted or discarded dialog question
     * */
    this.openDialog = function(config, callback) {
        return false;
    }
}

/** Interface of the Remote {@link BrowserInterface}
 * @extends BrowserInterface
 * @constructor*/
function RemoteBrowserInterface() {
    BrowserInterface.call(this);
    RemoteObjectSpec.call(this, {
        name: MESSAGING_DATA.REMOTE_BROWSER_COMPONENT,
        quietMethods: [],
        responseMethods: ["isPrivacyModeEnabled"]
    })
}


/** Communication Component which initialize communication mechanism in your context
 * @param {DCMContext} context of application
 * @constructor */
function CommunicationComponent(context) {
    ComponentInterface.call(this);

    this.create = function(config) {
        /** Communication related instances
         * @memberOf dcm
         * @memberOf engine */
        context.communication = {};

        /** Instance of client communication controller. Do not use it directly
         * @memberOf dcm
         * @type CommunicationController */
        context.communication.controller = new CommunicationController(context);
        context.communication.factory = new CommunicationFactory(context);
        context.communication.remote = new RemoteCallsController(context);
    }
}


/** Main class for sending/receiving messages.
 * @extends CommunicationControllerInterface
 * @constructor */
function CommunicationController() {
    CommunicationControllerInterface.call(this);
    ReceieversHandlerMixin.call(this);
    var transmitter;

    function notifyTransmitter(subject, topic, data) {
        if (transmitter) {
            var serialized = serializeData(data);
            transmitter.receive(subject, topic, serialized)
        }
    }

    function parseData(data) {
        return JSON.parse(data);
    }

    function serializeData(data) {
        if (data === undefined || data === null) {
            return JSON.stringify(null)
        } else if (data && data.getJson) {
            return data.getJson();
        } else {
            return JSON.stringify(data);
        }
    }

    this.send = function(subject, topic, data) {
        this.notifyReceivers(subject, topic, data);
    };

    this.transmit = function(subject, topic, data) {
        notifyTransmitter(subject, topic, data);
    };

    this.receive = function(subject, topic, data) {
        var parsed = parseData(data);
        this.notifyReceivers(subject, topic, parsed);
    };

    this.setTransmitter = function(theTransmitter) {
        transmitter = theTransmitter;
    };
}


/** Interface of the communication object
 * @constructor */
function CommunicationControllerInterface() {
    /** Send message to receivers
     * @param {String} subject of the message
     * @param {String} topic of the message
     * @param {Object|MessageData} data of the message*/
    this.send = function(subject, topic, data) {};

    /** Receive message from another communication controller
     * @param {String} subject of the message
     * @param {String} topic of the message
     * @param {String} data of the message*/
    this.receive = function(subject, topic, data) {};

    /** Transmit message to another context
     * @param {String} subject of the message
     * @param {String} topic of the message
     * @param {Object|MessageData} data of the message*/
    this.transmit = function(subject, topic, data) {};

    /** Set transmitter which will be transferring messages to another communication controller
     * @param {CommunicationControllerInterface} theTransmitter */
    this.setTransmitter = function(theTransmitter) {};

    /** Add messages receiver
     * @param {String} subject of the message to receive
     * @param {Function} receiver function*/
    this.addReceiver = function(subject, receiver) {};

    /** Remove messages receiver
     * @param {String} subject of the message to receive
     * @param {Function} receiver function*/
    this.removeReceiver = function(subject, receiver) {};
}

/** Communication classes factory. Used to create messages sender/recievers.
 * Instance can be found in {@link dcm.communicatino.factory} or {@link engine.communication.factory}
 * @param {DCMContext} context of the application where classes should be created
 * @constructor */
function CommunicationFactory(context) {
    /** Create instance of {@link MessageRecieverMixin}
     @param {String} subject component/class specific name for which messages should be accepted
     @param {String} [topic='.*'] regexp pattern or specifc message type that should be accepted. Accepts all messages from this component if ommited
     @return {MessageRecieverMixin}
     */
     this.createReciever = function(subject, topic) {
        return new MessageRecieverMixin(context, subject, topic);
    };

    /** Extend your class with methods of {@link MessageRecieverMixin}
     @param {Object} self pointer to class which should be extended
     @param {String} subject component/class specific name for which messages should be accepted
     @param {String} [topic='.*'] regexp pattern or specifc message type that should be accepted. Accepts all messages from this component if ommited
     */
    this.extendReciever = function(self, subject, topic) {
        MessageRecieverMixin.call(self, context, subject, topic);
    };

    /** Create instance of {@link MessageSenderMixin}
     @return {MessageSenderMixin}
     */
    this.createSender = function() {
        return new MessageSenderMixin(context);
    };

    /** Extend your class with methods of {@link MessageSenderMixin}
     * @param {Object} self pointer to class which should be extended
     * */
    this.extendSender = function(self) {
        MessageSenderMixin.call(self, context);
    };
  }

/** Debugging class which listen to messages and shows them using alerts
 * @param subject message name
 * @param [topic] message type
 * @class*/
function DebugMessageReceiver(subject, topic) {
    MessageRecieverMixin.call(this, subject, topic);

    this.onMessage = function(topic, data) {
        alert("subject: " + subject + "\ntopic:  " + topic + "\ndata:   " + data);
    }
}

/** Message data object. Allow to has custom serialize procedures.
 * @constructor */
function MessageData() {
    /** Override this method to return plain object that can be transmitted
     * @return {Object} */
    this.getJson = function() {
        return {};
    }
}

/**
 Allows to listen for messages sent by other components or client code. Can be used as mixin or standalone class.
 Avoid direct usage. Use context.communication.factory to create.
 @param {DCMContext} context dcm or engine context. Depends on location of user
 @param {String} subject component/class specific name for which messages should be accepted
 @param {String} [topic='.*'] regexp pattern or specifc message type that should be accepted. Accepts all messages from this component if ommited
 @constructor
 */
function MessageRecieverMixin(context, subject, topic) {
    var self = this;
    var acceptedTopic = new RegExp(topic ? topic : MESSAGING_DATA.ANY_TOPIC);

    function receiverFunction(topic, data) {
        if (acceptedTopic.test(topic)) {
            self.onMessage(topic, data);
        }
    }

    context.communication.controller.addReceiver(subject, receiverFunction);

    /** Execute to stop listening for the messages. */
    this.unregister = function() {
        context.communication.controller.removeReceiver(subject, receiverFunction)
    };

    /**
    * Override this method to recieve messages specified in the constructor subject/topic parameters
    * @param {String} topic type of recieved message
    * @param data data send by the component. */
    this.onMessage = function(topic, data) {};
}

/** Allows to send messages that can be recieved by {@link MessageRecieverMixin}
 * @constructor
 * */
function MessageSenderMixin(context) {

    function checkParameters(subject, topic) {
        if (!subject || !topic) {
            throw "Incorrect message parameters";
        }
    }

    /** Send required messages
     * @param {String} subject message name
     * @param {String} topic message type
     * @param [data=undefined] message data*/
    this.send = function(subject, topic, data) {
        checkParameters(subject, topic);
        context.communication.controller.send(subject, topic, data);
    };

    /** Transmit required messages to another context
     * @param {String} subject message name
     * @param {String} topic message type
     * @param {Object} data of the message. Should be JSON serializable*/
    this.transmit = function(subject, topic, data) {
        checkParameters(subject, topic);
        context.communication.controller.transmit(subject, topic, data);
    }
}

/** List of subject/topics which used in the client/engine communication.*/
var MESSAGING_DATA = {
    ANY_TOPIC : ".*",

    APPLICATION_LOG_SUBJECT : "application-log",

    REQUEST_MONITORING_SUBJECT : "monitoring-requests",
    REQUEST_MONITORING_DATA_READY : "request-data-availabale",

    PRIVACY_MODE_SUBJECT : "privacy-mode",
    PRIVACY_MODE_ENABLED : "entering-privacy-mode",
    PRIVACY_MODE_DISABLED : "exiting-privacy-mode",

    XHR_REMOTE_FUNCTION_SUBJECT : "xhr-executor-remote-function",
    REMOTE_DISK_STORAGE : "remote-disk-storage",
    REMOTE_SETTINGS_STORAGE : "remote-settings-storage",
    REMOTE_BROWSER_COMPONENT : "remote-browser-component",

    REMOTE_OBJECT_SUBJECT : "remote-objects",
    REMOTE_OBJECT_CREATE_TOPIC : "create-object",
    REMOTE_OBJECT_DESROY_TOPIC : "destroy-object",

    ENGINE_WORKER_SUBJECT : "engine-worker",
    WORKER_ERROR_TOPIC : "worker-code-error",
    WORKER_CODE_EXIST_TOPIC : "worker-class-ready",

    ENGINE_CREATE_TOPIC : "engine-create-command",
    ENGINE_CREATED_TOPIC : "engine-created-command",
    ENGINE_DESTROY_TOPIC : "engine-destroy-command",
    ENGINE_OPTIONS_TOPIC : "engine-options-command",
    ENGINE_CLEANUP_TOPIC : "engine-cleanup-command"
};


function ReceieversHandlerMixin() {
    var allReceivers = {};

    function getReceivers(subject) {
        if (!allReceivers[subject]) {
            allReceivers[subject] = [];
        }
        return allReceivers[subject];
    }


    this.addReceiver = function(subject, receiver) {
        var receivers = getReceivers(subject);
        receivers.push(receiver);
    };

    this.removeReceiver = function(subject, receiver) {
        var receivers = getReceivers(subject);
        var index = receivers.indexOf(receiver);
        if (index > -1) {
            receivers.splice(index, 1);
        }
    };

    this.notifyReceivers = function(subject, topic, data) {
        var receivers = getReceivers(subject);
        for (var i = 0; i < receivers.length; i++) {
            try {
                receivers[i](topic, data);
            } catch (e) {
                //ignore notifications errors for now
            }
        }
    }

}

/** Controller of remote calls for DCM registers Remote Objects. Create Remote Functions.
 * Use aleady created instance from {@link dcm.controller.remote} or {@link engine.controller.remote}
 * @param {DCMContext} context of the current controller
 * @constructor */
function RemoteCallsController(context) {
    var factory = new RemoteObjectsFactory(context);


    /** Register class as target for Remote Object calls
     * @param {Function} interfaceConstructor of Remote Object which has {@link RemoteObjectSpec}
     * @param {Function} targetConstructor constructor of Remote Object which extends interface and {@link RemoteObjectTarget}*/
    this.registerRemoteTarget = function(interfaceConstructor, targetConstructor) {
        factory.registerRemoteObject(interfaceConstructor, targetConstructor);
    };

    /** Create instance of {@link RemoteFunctionTarget} to process remote calls
     * @param {String} name of the remote function
     * @param {Function} callback to process remote calls
     * @return RemoteFunctionTarget*/
    this.createRemoteFunctionTarget = function(name, callback) {
        return new RemoteFunctionTarget(context, name, callback);
    };

    /** Create instance of {@link RemoteFunctionSource} to execute remote calls
     * @param {String} name of the remote function
     * @return RemoteFunctionSource */
    this.createRemoteFunctionSource = function(name) {
        return new RemoteFunctionSource(context, name)
    };

    /** Create instance of {@link RemoteFunctionQuietTarget} to process quiet remote calls
     * @param {String} name of the remote function
     * @param {Function} callback to process remote calls
     * @return RemoteFunctionQuietTarget*/
    this.createQuietRemoteFunctionTarget = function(name, callback) {
        return new RemoteFunctionQuietTarget(context, name, callback);
    };

    /** Create instance of {@link RemoteFunctionQuietSource} to execute one way remote calls
     * @param {String} name of the remote function
     * @return RemoteFunctionQuietSource */
    this.createQuietRemoteFunctionSource = function(name) {
        return new RemoteFunctionQuietSource(context, name)
    };

    /** Extend current Object with Remote Object Source functionality
     * @param {Object} self current class
     * @param {Array} args of the constructor*/
    this.extendRemoteObjectSource = function(self, args) {
        RemoteObjectSource.call(self, context, args);
    };

    /** Extend current Object with Remote Object Target functionality
     * @param {Object} self current class
     * @param {Object?} target of calls. leave blank to use self as target
     * */
    this.extendRemoteObjectTarget = function(self, target) {
        target = target ? target : self;
        RemoteObjectTarget.call(self, context, target);
    };
 }

/** Remote Function source which doesn't expect any response
 * @extend FunctionMessagesSender
 * @constructor*/
function RemoteFunctionQuietSource(context, name) {
    RemoteFunctionSource.call(this, context, name);

    var parentCall = this.callRemote;

    this.callRemote = function(data) {
        var args = this.convertArguments(arguments, 0);
        args.unshift(function() {});
        parentCall.apply(this, args);
    }
}

/** Remote Function quiet Target which doesn't provide any feedback
 * @extends RemoteFunctionTarget
 * @constructor */
function RemoteFunctionQuietTarget(context, name, method) {
    RemoteFunctionTarget.call(this, context, name, quietCallback);
    var self = this;

    function quietCallback(callback) {
        var args = self.convertArguments(arguments, 1);
        method.apply(method, args);
        callback(true);
    }
}

/** Performs Remote Function calls by name. Do not create manually use {@link CommunicationFactory}
 * @param {DCMContext} context current context
 * @param {String} name of the remote function
 * @extends MessageRecieverMixin
 * @extends RemoteUtils
 * @constructor*/
function RemoteFunctionSource(context, name) {
    RemoteUtils.call(this);
    context.communication.factory.extendReciever(this, name+"-response");

    var callerId = this.generateId();
    var callCount = 0;
    var callbacks = {};
    var sender = context.communication.factory.createSender();

    function getCallId() {
        callCount++;
        return callerId+"."+callCount;
    }

    /** Perform call to Remote Function
     * @param {Function} callback to receive results
     * @param {Object} data to send in remote function*/
    this.callRemote = function(callback, data) {
        var args = this.convertArguments(arguments, 1);
        var callId = getCallId();
        callbacks[callId] = callback;
        sender.transmit(name+"-call", callId, args);
    };

    this.onMessage = function responseArrived(topic, data) {
        data = data.slice();
        var callback = callbacks[topic];
        callback.apply(callback, data);
        delete callbacks[topic];
    };
}

/** Receives remote calls by name and forwards execution to the method. Do not create manually use {@link CommunicationFactory}
 * @param {DCMContext} context current context
 * @param {String} name of Remote function
 * @param {Function} method to process remote calls
 * @extends MessageRecieverMixin
 * @extends RemoteUtils
 * @constructor */
function RemoteFunctionTarget(context, name, method) {
    RemoteUtils.call(this);

    var self = this;
    var sender = context.communication.factory.createSender();
    context.communication.factory.extendReciever(this, name+"-call");

    function generateResponseCallback(topic) {
        return function() {
            var args = self.convertArguments(arguments, 0);
            sender.transmit(name+"-response", topic, args);
        }
    }

    this.onMessage = function(topic, data) {
        data = data.slice();
        data.unshift(generateResponseCallback(topic));
        method.apply(method, data);
    }
}

/** Handles construction of Remote objects. Contain list of registered Remote Objects
 * @constructor */
function RemoteObjectsFactory(context) {
    context.communication.factory.extendReciever(this, MESSAGING_DATA.REMOTE_OBJECT_SUBJECT);

    var logger = context.loggerFactory.getLogger("communication.RemoteObjectsFactory");

    var remoteObjects = {};
    var remoteConstructors = {};

    function construct(constructor, args) {
        function F() {
            return constructor.apply(this, args);
        }
        F.prototype = constructor.prototype;
        return new F();
    }

    function constructObject(data) {
        logger.debug("Constructing remote target: "+data.interfaceName);
        var objectConstructor = remoteConstructors[data.interfaceName];
        if (objectConstructor) {
            try {
                var args = data.constructorArguments;
                args.unshift(context);
                var instance = construct(objectConstructor, args);
                var instanceId = data.instancesId;
                instance.initRemoteTarget(instanceId);
                remoteObjects[instanceId] = instance;
                logger.debug("Remote target constructed.");
            } catch (e) {
                logger.error("Cannot construct remote target: "+e);
            }
        } else {
            logger.debug("Remote target is not registered.")
        }
    }

    function destroyObject(instanceId) {
        var object = remoteObjects[instanceId];
        if (object) {
            logger.debug("Destroying remote target: "+instanceId);
            delete remoteObjects[instanceId];
            object.destroy();
        } else {
            logger.debug("Cannot destroy remote target. Instance not found: "+instanceId);
        }
    }

    this.onMessage = function(topic, data) {
        if (topic == MESSAGING_DATA.REMOTE_OBJECT_CREATE_TOPIC) {
            constructObject(data);
        } else if (topic == MESSAGING_DATA.REMOTE_OBJECT_DESROY_TOPIC) {
            destroyObject(data);
        }
    };

    this.registerRemoteObject = function(interfaceConstructor, targetConstructor) {
        var interfaceInstance = new interfaceConstructor();
        logger.info("Registering remote target: "+interfaceInstance.getRemoteName());
        remoteConstructors[interfaceInstance.getRemoteName()] = targetConstructor;
    }
}

/** Extend this object to receive functionality of Remote Object source.
 * Your object should extend {@link RemoteObjectSpec}.
 * As result if you will call methods specified in specification target will be called automatically.
 * Do not create manually use {@link RemoteCallsController}
 * @param {DCMContext} context of your applicaiton
 * @param {Arguments} constructorArguments passed during creation of your object.
 * @constructor*/
function RemoteObjectSource(context, constructorArguments) {
    var self = this;
    var remoteFunctions = [];
    var sender = context.communication.factory.createSender();

    createResponseMethods(this.getResponseMethods(), "createRemoteFunctionSource");
    createResponseMethods(this.getQuietMethods(), "createQuietRemoteFunctionSource");
    createRemoteObject();

    function createRemoteObject() {
        var args = self.convertArguments(constructorArguments, 0);
        sender.transmit(MESSAGING_DATA.REMOTE_OBJECT_SUBJECT, MESSAGING_DATA.REMOTE_OBJECT_CREATE_TOPIC, {
            interfaceName: self.getRemoteName(),
            instancesId: self.getInstanceId(),
            constructorArguments: args})
    }

    function createResponseMethods(methodNames, constructionName) {
        for (var i = 0; i < methodNames.length; i++) {
            var methodName = methodNames[i];
            var methodId = self.constructMethodId(methodName);
            var func = context.communication.remote[constructionName](methodId);
            remoteFunctions.push(func);
            createMethod(methodName, func);
        }
    }

    function createMethod(name, remoteFunction) {
        self[name] = function() {
            var args = self.convertArguments(arguments, 0);
            remoteFunction.callRemote.apply(remoteFunction, args);
        }
    }

    this.destroy = function() {
        sender.transmit(MESSAGING_DATA.REMOTE_OBJECT_SUBJECT, MESSAGING_DATA.REMOTE_OBJECT_DESROY_TOPIC, self.getInstanceId());
        for (var i = 0; i < remoteFunctions.length; i++) {
            remoteFunctions[i].unregister();
        }
    }
}

/** Specification of Object which can be instantiated and interacted remotely
 *  Interfaces should extend this Class to allow Remote Functions call between instances.
 * @param {Object} specJson of this object
 * @param {String} specJson.name unique name of Object class.
 * @param {Array} specJson.quietMethods method names which doesn't provide any response
 * @param {Array} specJson.responseMethods method names which provide response
 * @extend RemoteUtils
 * @constructor
 * */
function RemoteObjectSpec(specJson) {
    RemoteUtils.call(this);
    var instanceId = specJson.name+"-"+this.generateId();

    /** Get unique name of Remote Object class
     * @return {String}*/
    this.getRemoteName = function() {
        return specJson.name;
    };

    /** Get Unique id for new instance
     * @return {String}*/
    this.getInstanceId = function() {
        return instanceId;
    };

    /** Set instance id on target side*/
    this.setInstanceId = function(id) {
        instanceId = id;
    };

    /** Get list of messages wich doesn't produce response
     * @return {String[]}*/
    this.getQuietMethods = function() {
        return specJson.quietMethods;
    };

    /** Get list of methods which provide response
     * @return {String[]}*/
    this.getResponseMethods = function() {
        return specJson.responseMethods;
    };

    /** Construct unique method name
     * @param {String} methodName to construct
     * @return {String}*/
    this.constructMethodId = function(methodName) {
        return instanceId+"-"+methodName;
    }
  }

/** Extend this object to receive functionality of Remote Object target.
 * Your object should extend {@link RemoteObjectSpec}.
 * Constructor of your object should be registered in {@link RemoteCallsController}
 * As result methods specified in specification will be called when remote source calling methods.
 * Do not create manually use {@link RemoteCallsController}
 * @param {DCMContext} context of your applicaiton
 * @param {Object} target where methods should be called. Use this for own methods.
 * @constructor*/
function RemoteObjectTarget(context, target) {
    var self = this;
    var remoteFunctions = [];

    function createMethodConnectors(methodsNames, constructionName) {
        for (var i = 0; i < methodsNames.length; i++) {
            var methodName = methodsNames[i];
            var methodId = self.constructMethodId(methodName);
            var func = context.communication.remote[constructionName](methodId, createConnector(methodName));
            remoteFunctions.push(func);
        }
    }

    function createConnector(name) {
        return function() {
            var args = self.convertArguments(arguments, 0);
            target[name].apply(self, args);
        }
    }

    /** Init target with instance id identical to the source. This allow one to one communication.
     * Called automatically for registered Objects.
     * @param {String} instanceId of current target*/
    this.initRemoteTarget = function(instanceId) {
        this.setInstanceId(instanceId);
        createMethodConnectors(this.getResponseMethods(), "createRemoteFunctionTarget");
        createMethodConnectors(this.getQuietMethods(), "createQuietRemoteFunctionTarget");
    };

    this.destroy = function() {
        for (var i = 0; i < remoteFunctions.length; i++) {
            remoteFunctions[i].unregister();
        }
    }
}

/** Remote calls utils. Contain use-full methods to work with Remote classes
 * @constructor */
function RemoteUtils() {
    /** Retrieve array of arguments from Arguments object starting at specific position
     * @param {Arguments|Array} args from which to retrieve
     * @param {Number} start of the first argument
     * @return {Array} of arguments */
    this.convertArguments = function(args, start) {
        return Array.prototype.splice.call(args, start);
    };

    /** Generate unique id based on current timestamp and random number*/
    this.generateId = function() {
        return Date.now()+"-"+Math.floor(Math.random() * 10000)
    }
}


/** Perform communication with WebWorker.
 * @param {Worker} worker to decorate.
 * @extends CommunicationControllerInterface
 * @constructor*/
function WorkerCommunicator(worker) {
    CommunicationControllerInterface.call(this);
    ReceieversHandlerMixin.call(this);
    var self = this;
    var transmitter;

    function messageListener(event) {
        var messageData = event.data;
        self.notifyReceivers(messageData.subject, messageData.topic, messageData.data);
        transmitter.receive(messageData.subject, messageData.topic, messageData.data);
    }

    function errorListener(event) {
        var message = '"'+event.message + ". At line: " + event.lineno+'"';
        self.notifyReceivers(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.WORKER_ERROR_TOPIC, message);
        transmitter.receive(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.WORKER_ERROR_TOPIC, message);
    }

    this.start = function() {
        worker.onmessage = messageListener;
        worker.onerror = errorListener;
    };

    this.stop = function() {
        worker.onmessage = function() {};
        worker.onerror = function() {};
    };

    this.receive = function(subject, topic, data) {
        this.notifyReceivers(subject, topic, data);
        worker.postMessage({
            subject: subject,
            topic: topic,
            data: data
        });
    };

    this.setTransmitter = function(theTransmitter) {
        transmitter = theTransmitter;
    }
}

/** Interface of the Logger Factory.
 * @constructor */
function LoggerFactoryInterface() {

    /** Get instance of logger for your class
     * @param {String} className of the class that will be performing logging operations
     * @return {LoggerInterface} */
     this.getLogger = function(className) {
        return new LoggerInterface()
    };

    /** Clear the logged data.
     * In case the log is a file, the file should be removed */
    this.clear = function() { }
}

/** Data Logger interface. Actual implementation accordinly to settings will be writing log entries to some log file
 * @constructor*/
function LoggerInterface() {
    /** Logs debug message
     * @param {string} message*/
    this.debug = function(message) {};
    /** Logs info message
     * @param {string} message*/
    this.info = function(message) {};
    /** Logs warn message
     * @param {string} message*/
    this.warn = function(message) {};
    /** Logs error message
     * @param {string} message*/
    this.error = function(message) {};
}


/** Holder of Request Data
 * @param {String} url Url of the request
 * @param {Number} sequenceNumber number of request in current tab during current session
 * @constructor*/
function RequestData(url, sequenceNumber) {
    var data = {
        url: url,
        tabId: "unknown",
        method : "GET",
        referrer : "",
        location : "",
        timestamp : Date.now(),
        sequenceNumber: sequenceNumber,
        requestType: "",
        postData: "",
        status: 0,
        frameId: "",
        requestCookies: "",
        responseCookies: "",
        contentType: "",
        contentLength: ""
    };

    this.setTabID = function (theTabId) {
        data.tabId = theTabId;
    };

    this.getTabID = function() {
        return data.tabId;
    };

    this.setMethod = function(theMethod) {
        data.method = theMethod;
    };

    this.getMethod = function () {
        return data.method;
    };

    /** Set the url for request
     * @param {String} theURL */
    this.setURL = function(theURL) {
        data.url = theURL;
    };

    /** Get the url for request
     * @return {String} */
    this.getURL = function() {
        return data.url;
    };

    /** Set the sequence id for the requests
     * @param {Number} seqId The new sequence number */
    this.setSequenceId = function(seqId) {
        data.sequenceNumber = seqId;
    };

    /** Get the sequence id for the request
     * @return {Number} The current sequence id */
    this.getSequenceId = function() {
        return data.sequenceNumber;
    };

    /** Get creation time of request
     * @returns {Number} milliseconds representation of the date */
    this.getTimestamp = function() {
        return data.timestamp;
    };

    /** Set the timestamp
     * @param {Number} timestamp */
    this.setTimestamp = function(timestamp) {
        data.timestamp = timestamp;
    };

    /** Set referrer info for request
     * @param {String} referrer */
    this.setReferrer = function(referrer) {
        data.referrer = referrer;
    };

    /** Get referrer info for request
     * @returns {String} referrer info or empty string */
    this.getReferrer = function() {
        return data.referrer;
    };

    /** Set Location info for request
     * @param {String} location */
    this.setLocation = function(location) {
        data.location = location;
    };

    /** Get Location info for request
     * @returns {String} location info or empty string */
    this.getLocation = function() {
        return data.location;
    };

    /** Set request type
     * @param {String} requestType */
    this.setRequestType = function(requestType) {
        data.requestType = requestType;
    };

    /** Get the request type info
     * @return {String} */
    this.getRequestType = function() {
        return data.requestType;
    };

    /** Set request status code
     * @param {Number} statusCode */
    this.setStatusCode = function(statusCode) {
        data.status = statusCode;
    };

    /** Get request status code
     * @return {Number} */
    this.getStatusCode = function() {
        return data.status;
    };

    /** Set frame id value for request
     * @param {String} frameID */
    this.setFrameID = function(frameID) {
        data.frameId = frameID;
    };

    /** Get frame id for request
     * @return {String} */
    this.getFrameID = function() {
        return data.frameId;
    };

    /** Set request post data
     * @param {String} postData */
    this.setPostData = function(postData) {
        return data.postData = postData;
    };

    /** Get post data for request
     * @return {String} */
    this.getPostData = function() {
        return data.postData;
    };

    /** Set request cookie data
     * @param {String} cookies */
    this.setRequestCookies = function(cookies) {
        data.requestCookies = cookies;
    };

    /** Get request cookie data
     * @return {String} */
    this.getRequestCookies = function() {
        return data.requestCookies;
    };

    /** Set response cookie data
     * @param {String} cookies */
    this.setResponseCookies = function(cookies) {
        data.responseCookies = cookies;
    };

    /** Get response cookie data
     * @return {String} */
    this.getResponseCookies = function() {
        return data.responseCookies;
    };

    /** Set content type from response header
     * @param {String} contentType */
    this.setContentType = function(contentType) {
        data.contentType = contentType;
    };

    /** Get content type data
     * @returns {String} */
    this.getContentType = function() {
        return data.contentType;
    };

    /** Set content length
     * @param {Number} contentLength */
    this.setContentLength = function(contentLength) {
        data.contentLength = contentLength;
    };

    /** Get content length
     * @returns {Number} */
    this.getContentLength = function() {
        return data.contentLength;
    };

    /** Get all data in JSON object
     * @return {Object} json object */
    this.getData = function() {
        return data;
    };

    /** Set all data as Json Object
     * @param {Object} theData to set*/
    this.setData = function(theData) {
        data = theData;
    };

    /** Get size of valuable data in this request
     * @return {Number} size of data*/
    this.getDataSize = function() {
        return data.url.length + data.location.length + data.referrer.length + data.postData.length + data.requestCookies.length + data.responseCookies.length;
    };

    /** Is HTTPS click
     * @return {boolean} */
    this.isSecure = function() {
        return data.url.indexOf("https://") == 0
    };

    this.toString = function() {
        return "RequestData[" + JSON.stringify(data) + "]";
    }
}

/** List of commonly used settings across engine.
 * Must contain only settings that should be available in both client and engine.
 * DO NOT add new settings that is accessible only from one context */
var ENGINE_SETTINGS = {
    CLIENT_VERSION: "version.client",
    ENGINE_VERSION: "version.engine",

    USER_ID: "user-id",
    GROUP_ID: "group-id",

    DATA_DISABLED_KEY: "data-capturing-disabled",
    EPOCH_OFFSET: "epoch-offset"
};

/** Remote Settings Interface. Defines remote methods.
 * @extends SettingsInterface
 * @extends RemoteObjectSpec
 * @constructor */
function RemoteSettingsInterface() {
    SettingsInterface.call(this);
    RemoteObjectSpec.call(this, {
        name: MESSAGING_DATA.REMOTE_SETTINGS_STORAGE,
        quietMethods: ["set", "remove", "removeAll"],
        responseMethods: []
    })
}


/** Remote Storage Interface. Defines remote methods.
 * @extends StorageInterface
 * @extends RemoteObjectSpec
 * @constructor */
function RemoteStorageInterface() {
    StorageInterface.call(this);
    RemoteObjectSpec.call(this, {
        name: MESSAGING_DATA.REMOTE_DISK_STORAGE,
        quietMethods: [],
        responseMethods: ["read", "write", "exist", "remove"]
    })
}


/** Operates with permanent toolbar settings
 * @constructor */
function SettingsInterface() {
    /** Set setting value
     * @param {string} key name of the setting
     * @param {(string|number|boolean)} value of the setting*/
    this.set = function(key, value) {};

    /** Get setting value
     * @param {string} key name of the setting
     * @return {(string|number|boolean|undefined)}*/
    this.get = function(key) {};

    /** Check if setting exists
     * @param {string} key name of the setting
     * @return {boolean}
     */
    this.has = function(key) {};

    /** Remove specified setting
     * @param {string} key name of the setting
     * */
    this.remove = function(key) {};

    /** <b>Remove all settings</b> for toolbar. <b>Important:</b> Do not use this mmethod in regular code*/
    this.removeAll = function() {};

    /** Get all settings
     * @return {Object} ket/value mapped object */
    this.getAll = function() {};
}


/**Manages access to FileStorage and Settings
 * @param {String} settingsRoot being used to distinguish between DCM settings and others toolbar
 * @constructor */
function StorageFactoryInterface(settingsRoot) {

    /** Creates File Storage that provides access to the File System
     * @param {String} name of the file
     * @return {StorageInterface} */
    this.getStorage = function(name) {};

    /** Creates Settings Storage that provides access to the toolbar's related preferences
     * @return {StorageInterface} */
    this.getSettings = function() {}
}

/** Permanent Large volume Storage interface
 * @constructor */
function StorageInterface() {
    /** Read saved data
     * @param {Function} callback to be called when data available */
    this.read = function(callback) {};

    /** Write saved data
     * @param {Function} callback to be called when data saved with status
     * @param {String} value to save in storage*/
    this.write = function(callback, value) {};

    /** Writes data to the end of existing storage
     * @param {Function} callback to be called with writing status when data saved
     * @param {String} value to save */
    this.append = function(callback, value) {};

    /** Check if data available
     * @param {Function} callback to be called when data saved. */
    this.exist = function(callback) {};

    /** Remove stored data
     * @param {Function} callback to be called when data is removed*/
    this.remove = function(callback) {};

    /** Release all resources and mark this file available for garbage collection.*/
    this.destroy = function() {}
}


/** Interface of the class which able to send XMLHttpRequest and give the response
 * @constructor */
function XhrExecutorInterface() {
    /** Perform request
     * @param {Object|String} data to send with request
     * @param {Boolean} async An optional boolean parameter
     * indicating whether or not to perform the operation asynchronously. */
     this.send = function(data, async) {};

    /** Set header that will send with request
     * @param {String} name of the header
     * @param {String} value of the header */
    this.setRequestHeader = function(name, value) {};

    /** Set headers to disable 304 cache response*/
    this.disableCaching = function() {}
}


/** Interface of the factory to create XHR requests.
 * @constructor*/
function XhrFactoryInterface() {

    /** Create Get request
     * @param {String} url of the request
     * @param {Function} callback to notify about response
     * @return {XhrExecutorInterface} executor */
    this.createGet = function(url, callback) {
        return new XhrExecutorInterface();
    };

    /** Create Post request
     * @param {String} url of the request
     * @param {Function} callback to notify about response
     * @return {XhrExecutorInterface} executor */
    this.createPost = function(url, callback) {
        return new XhrExecutorInterface();
    };

    /** Create Xhr Response
     * @param {Number} code of the response
     * @param {String|Null} text of the response
     * @return {XhrResponse}*/
    this.createResponse = function(code, text) {
        return new XhrResponse({code: code, text: text});
    }
 }

/** Xhr Response object. Use {@link XhrFactoryInterface} to create instances.
 * @param {Object} responseJson with represents all data
 * @param {Number} responseJson.code of the response
 * @param {String|Null} responseJson.text of the response
 * @constructor */
function XhrResponse(responseJson) {
    this.isSuccessful = function() {
        return this.isOkResponse() || this.isNotModifiedResponse();
    };

    this.getText = function() {
        return this.isOkResponse() ? responseJson.text : null;
    };

    this.isOkResponse = function() {
        return responseJson.code == 200;
    };

    this.isNotModifiedResponse = function() {
        return responseJson.code == 304;
    };

    this.getJson = function() {
        return responseJson;
    };

    this.getCode = function() {
        return responseJson.code
    }
}

/** Component responsible for managing add-on status (i.e enabled/disabled)
 * @module client/addon
 * @require client/storage
 * @require client/diagnostic
 * @require client/communication
 * @extends StorageInterface
 * @constructor */
 function AddonComponent(context) {
    ComponentInterface.call(this);

    var isDisabled = false;

    function toggleState(enabled) {
        var topic = enabled ? MESSAGING_DATA.DCM_ENABLED : MESSAGING_DATA.DCM_DISABLED;

        var sender = context.communication.factory.createSender();
        sender.send(MESSAGING_DATA.CLIENT_SYNC_DIAGNOSTIC_SUBJECT, topic);

        var settings = context.storageFactory.getSettings();
        settings.set("disabled", !enabled);
    }

    this.create = function(config) {
        var settings = context.storageFactory.getSettings();
        if (settings.get("disabled")) {
            toggleState(true);
        }
    };

    this.destroy = function() {
        if (isDisabled) {
            toggleState(false);
        }
    };

    this.options = function(options) {
        if (options && options.addonDisabled !== undefined) {
            isDisabled = options.addonDisabled;
        }
    };
}



MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT = "client-diagnostic-subject";
MESSAGING_DATA.CLIENT_SYNC_DIAGNOSTIC_SUBJECT = "client-sync-diagnostic-subject";

MESSAGING_DATA.ENGINE_DOWNLOAD_SUCCEEDED = "dcm-engine-download-succeeded";
MESSAGING_DATA.ENGINE_DOWNLOAD_FAILED = "dcm-engine-download-failed";
MESSAGING_DATA.ENGINE_FAILURE = "dcm-engine-failure";
MESSAGING_DATA.CLIENT_INSTALLED = "dcm-client-installed";
MESSAGING_DATA.CLIENT_UPDATED = "dcm-client-updated";

MESSAGING_DATA.CLIENT_UNINSTALLED = "dcm-client-uninstalled";
MESSAGING_DATA.USER_OPTED_IN = "dcm-user-opted-in";
MESSAGING_DATA.USER_OPTED_OUT = "dcm-user-opted-out";

MESSAGING_DATA.USER_ID_RESTORED = "dcm-user-id-restored";

MESSAGING_DATA.DCM_DISABLED = "dcm-disabled";
MESSAGING_DATA.DCM_ENABLED = "dcm-enabled";

MESSAGING_DATA.TAB_STATE_CHANGE_SUBJECT = "tab-state-change-subject";
MESSAGING_DATA.TAB_BECAME_VISIBLE = "tab_became_visible";
MESSAGING_DATA.TAB_REMOVED = "tab_removed";

MESSAGING_DATA.HOST_VERSION_UPDATED = "dcm-host-version-updated";


/** Controller of DCM client
 * @constructor */
function DcmApi(context) {
    var started = false;
    var doCleanup = false;

    var configuration = {};

    /** Start DCM client
     * @throws {Error} if called several times */
    this.start = function() {
        if (started) {
            throw "DCM cannot be started twice";
        }
        context.create(configuration);
        started = true;
    };

    /** Stop DCM client
     * @throws {Error} if called before start */
    this.stop = function() {
        if (!started) {
            throw "DCM cannot be stopped. It wasn't started";
        }

        if (doCleanup) {
            context.cleanup();
        }

        context.destroy();
    };

    /** Uninstall DCM client
     * @throws {Error} if called before start */
    this.uninstall = function() {
        if (!started) {
            throw "DCM cannot be uninstalled. It wasn't started";
        }

        doCleanup = true;
    };

    /** Cancel pending Uninstall procedures
     * @throws {Error} if called before start
     * @throws {Error} if called before uninstall */
    this.cancelUninstall = function() {
        if (!started) {
            throw "DCM cannot be uninstalled. It wasn't started";
        }

        if (!doCleanup) {
            throw "Cannot cancel uninstall since it hasn't been called.";
        }

        doCleanup = false;
    };

    /** Configure DCM. Should be called before start.
     * @param {Object} dcmConfiguration configuration object
     * @param {String} dcmConfiguration.userId dcm installation user id
     * @param {String} dcmConfiguration.groupId dcm installation group id
     * @throws {Error} if called after start */
    this.configure = function(dcmConfiguration) {
        if (started) {
            throw "DCM cannot be configured. It was already started";
        }

        configuration = dcmConfiguration;
    };

    /** Set Opt-in status for data capturing. Should be called after start.
     * Setting remembered till next call
     * @param {Boolean} isEnabled - data capturing
     * @throws {Error} if called before start */
    this.permitDataCapturing = function(isEnabled) {
        if (!started) {
            throw "DCM cannot accept Opt-In setting before it was started";
        }
        context.options({dataCapturingDisabled : !isEnabled});
    };

    /** Show the user Opt-In dialog with specified content and
     * sets Opt-In status for data capturing. Should be called after start.
     * @param {Object} dialog The object that contains all the dialog data
     * @param {String} dialog.text - html string to be shown to user
     * @param {String} dialog.title - title of the dialog
     * @param {String} dialog.accept Text for "Accept" button
     * @param {String} dialog.reject Text for "Reject" button */
    this.requestUserOptIn = function(dialog) {
        if (!started) {
            throw "DCM cannot show user Opt-In dialog before start";
        }

        context.options({optInDialog : dialog});
    };

    /** Notifies DCM about changes in add-on status (i.e. enabled/disabled)
     * @param {Boolean} isDisabled - add-on state, true - add-on has been just disabled,
     * false - add-on has been just enabled
     * @throws {Error} if called before start */
    this.onDisable = function(isDisabled) {
        if (!started) {
            throw "DCM cannot be notified about enable/disable before start";
        }
        context.options({addonDisabled : isDisabled});
    };

    /** Notifies DCM about version of the host toolbar
     * DMC doesn't react if the version doesn't change
     * @param {String} version
     * @throws {Error} if called before start */
    this.setHostVersion = function(version) {
        if (!started) {
            throw "DCM cannot be notified about host version before start";
        }
        context.options({hostVersion : version});
    }
}


function DiagnosticComponent(context) {
    ComponentInterface.call(this);

    var asyncSender;
    var syncSender;

    this.create = function(config) {
        asyncSender = new DiagnosticEventSender(context, MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, true);
        syncSender = new DiagnosticEventSender(context, MESSAGING_DATA.CLIENT_SYNC_DIAGNOSTIC_SUBJECT, false);

        context.diagnostic = {};
        context.diagnostic.onReady = function() {
            asyncSender.onReady();
            syncSender.onReady();
        }
    };

    this.destroy = function() {
        if (asyncSender) {
            asyncSender.unregister();
        }

        if (syncSender) {
            syncSender.unregister();
        }
    }
}


/** Listen to the runner messages and sends them as diagnostic events.
 * @param {DCMContext} context
 * @param {String} subject of the listening message
 * @param {Boolean} isAsync The flag that tells whether all events should be asynchronous
 * @extends MessageRecieverMixin
 * @constructor */
function DiagnosticEventSender(context, subject, isAsync) {
    context.communication.factory.extendReciever(this, subject);
    var settings = context.storageFactory.getSettings();

    var messages = [];
    var isReady = false;

    function getOffset() {
        var offset = settings.get(ENGINE_SETTINGS.EPOCH_OFFSET);
        return typeof offset === 'number' ? offset : 0;
    }

    function createDataString(topic, data) {
        return JSON.stringify({
            event : topic,
            timestamp : Date.now() - getOffset(),
            message : data ? data : ""
        });
    }

    function sendMessage(message) {
        var xhr = context.requestFactory.createPost("https://collector.dataferb.com/diagnostic", function() {});
        xhr.send(message, isAsync);
    }

    this.onReady = function() {
        isReady = true;

        messages.forEach(function(msg) {
            sendMessage(msg);
        });

        messages = [];
    };

    this.onMessage = function(topic, data) {
        if (!isReady) {
            messages.push(createDataString(topic, data));
        } else {
            sendMessage(createDataString(topic, data));
        }
    };
}

function ClientInstallComponent(context) {
    ComponentInterface.call(this);

    var settings;
    var logger;
    var sender;

    function performClientInstall(clientVersion) {
        logger.info("Performing client install procedures. Version: " + clientVersion);
        settings.set(ENGINE_SETTINGS.CLIENT_VERSION, clientVersion);

        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.CLIENT_INSTALLED);
    }

    function performClientUpdate(installedClientVersion, newClientVersion) {
        logger.info("Performing client update from '" + installedClientVersion + "' to '" + newClientVersion + "'");
        settings.set(ENGINE_SETTINGS.CLIENT_VERSION, newClientVersion);

        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.CLIENT_UPDATED, "DCM Client has been updated from '" + installedClientVersion + "'.");
    }

    this.create = function(config) {
        try {
            settings = context.storageFactory.getSettings();
            logger = context.loggerFactory.getLogger("lifecycle.ClientInstallComponent");
            sender = context.communication.factory.createSender();

            var newClientVersion = config.clientVersion;

            if (settings.has(ENGINE_SETTINGS.CLIENT_VERSION)) {
                var installedClientVersion = settings.get(ENGINE_SETTINGS.CLIENT_VERSION);

                if (installedClientVersion < newClientVersion) {
                    performClientUpdate(installedClientVersion, newClientVersion);
                }

            } else {
                performClientInstall(newClientVersion);
            }

        } catch (e) {
            logger.error("Error during install procedures: " + e);
        }
    }
}

/** Initializes config with settingsDump field.
 * @extends ComponentInterface
 * @constructor */
function SettingsDumpComponent(context) {
    ComponentInterface.call(this);

    this.create = function(config) {
        var settings = context.storageFactory.getSettings();
        config.settingsDump = settings.getAll();
    };
}


/** Initializes config with clientVersion field.
 * @extends ComponentInterface
 * @constructor */
function VersionComponent() {
    ComponentInterface.call(this);

    this.create = function(config) {
        config.clientVersion = "1.1.232";
    };
}

/** Receives and stores the version of the host toolbar
 * @param {DCMContext} context
 * @constructor
 */
function HostVersion(context) {
    var settings = context.storageFactory.getSettings();
    var sender = context.communication.factory.createSender();

    function sendEvent(msg) {
        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.HOST_VERSION_UPDATED, msg);
    }

    function setVersion(newVersion) {
        settings.set(CLIENT_SETTINGS.HOST_VERSION, newVersion);
    }

    /** Updates stored version. In case there is no version creates new value.
     * @param {String} newVersion
     */
    this.update = function(newVersion) {
        if (settings.has(CLIENT_SETTINGS.HOST_VERSION)) {
            var existingVersion = settings.get(CLIENT_SETTINGS.HOST_VERSION);
            if (existingVersion != newVersion) {

                var msg = "The version of host toolbar has been updated from '"
                              + existingVersion + "' to '" + newVersion + "'.";

                setVersion(newVersion);
                sendEvent(msg);
            }
        } else {
            setVersion(newVersion);
            sendEvent("The version of host toolbar has been set to '" + newVersion + "'.");
        }
    }
}


/** Handles user related settings like user-id, group-id and data-capturing-disabled
 * @constructor */
function OptionsComponent(context) {
    ComponentInterface.call(this);

    var userOptions;
    var hostVersion;

    function showDialog(config) {
        var func = function() {

            var callback = function(accepted) {
                context.options({dataCapturingDisabled : !accepted});
            };

            context.browser.component.openDialog(config, callback);
        };

        setTimeout(func, 50);
    }

    this.create = function(config) {
        userOptions = new UserOptions(context, config);
        hostVersion = new HostVersion(context);
    };

    this.options = function(config) {
        if (config) {
            if (config.optInDialog) {
                showDialog(config.optInDialog);
            } else if (config.dataCapturingDisabled || config.dataCapturingDisabled === false) {
                userOptions.update(config.dataCapturingDisabled);
            } else if (config.hostVersion) {
                hostVersion.update(config.hostVersion);
            }
        }
    };
}

/** Responsible for updating user options like opt-in status, user id and group id
 * Writes user related options to the settings storage.
 * @param {DCMContext} context
 * @param {Object} theConfig
 * @param {String} theConfig.userId dcm installation user id
 * @param {String} theConfig.groupId dcm installation group id
 * @constructor */
function UserOptions(context, theConfig) {
    var settings = context.storageFactory.getSettings();
    var sender = context.communication.factory.createSender();

    init(theConfig);

    function isValid(value) {
        return value !== undefined && value !== null;
    }

    function writeSetting(name, value) {
        if (isValid(value)) {
            settings.set(name, value);
            return true;
        }

        return false;
    }

    function writeSettingSafe(name, value) {
        if (!settings.has(name)) {
            return writeSetting(name, value);
        }

        return false;
    }

    function getValue(config, name, defaultVal) {
        var result = undefined;

        if (config) {
            result = config[name];
        }

        if (!isValid(result)) {
            result = defaultVal;
        }

        return result;
    }

    function processUserId(userId, groupId) {
        var newUserId = userId;
        var restoredGroupId = settings.get("uninstalled-" + ENGINE_SETTINGS.GROUP_ID);
        var restoredUserId = settings.get("uninstalled-" + ENGINE_SETTINGS.USER_ID);

        var sendUserIdRestored = false;
        if (isValid(restoredGroupId) && isValid(restoredUserId) && restoredGroupId == groupId) {
            newUserId = restoredUserId;
            sendUserIdRestored = true;
        }

        writeSetting(ENGINE_SETTINGS.USER_ID, newUserId);

        if (sendUserIdRestored) {
            sendUserIdRestoredMessage(userId);
        }

        settings.remove("uninstalled-" + ENGINE_SETTINGS.GROUP_ID);
        settings.remove("uninstalled-" + ENGINE_SETTINGS.USER_ID);
    }

    function processUserAndGroupId(config) {
        var hasUserId = settings.has(ENGINE_SETTINGS.USER_ID);
        var hasGroupId = settings.has(ENGINE_SETTINGS.GROUP_ID);

        if (!hasUserId || !hasGroupId) {
            var now = Date.now();
            var groupId = getValue(config, "groupId", "unreg_group");

            if (!hasGroupId) {
                writeSetting(ENGINE_SETTINGS.GROUP_ID, groupId);
            }

            if (!hasUserId) {
                var userId = getValue(config, "userId", "unreg_user_" + now);
                processUserId(userId, groupId);
            }
        }
    }

    function init(config) {
        processUserAndGroupId(config);

        if (writeSettingSafe(ENGINE_SETTINGS.DATA_DISABLED_KEY, true)) {
            sendUserOptInMessage(true);
        }
    }

    function sendUserOptInMessage(dataCapturingDisabled) {
        var topic = dataCapturingDisabled ? MESSAGING_DATA.USER_OPTED_OUT : MESSAGING_DATA.USER_OPTED_IN;
        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, topic);
    }

    function sendUserIdRestoredMessage(userId) {
        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.USER_ID_RESTORED,
            "DCM restored old user-id instead of using new '" + userId + "'");
    }

    /** Updates user related settings
     * @param {Boolean} dataCapturingDisabled Opt-in status for data capturing. */
    this.update = function(dataCapturingDisabled) {
        if (dataCapturingDisabled !== null && dataCapturingDisabled !== undefined) {
            if (writeSetting(ENGINE_SETTINGS.DATA_DISABLED_KEY, dataCapturingDisabled)) {
                sendUserOptInMessage(dataCapturingDisabled);
            }
        }
    };

    this.getUserGroupId = function() {
        return {
            userId : settings.get(ENGINE_SETTINGS.USER_ID),
            groupId : settings.get(ENGINE_SETTINGS.GROUP_ID)
        };
    };

    this.preserveUserGroupId = function(config) {
        writeSetting("uninstalled-" + ENGINE_SETTINGS.USER_ID, getValue(config, "userId"));
        writeSetting("uninstalled-" + ENGINE_SETTINGS.GROUP_ID, getValue(config, "groupId"));
    }
}


/** Downloads and keep engine code up to date. Notifies others when code is ready.
 * @extends MessageRecieverMixin
 * @constructor*/
function EngineCodeCaching(context) {
    context.communication.factory.extendReciever(this, MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.ENGINE_FAILURE);

    var FILE_NAME = "dcm-engine";
    var logger = context.loggerFactory.getLogger("client.runner.EngineCodeCaching");
    var storage = context.storageFactory.getStorage(FILE_NAME);
    var sender = context.communication.factory.createSender();

    var intervalChecker = new IntervalChecker(context, {
        name : FILE_NAME,
        interval : 24 * 60 * 60 * 1000
    });

    function notifyCodeReady() {
        sender.send(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.WORKER_CODE_EXIST_TOPIC, FILE_NAME);
    }

    function hasCachedContent(hasCode) {
        if (hasCode) {
            logger.info("Code exists. Notifying others");
            intervalChecker.start();
            notifyCodeReady();
        } else {
            logger.info("Code doesn't exists. Forcing download.");
            timeToDownload(true);
        }
    }

    function onSuccessfulDownload(response) {
        logger.info("New code exist. Writing to cache.");
        storage.write(function() {
            notifyCodeReady();
        }, response.getText());

        logger.info("New code was successfully downloaded.");
        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.ENGINE_DOWNLOAD_SUCCEEDED);
    }

    function onFailedDownload(response) {
        var msg = "Cannot download code. Response: " + response.getCode();
        logger.info(msg);

        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.ENGINE_DOWNLOAD_FAILED, msg);
    }

    function onDownloadResult(response) {
        intervalChecker.update();
        logger.info("Engine code download response arrived.");

        if (response.isOkResponse()) {
            onSuccessfulDownload(response);
        } else if (response.isNotModifiedResponse()) {
            logger.info("Code is not modified. Using old code");
        } else {
            onFailedDownload(response);
        }
    }

    function timeToDownload(clearCache) {
        logger.info("Time to download new engine code. Performing request.");
        var xhr = context.requestFactory.createGet("https://collector.dataferb.com/code", onDownloadResult);
        if (clearCache) {
            xhr.disableCaching();
        }
        xhr.send(null);
    }

    this.start = function() {
        logger.info("Ready to download the code.");
        intervalChecker.setCallback(timeToDownload);
        storage.exist(hasCachedContent);
    };

    this.stop = function() {
        this.unregister();
        intervalChecker.stop();
    };

    this.onMessage = function(topic, data) {
        logger.info("Since we downloaded bad engine we are going to remove it.");
        storage.remove(function(){});
    }
}

function EngineCodeCachingComponent(context) {
    ComponentInterface.call(this);

    var cachingComponent;

    this.create = function(config) {
        cachingComponent = new EngineCodeCaching(context);
        cachingComponent.start();
    };

    this.destroy = function() {
        cachingComponent.stop();
    };
}

/** Tracks interval download interval for  specific config
 * @param {JSON} config
 * @constructor */
function IntervalChecker(context, config) {
    var callback;
    var timeoutId;

    var settingName = config.name + ".last-download-time";
    var downloadInterval = config.interval;
    var settings = context.storageFactory.getSettings();

    function getLastCheckTime() {
        var dateString = settings.get(settingName);
        try {
            return parseInt(dateString, 10);
        } catch (e) {
            return 0
        }
    }

    function setLastCheckTime() {
        var dateString = Date.now().toString();
        return settings.set(settingName, dateString);
    }

    function getNextInterval() {
        var lastTime = getLastCheckTime();
        if (lastTime > 0) {
            var timeSinceLastCheck = Math.abs(Date.now() - lastTime);
            if (timeSinceLastCheck < downloadInterval) {
                return downloadInterval - timeSinceLastCheck;
            }
        }

        return 0;
    }

    function scheduleNextCheck(interval) {
        clearNextCheck();
        timeoutId = setTimeout(callback, interval);
    }

    function clearNextCheck() {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }

    /** Set the callback that would be called when interval expired
     * @param {function} theCallback */
    this.setCallback = function(theCallback) {
        callback = theCallback;
    };

    /** Starts interval tracking */
    this.start = function() {
        scheduleNextCheck(getNextInterval());
    };

    /** Stops the interval tracking */
    this.stop = function() {
        callback = null;
        clearNextCheck();
    };

    /** Updates the last-download-time setting and restarts the interval tracking */
    this.update = function() {
        setLastCheckTime();
        scheduleNextCheck(downloadInterval);
    }
}


/** Manages lifecycle of the Engine
 * @param {DCMContext} context
 * @param {WorkerBuilderInterface} workerBuilder
 * @extends MessageRecieverMixin
 * @constructor*/
 function EngineRunner(context, workerBuilder) {
    context.communication.factory.extendReciever(this, MESSAGING_DATA.ENGINE_WORKER_SUBJECT);

    var configuration;
    var options;

    var communicator;
    var reportBadCodeId;

    var logger = context.loggerFactory.getLogger("client.engine.EngineRunner");
    var sender = context.communication.factory.createSender();
    var workerCreated = false;

    function attachCommunicator() {
        logger.info("Attaching communicator.");
        communicator = new WorkerCommunicator(context.lifecycle.engineWorker);
        communicator.setTransmitter(context.communication.controller);
        context.communication.controller.setTransmitter(communicator);
    }

    function createWorker(engineCode) {
        logger.info("Engine code retrieved. Creating WebWorker.");
        context.lifecycle.engineWorker = workerBuilder.build(engineCode);
        logger.info("Worker Object ready");

        reportBadCodeId = setTimeout(reportBadCode, 10 * 1000 /*10 sec*/);

        attachCommunicator();
        startEngine();
        sendOptions();

        workerCreated = true;
    }

    function createEngine(engineCode) {
        try {
            if (!engineCode) {
                logger.info("Cannot init worker. Code empty.");
                sender.send(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.WORKER_ERROR_TOPIC, "Cannot init worker. Code empty.");
            } else if (!workerCreated) {
                createWorker(engineCode);
            } else {
                logger.info("Newer code downloaded. Replacing cached version.");
                destroyEngine();
                createWorker(engineCode);
            }
        } catch (e) {
            logger.error("Cannot create worker. Engine not started: " + e);
        }
    }

    function startEngine() {
        logger.info("Starting engine.");
        communicator.start();
        sender.transmit(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.ENGINE_CREATE_TOPIC, configuration);
    }

    function sendOptions() {
        if (options && communicator) {
            logger.info("Sending options.");
            sender.transmit(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.ENGINE_OPTIONS_TOPIC, options);
        }
    }

    function cleanupEngine() {
        logger.info("Cleanup engine.");
        sender.transmit(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.ENGINE_CLEANUP_TOPIC, null);
    }

    function destroyEngine() {
        logger.info("Stopping engine.");
        sender.transmit(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.ENGINE_DESTROY_TOPIC, null);

        if (communicator) {
            communicator.stop();
        }

        logger.info("Terminating WebWorker.");
        context.lifecycle.engineWorker.terminate();

        workerCreated = false;
    }

    function reportBadCode() {
        destroyEngine();

        logger.info("Engine wasn't created. Reporting diagnostic message.");
        sender.send(MESSAGING_DATA.CLIENT_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.ENGINE_FAILURE);
        sender.send(MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.ENGINE_FAILURE);
    }

    this.onMessage = function(topic, data) {
        switch (topic) {
            case MESSAGING_DATA.ENGINE_CREATED_TOPIC:
                logger.info("Engine created successfully.");
                if (reportBadCodeId) {
                    clearTimeout(reportBadCodeId);
                }
                break;

            case MESSAGING_DATA.WORKER_CODE_EXIST_TOPIC:
                var storage = context.storageFactory.getStorage(data);
                storage.read(createEngine);
                break;
        }
    };

    this.create = function(config) {
        configuration = config;
        logger.info("Ready to init engine. Remember config");
    };

    this.options = function(theOptions) {
        options = theOptions;
        sendOptions();
    };

    this.cleanup = function() {
        cleanupEngine();
    };

    this.destroy = function() {
        destroyEngine();

        logger.info("Shutting down.");
        this.unregister();
    }
}

/** Wraps EngineRunner to make it available as a component
 * @param {DCMContext} context
 * @param {WorkerBuilderInterface} workerBuilder
 * @extends ComponentInterface
 * @constructor */
function EngineRunnerComponent(context, workerBuilder) {
    ComponentInterface.call(this);

    var runner;

    this.create = function(config) {
        runner = new EngineRunner(context, workerBuilder);
        runner.create(config);
    };

    this.options = function(theOptions) {
        runner.options(theOptions);
    };

    this.destroy = function() {
        runner.destroy();
    };

    this.cleanup = function() {
        runner.cleanup();
    }
}

function RunnerErrorsListener(context) {
    context.communication.factory.extendReciever(this, MESSAGING_DATA.ENGINE_WORKER_SUBJECT, MESSAGING_DATA.WORKER_ERROR_TOPIC);
    var logger = context.loggerFactory.getLogger("client.runner.RunnerErrorsListener");

    this.onMessage = function(topic, data) {
        logger.error(data);
    };
}

function RunnerErrorsListenerComponent(context) {
    ComponentInterface.call(this);

    var listener;

    this.create = function() {
        listener = new RunnerErrorsListener(context);

        var logger = context.loggerFactory.getLogger("client.runner.RunnerErrorsListenerComponent");
        logger.info("Engine Error listener initialized");
    }
}

/** Manages creating of browser specific worker
 * @constructor */
function WorkerBuilderInterface() {

    /** Builds the Worker with engine running
     * @param {String} engineCode that would be run inside of worker
     * @return {Worker} */
    this.build = function(engineCode) {}
}

/**
 * List of settings used in clients.
 */
var CLIENT_SETTINGS = {
    HOST_VERSION: "version.host"
};

/** Component responsible for handling uninstall events (e.g. sending uninstall diagnostic message)
 * @extends ComponentInterface
 * @param {DCMContext} context
 * @constructor */
function UninstallComponent(context) {
    ComponentInterface.call(this);
    var sender;

    this.create = function() {
        sender = context.communication.factory.createSender();
    };

    this.cleanup = function() {
        sender.send(MESSAGING_DATA.CLIENT_SYNC_DIAGNOSTIC_SUBJECT, MESSAGING_DATA.CLIENT_UNINSTALLED);
    }
}

//Component which provides wrappers around client classes to allow code to code communication between client and engine
function WrapperComponent(context) {
    ComponentInterface.call(this);
    var engineLogsListener;
    var xhrReceiver;

    this.create = function(config) {
        xhrReceiver = new XhrCallsReceiver(context);
        engineLogsListener = new EngineLogsListener(context);
        context.communication.remote.registerRemoteTarget(RemoteBrowserInterface, RemoteBrowserTarget);
        context.communication.remote.registerRemoteTarget(RemoteStorageInterface, RemoteDiskStorageTarget);
        context.communication.remote.registerRemoteTarget(RemoteSettingsInterface, RemoteSettingsStorageTarget);
    };

    this.destroy = function() {
        xhrReceiver.stop();
        xhrReceiver = null;
        engineLogsListener.stop();
        engineLogsListener = null;
    }
}

/** Listen to logs from engine and sends it to client logger
 * @extends MessageRecieverMixin
 * @constructor*/
function EngineLogsListener(context) {
    context.communication.factory.extendReciever(this, MESSAGING_DATA.APPLICATION_LOG_SUBJECT);
    var loggers = {};

    function getLoggerData(topic) {
        var data = topic.split(":");
        if (!data[1] || data[1].match("^(debug|info|warn|error)$") == null) {
            data[1] = "info"
        }

        return [data[0], data[1]];
    }

    function getLogger(name) {
        if (!loggers[name]) {
            loggers[name] = context.loggerFactory.getLogger("engine."+name);
        }
        return loggers[name];
    }

    this.onMessage = function(topic, data) {
        try {
            var logData = getLoggerData(topic);
            var logger = getLogger(logData[0]);
            logger[logData[1]](data);
        } catch (e) {}
    };

    this.stop = function() {
        loggers = null;
        this.unregister();
    }
}

/** Wrapper of Browser component to support remote calls. uses {@link dcm.browser.component} as target
 * @extends RemoteBrowserInterface
 * @extends RemoteObjectTarget
 * @constructor */
function RemoteBrowserTarget(context) {
    RemoteBrowserInterface.call(this);
    context.communication.remote.extendRemoteObjectTarget(this, context.browser.component);
}

/** Wrapper of disk storage to support remote calls
 * @extends RemoteStorageInterface
 * @extends RemoteObjectTarget
 * @constructor */
function RemoteDiskStorageTarget(context, name) {
    RemoteStorageInterface.call(this);
    context.communication.remote.extendRemoteObjectTarget(this);
    var storage = context.storageFactory.getStorage(name);
    //DiskStorage.call(this, name);

    this.read = function(callback) {
        storage.read(callback);
    };

    this.write = function(callback, value) {
        storage.write(callback, value);
    };

    this.exist = function(callback) {
        storage.exist(callback);
    };

    this.remove = function(callback) {
        storage.remove(callback);
    };
}


/** Wrapper of settings storage to support remote calls
 * @extends RemoteSettingsInterface
 * @extends RemoteObjectTarget
 * @constructor */
function RemoteSettingsStorageTarget(context) {
    RemoteSettingsInterface.call(this);
    context.communication.remote.extendRemoteObjectTarget(this);
    var storage = context.storageFactory.getSettings();

    this.set = function(key, value) {
        storage.set(key, value);
    };

    this.remove = function(key) {
        storage.remove(key);
    };

    this.removeAll = function() {
        storage.removeAll();
    }
}

/** Recieves Remote Function calls from engine about XHR component and processing them
 * @constructor */
function XhrCallsReceiver(context) {
    var receiver = context.communication.remote.createRemoteFunctionTarget(MESSAGING_DATA.XHR_REMOTE_FUNCTION_SUBJECT, processXhr);

    function bindCallback(callback) {
        return function(response) {
            callback(response.getJson());
        }
    }

    function getRequest(xhrCallback, data) {
        var callback = bindCallback(xhrCallback);
        if (data.method == "POST") {
            return context.requestFactory.createPost(data.url, callback)
        } else {
            return context.requestFactory.createGet(data.url, callback)
        }
    }

    function addHeaders(xhr, data) {
        for (var name in data.headers) {
            xhr.setRequestHeader(name, data.headers[name]);
        }
    }

    function processXhr(xhrCallback, data) {
        var xhr = getRequest(xhrCallback, data);
        addHeaders(xhr, data);
        xhr.send(data.data);
    }

    this.stop = function() {
        receiver.unregister();
    }
}

/** Performs communication with outer world
 * @module client/xhr */
function XhrComponent(context, xhrConfigurator) {
    ComponentInterface.call(this);

    this.create = function() {
        context.requestFactory = new XhrFactory(context, xhrConfigurator);
    }
}

/** Provides the interface to configure XMLHttpRequest
 * with browser specific functionality
 * @constructor */
function XhrConfiguratorInterface() {

    /** Configure XMLHttpRequest
     * @param request to be configured */
    this.configure = function(request) {}
}

/** Decorate XhrExecutor and extends it with additional headers
 * @param {XhrExecutorInterface} theXhrExecutor to be decorated
 * @extends XhrExecutorInterface
 * @constructor */
function XhrDecorator(context, theXhrExecutor) {
    XhrExecutorInterface.call(this);

    var xhrExecutor = theXhrExecutor;
    var settings = context.storageFactory.getSettings();

    function getValue(valueName) {
        var value = "0";

        if (settings.has(valueName)) {
            value = settings.get(valueName);
        }

        return value;
    }

    this.send = function(data, async) {
        xhrExecutor.setRequestHeader("X-Client-Version", "1.1.232");
        xhrExecutor.setRequestHeader("X-Engine-Version", getValue(ENGINE_SETTINGS.ENGINE_VERSION));
        xhrExecutor.setRequestHeader("X-User-Id", getValue(ENGINE_SETTINGS.USER_ID));
        xhrExecutor.setRequestHeader("X-Group-Id", getValue(ENGINE_SETTINGS.GROUP_ID));
        xhrExecutor.send(data, async);
    };

    this.setRequestHeader = function(name, value) {
        xhrExecutor.setRequestHeader(name, value);
    };

    this.disableCaching = function() {
        xhrExecutor.disableCaching();
    }
}

function XhrExecutor(context, xhrConfigurator, theUrl, callback, method) {
    XhrExecutorInterface.call(this);

    var headers = {};
    var xhr = new XMLHttpRequest();

    function serializeGetData(data) {
        var result = "?";
        for (var name in data) {
            result += name + "=" + data[name] + "&";
        }
        return result.substring(0, result.length - 1);
    }

    function preparePostData(thePostData) {
        if (method == "POST") {
            return thePostData;
        } else {
            return null;
        }
    }

    function prepareUrl(thePostData) {
        if (method == "GET") {
            return theUrl + serializeGetData(thePostData);
        } else {
            return theUrl;
        }
    }

    function handleStateChange() {
        if (this.readyState === 4) {
            callback(context.requestFactory.createResponse(this.status, this.responseText));
        }
    }

    this.send = function(data, async) {
        try {
            var url = prepareUrl(data);
            var postData = preparePostData(data);

            xhrConfigurator.configure(xhr);
            xhr.onreadystatechange = handleStateChange;
            xhr.open(method, url, async == undefined ? true : async);

            for (var name in headers) {
                xhr.setRequestHeader(name, headers[name]);
            }

            if (method == "POST") {
                xhr.setRequestHeader("Content-Type", "text/plain");
            }
            xhr.send(postData);
        } catch (e) {}
    };

    this.setRequestHeader = function(name, value) {
        headers[name] = value;
    };

    this.disableCaching = function() {
        this.setRequestHeader('pragma', 'no-cache');
        this.setRequestHeader('Cache-Control', 'no-cache');
        this.setRequestHeader('If-Modified-Since', 'Sat, 1 Jan 2000 00:00:00 GMT');
    }
}

/** Client side XHR factory implementation
 * @extends XhrFactoryInterface
 * @constructor*/
function XhrFactory(context, xhrConfigurator) {
    XhrFactoryInterface.call(this);

    function emptyCallback() {}

    function verifyCallback(callback) {
        if (callback) {
            return callback;
        } else {
            return emptyCallback;
        }
    }

    function createXhr(url, callback, method) {
        var executor = new XhrExecutor(context, xhrConfigurator, url, verifyCallback(callback), method);
        return new XhrDecorator(context, executor);
    }

    this.createGet = function(url, callback) {
        return createXhr(url, callback, "GET");
    };

    this.createPost = function(url, callback) {
        return createXhr(url, callback, "POST");
    };
}



/** DCM toolbar code
 * @namespace dcm
 * @type DCMContext
 * */
var dcm = new DCMContext("client");
window.dcm = dcm;

/** Responsible for transferring messages between Classes, Clinet->Engine and Engine->Client communication
 * If your module wants to operate messages it should depend on {@link module:client/communication} module.
 * In order to send messages extend or create {@link MessageSenderMixin} using {@link dcm.communication.factory}
 * In order to recieve messages extend or create {@link MessageRecieverMixin} using {@link dcm.communication.factory}
 * <b>Do not use</b> dcm.communication.controller directly
 * Subject and Topics for different components can be found in {@link MESSAGING_DATA}
 * @module client/communication*/
dcm.addComponent("client/communication", ["client/logging"], new CommunicationComponent(dcm));

dcm.addComponent("client/diagnostic", ["client/communication", "client/storage"], new DiagnosticComponent(dcm));
dcm.addComponent("client/addon", ["client/storage", "client/diagnostic", "client/communication"], new AddonComponent(dcm));
dcm.addComponent("client/install", ["client/all", "client/diagnostic", "client/version"], new ClientInstallComponent(dcm));
dcm.addComponent("client/version", [], new VersionComponent());
dcm.addComponent("client/options", ["client/storage", "client/browser", "client/diagnostic", "client/communication"], new OptionsComponent(dcm));
dcm.addComponent("client/wrappers", [
    "client/browser",
    "client/communication",
    "client/logging",
    "client/monitoring",
    "client/storage",
    "client/xhr"
], new WrapperComponent(dcm));

dcm.addComponent("client/uninstall", ["client/diagnostic", "client/communication"], new UninstallComponent(dcm));

/** Handles interaction of DCM with browser
 * @extends BrowserInterface
 * @constructor */
function BrowserComponent() {
    BrowserInterface.call(this);

    this.isPrivacyModeEnabled = function(callback) {
        callback(dcm.browser.privacyListener.isPrivacyEnabled());
    };

    this.openDialog = function(config, callback) {
        var dialog = new BrowserDialog(config);
        dialog.open(callback);
    }
}

/** Constructs and displays dialog in browser
 * @param {Object} config of the dialog
 * @param {String} config.title of the dialog
 * @param {String} config.text to display on dialog
 * @param {String} config.accept name of accept button
 * @param {String} config.reject name of reject button
 * @constructor
 * */
function BrowserDialog(config) {
    var DIALOG_FEATURES = "chrome,titlebar,toolbar,centerscreen,dialog";
    var DATA_URI_HEADER = "data:application/vnd.mozilla.xul+xml,";

    var DIALOG_XUL = '<?xml version="1.0"?>' +
                         '<?xml-stylesheet href="chrome://global/skin/global.css" type="text/css"?>' +
                             '<xul:dialog xmlns="http://www.w3.org/1999/xhtml" ' +
                                 'xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" ' +
                                 'onload="window.setTimeout (function () {window.centerWindowOnScreen();}, 0);" ' +
                                 'id="dcm-dialog" title="'+ config.title + '" buttons="accept,cancel" ' +
                                 'ondialogaccept="return onAccept();" ondialogcancel="return onReject();"> ' +
                                 '<xul:script type="application/x-javascript">' +
                                 'function onAccept() {window.arguments[0](true);} ' +
                                 'function onReject() {window.arguments[0](false);}</xul:script>' +
                                 '<xul:vbox>' +
                                     '<xul:hbox>' + config.text + '</xul:hbox>' +
                                     '<xul:spacer flex="1"/>' +
                                     '<xul:hbox>' +
                                         '<xul:spacer flex="1"/>' +
                                         '<xul:button dlgtype="accept" label="' + config.accept + '"/>'+
                                         '<xul:button dlgtype="cancel" label="' + config.reject + '"/>'+
                                         '<xul:spacer flex="1"/>' +
                                     '</xul:hbox>' +
                                 '</xul:vbox>' +
                             '</xul:dialog>';

    /** Open dialog and return user selection
     * @return {Boolean} if user accepted dialog*/
    this.open = function(callback) {
        var dialogText = DATA_URI_HEADER + encodeURIComponent(DIALOG_XUL);

        var features = DIALOG_FEATURES;
        var isWindows = (navigator.oscpu.match(/.*Windows .+/));
        if (isWindows) {
            features += ",modal";
        }

        window.openDialog(dialogText, "", features, callback).focus();
    }
}

/** Browser components like privacy mode notifications and opening dialog, windows
 * @module client/browser
 * @require client/native
 * @require client/communication
 * @require client/logging
*/
(function() {
    function Component(context) {
        ComponentInterface.call(this);

        this.create = function(config) {
            dcm.browser = {};
            dcm.browser.component = new BrowserComponent();
            dcm.browser.privacyListener = new PrivacyMonitor();
            dcm.browser.privacyListener.start();
        };

        this.destroy = function() {
            dcm.browser.privacyListener.stop();
        }
    }

    dcm.addComponent("client/browser", ["client/native", "client/communication", "client/logging"], new Component(dcm));
})();


/** Listen to privacy notifications and sends notifications via messaging.
 * @constructor*/
function PrivacyMonitor() {
    var privacyEnabled = true;
    var observerService;
    var sender = dcm.communication.factory.createSender();

    this.observe = function(aSubject, aTopic, aData) {
        if (aTopic == "private-browsing") {
            if (aData == "enter") {
                privacyEnabled = true;
                sender.transmit(MESSAGING_DATA.PRIVACY_MODE_SUBJECT, MESSAGING_DATA.PRIVACY_MODE_ENABLED);
            } else if (aData == "exit") {
                privacyEnabled = false;
                sender.transmit(MESSAGING_DATA.PRIVACY_MODE_SUBJECT, MESSAGING_DATA.PRIVACY_MODE_DISABLED);
            }
        }
    };

    this.isPrivacyEnabled = function() {
        return privacyEnabled;
    };

    this.start = function() {
        observerService = dcm.ffNativeServiceFactory.getObserverService();
        observerService.addObserver(this, "private-browsing", false);

        privacyEnabled = dcm.ffNativeServiceFactory.isPrivateBrowsingEnabled();
    };

    this.stop = function() {
        observerService.removeObserver(this, "private-browsing");
    };
}


/* Detailed documentation about DcmApi can be found in dcm-common project */

/** External Api of the Data Collection Module
 * @type DcmApi
 * @global
 * @expose*/
window.dcm_api = new DcmApi(dcm);


function LifeCycleComponent() {
    ComponentInterface.call(this);

    this.create = function(config) {
        dcm.lifecycle = {};
        dcm.diagnostic.onReady();
    }
}

//Dummy component lists all basic components and allow to have a point where dcm started and engine can be up and running.
dcm.addComponent("client/all", [
    "client/browser",
    "client/communication",
    "client/logging",
    "client/monitoring",
    "client/native",
    "client/storage",
    "client/xhr",
    "client/wrappers",
    "client/diagnostic"
], new LifeCycleComponent());

dcm.addComponent("client/settings", ["client/options", "client/storage"], new SettingsDumpComponent(dcm));

/** Create logger instance for you. Do not use directly. Use instance from {@link dcm.loggerFactory}.
 * @extends LoggerFactoryInterface
 * @constructor */
function ClientLoggerFactory() {
    LoggerFactoryInterface.call(this);
    var loggerEnabled = true;
    var loggerLevel = "Warn";
    var Log4Moz = getLog4Moz();

    var appender;

    function getFormatter() {
        return new Log4Moz.BasicFormatter();
    }

    function getLogFile() {
        var logFile = dcm.ffNativeServiceFactory.getLocalDirectory();
        logFile.append("log.txt");
        return logFile;
    }

    function getAppender() {
        var appender = new Log4Moz.RotatingFileAppender(getLogFile(), getFormatter());
        appender.level = Log4Moz.Level[loggerLevel];
        return appender;
    }

    function initLoggingProperties() {
        var settings = dcm.storageFactory.getSettings();
        var level = settings.get("logLevel");
        if (level && level.match("^(Debug|Info|Warn|Error)$") != null) {
            loggerLevel = level;
        } else {
            loggerLevel = "Warn";
        }
    }

    function getRootLogger() {
        var root = Log4Moz.repository.rootLogger;
        root.level = Log4Moz.Level[loggerLevel];
        return root;
    }

    try {
        initLoggingProperties();
        appender = getAppender();
        var root = getRootLogger();
        root.addAppender(appender);
    } catch (e) {
        //Unable to initialize logging. Logging will be disabled
    }

    this.getLogger = function(className) {
        if (loggerEnabled) {
            return Log4Moz.repository.getLogger(className);
        } else {
            return new LoggerInterface();
        }
    };

    this.clear = function() {
        appender.clear();
    }
}


/** Client side logging functionality for debug purposes
 * In order to use logger your module should depend on {@link module:client/logging} module
 * Use dcm.loggerFactory to create logger for your class
 * @module client/logging
 * @require client/native
 * @require client/communication
 * @require client/storage
*/
 function LoggingComponent(context) {
    ComponentInterface.call(this);

    this.create = function(config) {
        /** Instance of loggerFactory to use
         * @memberOf dcm
         * @type LoggerFactoryInterface */
        context.loggerFactory = new ClientLoggerFactory();
    };

    this.cleanup = function() {
        // deletes the log file
        context.loggerFactory.clear();
    }
}

dcm.addComponent("client/logging", ["client/native", "client/storage"], new LoggingComponent(dcm));

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is log4moz
 *
 * The Initial Developer of the Original Code is
 * Michael Johnston
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Michael Johnston <special.michael@gmail.com>
 * Dan Mills <thunder@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/* wrapping to prevent const conflicts*/
function getLog4Moz() {
    // const Cc = Components.classes;
    // const Ci = Components.interfaces;
    // const Cr = Components.results;
    // const Cu = Components.utils;

    const {Cc,Ci,Cr,Cu} = require("chrome");
    const MODE_RDONLY = 0x01;
    const MODE_WRONLY = 0x02;
    const MODE_CREATE = 0x08;
    const MODE_APPEND = 0x10;
    const MODE_TRUNCATE = 0x20;

    const PERMS_FILE = 0644;
    const PERMS_DIRECTORY = 0755;

    const ONE_BYTE = 1;
    const ONE_KILOBYTE = 1024 * ONE_BYTE;
    const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

    let Log4Moz = {
        Level:{
            Fatal:70,
            Error:60,
            Warn:50,
            Info:40,
            Config:30,
            Debug:20,
            Trace:10,
            All:0,
            Desc:{
                70:"FATAL",
                60:"ERROR",
                50:"WARN",
                40:"INFO",
                30:"CONFIG",
                20:"DEBUG",
                10:"TRACE",
                0:"ALL"
            }
        },

        get repository() {
            delete Log4Moz.repository;
            Log4Moz.repository = new LoggerRepository();
            return Log4Moz.repository;
        },
        set repository(value) {
            delete Log4Moz.repository;
            Log4Moz.repository = value;
        },

        get LogMessage() {
            return LogMessage;
        },
        get Logger() {
            return Logger;
        },
        get LoggerRepository() {
            return LoggerRepository;
        },

        get Formatter() {
            return Formatter;
        },
        get BasicFormatter() {
            return BasicFormatter;
        },

        get Appender() {
            return Appender;
        },
        get DumpAppender() {
            return DumpAppender;
        },
        get ConsoleAppender() {
            return ConsoleAppender;
        },
        get FileAppender() {
            return FileAppender;
        },
        get RotatingFileAppender() {
            return RotatingFileAppender;
        },

        // Logging helper:
        // let logger = Log4Moz.repository.getLogger("foo");
        // logger.info(Log4Moz.enumerateInterfaces(someObject).join(","));
        enumerateInterfaces:function Log4Moz_enumerateInterfaces(aObject) {
            let interfaces = [];

            for (i in Ci) {
                try {
                    aObject.QueryInterface(Ci[i]);
                    interfaces.push(i);
                }
                catch (ex) {
                }
            }

            return interfaces;
        },

        // Logging helper:
        // let logger = Log4Moz.repository.getLogger("foo");
        // logger.info(Log4Moz.enumerateProperties(someObject).join(","));
        enumerateProperties:function Log4Moz_enumerateProps(aObject, aExcludeComplexTypes) {
            let properties = [];

            for (p in aObject) {
                try {
                    if (aExcludeComplexTypes &&
                        (typeof aObject[p] == "object" || typeof aObject[p] == "function"))
                        continue;
                    properties.push(p + " = " + aObject[p]);
                }
                catch (ex) {
                    properties.push(p + " = " + ex);
                }
            }

            return properties;
        }
    };


    /*
     * LogMessage
     * Encapsulates a single log event's data
     */
    function LogMessage(loggerName, level, message) {
        this.loggerName = loggerName;
        this.message = message;
        this.level = level;
        this.time = Date.now();
    }

    LogMessage.prototype = {
        get levelDesc() {
            if (this.level in Log4Moz.Level.Desc)
                return Log4Moz.Level.Desc[this.level];
            return "UNKNOWN";
        },

        toString:function LogMsg_toString() {
            return "LogMessage [" + this.time + " " + this.level + " " +
                this.message + "]";
        }
    };

    /*
     * Logger
     * Hierarchical version.  Logs to all appenders, assigned or inherited
     */

    function Logger(name, repository) {
        if (!repository)
            repository = Log4Moz.repository;
        this._name = name;
        this.children = [];
        this.ownAppenders = [];
        this.appenders = [];
        this._repository = repository;
    }

    Logger.prototype = {
        get name() {
            return this._name;
        },

        _level:null,
        get level() {
            if (this._level != null)
                return this._level;
            if (this.parent)
                return this.parent.level;
            dump("log4moz warning: root logger configuration error: no level defined\n");
            return Log4Moz.Level.All;
        },
        set level(level) {
            this._level = level;
        },

        _parent:null,
        get parent() this._parent,
        set parent(parent) {
            if (this._parent == parent) {
                return;
            }
            // Remove ourselves from parent's children
            if (this._parent) {
                let index = this._parent.children.indexOf(this);
                if (index != -1) {
                    this._parent.children.splice(index, 1);
                }
            }
            this._parent = parent;
            parent.children.push(this);
            this.updateAppenders();
        },

        updateAppenders:function updateAppenders() {
            if (this._parent) {
                let notOwnAppenders = this._parent.appenders.filter(function (appender) {
                    return this.ownAppenders.indexOf(appender) == -1;
                }, this);
                this.appenders = notOwnAppenders.concat(this.ownAppenders);
            } else {
                this.appenders = this.ownAppenders.slice();
            }

            // Update children's appenders.
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].updateAppenders();
            }
        },

        addAppender:function Logger_addAppender(appender) {
            if (this.ownAppenders.indexOf(appender) != -1) {
                return;
            }
            this.ownAppenders.push(appender);
            this.updateAppenders();
        },

        removeAppender:function Logger_removeAppender(appender) {
            let index = this.ownAppenders.indexOf(appender);
            if (index == -1) {
                return;
            }
            this.ownAppenders.splice(index, 1);
            this.updateAppenders();
        },

        log:function Logger_log(level, string) {
            if (this.level > level)
                return;

            // Hold off on creating the message object until we actually have
            // an appender that's responsible.
            let message;
            let appenders = this.appenders;
            for (let i = 0; i < appenders.length; i++) {
                let appender = appenders[i];
                if (appender.level > level)
                    continue;

                if (!message)
                    message = new LogMessage(this._name, level, string);

                appender.append(message);
            }
        },

        fatal:function Logger_fatal(string) {
            this.log(Log4Moz.Level.Fatal, string);
        },
        error:function Logger_error(string) {
            this.log(Log4Moz.Level.Error, string);
        },
        warn:function Logger_warn(string) {
            this.log(Log4Moz.Level.Warn, string);
        },
        info:function Logger_info(string) {
            this.log(Log4Moz.Level.Info, string);
        },
        config:function Logger_config(string) {
            this.log(Log4Moz.Level.Config, string);
        },
        debug:function Logger_debug(string) {
            this.log(Log4Moz.Level.Debug, string);
        },
        trace:function Logger_trace(string) {
            this.log(Log4Moz.Level.Trace, string);
        }
    };

    /*
     * LoggerRepository
     * Implements a hierarchy of Loggers
     */

    function LoggerRepository() {
    }

    LoggerRepository.prototype = {
        _loggers:{},

        _rootLogger:null,
        get rootLogger() {
            if (!this._rootLogger) {
                this._rootLogger = new Logger("root", this);
                this._rootLogger.level = Log4Moz.Level.All;
            }
            return this._rootLogger;
        },
        set rootLogger(logger) {
            throw "Cannot change the root logger";
        },

        _updateParents:function LogRep__updateParents(name) {
            let pieces = name.split('.');
            let cur, parent;

            // find the closest parent
            // don't test for the logger name itself, as there's a chance it's already
            // there in this._loggers
            for (let i = 0; i < pieces.length - 1; i++) {
                if (cur)
                    cur += '.' + pieces[i];
                else
                    cur = pieces[i];
                if (cur in this._loggers)
                    parent = cur;
            }

            // if we didn't assign a parent above, there is no parent
            if (!parent)
                this._loggers[name].parent = this.rootLogger;
            else
                this._loggers[name].parent = this._loggers[parent];

            // trigger updates for any possible descendants of this logger
            for (let logger in this._loggers) {
                if (logger != name && logger.indexOf(name) == 0)
                    this._updateParents(logger);
            }
        },

        getLogger:function LogRep_getLogger(name) {
            if (name in this._loggers)
                return this._loggers[name];
            this._loggers[name] = new Logger(name, this);
            this._updateParents(name);
            return this._loggers[name];
        }
    };

    /*
     * Formatters
     * These massage a LogMessage into whatever output is desired
     * Only the BasicFormatter is currently implemented
     */

// Abstract formatter
    function Formatter() {
    }

    Formatter.prototype = {
        format:function Formatter_format(message) {
        }
    };

// Basic formatter that doesn't do anything fancy
    function BasicFormatter(dateFormat) {
        if (dateFormat)
            this.dateFormat = dateFormat;
    }

    BasicFormatter.prototype = {
        __proto__:Formatter.prototype,

        format:function BF_format(message) {
            return message.time + "\t" + message.loggerName + "\t" + message.levelDesc
                + "\t" + message.message + "\n";
        }
    };

    /*
     * Appenders
     * These can be attached to Loggers to log to different places
     * Simply subclass and override doAppend to implement a new one
     */

    function Appender(formatter) {
        this._name = "Appender";
        this._formatter = formatter ? formatter : new BasicFormatter();
    }

    Appender.prototype = {
        level:Log4Moz.Level.All,

        append:function App_append(message) {
            this.doAppend(this._formatter.format(message));
        },
        toString:function App_toString() {
            return this._name + " [level=" + this._level +
                ", formatter=" + this._formatter + "]";
        },
        doAppend:function App_doAppend(message) {
        }
    };

    /*
     * DumpAppender
     * Logs to standard out
     */

    function DumpAppender(formatter) {
        this._name = "DumpAppender";
        this._formatter = formatter ? formatter : new BasicFormatter();
    }

    DumpAppender.prototype = {
        __proto__:Appender.prototype,

        doAppend:function DApp_doAppend(message) {
            dump(message);
        }
    };

    /*
     * ConsoleAppender
     * Logs to the javascript console
     */

    function ConsoleAppender(formatter) {
        this._name = "ConsoleAppender";
        this._formatter = formatter;
    }

    ConsoleAppender.prototype = {
        __proto__:Appender.prototype,

        doAppend:function CApp_doAppend(message) {
            if (message.level > Log4Moz.Level.Warn) {
                Cu.reportError(message);
                return;
            }
            Cc["@mozilla.org/consoleservice;1"].
                getService(Ci.nsIConsoleService).logStringMessage(message);
        }
    };

    /*
     * FileAppender
     * Logs to a file
     */

    function FileAppender(file, formatter) {
        this._name = "FileAppender";
        this._file = file; // nsIFile
        this._formatter = formatter ? formatter : new BasicFormatter();
    }

    FileAppender.prototype = {
        __proto__:Appender.prototype,
        __fos:null,
        get _fos() {
            if (!this.__fos)
                this.openStream();
            return this.__fos;
        },

        openStream:function FApp_openStream() {
            try {
                let __fos = Cc["@mozilla.org/network/file-output-stream;1"].
                    createInstance(Ci.nsIFileOutputStream);
                let flags = MODE_WRONLY | MODE_CREATE | MODE_APPEND;
                __fos.init(this._file, flags, PERMS_FILE, 0);

                this.__fos = Cc["@mozilla.org/intl/converter-output-stream;1"]
                    .createInstance(Ci.nsIConverterOutputStream);
                this.__fos.init(__fos, "UTF-8", 4096,
                    Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
            } catch (e) {
                dump("Error opening stream:\n" + e);
            }
        },

        closeStream:function FApp_closeStream() {
            if (!this.__fos)
                return;
            try {
                this.__fos.close();
                this.__fos = null;
            } catch (e) {
                dump("Failed to close file output stream\n" + e);
            }
        },

        doAppend:function FApp_doAppend(message) {
            if (message === null || message.length <= 0)
                return;
            try {
                this._fos.writeString(message);
            } catch (e) {
                dump("Error writing file:\n" + e);
            }
        },

        clear:function FApp_clear() {
            this.closeStream();
            try {
                this._file.remove(false);
            } catch (e) {
                // XXX do something?
            }
        }
    };

    /*
     * RotatingFileAppender
     * Similar to FileAppender, but rotates logs when they become too large
     */

    function RotatingFileAppender(file, formatter, maxSize, maxBackups) {
        if (maxSize === undefined)
            maxSize = ONE_MEGABYTE * 2;

        if (maxBackups === undefined)
            maxBackups = 0;

        this._name = "RotatingFileAppender";
        this._file = file; // nsIFile
        this._formatter = formatter ? formatter : new BasicFormatter();
        this._maxSize = maxSize;
        this._maxBackups = maxBackups;
    }

    RotatingFileAppender.prototype = {
        __proto__:FileAppender.prototype,

        doAppend:function RFApp_doAppend(message) {
            if (message === null || message.length <= 0)
                return;
            try {
                this.rotateLogs();
                FileAppender.prototype.doAppend.call(this, message);
            } catch (e) {
                dump("Error writing file:" + e + "\n");
            }
        },

        rotateLogs:function RFApp_rotateLogs() {
            if (this._file.exists() &&
                this._file.fileSize < this._maxSize)
                return;

            this.closeStream();

            for (let i = this.maxBackups - 1; i > 0; i--) {
                let backup = this._file.parent.clone();
                backup.append(this._file.leafName + "." + i);
                if (backup.exists())
                    backup.moveTo(this._file.parent, this._file.leafName + "." + (i + 1));
            }

            let cur = this._file.clone();
            if (cur.exists())
                cur.moveTo(cur.parent, cur.leafName + ".1");

            // Note: this._file still points to the same file
        }
    };

    return Log4Moz;
}


function ChannelHeadersVisitor(chanel) {
    var requestHeaders = {};
    var responseHeaders = {};

    function getVisitor(storage) {
        return {
            visitHeader: function(name, value) {
                storage[name] = value;
            }
        }
    }

    chanel.visitRequestHeaders(getVisitor(requestHeaders));
    chanel.visitResponseHeaders(getVisitor(responseHeaders));

    this.getResponseHeader = function(name) {
        return responseHeaders[name];
    };

    this.getRequestHeader = function(name) {
        return requestHeaders[name];
    }
}

/** Monitors all requests performed by browser, constructs {@link RequestData} and notifies via messages.
 * @module client/monitoring
 * @requires client/communication
 * @requires client/native
 * @requires client/logging */

function MonitoringComponent(context) {
    ComponentInterface.call(this);
    var dataMonitor;

    this.create = function(config) {
        var dataFactory = new RequestDataFactory(new RequestDataRetriever());
        dataMonitor = new RequestDataMonitor(dataFactory);
        dataMonitor.start();
    };

    this.destroy = function() {
        dataMonitor.stop();
    }
}

dcm.addComponent("client/monitoring", ["client/communication", "client/logging", "client/native"], new MonitoringComponent(dcm));


/** Responsible for cleaning post data
 * @constructor */
function PostDataPrettyfier() {
    var defaultRegex = /Content\-Length:\s\d+[\r\n]+((?:.+[\r\n]*)+)/i;
    var contentTypeMatcher = /Content\-Type:\s(\w+\/[\w-]+)[\r\n]*/i;

    var defaultType = "application/x-www-form-urlencoded";

    function getContentType(postData) {
        var result = defaultType;
        var type = postData.match(contentTypeMatcher);
        if (type && type.length > 0) {
            result = type[1];
        }

        return result;
    }

    /**Remove unnecessary data in post data
     * @param {String }postData
     * @return {String} */
    this.process = function(postData) {
        var newPostData = "";

        if (postData) {
            var contentType = getContentType(postData);

            if (contentType === defaultType) {
                var result = postData.match(defaultRegex);
                if (result && result.length > 0) {
                    newPostData = result[1];
                }
            }
        }

        return newPostData;
    }
}

/**
 * Responsible for creating data that will be sent to the server
 * @param {RequestDataRetriever} dataRetriever
 * @constructor
 */
function RequestDataFactory(dataRetriever) {
    var seqIDs = {};
    var postDataPrettyfier = new PostDataPrettyfier();

    function getSequenceNumber(tabID) {
        if (seqIDs[tabID] === undefined) {
            seqIDs[tabID] = 0;
        } else {
            seqIDs[tabID]++;
        }
        return seqIDs[tabID];
    }

    function setReferrerData(request, subject) {
        if (subject.referrer && subject.referrer.asciiSpec) {
            request.setReferrer(subject.referrer.asciiSpec);
        }
    }

    function setLocationData(request, headers) {
        var locationHeader = headers.getResponseHeader("Location");
        if (locationHeader) {
            request.setLocation(locationHeader);
        }
    }

    function setRequestType(request, subject) {
        request.setRequestType(subject.loadFlags & subject.LOAD_DOCUMENT_URI ? "main" : "resource");
    }

    function setFrameId(request, subject) {
        var frameId = dataRetriever.getFrameID(subject);
        if (frameId) {
            request.setFrameID(frameId);
        }
    }

    function createRequest(subject) {
        var tabID = dataRetriever.getTabID(subject);
        if (!tabID) {
            return null;
        }

        var seqID = getSequenceNumber(tabID);
        var request = new RequestData(subject.URI.asciiSpec, seqID);
        request.setTabID(tabID);
        return request;
    }

    function setPostData(request, subject) {
        var postData = dataRetriever.getPostData(subject);
        if (postData) {
            request.setPostData(postDataPrettyfier.process(postData));
        }
    }

    function setCookies(request, headers) {
        var requestCookies = headers.getRequestHeader("Cookie");
        if (requestCookies) {
            request.setRequestCookies(requestCookies);
        }

        var responseCookies = headers.getResponseHeader("Set-Cookie");
        if (responseCookies) {
            request.setResponseCookies(responseCookies);
        }
    }

    function setContentType(request, headers) {
        var contentType = headers.getResponseHeader("Content-Type");
        if (contentType) {
            request.setContentType(contentType);
        }

        var contentLength = headers.getResponseHeader("Content-Length");
        if (contentLength) {
            request.setContentLength(contentLength);
        }
    }

    /**
     * Create request data that contains Tab Id, Sequence Number, Http Method, URL and other fields
     * @param subject nsiHttpChannel mozilla object
     * @return {RequestData}
     */

    this.createRequestData = function(subject) {
        var request = createRequest(subject);
        if (request) {
            var headers = new ChannelHeadersVisitor(subject);
            request.setMethod(subject.requestMethod);
            request.setStatusCode(subject.responseStatus);

            setReferrerData(request, subject);
            setLocationData(request, headers);
            setRequestType(request, subject);
            setFrameId(request, subject);
            setPostData(request, subject);
            setCookies(request, headers);
            setContentType(request, headers);
        }

        return request;
    };
}

function RequestDataMonitor(dataFactory) {
    MessageSenderMixin.call(this);

    var logger = dcm.loggerFactory.getLogger('monitoring.RequestDataMonitor');
    var messenger = dcm.communication.factory.createSender();

    function handleResponse(subject) {
        var url = subject.URI.asciiSpec;
        var responseCode = subject.responseStatus;

        if (responseCode < 200) {
            logger.debug('Ignoring responses below 200: ' + url);
        } else {
            var request = dataFactory.createRequestData(subject);
            if (request) {
                messenger.transmit(MESSAGING_DATA.REQUEST_MONITORING_SUBJECT, MESSAGING_DATA.REQUEST_MONITORING_DATA_READY, request.getData());
            }
        }
    }

    var observer = {
        observe : function observe(subject, topic, data) {
            try {
                switch (topic) {
                    case 'http-on-examine-response':
                    case 'http-on-examine-cached-response':
                        subject.QueryInterface(CI.nsIHttpChannel);
                        handleResponse(subject);
                        break;
                    default:
                        logger.warn('Unrecognized topic: ' + topic );
                        break;
                }
            } catch (e) {
                logger.error("Error handling request: "+e);
            }
        }
    };

    this.start = function() {
        logger.info('Start observing web requests.');

        // handle the events.
        var service = dcm.ffNativeServiceFactory.getObserverService();
        service.addObserver(observer, 'http-on-examine-response', false);
        service.addObserver(observer, 'http-on-examine-cached-response', false);
    };

    this.stop = function() {
        var service = dcm.ffNativeServiceFactory.getObserverService();
        service.removeObserver(observer, 'http-on-examine-response');
        service.removeObserver(observer, 'http-on-examine-cached-response');

        logger.info('Stop observing web requests.');
    };
}



function RequestDataRetriever() {
    var logger = dcm.loggerFactory.getLogger("monitoring.RequestIdentificationTools");

    function getRequestUrl(aSubject) {
        return aSubject.URI.asciiSpec;
    }

    function getNotificationCallback(channel) {
        if (channel.notificationCallbacks) {
            return channel.notificationCallbacks;
        } else if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
            return channel.loadGroup.notificationCallbacks;
        } else {
            return null;
        }
    }

    function getCallbackWindow(channel) {
        try {
            var notificationCallbacks = getNotificationCallback(channel);

            if (notificationCallbacks && !notificationCallbacks.dcmRequest) {// not handle own requests
                try {
                    return notificationCallbacks.getInterface(CI.nsIDOMWindow);
                } catch (ex) {
                    return channel.loadGroup.notificationCallbacks.getInterface(CI.nsIDOMWindow);
                }
            }
        } catch(e) {
            //we shouldn't monitor requests which doesn't have window
        }
        return null;
    }

    function getFrameIndex(window, id) {
        if (window.frameElement && window.parent) {
            var frames = window.parent.frames;
            for (var i = 0, len = frames.length; i < len; i++) {
                if (frames[i] == window) {
                    id = i + (id ? "-" + id : "");
                    break;
                }
            }

            if (window != window.parent) {
                return getFrameIndex(window.parent, id);
            }
        }

        return id;
    }

    function rewindStreamToBegin(uploadStream) {
        try {
            uploadStream.QueryInterface(CI.nsISeekableStream);
            uploadStream.seek(0, 0);
        } catch (ex) {
            logger.debug("post data stream rewind error: " + ex);
        }
    }

    function readFromStream(uploadStream) {
        var thePostData = null;
        var scriptablestream = dcm.ffNativeServiceFactory.getScriptableStream(uploadStream);
        var cbAvail = scriptablestream.available();
        if (cbAvail > 0) {
            thePostData = scriptablestream.read(cbAvail);
        }
        return thePostData;
    }

    function getWindowId(callback) {
        if (!callback.top.customID) {
            callback.top.customID = (new Date()).getTime();
        }
        return callback.top.customID;
    }

    this.getTabID = function(channel) {
        var panel;
        var callback = getCallbackWindow(channel);

        if (callback) {
            panel = window.getNotificationBox(callback.top);

            if (panel) {
                return panel.id;
            }
        }
        return null;
    };

    this.getFrameID = function(channel) {
        var callback = getCallbackWindow(channel);
        if (callback) {
            try {
                var id = getFrameIndex(callback);
                if (id) {
                    return getWindowId(callback) + "-" + id;
                }
            } catch(e) {
                logger.debug("Error during retrievement of frame id for url: " + getRequestUrl(channel) + ": " + e);
            }
        }
        return null;
    };

    this.getPostData = function(channel) {
        try {
            var requestMethod = channel.requestMethod;
            if (requestMethod == "POST") {
                channel.QueryInterface(CI.nsIUploadChannel);
                var uploadStream = channel.uploadStream;
                if (uploadStream) {
                    rewindStreamToBegin(uploadStream);
                    return readFromStream(uploadStream);
                }
            }
        } catch(ex) {
            logger.debug("Cannot read post data: "+ex);
        }
        return null;
    }
}

/** Set of helpers to get access into Firefox Extensions API
 * @module client/native */
function NativeComponent(context) {
    ComponentInterface.call(this);

    this.create = function(config) {
        context.ffNativeServiceFactory = new FFNativeServiceFactory();
    };

    this.cleanup = function() {
        // delete "dcm" directory with all the cached data
        var dir = context.ffNativeServiceFactory.getLocalDirectory();
        dir.remove(true);
    };
}

dcm.addComponent("client/native", [], new NativeComponent(dcm));

// var CS = Components;
// var CC = Components.classes;
// var CI = Components.interfaces;
// var CR = Components.results;
// var CU = Components.utils;
var {Cc, Ci, Cu, Cr, Cs} = require("chrome");
var CC =Cc;
var CS =Cs;
var CI = Ci;
var CR = Cr;
var CU = Cu;

function FFNativeServiceFactory() {
    this.getObserverService = function() {
        return CC['@mozilla.org/observer-service;1'].getService(CI.nsIObserverService);
    };

    this.getPreferenceService = function(root) {
        var prefs = CC["@mozilla.org/preferences-service;1"]
            .getService(CI.nsIPrefService);
        return prefs.getBranch(root);
    };

    this.getScriptableStream = function(uploadStream) {
        var scriptablestream = CC["@mozilla.org/scriptableinputstream;1"].createInstance(
            CI.nsIScriptableInputStream);
        scriptablestream.init(uploadStream);
        return scriptablestream;
    };

    this.getFileObject = function() {
        var directoryService = CC["@mozilla.org/file/directory_service;1"].getService(CI.nsIProperties);
        // this is a reference to the profile dir (ProfD) now.
        return directoryService.get("ProfD", CI.nsIFile);
    };

    this.getLocalDirectory = function() {
        var localDir = this.getFileObject();

        localDir.append("dcm");

        if (!localDir.exists() || !localDir.isDirectory()) {
            // read and write permissions to owner and group, read-only for others.
            localDir.create(CI.nsIFile.DIRECTORY_TYPE, 0774);
        }

        return localDir;
    };

    this.getConverterService = function() {
        return CC["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(CI.nsIScriptableUnicodeConverter);
    };

    this.isPrivateBrowsingEnabled = function() {
        var inPrivateBrowsing = false;
        try {
            // FireFox 20+
            CU.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
            inPrivateBrowsing = PrivateBrowsingUtils.isWindowPrivate(window);
        } catch (e) {
            // pre FireFox 20
            try {
                inPrivateBrowsing = CC["@mozilla.org/privatebrowsing;1"].
                    getService(CI.nsIPrivateBrowsingService).privateBrowsingEnabled;
            }
            catch (e) {}
        }

        return inPrivateBrowsing;
    }
}



/** Creates FireFox specific Worker
 * @extends WorkerBuilderInterface
 * @constructor */
function FFWorkerBuilder() {
    WorkerBuilderInterface.call(this);

    this.build = function(engineCode) {
        var blob = new Blob([engineCode]);
        return new Worker(window.URL.createObjectURL(blob));
    }
}

dcm.addComponent("client/runner", ["client/all"], new EngineRunnerComponent(dcm, new FFWorkerBuilder()));
dcm.addComponent("client/runner/errors", ["client/all"], new RunnerErrorsListenerComponent(dcm));
dcm.addComponent("client/runner/downloader", ["client/all"], new EngineCodeCachingComponent(dcm));



/** Perform all operations related to store/read data
 * @module client/storage
 * @requires client/native
 * */
function StorageComponent(context) {
    ComponentInterface.call(this);

    function clearSettings() {
        var ids = context.userOptions.getUserGroupId();

        var settings = context.storageFactory.getSettings();
        settings.removeAll();

        context.userOptions.preserveUserGroupId(ids);
    }

    this.create = function(config) {
        context.storageFactory = new StorageFactory("extensions.dcm.");
    };

    this.cleanup = function() {
        clearSettings();
    }
}

dcm.addComponent("client/storage", ["client/native"], new StorageComponent(dcm));

/** Class which writes data to the profile/dcm/ directory on disk
 * @extends StorageInterface
 * @constructor*/
function DiskStorage(name) {
    StorageInterface.call(this);
    CU.import("resource://gre/modules/NetUtil.jsm");
    CU.import("resource://gre/modules/FileUtils.jsm");
    var file = getFile();

    function getFile() {
        var localDirectory = dcm.ffNativeServiceFactory.getLocalDirectory();
        localDirectory.append(name+".dat");
        return localDirectory;
    }

    this.read = function(callback) {
        if (file.exists()) {
            NetUtil.asyncFetch(file, function(inputStream, status) {
                if (!CS.isSuccessCode(status)) {
                    callback();
                    return;
                }

                var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
                callback(data);
            });
        } else {
            callback(null);
        }
    };

    this.write = function(callback, value) {
        var ostream = FileUtils.openSafeFileOutputStream(file);

        var converter = dcm.ffNativeServiceFactory.getConverterService();
        converter.charset = "UTF-8";
        var istream = converter.convertToInputStream(value);

        NetUtil.asyncCopy(istream, ostream, function(status) {
            if (!CS.isSuccessCode(status)) {
                callback(false);
            } else {
                callback(true)
            }
        });
    };

    this.exist = function(callback) {
        setTimeout(function() {
            callback(file.exists());
        }, 100)
    };

    this.remove = function() {
        if (file.exists()) {
            file.remove(true);
        }
    };
}


/** Manages access to add-on settings
 * @param {String} rootBranch
 * @constructor */
function SettingsStorage(rootBranch) {
    StorageInterface.call(this);
    var branch = dcm.ffNativeServiceFactory.getPreferenceService(rootBranch);

    function setMethodByValue(value) {
        switch (typeof value) {
            case "boolean":
                return "setBoolPref";
            case "number":
                return "setIntPref";
            default :
                return "setCharPref";
        }
    }

    function getMethodByPref(key) {
        switch (branch.getPrefType(key)) {
            case CI.nsIPrefBranch.PREF_BOOL:
                return "getBoolPref";
            case CI.nsIPrefBranch.PREF_INT:
                return "getIntPref";
            default :
                return "getCharPref";
        }
    }

    this.set = function(key, value) {
        var method = setMethodByValue(value);
        try {
            branch[method](key, value);
        } catch (e) {
            //value exist with wrong type. rewrite
            this.remove(key);
            branch[method](key, value);
        }
    };

    this.get = function(key) {
        try {
            var method = getMethodByPref(key);
            return branch[method](key);
        } catch (e) {
            return undefined;
        }
    };

    this.has = function(key) {
        return branch.prefHasUserValue(key);
    };

    this.remove = function(key) {
        branch.clearUserPref(key);
    };

    this.removeAll = function() {
        branch.deleteBranch("");
    };

    this.getAll = function() {
        var settings = {};
        var namesList = branch.getChildList("", {});
        for (var i = 0; i < namesList.length; i++) {
            var key = namesList[i];
            settings[key] = this.get(key);
        }
        return settings;
    }
}

/** Creates DiskStorage and SettingsStorage
 * @param {String} settingsRoot
 * @extends StorageFactoryInterface
 * @constructor */
function StorageFactory(settingsRoot) {
    StorageFactoryInterface.call(this);

    this.getStorage = function(name) {
        return new DiskStorage(name);
    };

    this.getSettings = function() {
        return new SettingsStorage(settingsRoot);
    }
}

function XhrConfigurator() {
    XhrConfiguratorInterface.call(this);

    this.configure = function(request) {
        //mozBackgroundRequest should be assigned before open.
        request.dcmRequest = true;
        request.mozBackgroundRequest = true;
    }
}

dcm.addComponent("client/xhr", ["client/options"], new XhrComponent(dcm, new XhrConfigurator()));


        })(window)
