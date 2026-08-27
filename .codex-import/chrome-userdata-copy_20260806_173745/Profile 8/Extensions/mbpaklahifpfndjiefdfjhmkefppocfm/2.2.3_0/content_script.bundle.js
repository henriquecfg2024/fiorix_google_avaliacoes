/******/ (function(modules) { // webpackBootstrap
/******/ 	// install a JSONP callback for chunk loading
/******/ 	function webpackJsonpCallback(data) {
/******/ 		var chunkIds = data[0];
/******/ 		var moreModules = data[1];
/******/ 		var executeModules = data[2];
/******/
/******/ 		// add "moreModules" to the modules object,
/******/ 		// then flag all "chunkIds" as loaded and fire callback
/******/ 		var moduleId, chunkId, i = 0, resolves = [];
/******/ 		for(;i < chunkIds.length; i++) {
/******/ 			chunkId = chunkIds[i];
/******/ 			if(installedChunks[chunkId]) {
/******/ 				resolves.push(installedChunks[chunkId][0]);
/******/ 			}
/******/ 			installedChunks[chunkId] = 0;
/******/ 		}
/******/ 		for(moduleId in moreModules) {
/******/ 			if(Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
/******/ 				modules[moduleId] = moreModules[moduleId];
/******/ 			}
/******/ 		}
/******/ 		if(parentJsonpFunction) parentJsonpFunction(data);
/******/
/******/ 		while(resolves.length) {
/******/ 			resolves.shift()();
/******/ 		}
/******/
/******/ 		// add entry modules from loaded chunk to deferred list
/******/ 		deferredModules.push.apply(deferredModules, executeModules || []);
/******/
/******/ 		// run deferred modules when all chunks ready
/******/ 		return checkDeferredModules();
/******/ 	};
/******/ 	function checkDeferredModules() {
/******/ 		var result;
/******/ 		for(var i = 0; i < deferredModules.length; i++) {
/******/ 			var deferredModule = deferredModules[i];
/******/ 			var fulfilled = true;
/******/ 			for(var j = 1; j < deferredModule.length; j++) {
/******/ 				var depId = deferredModule[j];
/******/ 				if(installedChunks[depId] !== 0) fulfilled = false;
/******/ 			}
/******/ 			if(fulfilled) {
/******/ 				deferredModules.splice(i--, 1);
/******/ 				result = __webpack_require__(__webpack_require__.s = deferredModule[0]);
/******/ 			}
/******/ 		}
/******/ 		return result;
/******/ 	}
/******/
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// object to store loaded and loading chunks
/******/ 	// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 	// Promise = chunk loading, 0 = chunk loaded
/******/ 	var installedChunks = {
/******/ 		3: 0
/******/ 	};
/******/
/******/ 	var deferredModules = [];
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	var jsonpArray = window["webpackJsonp"] = window["webpackJsonp"] || [];
/******/ 	var oldJsonpFunction = jsonpArray.push.bind(jsonpArray);
/******/ 	jsonpArray.push = webpackJsonpCallback;
/******/ 	jsonpArray = jsonpArray.slice();
/******/ 	for(var i = 0; i < jsonpArray.length; i++) webpackJsonpCallback(jsonpArray[i]);
/******/ 	var parentJsonpFunction = oldJsonpFunction;
/******/
/******/
/******/ 	// add entry module to deferred list
/******/ 	deferredModules.push([44,0]);
/******/ 	// run deferred modules when ready
/******/ 	return checkDeferredModules();
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.SetLinuxNativeVersion = SetLinuxNativeVersion;
exports.GetLinuxNativeVersion = GetLinuxNativeVersion;
exports.SetWindowsNativeVersion = SetWindowsNativeVersion;
exports.GetWindowsNativeVersion = GetWindowsNativeVersion;
exports.SetMacNativeVersion = SetMacNativeVersion;
exports.GetMacNativeVersion = GetMacNativeVersion;
exports.SetExtensionFunctionPrefix = SetExtensionFunctionPrefix;
exports.GetExtensionFunctionPrefix = GetExtensionFunctionPrefix;
exports.SetExtensionInternalNamespacePrefix = SetExtensionInternalNamespacePrefix;
exports.GetExtensionInternalNamespacePrefix = GetExtensionInternalNamespacePrefix;
exports.SetExtensionPrefixForFunctionAndInternalNamespace = SetExtensionPrefixForFunctionAndInternalNamespace;
exports.SetNativeUrl_x32_exe = SetNativeUrl_x32_exe;
exports.SetNativeUrl_x64_exe = SetNativeUrl_x64_exe;
exports.SetNativeUrl_x64_msi = SetNativeUrl_x64_msi;
exports.SetNativeUrl_x32_msi = SetNativeUrl_x32_msi;
exports.SetNativeUrl_x64_rpm = SetNativeUrl_x64_rpm;
exports.SetNativeUrl_x32_rpm = SetNativeUrl_x32_rpm;
exports.SetNativeUrl_x64_deb = SetNativeUrl_x64_deb;
exports.SetNativeUrl_x32_deb = SetNativeUrl_x32_deb;
exports.SetNativeUrl_x64_mac = SetNativeUrl_x64_mac;
exports.GetNativeUrl_x64_mac = GetNativeUrl_x64_mac;
exports.GetNativeUrl_x32_exe = GetNativeUrl_x32_exe;
exports.GetNativeUrl_x64_exe = GetNativeUrl_x64_exe;
exports.GetNativeUrl_x64_msi = GetNativeUrl_x64_msi;
exports.GetNativeUrl_x32_msi = GetNativeUrl_x32_msi;
exports.GetNativeUrl_x64_rpm = GetNativeUrl_x64_rpm;
exports.GetNativeUrl_x32_rpm = GetNativeUrl_x32_rpm;
exports.GetNativeUrl_x64_deb = GetNativeUrl_x64_deb;
exports.GetNativeUrl_x32_deb = GetNativeUrl_x32_deb;
var extensionFunctionPrefix = "";
var extensionInternalNamespacePrefix = "";
var nativeUrl_x32_exe = "";
var nativeUrl_x64_exe = "";
var nativeUrl_x64_msi = "";
var nativeUrl_x32_msi = "";
var natuveUrl_x64_rpm = "";
var natuveUrl_x32_rpm = "";
var natuveUrl_x64_deb = "";
var natuveUrl_x32_deb = "";
var nativeUrl_x64_mac = "";
var linux_native_version = "1.1.0";
var windows_native_version = "1.1.0";
var mac_native_version = "1.0.0";

function SetLinuxNativeVersion(version) {
    linux_native_version = version;
}

function GetLinuxNativeVersion() {
    return linux_native_version;
}

function SetWindowsNativeVersion(version) {
    windows_native_version = version;
}

function GetWindowsNativeVersion() {
    return windows_native_version;
}

function SetMacNativeVersion(version) {
    mac_native_version = version;
}

function GetMacNativeVersion() {
    return mac_native_version;
}

function SetExtensionFunctionPrefix(prefix) {
    extensionFunctionPrefix = prefix;
}

function GetExtensionFunctionPrefix() {
    return extensionFunctionPrefix;
}

function SetExtensionInternalNamespacePrefix(prefix) {
    extensionInternalNamespacePrefix = prefix;
}

function GetExtensionInternalNamespacePrefix() {
    return extensionInternalNamespacePrefix;
}

function SetExtensionPrefixForFunctionAndInternalNamespace(prefix) {
    SetExtensionInternalNamespacePrefix(prefix);
    SetExtensionFunctionPrefix(prefix.toLowerCase());
}

function SetNativeUrl_x32_exe(url) {
    return nativeUrl_x32_exe = url;
}

function SetNativeUrl_x64_exe(url) {
    return nativeUrl_x64_exe = url;
}

function SetNativeUrl_x64_msi(url) {
    return nativeUrl_x64_msi = url;
}

function SetNativeUrl_x32_msi(url) {
    return nativeUrl_x32_msi = url;
}

function SetNativeUrl_x64_rpm(url) {
    return natuveUrl_x64_rpm = url;
}

function SetNativeUrl_x32_rpm(url) {
    return natuveUrl_x32_rpm = url;
}

function SetNativeUrl_x64_deb(url) {
    return natuveUrl_x64_deb = url;
}

function SetNativeUrl_x32_deb(url) {
    return natuveUrl_x32_deb = url;
}

function SetNativeUrl_x64_mac(url) {
    return nativeUrl_x64_mac = url;
}

function GetNativeUrl_x64_mac() {
    return nativeUrl_x64_mac;
}

function GetNativeUrl_x32_exe() {
    return nativeUrl_x32_exe;
}

function GetNativeUrl_x64_exe() {
    return nativeUrl_x64_exe;
}

function GetNativeUrl_x64_msi() {
    return nativeUrl_x64_msi;
}

function GetNativeUrl_x32_msi() {
    return nativeUrl_x32_msi;
}

function GetNativeUrl_x64_rpm() {
    return natuveUrl_x64_rpm;
}

function GetNativeUrl_x32_rpm() {
    return natuveUrl_x32_rpm;
}

function GetNativeUrl_x64_deb() {
    return natuveUrl_x64_deb;
}

function GetNativeUrl_x32_deb() {
    return natuveUrl_x32_deb;
}

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.IsVersionEqualOrGreaterThan = IsVersionEqualOrGreaterThan;
exports.IsVersionEqualOrGreaterThanInternal = IsVersionEqualOrGreaterThanInternal;
exports.GetOS = GetOS;
exports.GetMachineArch = GetMachineArch;
exports.GetBrowserArch = GetBrowserArch;
exports.IsEdge = IsEdge;
exports.GetBrowserFacade = GetBrowserFacade;
exports.IsChrome = IsChrome;
exports.PromptDownload = PromptDownload;

var _config = __webpack_require__(0);

function IsVersionEqualOrGreaterThan(actualVersion, operationSystem) {
    var expectedVersion;
    if (operationSystem == "Windows") {
        expectedVersion = (0, _config.GetWindowsNativeVersion)();
    } else if (operationSystem == "macOS") {
        expectedVersion = (0, _config.GetMacNativeVersion)();
    } else if (operationSystem == "Linux" || typeof operationSystem != "undefined") {
        expectedVersion = (0, _config.GetLinuxNativeVersion)();
    } else {
        expectedVersion = (0, _config.GetLinuxNativeVersion)();
    }
    return IsVersionEqualOrGreaterThanInternal(actualVersion, expectedVersion);
}

function IsVersionEqualOrGreaterThanInternal(actualVersion, expectedVersion) {
    // This remove the build type string from the version. e.g. 1.0.0-DEV.1 => 1.0.0
    actualVersion = actualVersion.split('-')[0];
    var actualVersionVector = actualVersion.split('.');
    var expectedVersionVector = expectedVersion.split('.');

    for (var i = 0; i < actualVersionVector.length; i++) {
        var actualVersionNumber = parseInt(actualVersionVector[i]);
        var expectedVersionNumber = parseInt(expectedVersionVector[i]);
        if (actualVersionNumber < expectedVersionNumber) {
            return false;
        } else if (actualVersionNumber > expectedVersionNumber) {
            return true;
        }
    }
    return true;
}

function GetOS() {
    var platform = navigator.platform.toLowerCase();
    if (platform.search(/win/i) > -1) {
        return "windows";
    } else if (platform.search(/linux/i) > -1) {
        return "linux";
    } else if (platform.search(/mac/i) > -1) {
        return "macos";
    } else {
        return "unknown";
    }
}

function GetMachineArch() {
    // TODO padronizar a utilização desta função
    var arch = (navigator.platform + navigator.userAgent).toLowerCase();
    if (arch.search(/win64/i) > -1 || arch.search(/x86_64/i) > -1 || arch.search(/x64\)/i) > -1 || arch.search(/x64;/i) > -1 || arch.search(/wow64;/i) > -1) {
        return "x64";
    } else if (arch.search(/i386/i) > -1) {
        return "x32";
    } else {
        return "unknown";
    }
}

function GetBrowserArch() {
    // TODO padronizar a utilização desta função
    var arch = navigator.userAgent;
    if (arch.search(/x64/i) > -1 || arch.search(/x86_64/i) > -1) {
        return "x64";
    } else if (arch.search(/i386/i) > -1) {
        return "x32";
    } else {
        return "unknown";
    }
}

function IsEdge() {
    if (/Edge/.test(navigator.userAgent)) {
        return true;
    } else {
        return false;
    }
}

function GetBrowserFacade() {
    if (typeof chrome === "undefined" || IsEdge()) return browser;else return chrome;
}

function IsChrome() {
    var isChromium = window.chrome,
        winNav = window.navigator,
        vendorName = winNav.vendor,
        isOpera = winNav.userAgent.indexOf("OPR") > -1,
        isIEedge = winNav.userAgent.indexOf("Edge") > -1,
        isIOSChrome = winNav.userAgent.match("CriOS");

    if (isIOSChrome) {
        return true;
    } else if (isChromium !== null && typeof isChromium !== "undefined" && vendorName === "Google Inc." && isOpera === false && isIEedge === false) {
        return true;
    } else {
        return false;
    }
}

/**
 * Faz o download do arquivo indicado na url
 *
 * @param {string} url url do arquivo que deve ser baixado.
 */
function PromptDownload(url) {
    var elementDownload = document.createElement("a");
    elementDownload.setAttribute('href', url);

    elementDownload.style.display = 'none';
    document.body.appendChild(elementDownload);

    elementDownload.click();

    document.body.removeChild(elementDownload);
}

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.GetBaseActionNames = GetBaseActionNames;
exports.SetActionNames = SetActionNames;
exports.GetActionNames = GetActionNames;
exports.GetNativeIdName = GetNativeIdName;
exports.SetNativeIdName = SetNativeIdName;

var _config = __webpack_require__(0);

var baseActionNames = [];

var actionNames = baseActionNames;

var nativeIdName = "bryextension";

function GetBaseActionNames() {
    return baseActionNames;
}

function SetActionNames(actions) {
    actionNames = actions;
}

function GetActionNames() {
    return actionNames;
}

function GetNativeIdName() {
    return nativeIdName;
}

function SetNativeIdName(idName) {
    nativeIdName = idName;
}

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.EXT_MARK = exports.DYNAMIC_DOMAINS_URL = exports.COMPLEMENT_BASE_URL = undefined;
exports.GlobalConfiguration = GlobalConfiguration;

var _config = __webpack_require__(0);

var _configuration = __webpack_require__(2);

var COMPLEMENT_BASE_URL = exports.COMPLEMENT_BASE_URL = "https://www.bry.com.br/downloads/extension/v2/complement";
var DYNAMIC_DOMAINS_URL = exports.DYNAMIC_DOMAINS_URL = null;
var EXT_MARK = exports.EXT_MARK = '__BRY_CONTENT_SCRIPT_LOADED__';

function GlobalConfiguration() {
    (0, _config.SetLinuxNativeVersion)("1.0.0");
    (0, _config.SetWindowsNativeVersion)("1.0.0");
    (0, _config.SetMacNativeVersion)("1.0.0");

    (0, _config.SetExtensionFunctionPrefix)('bryweb'); // {bry}_xyz
    (0, _config.SetExtensionInternalNamespacePrefix)('BryWeb'); //{Bry}Extension.xyz

    (0, _configuration.SetNativeIdName)("com.bry.extension"); // Permite localizar o módulo nativo

    (0, _config.SetNativeUrl_x32_exe)('https://www.bry.com.br/downloads/extension/v2/windows/ExtensionModule-x32.exe');
    (0, _config.SetNativeUrl_x64_exe)('https://www.bry.com.br/downloads/extension/v2/windows/ExtensionModule.exe');
    (0, _config.SetNativeUrl_x64_rpm)('https://www.bry.com.br/downloads/extension/v2/linux/ExtensionModule.rpm');
    (0, _config.SetNativeUrl_x32_rpm)('https://www.bry.com.br/downloads/extension/v2/linux/ExtensionModule-x32.rpm');
    (0, _config.SetNativeUrl_x64_deb)('https://www.bry.com.br/downloads/extension/v2/linux/ExtensionModule.deb');
    (0, _config.SetNativeUrl_x32_deb)('https://www.bry.com.br/downloads/extension/v2/linux/ExtensionModule-x32.deb');
    (0, _config.SetNativeUrl_x64_mac)('https://www.bry.com.br/downloads/extension/v2/macos/ExtensionModule.pkg');

    var extensionActionNames = (0, _configuration.GetBaseActionNames)();
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_list_certificates');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_sign');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_get_certificate');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_mostrarDetalhes');
    extensionActionNames.push('is_installed_test');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_is_installed_test');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_cert_req_generate');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_cert_req_import');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_export_certificate');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_list_readers');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_get_finger_print');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_get_system_info');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_get_fingerprint_installed_list');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_get_complement_fingerprint_supportedlist');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_install_complement_fingerprint');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_is_finger_on');
    extensionActionNames.push((0, _config.GetExtensionFunctionPrefix)() + '_is_finger_off');

    (0, _configuration.SetActionNames)(extensionActionNames);
}

/***/ }),
/* 4 */,
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.SetUpdateSteps_firstStepScreenTitle = SetUpdateSteps_firstStepScreenTitle;
exports.SetUpdateSteps_firstStepScreenBody = SetUpdateSteps_firstStepScreenBody;
exports.SetUpdateSteps_secondStepScreenTitle = SetUpdateSteps_secondStepScreenTitle;
exports.SetUpdateSteps_secondStepScreenBody = SetUpdateSteps_secondStepScreenBody;
exports.SetUpdateSteps_thirdStepScreenTitle = SetUpdateSteps_thirdStepScreenTitle;
exports.SetUpdateSteps_thirdStepScreenBody = SetUpdateSteps_thirdStepScreenBody;
exports.GetUpdateSteps_firstStepScreenTitle = GetUpdateSteps_firstStepScreenTitle;
exports.GetUpdateSteps_firstStepScreenBody = GetUpdateSteps_firstStepScreenBody;
exports.GetUpdateSteps_secondStepScreenTitle = GetUpdateSteps_secondStepScreenTitle;
exports.GetUpdateSteps_secondStepScreenBody = GetUpdateSteps_secondStepScreenBody;
exports.GetUpdateSteps_thirdStepScreenTitle = GetUpdateSteps_thirdStepScreenTitle;
exports.GetUpdateSteps_thirdStepScreenBody = GetUpdateSteps_thirdStepScreenBody;
exports.SetInstalationSteps_firstStepScreenTitle_windows = SetInstalationSteps_firstStepScreenTitle_windows;
exports.GetInstalationSteps_firstStepScreenTitle_windows = GetInstalationSteps_firstStepScreenTitle_windows;
exports.SetInstalationSteps_firstStepScreenBody_windows = SetInstalationSteps_firstStepScreenBody_windows;
exports.GetInstalationSteps_firstStepScreenBody_windows = GetInstalationSteps_firstStepScreenBody_windows;
exports.SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows = SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows;
exports.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows = GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows;
exports.SetInstalationSteps_secondStepScreenTitle = SetInstalationSteps_secondStepScreenTitle;
exports.GetInstalationSteps_secondStepScreenTitle = GetInstalationSteps_secondStepScreenTitle;
exports.SetInstalationSteps_secondStepScreenBody = SetInstalationSteps_secondStepScreenBody;
exports.GetInstalationSteps_secondStepScreenBody = GetInstalationSteps_secondStepScreenBody;
exports.SetInstalationSteps_thirdStepScreenTitle = SetInstalationSteps_thirdStepScreenTitle;
exports.GetInstalationSteps_thirdStepScreenTitle = GetInstalationSteps_thirdStepScreenTitle;
exports.SetInstalationSteps_thirdStepScreenBody = SetInstalationSteps_thirdStepScreenBody;
exports.GetInstalationSteps_thirdStepScreenBody = GetInstalationSteps_thirdStepScreenBody;
exports.SetInstalationSteps_secondStepScreenTitle_linux = SetInstalationSteps_secondStepScreenTitle_linux;
exports.GetInstalationSteps_secondStepScreenTitle_linux = GetInstalationSteps_secondStepScreenTitle_linux;
exports.SetInstalationSteps_secondStepScreenBody_linux = SetInstalationSteps_secondStepScreenBody_linux;
exports.GetInstalationSteps_secondStepScreenBody_linux = GetInstalationSteps_secondStepScreenBody_linux;
exports.SetInstalationSteps_thirdStepScreenTitle_linux = SetInstalationSteps_thirdStepScreenTitle_linux;
exports.GetInstalationSteps_thirdStepScreenTitle_linux = GetInstalationSteps_thirdStepScreenTitle_linux;
exports.SetInstalationSteps_thirdStepScreenBody_linux = SetInstalationSteps_thirdStepScreenBody_linux;
exports.GetInstalationSteps_thirdStepScreenBody_linux = GetInstalationSteps_thirdStepScreenBody_linux;
exports.SetInstalationSteps_secondStepScreenBody_macos = SetInstalationSteps_secondStepScreenBody_macos;
exports.GetInstalationSteps_secondStepScreenBody_macos = GetInstalationSteps_secondStepScreenBody_macos;
exports.SetInstalationSteps_notSupportedStepScreenTitle = SetInstalationSteps_notSupportedStepScreenTitle;
exports.GetInstalationSteps_notSupportedStepScreenTitle = GetInstalationSteps_notSupportedStepScreenTitle;
exports.SetInstalationSteps_notSupportedStepScreenBody = SetInstalationSteps_notSupportedStepScreenBody;
exports.GetInstalationSteps_notSupportedStepScreenBody = GetInstalationSteps_notSupportedStepScreenBody;
exports.SetInstalationSteps_firstStepScreenTitle_linux = SetInstalationSteps_firstStepScreenTitle_linux;
exports.GetInstalationSteps_firstStepScreenTitle_linux = GetInstalationSteps_firstStepScreenTitle_linux;
exports.SetInstalationSteps_firstStepScreenBody_linux = SetInstalationSteps_firstStepScreenBody_linux;
exports.GetInstalationSteps_firstStepScreenBody_linux = GetInstalationSteps_firstStepScreenBody_linux;
exports.SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux = SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux;
exports.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux = GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux;
exports.SetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux = SetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux;
exports.GetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux = GetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux;
exports.SetDomainAuthorizationScreenBody = SetDomainAuthorizationScreenBody;
exports.GetDomainAuthorizationScreenBody = GetDomainAuthorizationScreenBody;
exports.SetDomainAuthorizationScreenTitle = SetDomainAuthorizationScreenTitle;
exports.GetDomainAuthorizationScreenTitle = GetDomainAuthorizationScreenTitle;
exports.SetDomainAuthorizationScreenBodyConfirmButtonColor = SetDomainAuthorizationScreenBodyConfirmButtonColor;
exports.GetDomainAuthorizationScreenBodyConfirmButtonColor = GetDomainAuthorizationScreenBodyConfirmButtonColor;
exports.SetDomainAuthorizationScreenBodyCancelButtonColor = SetDomainAuthorizationScreenBodyCancelButtonColor;
exports.GetDomainAuthorizationScreenBodyCancelButtonColor = GetDomainAuthorizationScreenBodyCancelButtonColor;
var updateSteps_firstStepScreenTitle = "<h4 style='font-size:19px;'><img style='height: 35px;'src='brand.png'/>&nbsp&nbsp</h4>";
var updateSteps_firstStepScreenBody = "<h4 style=\"fontSize:19px,fontFamily:Calibri, fontWeight: bold, margin:0\" >M\xF3dulo nativo desatualizado!</h4><br/><h5 style=\"color:#333333; font-size:19px; font-family:Calibri;\">Fa\xE7a o download do instalador atualizado clicando no bot\xE3o abaixo:</h5>";
var updateSteps_secondStepScreenTitle = "<h4 style='font-size:19px;'><img style='height: 35px;'src='brand.png'/>&nbsp&nbsp</h4>";
var updateSteps_secondStepScreenBody = "<h4 style=\"fontSize:19px,fontFamily:Calibri, fontWeight: bold, margin:0\" >M\xF3dulo nativo desatualizado!</h4><br/><h5 style=\"color:#333333; font-size:19px; font-family:Calibri;\">Fa\xE7a o download do instalador atualizado clicando no bot\xE3o abaixo:</h5>";
var updateSteps_thirdStepScreenTitle = "<h4 style='font-size:19px;'><img style='height: 35px;'src='brand.png'/>&nbsp&nbsp</h4>";
var updateSteps_thirdStepScreenBody = "<h4 style=\"color:#aaa;font-size:19px; font-family:Calibri;\">M\xF3dulo nativo atualizado!</h4>";

var instalationSteps_firstStepScreenTitle_windows = "<h4 style='font-size:19px;'><img style='height: 35px;'src='brand.png'/>&nbsp&nbspEXTENSÃO PARA ASSINATURA DIGITAL</h4>";
var instalationSteps_firstStepScreenBody_windows = "<br/>\n<h3 style=\"color:#333333; font-weight:500; padding-bottom:8px;\">A extens\xE3o foi adicionada.</h3>\n<h4 style=\"color:#333333;font-size:19px;\">Falta pouco! Siga os passos a seguir para realizar<br/> assinaturas digitais do seu navegador:</h4><br/><br/><br/>\n<small class=\"step\" style=\"color:#aaa;\">Passo 1 de 2</small>\n<h4 style=\"color:#333333; font-size:19px;\">Fa\xE7a download do instalador clicando no bot\xE3o abaixo:</h4>";
var instalationSteps_firstStepScreenBody_confirmButtonColor_windows = "#4F97DC";

var instalationSteps_firstStepScreenTitle_linux = "<h4 style='font-size:19px;'><img style='height: 35px;'src='brand.png'/>&nbsp&nbspEXTENSÃO PARA ASSINATURA DIGITAL</h4>";
var instalationSteps_firstStepScreenBody_linux = "<br/>\n<h3 style=\"color:#333333; font-weight:500; padding-bottom:8px;\">A extens\xE3o foi adicionada.</h3>\n<h4 style=\"color:#333333;font-size:19px;\">Falta pouco! Siga os passos a seguir para realizar<br/> assinaturas digitais do seu navegador:</h4><br/><br/><br/>\n<small class=\"step\" style=\"color:#aaa;\">Passo 1 de 2</small>\n<h4 style=\"color:#333333; font-size:19px;\">Fa\xE7a o download do pacote para a sua distribui\xE7\xE3o clicando num dos bot\xF5es abaixo:</h4>";
var instalationSteps_firstStepScreenBody_confirmButtonColor_linux = instalationSteps_firstStepScreenBody_confirmButtonColor_windows;
var instalationSteps_firstStepScreenBody_cancelButtonColor_linux = instalationSteps_firstStepScreenBody_confirmButtonColor_linux;

var instalationSteps_secondStepScreenTitle = instalationSteps_firstStepScreenTitle_windows;
var instalationSteps_secondStepScreenBody = "\n<br/><small class=\"step\" style=\"color:#aaa;\">Passo 2 de 2</small>\n<h4 style=\"color:#333333;\">Abra o arquivo baixado e siga as<br/> orienta\xE7\xF5es de instala\xE7\xE3o</h4><br/>\n<img width=\"40px\" src=\"loading.gif\"/><br/>\n<h4 style=\"color:#333333;font-size:19px;\">Aguardando instala\xE7\xE3o</h4>\n";

var instalationSteps_secondStepScreenTitle_linux = instalationSteps_firstStepScreenTitle_windows;
var instalationSteps_secondStepScreenBody_linux = "\n<br/><small class=\"step\" style=\"color:#aaa;\">Passo 2 de 2</small>\n<h4 style=\"color:#333333;\">Abra o arquivo baixado e siga as<br/> orienta\xE7\xF5es de instala\xE7\xE3o</h4><br/>\n<img width=\"40px\" src=\"loading.gif\"/><br/>\n<h4 style=\"color:#333333;font-size:19px;\">Aguardando instala\xE7\xE3o</h4>\n";

var instalationSteps_secondStepScreenBody_macos = "";

var instalationSteps_secondStepScreenChromeBody = "\n<br/><small class=\"step\" style=\"color:#aaa;\">Passo 2 de 2</small>\n<h4 style=\"color:#333333;\">Abra o arquivo baixado e siga as<br/> orienta\xE7\xF5es de instala\xE7\xE3o</h4><br/>\n<img width=\"40px\" src=\"loading.gif\"/><br/>\n<h4 style=\"color:#333333;font-size:19px;\">Aguardando instala\xE7\xE3o</h4>\n";

var instalationSteps_thirdStepScreenTitle = instalationSteps_firstStepScreenTitle_windows;
var instalationSteps_thirdStepScreenBody = "<br/>\n<p><img style=\"height: 50px;\" src=\"ok.png\"/></p>\n<h4 style=\"color:#aaa;font-size:19px;\">Pronto!</h4><br/>\n<h4 style=\"color:#333333; font-size:19px;\">Agora voc\xEA j\xE1 pode assinar seus documentos<br/> pelo navegador</h4>\n";

var instalationSteps_thirdStepScreenTitle_linux = instalationSteps_firstStepScreenTitle_windows;
var instalationSteps_thirdStepScreenBody_linux = "<br/>\n<p><img style=\"height: 50px;\" src=\"ok.png\"/></p>\n<h4 style=\"color:#aaa;font-size:19px;\">Pronto!</h4><br/>\n<h4 style=\"color:#333333; font-size:19px;\">Agora voc\xEA j\xE1 pode assinar seus documentos<br/> pelo navegador</h4>\n";

var instalationSteps_notSupportedStepScreenTitle = instalationSteps_firstStepScreenTitle_windows;
var instalationSteps_notSupportedStepScreenBody = "<br/>\n<h3 style=\"color:#333333; font-weight:500; padding-bottom:8px;\">A extens\xE3o foi adicionada.</h3>\n<h4 style=\"color:#333333;font-size:19px;\">Falta pouco! Siga os passos a seguir para realizar<br/> assinaturas digitais do seu navegador:</h4><br/><br/><br/>\n<p>O suporte para o esse sistema operacional ser\xE1 adicionado na pr\xF3xima vers\xE3o da extens\xE3o!</p>";

var domainAuthorizationScreenTitle = instalationSteps_firstStepScreenTitle_windows;
var domainAuthorizationScreenBody = "<h4 align=\"center\" style=\"color:#333333;font-weight: 500;\"> O domínio hostname está tentando gerar assinaturas. Você autoriza?</h4>";
var domainAuthorizationScreenBodyConfirmButtonColor = "#555";
var domainAuthorizationScreenBodyCancelButtonColor = "#4F97DC";

function SetUpdateSteps_firstStepScreenTitle(step) {
    return updateSteps_firstStepScreenTitle = step;
}

function SetUpdateSteps_firstStepScreenBody(step) {
    return updateSteps_firstStepScreenBody = step;
}

function SetUpdateSteps_secondStepScreenTitle(step) {
    return updateSteps_secondStepScreenTitle = step;
}

function SetUpdateSteps_secondStepScreenBody(step) {
    return updateSteps_secondStepScreenBody = step;
}

function SetUpdateSteps_thirdStepScreenTitle(step) {
    return updateSteps_thirdStepScreenTitle = step;
}

function SetUpdateSteps_thirdStepScreenBody(step) {
    return updateSteps_thirdStepScreenBody = step;
}

function GetUpdateSteps_firstStepScreenTitle() {
    return updateSteps_firstStepScreenTitle;
}

function GetUpdateSteps_firstStepScreenBody() {
    return updateSteps_firstStepScreenBody;
}

function GetUpdateSteps_secondStepScreenTitle() {
    return updateSteps_secondStepScreenTitle;
}

function GetUpdateSteps_secondStepScreenBody() {
    return updateSteps_secondStepScreenBody;
}

function GetUpdateSteps_thirdStepScreenTitle() {
    return updateSteps_thirdStepScreenTitle;
}

function GetUpdateSteps_thirdStepScreenBody() {
    return updateSteps_thirdStepScreenBody;
}

function SetInstalationSteps_firstStepScreenTitle_windows(step) {
    return instalationSteps_firstStepScreenTitle_windows = step;
}

function GetInstalationSteps_firstStepScreenTitle_windows() {
    return instalationSteps_firstStepScreenTitle_windows;
}

function SetInstalationSteps_firstStepScreenBody_windows(step) {
    return instalationSteps_firstStepScreenBody_windows = step;
}

function GetInstalationSteps_firstStepScreenBody_windows() {
    return instalationSteps_firstStepScreenBody_windows;
}

function SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows(step) {
    instalationSteps_firstStepScreenBody_confirmButtonColor_windows = step;
}

function GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows() {
    return instalationSteps_firstStepScreenBody_confirmButtonColor_windows;
}

function SetInstalationSteps_secondStepScreenTitle(step) {
    return instalationSteps_secondStepScreenTitle = step;
}

function GetInstalationSteps_secondStepScreenTitle() {
    return instalationSteps_secondStepScreenTitle;
}

function SetInstalationSteps_secondStepScreenBody(step) {
    return instalationSteps_secondStepScreenBody = step;
}

function GetInstalationSteps_secondStepScreenBody() {
    return instalationSteps_secondStepScreenBody;
}

function SetInstalationSteps_thirdStepScreenTitle(step) {
    return instalationSteps_thirdStepScreenTitle = step;
}

function GetInstalationSteps_thirdStepScreenTitle() {
    return instalationSteps_thirdStepScreenTitle;
}

function SetInstalationSteps_thirdStepScreenBody(step) {
    return instalationSteps_thirdStepScreenBody = step;
}

function GetInstalationSteps_thirdStepScreenBody() {
    return instalationSteps_thirdStepScreenBody;
}

function SetInstalationSteps_secondStepScreenTitle_linux(step) {
    return instalationSteps_secondStepScreenTitle_linux = step;
}

function GetInstalationSteps_secondStepScreenTitle_linux() {
    return instalationSteps_secondStepScreenTitle_linux;
}

function SetInstalationSteps_secondStepScreenBody_linux(step) {
    return instalationSteps_secondStepScreenBody_linux = step;
}

function GetInstalationSteps_secondStepScreenBody_linux() {
    return instalationSteps_secondStepScreenBody_linux;
}

function SetInstalationSteps_thirdStepScreenTitle_linux(step) {
    return instalationSteps_thirdStepScreenTitle_linux = step;
}

function GetInstalationSteps_thirdStepScreenTitle_linux() {
    return instalationSteps_thirdStepScreenTitle_linux;
}

function SetInstalationSteps_thirdStepScreenBody_linux(step) {
    return instalationSteps_thirdStepScreenBody_linux = step;
}

function GetInstalationSteps_thirdStepScreenBody_linux() {
    return instalationSteps_thirdStepScreenBody_linux;
}

function SetInstalationSteps_secondStepScreenBody_macos(step) {
    return instalationSteps_secondStepScreenBody_macos = step;
}

function GetInstalationSteps_secondStepScreenBody_macos() {
    return instalationSteps_secondStepScreenBody_macos;
}

function SetInstalationSteps_notSupportedStepScreenTitle(step) {
    return instalationSteps_notSupportedStepScreenTitle = step;
}

function GetInstalationSteps_notSupportedStepScreenTitle() {
    return instalationSteps_notSupportedStepScreenTitle;
}

function SetInstalationSteps_notSupportedStepScreenBody(step) {
    return instalationSteps_notSupportedStepScreenBody = step;
}

function GetInstalationSteps_notSupportedStepScreenBody() {
    return instalationSteps_notSupportedStepScreenBody;
}

function SetInstalationSteps_firstStepScreenTitle_linux(step) {
    return instalationSteps_firstStepScreenTitle_linux = step;
}

function GetInstalationSteps_firstStepScreenTitle_linux() {
    return instalationSteps_firstStepScreenTitle_linux;
}

function SetInstalationSteps_firstStepScreenBody_linux(step) {
    return instalationSteps_firstStepScreenBody_linux = step;
}

function GetInstalationSteps_firstStepScreenBody_linux() {
    return instalationSteps_firstStepScreenBody_linux;
}

function SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux(step) {
    instalationSteps_firstStepScreenBody_confirmButtonColor_linux = step;
}

function GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux() {
    return instalationSteps_firstStepScreenBody_confirmButtonColor_linux;
}

function SetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux(step) {
    instalationSteps_firstStepScreenBody_cancelButtonColor_linux = step;
}

function GetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux() {
    return instalationSteps_firstStepScreenBody_cancelButtonColor_linux;
}

function SetDomainAuthorizationScreenBody(step) {
    return domainAuthorizationScreenBody = step;
}

function GetDomainAuthorizationScreenBody() {
    return domainAuthorizationScreenBody;
}

function SetDomainAuthorizationScreenTitle(step) {
    return domainAuthorizationScreenTitle = step;
}

function GetDomainAuthorizationScreenTitle() {
    return domainAuthorizationScreenTitle;
}

function SetDomainAuthorizationScreenBodyConfirmButtonColor(step) {
    domainAuthorizationScreenBodyConfirmButtonColor = step;
}

function GetDomainAuthorizationScreenBodyConfirmButtonColor() {
    return domainAuthorizationScreenBodyConfirmButtonColor;
}

function SetDomainAuthorizationScreenBodyCancelButtonColor(step) {
    domainAuthorizationScreenBodyCancelButtonColor = step;
}

function GetDomainAuthorizationScreenBodyCancelButtonColor() {
    return domainAuthorizationScreenBodyCancelButtonColor;
}

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ListAuthorizedDomains = ListAuthorizedDomains;
exports.RemoveDomain = RemoveDomain;
exports.ListCertificates = ListCertificates;
exports.AuthorizeDomain = AuthorizeDomain;
exports.setPkcs11Path = setPkcs11Path;
exports.listPkcs11Paths = listPkcs11Paths;
exports.removePkcs11PathByPath = removePkcs11PathByPath;
exports.removePkcs11Path = removePkcs11Path;

var _utilities = __webpack_require__(1);

var _config = __webpack_require__(0);

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function ListAuthorizedDomains() {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        browserFacade.storage.local.get(null, function (items) {
            delete items["pkcs11"];
            resolve(items);
        });
    });
}

function RemoveDomain(domain) {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        browserFacade.storage.local.remove(domain, function () {
            resolve();
        });
    });
}

async function ListCertificates() {
    var browserFacade = (0, _utilities.GetBrowserFacade)();

    var paths = await listPkcs11Paths();

    var json = {
        action: (0, _config.GetExtensionFunctionPrefix)() + "_list_certificates",
        pkcs11Paths: paths
    };

    return new Promise(function (resolve) {
        browserFacade.runtime.sendMessage(JSON.stringify(json), function (data) {
            if (data.action && data.action === (0, _config.GetExtensionFunctionPrefix)() + "_list_certificates") {
                resolve(data.certificates);
            } else {
                resolve([]);
            }
        });
    });
}

function AuthorizeDomain(domain) {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        var toStore = {};
        toStore[domain] = domain;
        browserFacade.storage.local.set(toStore, function () {
            resolve();
        });
    });
}

function setPkcs11Path(pkcs11) {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        listPkcs11Paths().then(function (items) {
            var pkcs11Paths = items;
            browserFacade.storage.local.set({ "pkcs11": [].concat(_toConsumableArray(pkcs11Paths), [pkcs11]) }, function (items) {
                resolve(items);
            });
        });
    });
}

function listPkcs11Paths() {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        browserFacade.storage.local.get("pkcs11", function (items) {
            if (items.pkcs11 === undefined) resolve([]);else resolve([].concat(_toConsumableArray(items.pkcs11)));
        });
    });
}

function removePkcs11PathByPath(path) {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        listPkcs11Paths().then(function (items) {
            var pkcs11Paths = items;
            var index = pkcs11Paths.indexOf(path);
            if (index !== -1) {
                pkcs11Paths.splice(index, 1);
            }
            // pkcs11Paths.splice(index, 1);
            browserFacade.storage.local.set({ "pkcs11": pkcs11Paths }, function (items) {
                resolve(items);
            });
        });
    });
}

function removePkcs11Path(index) {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        listPkcs11Paths().then(function (items) {
            var pkcs11Paths = items;
            pkcs11Paths.splice(index, 1);
            browserFacade.storage.local.set({ "pkcs11": pkcs11Paths }, function (items) {
                resolve(items);
            });
        });
    });
}

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InitializeBaseContentScript = InitializeBaseContentScript;
exports.executeInPage = executeInPage;
exports.sendResponse = sendResponse;
exports.GetNativeModuleInfo = GetNativeModuleInfo;
exports.VerifyDomainAuthorization = VerifyDomainAuthorization;
exports.FilterError = FilterError;

var _config = __webpack_require__(0);

var _configuration = __webpack_require__(5);

var _utilities = __webpack_require__(1);

var _downloadArrow = __webpack_require__(8);

var _downloadArrow2 = _interopRequireDefault(_downloadArrow);

var _sweetalert2Min = __webpack_require__(9);

var _sweetalert2Min2 = _interopRequireDefault(_sweetalert2Min);

var _browserAction = __webpack_require__(6);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

//import {initSweetAlert} from '../external-deps/sweetalert/sweetalert.min.js';


function InitializeBaseContentScript() {
    var browserFacade = (0, _utilities.GetBrowserFacade)();

    async function getCertificates(control) {
        try {
            var paths = await (0, _browserAction.listPkcs11Paths)();

            var json = {
                action: (0, _config.GetExtensionFunctionPrefix)() + "_list_certificates",
                pkcs11Paths: paths,
                control: control
            };

            var data = await new Promise(function (resolve, reject) {
                browserFacade.runtime.sendMessage(JSON.stringify(json), function (data) {
                    if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_list_certificates") resolve(data);else reject(data);
                });
            });

            return data;
        } catch (error) {
            if (error && typeof error.description !== "undefined" && typeof error.key !== "undefined") {
                throw {
                    key: error.key,
                    description: error.description
                };
            } else {
                throw {
                    key: "extension.invalid.context",
                    description: "A Extensão não está instalada ou foi desativada."
                };
            }
        }
    }

    async function executeLooplistCertifificates() {
        var result = [];
        try {
            var itens = {};
            var control = {};

            do {
                itens = await getCertificates(control);
                control = itens.control;
                result = result.concat(itens.certificates);
            } while (itens.hasNext);
        } catch (error) {
            throw error;
        }

        return result;
    }
    /**
    * Esse evento é repassado para o background e tem a finalidade de listar os
    * certificados com chave privada instalada na máquina do usuário. Os certificados
    * listados através desse evento podem ser utilizados para assinatura digital pelo usuário.
    * @event content_script#bry_list_certificates
    * @memberOf content_script
    */
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_list_certificates", function (event) {
        var detail = event.detail;
        executeLooplistCertifificates().then(function (certificates) {
            sendResponse((0, _config.GetExtensionFunctionPrefix)(), certificates, detail.resolveId, false, detail);
        }).catch(function (data) {
            if (data && data.key == 'signer.not.installed') {
                var verificarInstalacao = true;
                //a promise só retorna reject visto que o resolve é tratado como um reload da página, finalizando o escopo que disparou a promise
                FilterError(data, verificarInstalacao).then(function (result) {
                    executeLooplistCertifificates().then(function (certificates) {
                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), certificates, detail.resolveId, false, detail);
                    }).catch(function (data) {
                        var error = {
                            key: data.key,
                            description: data.description
                        };
                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    });
                }).catch(function (downloadCancelled) {
                    if (downloadCancelled) {
                        //usuário cancelou. editar erro de cancelamentos
                        var error = {
                            key: "module.download.user.cancelled",
                            code: -3099,
                            description: "O usuário cancelou o download do Módulo da Extensão"
                        };
                    } else {
                        var error = {
                            key: data.key,
                            code: data.code,
                            description: data.description
                        };
                    }

                    sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                });
            } else {
                var error = {
                    key: data.key,
                    code: data.code,
                    description: data.description
                };
                sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        });
    });

    /**
    * Evento que sinaliza para extensão que o usuário tem a intenção de fazer uma
    * assinatura PKCS#1 do dado passado junto desse evento. Os dados desse evento
    * serão repassados para o módulo {@link background} da extensão para que sejam repassados
    * para a parte nativa.
    *
    * @event content_script#bry_sign
    * @memberOf content_script
    */
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_sign", function (event) {
        var detail = event.detail;

        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: (0, _configuration.GetDomainAuthorizationScreenBody)(),
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };

        //criar uma função para verificar o domínio
        VerifyDomainAuthorization(context).then(function (result) {
            if (result) {
                var json = JSON.parse(detail.input);
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_sign";
                json.certId = detail.idCertificado;

                browserFacade.runtime.sendMessage(JSON.stringify(json), function (data) {
                    if (data.action == (0, _config.GetExtensionFunctionPrefix)() + "_sign") {
                        var response = {
                            nonce: data.nonce,
                            assinaturas: data.assinaturas
                        };

                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), response, detail.resolveId, false, detail);
                    } else {
                        var verificarInstalacao = true;
                        //a promise só retorna reject visto que o resolve é tratado como um reload da página, finalizando o escopo que disparou a promise
                        FilterError(data, verificarInstalacao, true).catch(function (downloadCancelled) {
                            if (downloadCancelled) {
                                //usuário cancelou. editar erro de cancelamentos
                                var error = {
                                    key: "module.download.user.cancelled",
                                    code: -3099,
                                    description: "O usuário cancelou o download do Módulo da Extensão"
                                };
                            } else {
                                var error = {
                                    key: data.key,
                                    code: data.code,
                                    description: data.description
                                };
                            }

                            sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                        });
                    }
                });
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };

                sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });

    /**
    * Evento utilizado para verificar a instalação da parte nativa. Acontece toda vez
    * que uma página é aberta. Caso a parte nativa não esteja instalada, o callback da
    * página será chamado com uma mensagem de erro que descreve a situação para que
    * se o programador da página que utiliza a extensão queira tratar a situação, ele o
    * possa fazer.
    * @event content_script#bry_verificarInstalacao
    * @memberOf content_script
    */
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_verificarInstalacao", function (event) {
        var detail = event.detail;
        try {
            browserFacade.runtime.sendMessage('{"action":"' + (0, _config.GetExtensionFunctionPrefix)() + '_verificarInstalacao"}', function (data) {
                if (data.action == "is_installed_test" || data.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test") {
                    if (!(0, _utilities.IsVersionEqualOrGreaterThan)(data.version, data.os)) {
                        /*
                        * Cria uma mensagem de erro.
                        */
                        var error = {};
                        error.description = "O módulo da extensão precisa ser atualizado.";
                        error.code = -3001;
                        error.key = "signer.not.updated";

                        /*
                        * Chama o callback com a mensagem recem criada
                        */
                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    } else {
                        var versionInfo = data.version;
                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), versionInfo, detail.resolveId, true, detail);
                    }
                } else {
                    var verificarInstalacao = false;
                    FilterError(data, verificarInstalacao, true).catch(function () {
                        var error = {};
                        error.description = data.description;
                        error.code = data.code;
                        error.key = data.key;
                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    });
                }
            });
        } catch (ex) {
            var error = {};
            error.description = "A Extensão não está instalada ou foi desativada.";
            error.key = "extension.invalid.context", sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        }
    });

    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_getNativeModuleVersion", function (event) {
        var detail = event.detail;
        try {
            browserFacade.runtime.sendMessage('{"action":"' + (0, _config.GetExtensionFunctionPrefix)() + '_verificarInstalacao"}', function (data) {
                if (data.action == "is_installed_test" || data.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test") {
                    var versionInfo = data.version;
                    sendResponse((0, _config.GetExtensionFunctionPrefix)(), versionInfo, detail.resolveId, true, detail);
                } else {
                    var verificarInstalacao = false;
                    FilterError(data, verificarInstalacao, true).catch(function () {
                        var error = {};
                        error.description = data.description;
                        error.code = data.code;
                        error.key = data.key;
                        sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    });
                }
            });
        } catch (ex) {
            var error = {};
            error.description = "A Extensão não está instalada ou foi desativada.";
            error.key = "extension.invalid.context", sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        }
    });

    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_prompt_update_native_module", function (event) {
        var detail = event.detail;
        browserFacade.runtime.sendMessage('{"action":"' + (0, _config.GetExtensionFunctionPrefix)() + '_verificarInstalacao"}', function (data) {
            if (data.action == "is_installed_test" || data.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test") {
                if (!(0, _utilities.IsVersionEqualOrGreaterThan)(data.version, data.os)) {
                    var _swal;

                    var os = (0, _utilities.GetOS)();
                    var arch = (0, _utilities.GetMachineArch)();
                    var confirmButtonText = os === 'linux' ? '<span style="font-size:17px; font-family:Calibri; padding: 0px 10px 0px 10px;">BAIXAR .deb</span>' : '<span style="font-size:17px; font-family:Calibri; padding: 0px 15px 0px 15px;">BAIXAR</span>';
                    // let confirmButtonClass = os === 'linux'? 'bry-btn-padding' : null;
                    var cancelButtonTextLinux = os === 'linux' ? '<span style="font-size:17px; font-family:Calibri; padding: 0px 10px 0px 10px;">BAIXAR .rpm</span>' : null;
                    var showCancelButton = os === 'linux' ? true : false;
                    (0, _sweetalert2Min2.default)((_swal = {
                        title: (0, _configuration.GetUpdateSteps_firstStepScreenTitle)(),
                        html: (0, _configuration.GetUpdateSteps_firstStepScreenBody)(),
                        width: '478px',
                        padding: 20,
                        confirmButtonColor: (0, _configuration.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows)(),
                        confirmButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 15px 0px 15px;">BAIXAR</span>'

                    }, _defineProperty(_swal, 'confirmButtonText', confirmButtonText), _defineProperty(_swal, 'cancelButtonColor', (0, _configuration.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows)()), _defineProperty(_swal, 'cancelButtonText', cancelButtonTextLinux), _defineProperty(_swal, 'showCancelButton', showCancelButton), _defineProperty(_swal, 'showCloseButton', true), _defineProperty(_swal, 'showConfirmButton', true), _defineProperty(_swal, 'focusConfirm', true), _defineProperty(_swal, 'showLoaderOnConfirm', true), _defineProperty(_swal, 'preConfirm', function preConfirm() {
                        return new Promise(function (resolve) {
                            resolve();
                        });
                    }), _defineProperty(_swal, 'allowEscapeKey', true), _defineProperty(_swal, 'allowOutsideClick', false), _swal)).then(function (result) {
                        if (result.value || result.dismiss && result.dismiss === _sweetalert2Min2.default.DismissReason.cancel) {

                            if (os === "windows") {
                                {
                                    arch === "x64" ? (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_exe)()) : (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x32_exe)());
                                }
                            } else if (os === "linux") {
                                // if (result.value || (result.dismiss && result.dismiss === swal.DismissReason.cancel))
                                if (result.value) {
                                    {
                                        arch === "x64" ? (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_deb)()) : (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x32_deb)());
                                    }
                                } else {
                                    {
                                        arch === "x64" ? (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_rpm)()) : (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x32_rpm)());
                                    }
                                }
                            } else if (os === "macos") {
                                (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_mac)());
                            }

                            (0, _sweetalert2Min2.default)({
                                title: (0, _configuration.GetUpdateSteps_secondStepScreenTitle)(),
                                html: (0, _configuration.GetUpdateSteps_secondStepScreenBody)(),
                                width: '478px',
                                showCloseButton: false,
                                showConfirmButton: false,
                                allowEscapeKey: true,
                                allowOutsideClick: false,
                                focusCancel: true,
                                cancelButtonColor: "#FFFFFF",
                                showCancelButton: true,
                                cancelButtonClass: "bry-btn-displayNone",
                                onOpen: function onOpen() {
                                    // Gambi para remover o foco do botão fechar, fica um contorno estranho
                                    var y = document.getElementsByClassName('bry-btn-displayNone');
                                    var aNode = y[0];
                                    if (aNode) {
                                        aNode.parentNode.removeChild(aNode);
                                    }

                                    var interval = setInterval(function () {
                                        GetNativeModuleInfo().then(function (nativeModuleInfo) {
                                            if (nativeModuleInfo.action && (nativeModuleInfo.action == "is_installed_test" || nativeModuleInfo.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test")) {
                                                if ((0, _utilities.IsVersionEqualOrGreaterThanInternal)(nativeModuleInfo.version, (0, _config.GetWindowsNativeVersion)())) {
                                                    clearInterval(interval);
                                                    _sweetalert2Min2.default.clickConfirm();
                                                }
                                            }
                                        });
                                    }, 500);
                                }
                            }).then(function (result) {
                                if (result && result.value) {
                                    (0, _sweetalert2Min2.default)({
                                        title: (0, _configuration.GetUpdateSteps_thirdStepScreenTitle)(),
                                        html: (0, _configuration.GetUpdateSteps_thirdStepScreenBody)(),
                                        width: '478px',
                                        showConfirmButton: false,
                                        timer: 4000,
                                        allowEscapeKey: true,
                                        allowOutsideClick: false
                                    }).then(function () {
                                        window.location.reload();
                                    });
                                }
                            });
                        } else {
                            var error = {};
                            error.description = "O usuário cancelou a atualização do Módulo da Extensão.";
                            error.code = -3100;
                            error.key = "module.update.user.cancelled";
                            sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                        }
                    });
                } else {
                    sendResponse((0, _config.GetExtensionFunctionPrefix)(), true, detail.resolveId, false, detail);
                }
            } else {
                var verificarInstalacao = false;
                FilterError(data, verificarInstalacao).then(function (result) {
                    sendResponse((0, _config.GetExtensionFunctionPrefix)(), result, detail.resolveId, false, detail);
                }).catch(function () {
                    var error = {};
                    error.description = data.description;
                    error.code = data.code;
                    error.key = data.key;
                    sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                });
            }
        });
    });

    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_prompt_install_native_module", function (event) {
        var verificarInstalacao = true;
        var detail = event.detail;
        detail.key = "signer.not.installed";
        FilterError(detail, verificarInstalacao).then(function (result) {
            sendResponse((0, _config.GetExtensionFunctionPrefix)(), result, detail.resolveId, false, detail);
        }).catch(function () {
            var error = {
                key: "module.download.user.cancelled",
                code: -3099,
                description: "O usuário cancelou o download do Módulo da Extensão."
            };

            sendResponse((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });

    if (!(0, _utilities.IsChrome)() && typeof window.wrappedJSObject !== "undefined") {
        var ExtensionVerify = {};
        window.wrappedJSObject[(0, _config.GetExtensionInternalNamespacePrefix)() + 'ExtensionVerify'] = cloneInto(ExtensionVerify, window, { cloneFunctions: true });
    }
}

/**
 * Executa o código passado por parâmetro no contexto da página do usuário da
 * extensão.
 *
 * @param {string} code   código que será executado no contexto da página do usuário.
 */
function executeInPage(code) {}

function sendResponse(prefix, data, id, notParse, detail) {
    if ((0, _utilities.IsChrome)()) {
        var event = new CustomEvent(prefix + '_response' + (detail.scriptId ? detail.scriptId : ''), { detail: {
                response: data,
                id: id
            } });
        document.dispatchEvent(event);
        return;
    }

    if (typeof window.wrappedJSObject !== "undefined" && typeof window.wrappedJSObject[(0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'] !== "undefined" && typeof window.wrappedJSObject[(0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'][id] !== "undefined") {
        if (notParse) window.wrappedJSObject[(0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'][id](data);else window.wrappedJSObject[(0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'][id](JSON.stringify(data));
    } else if (typeof window.top.wrappedJSObject !== "undefined" && typeof window.top.wrappedJSObject['Bry' + (0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'] !== "undefined" && typeof window.top.wrappedJSObject['Bry' + (0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'][id] !== "undefined") {
        if (notParse) window.top.wrappedJSObject['Bry' + (0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'][id](data);else window.top.wrappedJSObject['Bry' + (0, _config.GetExtensionInternalNamespacePrefix)() + 'Extension'][id](JSON.stringify(data));
    } else if ((0, _config.GetExtensionFunctionPrefix)() === "bryweb") {
        // Caso especial para a extensão bryweb. `${customPrefix}Extension` aqui é BryWebExtension, porém os clientes legados usam BryExtension.
        var wrappedJSObject = typeof window.wrappedJSObject !== "undefined" ? window.wrappedJSObject : window.top.wrappedJSObject;
        if (typeof wrappedJSObject !== "undefined" && typeof wrappedJSObject.BryExtension !== "undefined" && typeof wrappedJSObject.BryExtension[id] !== "undefined") {
            var parsedData = notParse ? data : JSON.stringify(data);
            wrappedJSObject.BryExtension[id](parsedData);
        }
    } else {
        var event = new CustomEvent(prefix + '_response' + (detail.scriptId ? detail.scriptId : ''), { detail: {
                response: data,
                id: id
            } });
        document.dispatchEvent(event);
    }
}

function GetNativeModuleInfo() {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    return new Promise(function (resolve) {
        browserFacade.runtime.sendMessage('{"action":"' + (0, _config.GetExtensionFunctionPrefix)() + '_verificarInstalacao"}', function (data) {
            resolve(data);
        });
    });
}

/**
* Esse evento informa que houve algum tipo de erro ao executar a chamada na
* parte nativa.
*
* @event content_script#bry_error
* @memberOf content_script
*/
function VerifyDomainAuthorization(context) {
    return new Promise(function (resolve, reject) {
        var browserFacade = (0, _utilities.GetBrowserFacade)();
        try {
            browserFacade.storage.local.get(null, function (items) //This is an asynchronous function that returns a Promise. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/get
            {
                var alreadyIncluded = false;
                for (var key in items) {
                    if (context.hostname === items[key]) {
                        alreadyIncluded = true;
                    }
                }
                if (!context.ignoreBrowserStore && alreadyIncluded) {
                    resolve(true);
                } else //item nao está na store OU store está sendo ignorada
                    {
                        (0, _sweetalert2Min2.default)({
                            title: context.domainAuthorizationScreenTitle,
                            html: context.domainAuthorizationScreenBody,
                            width: '478px',
                            padding: 30,
                            confirmButtonColor: "#555",
                            confirmButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 10px 0px 10px;">Não autorizo</span>',
                            showConfirmButton: true,
                            cancelButtonColor: (0, _configuration.GetDomainAuthorizationScreenBodyConfirmButtonColor)(), //"#4F97DC",
                            cancelButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 10px 0px 10px;">Autorizo</span>',
                            confirmButtonClass: 'bry-btn-padding', // definido no bry.css, incluído pelo manifest
                            showCancelButton: true,
                            showCloseButton: false,
                            focusCancel: true,
                            focusConfirm: false,
                            showLoaderOnConfirm: false,
                            preConfirm: function preConfirm() {
                                //o que essa linha faz?
                                return new Promise(function (resolve) {
                                    resolve();
                                });
                            },
                            allowEscapeKey: true,
                            allowOutsideClick: false

                        }).then(function (result) {
                            if (result.value || result.dismiss && result.dismiss === _sweetalert2Min2.default.DismissReason.cancel) //pq tem "result.dismiss && result.dismiss" ??
                                {
                                    if (result.value) {
                                        (0, _sweetalert2Min2.default)({
                                            title: context.denyPromptTittle,
                                            html: context.denyPromptBody,
                                            width: '478px',
                                            type: "error",
                                            showConfirmButton: false,
                                            allowOutsideClick: false,
                                            timer: 1500,
                                            onClose: function onClose() {
                                                resolve(false);
                                            }
                                        });
                                    } else {
                                        if (!alreadyIncluded) {
                                            var toStore = {};
                                            toStore[context.hostname] = context.hostname;
                                            browserFacade.storage.local.set(toStore, function () {});
                                        }
                                        (0, _sweetalert2Min2.default)({
                                            title: context.acceptedPromptTittle,
                                            html: context.acceptedPromptBody,
                                            width: '478px',
                                            type: "success",
                                            showConfirmButton: false,
                                            allowOutsideClick: false,
                                            timer: 1500,
                                            onClose: function onClose() {
                                                resolve(true);
                                            }
                                        });
                                    }
                                }
                        });
                    }
            });
        } catch (error) {
            if (error && typeof error.message !== "undefined" && error.message.includes("context")) reject({ key: "extension.invalid.context", description: "A Extensão não está instalada ou foi desativada." });else resolve(false);
        }
    });
}

/**
 * Faz os testes sobre a mensagem de erro e garante que nenhum erro interno será
 * repassado ao usuário da extensão.
 * @param {Object} error   mensagem de erro
 */

function FilterError(error, verificarInstalacao, pageReload) {
    return new Promise(function (resolve, reject) {
        var os = (0, _utilities.GetOS)();
        var arch = (0, _utilities.GetMachineArch)();
        if (error.key === "signer.not.installed" && verificarInstalacao) {
            if (os === "windows") {
                (0, _sweetalert2Min2.default)({
                    title: (0, _configuration.GetInstalationSteps_firstStepScreenTitle_windows)(),
                    html: (0, _configuration.GetInstalationSteps_firstStepScreenBody_windows)(),
                    width: '478px',
                    padding: 20,
                    confirmButtonColor: (0, _configuration.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows)(),
                    confirmButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 15px 0px 15px;">BAIXAR</span>',
                    showCloseButton: true,
                    showConfirmButton: true,
                    focusConfirm: true,
                    showLoaderOnConfirm: true,
                    preConfirm: function preConfirm() {
                        return new Promise(function (resolve) {
                            (0, _utilities.GetBrowserFacade)().runtime.sendMessage('{"action":"machineArch"}').then(function (data) {
                                if (data.arch == "x86-32") {
                                    (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x32_exe)());
                                } else {
                                    (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_exe)());
                                }

                                setTimeout(function () {
                                    resolve();
                                }, 2500);
                            }).catch(function (error) {
                                (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_exe)());
                                setTimeout(function () {
                                    resolve();
                                }, 2500);
                            });
                        });
                    },
                    allowEscapeKey: true,
                    allowOutsideClick: false
                }).then(function (result) {
                    if (result.value) {
                        var isChrome = (0, _utilities.IsChrome)();
                        (0, _sweetalert2Min2.default)({
                            title: (0, _configuration.GetInstalationSteps_secondStepScreenTitle)(),
                            html: (0, _configuration.GetInstalationSteps_secondStepScreenBody)(),
                            width: '478px',
                            showCloseButton: true,
                            showConfirmButton: false,
                            allowEscapeKey: true,
                            allowOutsideClick: false,
                            focusCancel: true,
                            cancelButtonColor: "#FFFFFF",
                            showCancelButton: true,
                            cancelButtonClass: "bry-btn-displayNone",
                            onOpen: function onOpen() {
                                // Gambi para remover o foco do botão fechar, fica um contorno estranho
                                var y = document.getElementsByClassName('bry-btn-displayNone');
                                var aNode = y[0];
                                if (aNode) {
                                    aNode.parentNode.removeChild(aNode);
                                }
                                // fim Gambi

                                // if(isChrome)
                                if (false) { var arrowDiv; }

                                var interval = setInterval(function () {
                                    GetNativeModuleInfo().then(function (nativeModuleInfo) {
                                        if (nativeModuleInfo.action && (nativeModuleInfo.action == "is_installed_test" || nativeModuleInfo.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test")) {
                                            var clear = false;
                                            if (error.version != undefined) {
                                                if ((0, _utilities.IsVersionEqualOrGreaterThanInternal)(nativeModuleInfo.version, error.version)) {
                                                    clear = true;
                                                }
                                            } else {
                                                clear = true;
                                            }
                                            if (clear) {
                                                clearInterval(interval);
                                                _sweetalert2Min2.default.clickConfirm();
                                            }
                                        }
                                    });
                                }, 500);
                            }
                        }).then(function (result) {
                            var bryDownloadArrow = document.getElementById("bry-download-arrow");
                            if (bryDownloadArrow != undefined) {
                                bryDownloadArrow.parentNode.removeChild(bryDownloadArrow);
                            }

                            if (result && result.value) {
                                (0, _sweetalert2Min2.default)({
                                    title: (0, _configuration.GetInstalationSteps_thirdStepScreenTitle)(),
                                    html: (0, _configuration.GetInstalationSteps_thirdStepScreenBody)(),
                                    width: '478px',
                                    showConfirmButton: false,
                                    timer: 4000,
                                    allowEscapeKey: true,
                                    allowOutsideClick: false
                                }).then(function () {
                                    if (pageReload) window.location.reload();else resolve(true);
                                });
                            }
                        });
                    } else {
                        //clicou no X da janela pra download
                        reject(true);
                    }
                });
            } else if (os === "linux") {
                (0, _sweetalert2Min2.default)({
                    title: (0, _configuration.GetInstalationSteps_firstStepScreenTitle_linux)(),
                    html: (0, _configuration.GetInstalationSteps_firstStepScreenBody_linux)(),
                    width: '478px',
                    padding: 20,
                    confirmButtonColor: (0, _configuration.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux)(),
                    confirmButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 10px 0px 10px;">BAIXAR .deb</span>',
                    showConfirmButton: true,
                    confirmButtonClass: 'bry-btn-padding', // definido no bry.css, incluído pelo manifest
                    cancelButtonColor: (0, _configuration.GetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux)(),
                    cancelButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 10px 0px 10px;">BAIXAR .rpm</span>',
                    showCancelButton: true,
                    showCloseButton: true,
                    focusConfirm: true,
                    showLoaderOnConfirm: false,
                    preConfirm: function preConfirm() {
                        return new Promise(function (resolve) {
                            resolve();
                        });
                    },
                    allowEscapeKey: true,
                    allowOutsideClick: false
                }).then(function (result) {
                    //botao swal.DismissReason.cancel é o pro download RPM
                    if (result.value || result.dismiss && result.dismiss === _sweetalert2Min2.default.DismissReason.cancel) {
                        if (result.value) {
                            (0, _utilities.PromptDownload)(arch === "x64" ? (0, _config.GetNativeUrl_x64_deb)() : (0, _config.GetNativeUrl_x32_deb)());
                        } else {
                            (0, _utilities.PromptDownload)(arch === "x64" ? (0, _config.GetNativeUrl_x64_rpm)() : (0, _config.GetNativeUrl_x32_rpm)());
                        }
                        (0, _sweetalert2Min2.default)({
                            title: (0, _configuration.GetInstalationSteps_secondStepScreenTitle_linux)(),
                            html: (0, _configuration.GetInstalationSteps_secondStepScreenBody_linux)(),
                            width: '478px',
                            showCloseButton: true,
                            showConfirmButton: false,
                            allowEscapeKey: true,
                            allowOutsideClick: false,
                            focusCancel: true,
                            cancelButtonColor: "#FFFFFF",
                            showCancelButton: true,
                            cancelButtonClass: "bry-btn-displayNone",
                            onOpen: function onOpen() {
                                // Gambi para remover o foco do botão fechar, fica um contorno estranho
                                var y = document.getElementsByClassName('bry-btn-displayNone');
                                var aNode = y[0];
                                if (aNode) {
                                    aNode.parentNode.removeChild(aNode);
                                }
                                // fim Gambi

                                var interval = setInterval(function () {
                                    GetNativeModuleInfo().then(function (nativeModuleInfo) {
                                        if (nativeModuleInfo.action && (nativeModuleInfo.action == "is_installed_test" || nativeModuleInfo.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test")) {
                                            var clear = false;
                                            if (error.version != undefined) {
                                                if ((0, _utilities.IsVersionEqualOrGreaterThanInternal)(nativeModuleInfo.version, error.version)) {
                                                    clear = true;
                                                }
                                            } else {
                                                clear = true;
                                            }
                                            if (clear) {
                                                clearInterval(interval);
                                                _sweetalert2Min2.default.clickConfirm();
                                            }
                                        }
                                    });
                                }, 500);
                            }
                        }).then(function (result) {
                            if (result && result.value) {
                                (0, _sweetalert2Min2.default)({
                                    title: (0, _configuration.GetInstalationSteps_thirdStepScreenTitle_linux)(),
                                    html: (0, _configuration.GetInstalationSteps_thirdStepScreenBody_linux)(),
                                    width: '478px',
                                    showConfirmButton: false,
                                    timer: 4000,
                                    allowEscapeKey: true,
                                    allowOutsideClick: false
                                }).then(function () {
                                    if (pageReload) window.location.reload();else resolve(true);
                                });
                            }
                        });
                    } else {
                        //clicou no X da janela pra download
                        reject(true);
                    }
                });
            } else if (os === "macos") {
                (0, _sweetalert2Min2.default)({
                    title: (0, _configuration.GetInstalationSteps_firstStepScreenTitle_windows)(),
                    html: (0, _configuration.GetInstalationSteps_firstStepScreenBody_windows)(),
                    width: '478px',
                    padding: 20,
                    confirmButtonColor: (0, _configuration.GetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows)(),
                    confirmButtonText: '<span style="font-size:17px; font-family:Calibri; padding: 0px 15px 0px 15px;">BAIXAR</span>',
                    showCloseButton: true,
                    showConfirmButton: true,
                    focusConfirm: true,
                    showLoaderOnConfirm: true,
                    preConfirm: function preConfirm() {
                        return new Promise(function (resolve) {
                            (0, _utilities.PromptDownload)((0, _config.GetNativeUrl_x64_mac)());
                            setTimeout(function () {
                                resolve();
                            }, 2500);
                        });
                    },
                    allowEscapeKey: true,
                    allowOutsideClick: false
                }).then(function (result) {
                    if (result.value) {
                        var isChrome = (0, _utilities.IsChrome)();
                        (0, _sweetalert2Min2.default)({
                            title: (0, _configuration.GetInstalationSteps_secondStepScreenTitle)(),
                            html: (0, _configuration.GetInstalationSteps_secondStepScreenBody_macos)(),
                            width: '478px',
                            showCloseButton: true,
                            showConfirmButton: false,
                            allowEscapeKey: true,
                            allowOutsideClick: false,
                            focusCancel: true,
                            cancelButtonColor: "#FFFFFF",
                            showCancelButton: true,
                            cancelButtonClass: "bry-btn-displayNone",
                            onOpen: function onOpen() {
                                // Gambi para remover o foco do botão fechar, fica um contorno estranho
                                var y = document.getElementsByClassName('bry-btn-displayNone');
                                var aNode = y[0];
                                if (aNode) {
                                    aNode.parentNode.removeChild(aNode);
                                }
                                // fim Gambi

                                // if(isChrome)
                                if (false) { var arrowDiv; }
                                var interval = setInterval(function () {
                                    GetNativeModuleInfo().then(function (nativeModuleInfo) {
                                        if (nativeModuleInfo.action && (nativeModuleInfo.action == "is_installed_test" || nativeModuleInfo.action == (0, _config.GetExtensionFunctionPrefix)() + "_is_installed_test")) {
                                            var clear = false;
                                            if (error.version != undefined) {
                                                if ((0, _utilities.IsVersionEqualOrGreaterThanInternal)(nativeModuleInfo.version, error.version)) {
                                                    clear = true;
                                                }
                                            } else {
                                                clear = true;
                                            }
                                            if (clear) {
                                                clearInterval(interval);
                                                _sweetalert2Min2.default.clickConfirm();
                                            }
                                        }
                                    });
                                }, 500);
                            }
                        }).then(function (result) {
                            var bryDownloadArrow = document.getElementById("bry-download-arrow");
                            if (bryDownloadArrow != undefined) {
                                bryDownloadArrow.parentNode.removeChild(bryDownloadArrow);
                            }
                            if (result && result.value) {
                                (0, _sweetalert2Min2.default)({
                                    title: (0, _configuration.GetInstalationSteps_thirdStepScreenTitle)(),
                                    html: (0, _configuration.GetInstalationSteps_thirdStepScreenBody)(),
                                    width: '478px',
                                    showConfirmButton: false,
                                    timer: 4000,
                                    allowEscapeKey: true,
                                    allowOutsideClick: false
                                }).then(function () {
                                    if (pageReload) window.location.reload();else resolve(true);
                                });
                            }
                        });
                    } else {
                        //clicou no X da janela pra download
                        reject(true);
                    }
                });
            }
        } else {
            reject();
        }
    });
}

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "download-arrow.png";

/***/ }),
/* 9 */,
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "brand.png";

/***/ }),
/* 11 */,
/* 12 */,
/* 13 */,
/* 14 */,
/* 15 */,
/* 16 */,
/* 17 */,
/* 18 */,
/* 19 */,
/* 20 */,
/* 21 */,
/* 22 */,
/* 23 */,
/* 24 */,
/* 25 */,
/* 26 */,
/* 27 */,
/* 28 */,
/* 29 */,
/* 30 */,
/* 31 */,
/* 32 */,
/* 33 */,
/* 34 */,
/* 35 */,
/* 36 */,
/* 37 */,
/* 38 */,
/* 39 */,
/* 40 */,
/* 41 */,
/* 42 */,
/* 43 */,
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _contentScript = __webpack_require__(7);

var _configuration = __webpack_require__(5);

var _config = __webpack_require__(0);

var _utilities = __webpack_require__(1);

var _configResources = __webpack_require__(45);

var _config2 = __webpack_require__(3);

var _config3 = _interopRequireDefault(_config2);

var _sweetalert2Min = __webpack_require__(9);

var _sweetalert2Min2 = _interopRequireDefault(_sweetalert2Min);

var _brand = __webpack_require__(10);

var _brand2 = _interopRequireDefault(_brand);

var _loading = __webpack_require__(46);

var _loading2 = _interopRequireDefault(_loading);

var _downloadArrow = __webpack_require__(47);

var _downloadArrow2 = _interopRequireDefault(_downloadArrow);

var _ok = __webpack_require__(48);

var _ok2 = _interopRequireDefault(_ok);

var _icon = __webpack_require__(49);

var _icon2 = _interopRequireDefault(_icon);

var _trash = __webpack_require__(50);

var _trash2 = _interopRequireDefault(_trash);

var _icon3 = __webpack_require__(51);

var _icon4 = _interopRequireDefault(_icon3);

var _firstTwosteps = __webpack_require__(52);

var _firstTwosteps2 = _interopRequireDefault(_firstTwosteps);

var _secondTwosteps = __webpack_require__(53);

var _secondTwosteps2 = _interopRequireDefault(_secondTwosteps);

var _chromeDownloadedFile = __webpack_require__(54);

var _chromeDownloadedFile2 = _interopRequireDefault(_chromeDownloadedFile);

var _firefoxDownloadedFile = __webpack_require__(55);

var _firefoxDownloadedFile2 = _interopRequireDefault(_firefoxDownloadedFile);

var _chromeDownloadedFileMacos = __webpack_require__(56);

var _chromeDownloadedFileMacos2 = _interopRequireDefault(_chromeDownloadedFileMacos);

var _firefoxDownloadedFileMacos = __webpack_require__(57);

var _firefoxDownloadedFileMacos2 = _interopRequireDefault(_firefoxDownloadedFileMacos);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// utilizado nos passos de instalação
// utilizado no browseraction para remover dominios autorizados
// Utilizada na parte que informa que o nativo foi detectado com sucesso
//@preserve Utilizada na parte de detectar se o nativo foi instalado


//import {PromptDownload} from '../external-deps/webextension/src/content-script';

(function () {

    if (document[_config3.default]) {
        return;
    }

    (0, _config2.GlobalConfiguration)(); // Configura prefixo, urls, ...
    (0, _contentScript.InitializeBaseContentScript)();

    (0, _configResources.ResourcesConfiguration)();
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_list_readers", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso aos seus certificados digitais. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                (0, _utilities.GetBrowserFacade)().runtime.sendMessage('{"action":"' + (0, _config.GetExtensionFunctionPrefix)() + '_list_readers"}', function (data) {
                    if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_list_readers") {
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data.readers, detail.resolveId, false, detail);
                    } else {
                        var error = {
                            key: data.key,
                            description: data.description
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    }
                });
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_cert_req_generate", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita permiss\xE3o para criar o par de chaves. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = JSON.parse(detail.input);
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_cert_req_generate";
                (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                    if (data.action == (0, _config.GetExtensionFunctionPrefix)() + "_cert_req_generate") {
                        var response = {
                            request: data.request,
                            keyInfo: data.keyInfo
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), response, detail.resolveId, false, detail);
                    } else {
                        var error = {
                            key: data.key,
                            description: data.description
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    }
                });
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_cert_req_import", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso ao seu reposit\xF3rio de certificados digitais. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = JSON.parse(detail.input);
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_cert_req_import";
                (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                    if (data.action == (0, _config.GetExtensionFunctionPrefix)() + "_cert_req_import") {
                        var response = {
                            status: data.status
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), response, detail.resolveId, false, detail);
                    } else {
                        var error = {
                            key: data.key,
                            description: data.description
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    }
                });
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_export_certificate", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso aos seus certificados digitais. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = JSON.parse(detail.input);
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_export_certificate";
                (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                    if (data.action == (0, _config.GetExtensionFunctionPrefix)() + "_export_certificate") {
                        delete data.action;
                        delete data.tabid;
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.resolveId, false, detail);
                    } else {
                        var error = {
                            key: data.key,
                            description: data.description
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    }
                });
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_get_finger_print", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso ao leitor biom\xE9trico. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = {};
                if (detail.input != undefined) {
                    json = JSON.parse(detail.input);
                }
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_get_finger_print";
                try {
                    (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                        if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_get_finger_print") {
                            delete data.action;
                            delete data.tabid;
                            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.resolveId, false, detail);
                        } else {
                            var error = {
                                key: data.key,
                                description: data.description
                            };
                            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                        }
                    });
                } catch (ex) {
                    var error = {};
                    error.description = "A Extensão não está instalada ou foi desativada.";
                    error.key = "extension.invalid.context", (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                }
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_get_fingerprint_installed_list", function (event) {
        var detail = event.detail;
        (0, _utilities.GetBrowserFacade)().runtime.sendMessage('{"action":"' + (0, _config.GetExtensionFunctionPrefix)() + '_get_fingerprint_installed_list"}', function (data) {
            if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_get_fingerprint_installed_list") {
                var response = {
                    complements: data.complements
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), response, detail.resolveId, false, detail);
            } else {
                var error = {
                    key: data.key,
                    description: data.description
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_get_complement_fingerprint_supportedlist", function (event) {
        var detail = event.detail;
        var json = {};
        if (detail.input != undefined) {
            json = JSON.parse(detail.input);
        }
        json.action = (0, _config.GetExtensionFunctionPrefix)() + "_get_complement_fingerprint_supportedlist";
        (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
            if (data.action == (0, _config.GetExtensionFunctionPrefix)() + "_get_complement_fingerprint_supportedlist") {
                delete data.action;
                delete data.tabid;
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.resolveId, false, detail);
            } else {
                delete data.action;
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.rejectId, false, detail);
            }
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_install_complement_fingerprint", function (event) {
        var detail = event.detail;
        var json = {};
        if (detail.input != undefined) {
            json = JSON.parse(detail.input);
        }
        json.action = (0, _config.GetExtensionFunctionPrefix)() + "_install_complement_fingerprint";
        json.complementBaseUrl = _config2.COMPLEMENT_BASE_URL;
        (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
            if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_install_complement_fingerprint") {
                var response = {
                    complements: data.complements
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), response, detail.resolveId, false, detail);
            } else {
                var error = {
                    key: data.key,
                    description: data.description
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_get_system_info", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso para obter a identifica\xE7\xE3o do seu computador. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = {};
                if (detail.input != undefined) {
                    json = JSON.parse(detail.input);
                }
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_get_system_info";
                (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                    if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_get_system_info") {
                        delete data.action;
                        delete data.tabid;
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.resolveId, false, detail);
                    } else {
                        var error = {
                            key: data.key,
                            description: data.description
                        };
                        (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                    }
                });
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_is_finger_on", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso ao leitor biom\xE9trico. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = {};
                if (detail.input != undefined) {
                    json = JSON.parse(detail.input);
                }
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_is_finger_on";
                try {
                    (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                        if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_is_finger_on") {
                            delete data.action;
                            delete data.tabid;
                            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.resolveId, false, detail);
                        } else {
                            var error = {
                                key: data.key,
                                description: data.description
                            };
                            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                        }
                    });
                } catch (ex) {
                    var error = {};
                    error.description = "A Extensão não está instalada ou foi desativada.";
                    error.key = "extension.invalid.context", (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                }
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });
    document.addEventListener((0, _config.GetExtensionFunctionPrefix)() + "_is_finger_off", function (event) {
        var detail = event.detail;
        var context = {
            hostname: window.location.hostname,
            domainAuthorizationScreenTitle: (0, _configuration.GetDomainAuthorizationScreenTitle)(),
            domainAuthorizationScreenBody: '<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso ao leitor biom\xE9trico. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ',
            acceptedPromptTittle: "Autorizado",
            acceptedPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> O site <strong>" + window.location.hostname + "</strong> foi autorizado.",
            denyPromptTittle: "Não Autorizado",
            denyPromptBody: "<h4 align=\"center\" style=\"color:#333333;font-weight: 500; font-family:Calibri;\"> Você não autorizou o site <strong>" + window.location.hostname + "</strong>.",
            ignoreBrowserStore: false
        };
        (0, _contentScript.VerifyDomainAuthorization)(context).then(function (result) {
            if (result) {
                var json = {};
                if (detail.input != undefined) {
                    json = JSON.parse(detail.input);
                }
                json.action = (0, _config.GetExtensionFunctionPrefix)() + "_is_finger_off";
                try {
                    (0, _utilities.GetBrowserFacade)().runtime.sendMessage(JSON.stringify(json), function (data) {
                        if (data.action === (0, _config.GetExtensionFunctionPrefix)() + "_is_finger_off") {
                            delete data.action;
                            delete data.tabid;
                            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), data, detail.resolveId, false, detail);
                        } else {
                            var error = {
                                key: data.key,
                                description: data.description
                            };
                            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                        }
                    });
                } catch (ex) {
                    var error = {};
                    error.description = "A Extensão não está instalada ou foi desativada.";
                    error.key = "extension.invalid.context", (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
                }
            } else {
                //domnínio não autorizado
                var error = {
                    key: "extension.authorization.canceled",
                    code: "1001",
                    description: "A autorização do domínio foi cancelada pelo usuário."
                };
                (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
            }
        }).catch(function (error) {
            //tratamento de erro
            (0, _contentScript.sendResponse)((0, _config.GetExtensionFunctionPrefix)(), error, detail.rejectId, false, detail);
        });
    });

    document[_config3.default] = true;
})(); // utilizado nos passos de instalação
// utilizado no browseraction
// faz output da imagem utilizada na parte // Sinaliza para o usuário que há atividades na página utilizando a extensão (excluindo atividades de verificação de instalação)
//@preserve Utilizada na parte que sinaliza para o usuário abrir o instalador do nativo
//@preserve Imagem utilizada na janela de aprovação do domínio

/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.ResourcesConfiguration = ResourcesConfiguration;

var _utilities = __webpack_require__(1);

var _configuration = __webpack_require__(5);

//("#4F97DC");

//("#4F97DC"); // rpm
// ("#4F97DC"); // baixar
var brand_img_name = 'brand.png'; //("#555");
//("#4F97DC"); // dep

var loading_img_name = 'loading.gif';
var download_arrow_img_name = 'download-arrow.png';
var ok_img_name = 'ok.png';
var icon_48_img_name = 'icon-48.png';
var trash_img_name = 'trash.png';
var icon_128_name = 'icon-128.png';
var first_step_name = 'first-twosteps.png';
var second_step_name = 'second-twosteps.png';
var chrome_downloaded_file_name = 'chrome-downloaded-file.png';
var firefox_downloaded_file_name = 'firefox-downloaded-file.png';
var chrome_downloaded_file_mac_name = 'chrome-downloaded-file-macos.png';
var firefox_downloaded_file_mac_name = 'firefox-downloaded-file-macos.png';

function ResourcesConfiguration() {
    (0, _configuration.SetInstalationSteps_firstStepScreenTitle_windows)("<h4 style='font-size:19px; font-family:Calibri;' class='bry-extension-header'><div><img class='bry-image' style='height: 4em; margin-bottom: 0.5em;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/></div>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_firstStepScreenBody_windows)('<br/>\n    <span class="bry-step-counter" style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:12px;">Passo 1</span><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(first_step_name) + '"/>\n    <h3 id="bry-element-to-focus" style="color:#333333; font-weight:500; padding-bottom:8px; font-family:Calibri;">A extens\xE3o foi adicionada</h3>\n    <h4 style="color:#333333; font-size:20px; font-family:Calibri;" >Falta pouco!</h4><br/>\n    <h5 style="color:#333333; font-size:19px; font-family:Calibri;">Fa\xE7a download do instalador clicando no bot\xE3o abaixo:</h5>');

    // Por algum motivo desconhecido não está exibindo a imagem na segunda tela de instalação (isso no firefox/linux), apenas se eu carregar na primeira tela.
    // Então adicionei 0px para ele carregar e não exibir
    (0, _configuration.SetInstalationSteps_firstStepScreenTitle_linux)("<h4 style='font-size:16px; font-family:Calibri;' class='bry-extension-header'><img class='bry-image' style='height: 30px; margin-bottom:15px;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/><br/>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_firstStepScreenBody_linux)('\n    <span class="bry-step-counter" style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:12px;">Passo 1</span><br/>\n    <img class=\'bry-image\' style="height: 0px;" src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(second_step_name) + '"/>\n    <img class=\'bry-image\' style="height: 0px;" src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(chrome_downloaded_file_name) + '"/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(first_step_name) + '"/>\n    <img class=\'bry-image\' style="height: 0px;" src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(firefox_downloaded_file_name) + '"/>\n    <h3 style="color:#333333; font-weight:500; padding-bottom:8px; font-family:Calibri;font-size:19px;">A extens\xE3o foi adicionada</h3>\n    <h4 style="color:#333333;font-size:19px; font-family:Calibri;">Falta pouco!</h4>\n    <h4 style="color:#333333; font-size:17px; font-family:Calibri !important;">Fa\xE7a o download do pacote para a sua distribui\xE7\xE3o clicando em um dos bot\xF5es abaixo:</h4>');

    (0, _configuration.SetInstalationSteps_secondStepScreenTitle)("<h4 style='font-size:19px; font-family:Calibri;' class='bry-extension-header'><div><img class='bry-image' style='height: 4em; margin-bottom: 0.5em;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/></div>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_secondStepScreenBody)('\n    <span class="bry-step-counter" style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:12px;">Passo 2</span><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(second_step_name) + '"/><br/><br/>\n    <h4 style="color:#333333; font-family:Calibri;font-size:19px;">Voc\xEA deve abrir o arquivo que foi baixado e seguir as orienta\xE7\xF5es de instala\xE7\xE3o.</h4><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL((0, _utilities.IsChrome)() ? chrome_downloaded_file_name : firefox_downloaded_file_name) + '"/><br/><br/>\n    <h5 style="color:#333333;font-size:19px; font-family:Calibri;font-size:19px;">Aguardando voc\xEA realizar a instala\xE7\xE3o...</h5>\n    ');

    (0, _configuration.SetInstalationSteps_secondStepScreenTitle_linux)("<h4 style='font-size:16px; font-family:Calibri;' class='bry-extension-header'><img class='bry-image' style='height: 30px; margin-bottom:15px;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/><br/>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_secondStepScreenBody_linux)('\n    <span class="bry-step-counter" style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:12px;">Passo 2</span><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(second_step_name) + '"/><br/><br/>\n    <h4 style="color:#333333; font-family:Calibri;font-size:17px;">Voc\xEA deve abrir o arquivo que foi baixado e seguir as orienta\xE7\xF5es de instala\xE7\xE3o.</h4><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL((0, _utilities.IsChrome)() ? chrome_downloaded_file_name : firefox_downloaded_file_name) + '"/><br/><br/>\n    <h5 style="color:#333333;font-size:17px; font-family:Calibri;">Aguardando voc\xEA realizar a instala\xE7\xE3o...</h5>\n    ');

    (0, _configuration.SetInstalationSteps_thirdStepScreenTitle)("<h4 style='font-size:19px; font-family:Calibri;' class='bry-extension-header'><div><img class='bry-image' style='height: 4em; margin-bottom: 0.5em;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/></div>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_thirdStepScreenBody)('<br/>\n    <p><img class=\'bry-image\' style="height: 50px;" src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(ok_img_name) + '"/></p>\n    <h4 style="color:#aaa;font-size:19px; font-family:Calibri;">Pronto!</h4><br/>\n    <h4 style="color:#333333; font-size:19px; font-family:Calibri;">Agora voc\xEA j\xE1 pode assinar seus documentos<br/> pelo navegador.</h4>\n    ');

    (0, _configuration.SetInstalationSteps_thirdStepScreenTitle_linux)("<h4 style='font-size:16px; font-family:Calibri;' class='bry-extension-header'><img class='bry-image' style='height: 30px; margin-bottom:15px;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/><br/>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_thirdStepScreenBody_linux)('<br/>\n    <p><img class=\'bry-image\' style="height: 50px;" src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(ok_img_name) + '"/></p>\n    <h4 style="color:#aaa;font-size:17px; font-family:Calibri;">Pronto!</h4><br/>\n    <h4 style="color:#333333; font-size:17px; font-family:Calibri;">Agora voc\xEA j\xE1 pode assinar seus documentos<br/> pelo navegador.</h4>\n    ');

    (0, _configuration.SetInstalationSteps_notSupportedStepScreenTitle)("<h4 style='font-size:19px; font-family:Calibri;' class='bry-extension-header'><div><img class='bry-image' style='height: 4em; margin-bottom: 0.5em;'src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/></div>EXTENSÃO PARA ASSINATURA DIGITAL</h4>");
    (0, _configuration.SetInstalationSteps_notSupportedStepScreenBody)('<br/>\n    <h3 style="color:#333333; font-weight:500; padding-bottom:8px; font-family:Calibri;">A extens\xE3o foi adicionada.</h3>\n    <h4 style="color:#333333; font-size:19px; font-family:Calibri;">Para fazer uso da extens\xE3o no sistema operacional MacOS favor utilizar o navegador Safari!</h4><br/><br/><br/>');

    (0, _configuration.SetDomainAuthorizationScreenTitle)("<div><img class='bry-image' style='height: 4em; margin-bottom: 0.5em;' src='" + (0, _utilities.GetBrowserFacade)().runtime.getURL(brand_img_name) + "'/></div>Pedido de Acesso<br/>");
    (0, _configuration.SetDomainAuthorizationScreenBody)('<h4 align="center" style="color:#333333;font-weight: 500; font-family:Calibri;"> \n    O site <strong>' + window.location.hostname + '</strong> solicita acesso\n    aos seus certificados digitais. Voc\xEA autoriza?</h4>\n    <br/>\n    <span style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:14px;"><i>Voc\xEA pode gerenciar este acesso clicando no bot\xE3o da Extens\xE3o.</i></span>\n    ');

    (0, _configuration.SetInstalationSteps_secondStepScreenBody_macos)('\n    <span class="bry-step-counter" style="color:#A7A7A7; font-weight:500; font-family:Calibri; font-size:12px;">Passo 2</span><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL(second_step_name) + '"/><br/><br/>\n    <h4 style="color:#333333; font-family:Calibri;font-size:19px;">Voc\xEA deve abrir o arquivo que foi baixado e seguir as orienta\xE7\xF5es de instala\xE7\xE3o.</h4><br/>\n    <img class=\'bry-image\' src="' + (0, _utilities.GetBrowserFacade)().runtime.getURL((0, _utilities.IsChrome)() ? chrome_downloaded_file_mac_name : firefox_downloaded_file_mac_name) + '"/><br/><br/>\n    <h5 style="color:#333333;font-size:19px; font-family:Calibri;font-size:19px;">Aguardando voc\xEA realizar a instala\xE7\xE3o...</h5>\n    ');

    (0, _configuration.SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_windows)("#009CDA");
    (0, _configuration.SetInstalationSteps_firstStepScreenBodyConfirmButtonColor_linux)("#009CDA");
    (0, _configuration.SetInstalationSteps_firstStepScreenBodyCancelButtonColor_linux)("#009CDA");
    (0, _configuration.SetDomainAuthorizationScreenBodyConfirmButtonColor)("#009CDA");
    (0, _configuration.SetDomainAuthorizationScreenBodyCancelButtonColor)("#575755");
}

/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "loading.gif";

/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "download-arrow.png";

/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "ok.png";

/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "icon-48.png";

/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "trash.png";

/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "icon-128.png";

/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "first-twosteps.png";

/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "second-twosteps.png";

/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "chrome-downloaded-file.png";

/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "firefox-downloaded-file.png";

/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "chrome-downloaded-file-macos.png";

/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "firefox-downloaded-file-macos.png";

/***/ })
/******/ ]);