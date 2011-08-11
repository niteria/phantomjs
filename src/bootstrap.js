// This allows creating a new web page using the construct "new WebPage",
// which feels more natural than "phantom.createWebPage()".
window.WebPage = function() {
    var page = phantom.createWebPage(),
        handlers = {};

    function defineSetter(handlerName, signalName) {
        page.__defineSetter__(handlerName, function(f) {
            if (handlers && typeof handlers[signalName] === 'function') {
                try {
                    this[signalName].disconnect(handlers[signalName]);
                } catch (e) {}
            }
            handlers[signalName] = f;
            this[signalName].connect(handlers[signalName]);
        });
    };

    // deep copy
    page.settings = JSON.parse(JSON.stringify(phantom.defaultPageSettings));

    defineSetter("onLoadStarted", "loadStarted");

    defineSetter("onLoadFinished", "loadFinished");

    defineSetter("onResourceRequested", "resourceRequested");

    defineSetter("onResourceReceived", "resourceReceived");

    defineSetter("onAlert", "javaScriptAlertSent");

    defineSetter("onConsoleMessage", "javaScriptConsoleMessageSent");

    page.open = function () {
        if (arguments.length === 1) {
            this.openUrl(arguments[0], 'get', this.settings);
            return;
        }
        if (arguments.length === 2 && typeof arguments[1] === 'function') {
            this.onLoadFinished = arguments[1];
            this.openUrl(arguments[0], 'get', this.settings);
            return;
        } else if (arguments.length === 2) {
            this.openUrl(arguments[0], arguments[1], this.settings);
            return;
        } else if (arguments.length === 3 && typeof arguments[2] === 'function') {
            this.onLoadFinished = arguments[2];
            this.openUrl(arguments[0], arguments[1], this.settings);
            return;
        } else if (arguments.length === 3) {
            this.openUrl(arguments[0], {
                operation: arguments[1],
                data: arguments[2]
                }, this.settings);
            return;
        } else if (arguments.length === 4) {
            this.onLoadFinished = arguments[3];
            this.openUrl(arguments[0], {
                operation: arguments[1],
                data: arguments[2]
                }, this.settings);
            return;
        }
        throw "Wrong use of WebPage#open";
    };

    page.openBlocking = function() {
        if (arguments.length === 1) {
            this.openUrl(arguments[0], 'get', this.settings, false);
            return;
        } else if (arguments.length === 2) {
            this.openUrl(arguments[0], arguments[1], this.settings, false);
            return;
        } else if (arguments.length === 3) {
            this.openUrl(arguments[0], {
                operation: arguments[1],
                data: arguments[2]
                }, this.settings, false);
            return;
        }
        throw "Wrong use of WebPage#openBlocking";
    }

    page.includeJs = function(scriptUrl, onScriptLoaded) {
        // Register temporary signal handler for 'alert()'
        this.javaScriptAlertSent.connect(function(msgFromAlert) {
            if ( msgFromAlert === scriptUrl ) {
                // Resource loaded, time to fire the callback
                onScriptLoaded(scriptUrl);
                // And disconnect the signal handler
                try {
                    this.javaScriptAlertSent.disconnect(arguments.callee);
                } catch (e) {}
            }
        });

        // Append the script tag to the body
        this._appendScriptElement(scriptUrl);
    };

    page.destroy = function() {
        phantom._destroy(page);
    };

    return page;
};

// window.fs
// JavaScript "shim" to throw exceptions in case a critical operation fails.

/** Open and return a "file" object.
 * It will throw exception if it fails.
 *
 * @param path Path of the file to open
 * @param mode Open Mode. A string made of 'r', 'w', 'a/+' characters.
 * @return "file" object
 */
window.fs.open = function(path, mode) {
    var file = window.fs._open(path, mode);
    if (file) {
        return file;
    }
    throw "Unable to open file '"+ path +"'";
};

/** Open, read and return content of a file.
 * It will throw an exception if it fails.
 *
 * @param path Path of the file to read from
 * @return file content 
 */
window.fs.read = function(path) {
    var f = fs.open(path, 'r'),
        content = f.read();

    f.close();
    return content;
};

/** Open and write content to a file
 * It will throw an exception if it fails.
 *
 * @param path Path of the file to read from
 * @param content Content to write to the file
 * @param mode Open Mode. A string made of 'w' or 'a / +' characters.
 */
window.fs.write = function(path, content, mode) {
    var f = fs.open(path, mode);

    f.write(content);
    f.close();
};

/** Return the size of a file, in bytes.
 * It will throw an exception if it fails.
 *
 * @param path Path fo the file to read the size of
 * @return File size in bytes
 */
window.fs.size = function(path) {
    var size = fs._size(path);
    if (size !== -1) {
        return size;
    }
    throw "Unable to read file '"+ path +"' size";
};


// --- begin file require.js
/*
 * An implementation of the CommonJS Modules 1.0
 * Copyright (c) 2009 by David Flanagan
 */
window.require = function(id) {
    var origid = id, filename;

    // If the module id is relative, convert it to a toplevel id
    // The normalize function is below.
    if (id.substring(0,2) == "./" || id.substring(0,3) == "../")
        id = normalize(require._current_module_dir, id);

    // Now resolve the toplevel id relative to require.dir
    filename = require.dir + id + ".js";

    // Only load the module if it is not already cached.
    if (!require._cache.hasOwnProperty(filename)) {

        // Remember the directory we're loading this module from
        var olddir = require._current_module_dir;
        require._current_module_dir = id.substring(0, id.lastIndexOf('/')+1);
        
        try {
            // Load the text of the module
            var modtext = gettext(filename);
            // Wrap it in a function
            var f = new Function("require", "exports", "module", modtext);
            // Prepare function arguments
            var context = {};                            // Invoke on empty obj
            var exports = require._cache[filename] = {}; // API goes here
            var module = { id: id, uri: filename };      // For Modules 1.1
            f.call(context, require, exports, module);   // Execute the module
        }
        catch(x) {
            throw new Error("Can't load module " + origid + ": " + x);
        }
        finally { // Restore the directory we saved above
            require._current_module_dir = olddir;
        }
    }
    return require._cache[filename];  // Return the module API from the cache

    /* Return the text of the specified url, script element or file */
    function gettext(url) {
        console.log('gettext(' + url + ')');
        var fd = fs.open(url, 'r');
        var contents = fd.read();
        fd.close();
        return contents;
    }

    function normalize(dir, file) {
        for(;;) {
            if (file.substring(0,2) == "./")
                file = file.substring(2);
            else if (file.substring(0,3) == "../") {
                file = file.substring(3);
                dir = up(dir);
            }
            else break;
        }
        return dir+file;
        
        function up(dir) { // Return the parent directory of dir
            if (dir == "") throw "Can't go up from ''";
            if (dir.charAt(dir.length-1) != "/") throw "dir doesn't end in /";
            return dir.substring(0, dir.lastIndexOf('/', dir.length-2)+1);
        }
    }
};

// Set require.dir to point to the directory from which modules should be
// loaded.  It must be an empty string or a string that ends with "/".
window.require.dir = "";
window.require._cache = {};               // So we only load modules once
window.require._current_module_dir = "";  // For relative module names

// --- end file require.js
