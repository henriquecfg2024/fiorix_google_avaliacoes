/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
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
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 18);
/******/ })
/************************************************************************/
/******/ ({

/***/ 0:
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

/***/ 1:
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

/***/ 18:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _config = __webpack_require__(3);

var _background = __webpack_require__(19);

//import {GlobalConfiguration} from '../config/config.js';
//import {GlobalConfiguration} from '../custom/assinepelainternet/index.js';
(0, _config.GlobalConfiguration)(); // Configura prefixo, urls, ...
(0, _background.InitializeBaseBackground)();

/***/ }),

/***/ 19:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InitializeBaseBackground = InitializeBaseBackground;

var _config = __webpack_require__(0);

var _utilities = __webpack_require__(1);

var _configuration = __webpack_require__(2);

function InitializeBaseBackground() {
    var browserFacade = (0, _utilities.GetBrowserFacade)();
    var functionPrefix = (0, _config.GetExtensionFunctionPrefix)();
    var actionNames = (0, _configuration.GetActionNames)();
    var nativeIdName = (0, _configuration.GetNativeIdName)();

    /**
    * Essa variável guarda a conexão com o módulo de debug incluído no devtools.
    */
    var connection = null;
    var isNativeInstalled = true;

    /**
    * Adiciona um listener para esperar pela conexão do módulo de debug
    */
    browserFacade.runtime.onConnect.addListener(function (port) {

        port.onDisconnect.addListener(function () {
            connection = null;
        });

        connection = port;
    });

    function onNativeMessage(message) {
        if (message.tabid !== "popup") {
            try {
                // Repassa a mensagem para o módulo de debug
                if (connection) {
                    connection.postMessage(message);
                }

                return message;
            } catch (ex) {
                if (connection) {
                    connection.postMessage(ex);
                }

                var errorMessage = {};
                errorMessage.action = functionPrefix + "_error";
                errorMessage.description = "Exceção ao fazer chamada nativa.";
                errorMessage.key = "signer.native.exception";
                errorMessage.ex = ex;
                return errorMessage;
            }
        }
    }

    function onError(key, description, tabid) {
        var message = {};
        message.action = functionPrefix + "_error";
        message.description = description;
        message.key = key;

        return message;
    }

    function getAction() {
        if (typeof browserFacade.action !== "undefined") return browserFacade.action;else return browserFacade.browserAction;
    }

    browserFacade.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        // Forward das mensagens para o módulo de debug
        if (connection) connection.postMessage(message);

        var json = JSON.parse(message);

        // Appends the tab id to the message
        if (sender.tab && sender.tab.id) json.tabid = sender.tab.id;else json.tabid = 0; // Ou "popup", se não houver tab

        //json.navegador = navigator.appVersion;

        //Transforma a ação de verificação na ação esperada pelo host
        if (json.action == "bry_verificarInstalacao") // Mantido por compatibilidade, existe uma versão do nativo que só verifica is_installed_test sem o prefixo
            {
                json.action = "is_installed_test";
            } else if (json.action == functionPrefix + "_verificarInstalacao") {
            json.action = functionPrefix + "_is_installed_test";
        } else if (sender.tab && sender.tab.id) {
            // Sinaliza para o usuário que há atividades na página utilizando a extensão (excluindo atividades de verificação de instalação)
            getAction().setIcon({ path: { "48": "icon-48.png" }, tabId: sender.tab.id });
        }

        if (actionNames.includes(json.action)) {
            browserFacade.runtime.sendNativeMessage(nativeIdName, json, function (response) {
                var action = getAction();
                // Alterando o estado da váriavel global de controle da instalação da parte nativa
                isNativeInstalled = response !== undefined;

                if (!isNativeInstalled) {
                    response = onError("signer.not.installed", "O Módulo da Extensão não foi instalado", json.tabid);

                    // O Aviso da badge deve ser global, por isso o tabId não é informado                    
                    action.setBadgeText({ text: "!" });
                    action.setBadgeBackgroundColor({ color: "#FAA300" });
                } else {
                    // Testando a versão para notificar uma atualização no browser action, só o is_installed_test tem a versão.
                    if (json.action == "is_installed_test" || json.action == functionPrefix + "_is_installed_test") {
                        if (!(0, _utilities.IsVersionEqualOrGreaterThan)(response.version, response.os)) {
                            action.setBadgeText({ text: "!" });
                            action.setBadgeBackgroundColor({ color: "#FAA300" });
                            nativeModuleNeedsUpdate = true;
                        } else {
                            action.setBadgeText({ text: "" });
                        }
                    }
                }

                //populatePopup(response);
                sendResponse(response);
            });
        } else if (json.action == "machineArch") {
            var facade = typeof browser === "undefined" ? chrome : browser;
            facade.runtime.getPlatformInfo().then(function (platformInfo) {
                sendResponse(platformInfo);
            }).catch(function (error) {
                sendResponse({ "arch": "x86-64", "error": "not handle" });
            });
        } else {
            var response = onError("background.unknow.message", "A mensagem enviada para a extensão é desconhecida: \"" + json.action + "\".", json.tabid);
            sendResponse(response);
        }

        return true;
    });

    var nativeModuleNeedsUpdate = false;

    var NEEDS_UPDATE = "NEEDS_UPDATE";
    var UPDATED = "UPDATED";
    var DO_NOTHING = "DO_NOTHING";

    function populatePopup(message) {
        var popups = browserFacade.extension.getViews({ type: "popup" });
        if (popups.length > 0) {
            popups.forEach(function (popupWindow) {
                var popupDocument = popupWindow.document;
                // Obtém o documento correto para inclusão dos elementos.
                if (isNativeInstalled) {
                    var state = nativoDesatualizado(message);
                    if (state === NEEDS_UPDATE) {
                        // Troca os paineis
                        popupDocument.getElementById("content-native-desatualizado").style = "";
                        // O Aviso da badge deve ser global, por isso o tabId não é informado
                        var action = getAction();
                        action.setBadgeText({ text: "!" });
                        action.setBadgeBackgroundColor({ color: "#FAA300" });
                    } else if (state === UPDATED) {
                        popupDocument.getElementById("content-native-desatualizado").style = "display: none;";
                    }

                    // garante que o painel de certificados e dominios instalados será mostrado
                    popupDocument.getElementById("content-native-instalado").style = "";
                }
            });
        }
    }

    function nativoDesatualizado(message) {
        if (message.action == "is_installed_test" || message.action == functionPrefix + "_is_installed_test") {
            if (!(0, _utilities.IsVersionEqualOrGreaterThan)(message.version, message.os)) {
                nativeModuleNeedsUpdate = true;
                return NEEDS_UPDATE;
            } else {
                nativeModuleNeedsUpdate = false;
                return UPDATED;
            }
        }

        return DO_NOTHING;
    }
}

/***/ }),

/***/ 2:
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

/***/ 3:
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

/***/ })

/******/ });