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
/******/ 	return __webpack_require__(__webpack_require__.s = 58);
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

/***/ 11:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.InitializeDevtools = InitializeDevtools;
exports.InitializeDebug = InitializeDebug;

var _utilities = __webpack_require__(1);

var _config = __webpack_require__(0);

function InitializeDevtools() {
    /**
     * Váriavel que representa a fachada para as funcionalidades de webextensions
     * do browser em que a extensão está instalada.
     */
    var browserFacade = (0, _utilities.GetBrowserFacade)();

    /**
    * Chamada que cria o painel de debug da extensão no navegador
    *
    * @namespace debug_module
    * @member {Panel} BRySignerWebPanel
    * @memberOf debug_module
    */
    browserFacade.devtools.panels.create((0, _config.GetExtensionInternalNamespacePrefix)() + "SignerWeb", "brand.png", "debug.html", function (panel) {});
}

function InitializeDebug() {
    (function () {
        // Escopo privado para evitar conflitos com outros scripts na extensão


        var browserFacade = (0, _utilities.GetBrowserFacade)();

        // Constantes utilizadas na interface
        var extensaoHTML = "Extens&atilde;o";
        var paginaClienteHTML = "P&aacute;gina cliente";
        var listCertificateExtensionDetailsDescricao = "Certificados com chave privada instalada no computador que foram buscados pela extens&atilde;o.";
        var indiceTitulo = "Indice";
        var nomeTitulo = "Nome";
        var identificadorDeCertificadoTitulo = "Identificador de Certificado";
        var listCertificateDetailsClientDescricao = "A p&aacute;gina cliente solicitou &agrave; extens&atilde;o os certificados instalados.";
        var signClientDetailsDescricao = "Mensagem de solicita&ccedil;&atilde;o de assinatura enviada a extens&atilde;o.";
        var algorithmoResumoCriptograficoTitulo = "Algoritmo de Resumo Criptogr&aacute;fico";
        var certificadoUtilizadoTitulo = "Certificado Utilizado";
        var formatoDosDadosTitulo = "Formato dos dados";
        var formatoDadosDeEntradaDetalhe = "<strong>Formato de entrada:</strong> ";
        var formatoDadosDeSaidaDetalhe = "<strong>Formato de sa&iacute;da:</strong> ";
        var assinaturasTitulo = "Assinaturas";
        var nonceTitulo = "Nonce";
        var signExtensionDetailsDescricao = "Mensagem de resposta da extens&atilde;o com os dados de assinatura solicitados.";
        var mensagemDesconhecidaAviso = "Mensagem desconhecida";
        var desligarModoDebugTexto = "Desligar modo de Debug";
        var ligarModoDebugTexto = "Ligar modo de Debug";
        var emissorTitulo = "Emissor";
        var tipoMensagemTitulo = "Tipo de mensagem";
        var momentoTitutlo = "Momento";

        var log = [];

        var backgroundConnection = browserFacade.runtime.connect({
            name: "debug-panel"
        });

        function showListCertificateExtensionDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = "";

            var divDescription = document.createElement("div");
            divDescription.innerHTML = listCertificateExtensionDetailsDescricao;
            messageInfoDiv.appendChild(divDescription);
            var table = document.createElement("table");
            table.classList.add("mui-table");
            table.classList.add("mui-table--bordered");
            var header = table.createTHead();
            var row = header.insertRow(0);

            var certificateIndex = document.createElement("th");
            certificateIndex.innerHTML = indiceTitulo;
            var certificateSubject = document.createElement("th");
            certificateSubject.innerHTML = nomeTitulo;
            var certificateBase64 = document.createElement("th");
            certificateBase64.innerHTML = identificadorDeCertificadoTitulo;

            row.appendChild(certificateIndex);
            row.appendChild(certificateSubject);
            row.appendChild(certificateBase64);

            message.certificates.forEach(function (certificate, i, array) {
                var row = table.insertRow(-1);
                var index = document.createElement("td");
                index.innerHTML = i;
                var name = document.createElement("td");
                name.innerHTML = certificate.name;
                var base64 = document.createElement("td");
                base64.innerHTML = certificate.certId;
                row.appendChild(index);
                row.appendChild(name);
                row.appendChild(base64);
            });

            messageInfoDiv.appendChild(table);
        }

        function showListCertificateDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = "";

            if (message.certificates) {
                // A mensagem partiu da extensão
                showListCertificateExtensionDetails(message, sender);
            } else {
                messageInfoDiv.innerHTML = listCertificateDetailsClientDescricao;
            }
        }

        function showSignClientDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = "";

            var descriptionDiv = document.createElement("div");
            descriptionDiv.innerHTML = signClientDetailsDescricao;
            messageInfoDiv.appendChild(descriptionDiv);

            var algoritmoHashTitulo = document.createElement("h3");
            algoritmoHashTitulo.innerHTML = algorithmoResumoCriptograficoTitulo;
            messageInfoDiv.appendChild(algoritmoHashTitulo);

            var algoritmoHashInformacao = document.createElement("p");
            algoritmoHashInformacao.innerHTML = message.algoritmoHash;
            messageInfoDiv.appendChild(algoritmoHashInformacao);

            var certificadoUtilizado = document.createElement("h3");
            certificadoUtilizado.innerHTML = certificadoUtilizadoTitulo;
            messageInfoDiv.appendChild(certificadoUtilizado);

            var certificadoUtilizadoInfo = document.createElement("p");
            certificadoUtilizadoInfo.innerHTML = message.certId;
            messageInfoDiv.appendChild(certificadoUtilizadoInfo);

            var formatos = document.createElement("h3");
            formatos.innerHTML = formatoDosDadosTitulo;
            messageInfoDiv.appendChild(formatos);

            var formatoEntrada = document.createElement("p");
            formatoEntrada.innerHTML = formatoDadosDeEntradaDetalhe + message.formatoDadosEntrada;
            messageInfoDiv.appendChild(formatoEntrada);

            var formatoSaida = document.createElement("p");
            formatoSaida.innerHTML = formatoDadosDeSaidaDetalhe + message.formatoDadosSaida;
            messageInfoDiv.appendChild(formatoSaida);

            var assinaturas = document.createElement("h3");
            assinaturas.innerHTML = assinaturasTitulo;
            messageInfoDiv.appendChild(assinaturas);

            var assinaturasTable = document.createElement("Table");
            var assinaturasHeader = assinaturasTable.insertRow(0);

            var assinaturaIndex = document.createElement("th");
            assinaturaIndex.innerHTML = indiceTitulo;
            assinaturasHeader.appendChild(assinaturaIndex);

            var assinaturaNonce = document.createElement("th");
            assinaturaNonce.innerHTML = nonceTitulo;
            assinaturasHeader.appendChild(assinaturaNonce);

            message.assinaturas.forEach(function (assinatura, index, array) {
                var assinaturaRow = assinaturasTable.insertRow(-1);

                var indexCell = assinaturaRow.insertCell();
                indexCell.innerHTML = index;

                var nonceCell = assinaturaRow.insertCell();
                nonceCell.innerHTML = assinatura.nonce;
            });
            messageInfoDiv.appendChild(assinaturasTable);

            var messageNonce = document.createElement("h3");
            messageNonce.innerHTML = nonceTitulo;
            messageInfoDiv.appendChild(messageNonce);

            var nonce = document.createElement("p");
            nonce.innerHTML = message.nonce;
            messageInfoDiv.appendChild(nonce);
        }

        function showSignExtensionDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = "";

            var descriptionDiv = document.createElement("div");
            descriptionDiv.innerHTML = signExtensionDetailsDescricao;
            messageInfoDiv.appendChild(descriptionDiv);

            var messageNonce = document.createElement("h3");
            messageNonce.innerHTML = nonceTitulo;
            messageInfoDiv.appendChild(messageNonce);

            var nonceText = document.createElement("p");
            nonceText.innerHTML = message.nonce;
            messageInfoDiv.appendChild(nonceText);

            var assinaturas = document.createElement("h3");
            assinaturas.innerHTML = assinaturasTitulo;
            messageInfoDiv.appendChild(assinaturas);

            var assinaturasTable = document.createElement("table");
            messageInfoDiv.appendChild(assinaturasTable);

            var titleRow = assinaturasTable.insertRow(0);

            var indexTitle = document.createElement("th");
            indexTitle.innerHTML = indiceTitulo;
            titleRow.appendChild(indexTitle);

            var hashNonce = document.createElement("th");
            hashNonce.innerHTML = nonceTitulo;
            titleRow.appendChild(hashNonce);

            message.assinaturas.forEach(function (assinatura, index, array) {
                var assinaturaRow = assinaturasTable.insertRow(-1);

                var indexCell = assinaturaRow.insertCell();
                indexCell.innerHTML = index;

                var nonceCell = assinaturaRow.insertCell();
                nonceCell.innerHTML = assinatura.nonce;
            });
        }

        function showSignDetails(message, sender) {
            if (message.algoritmoHash) {
                // A mensagem partiu da página cliente
                showSignClientDetails(message, sender);
            } else {
                showSignExtensionDetails(message, sender);
            }
        }

        function showVerificarExtensaoDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = "";

            var verificarInstalacaoTitle = document.createElement("h3");
            verificarInstalacaoTitle.innerHTML = "Verificar Instala&ccedil;&atilde;o";
            messageInfoDiv.appendChild(verificarInstalacaoTitle);

            var description = document.createElement("p");
            description.innerHTML = "A exentens&atilde;o enviou uma mensagem &agrave; parte nativa para verificar se a " + "instala&ccdeil;&atilde;o foi feita. Essa mensagem n&atilde;o cont&eacute;m nenhum dado.";
            messageInfoDiv.appendChild(description);
        }

        function showIsInstalledTestDetails(message, details) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = "";

            var installedTitle = document.createElement("h3");
            installedTitle.innerHTML = "Parte Nativa Instalada";
            messageInfoDiv.appendChild(installedTitle);
            var description = document.createElement("p");
            description.innerHTML = "O m&oacute;dulo nativo respondeu ao navegador que est&aacute; instalado e qual a sua vers&atilde;o.";
            messageInfoDiv.appendChild(description);
            var version = document.createElement("p");
            var versionLabel = document.createElement("b");
            versionLabel.innerHTML = "Vers&atilde;o: ";
            version.appendChild(versionLabel);
            var versionValue = document.createElement("span");
            versionValue.innerHTML = message.version;
            version.appendChild(versionValue);
            messageInfoDiv.appendChild(version);
        }

        function showErrorDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = JSON.stringify(message);
        }

        /**
        * Função chamada quando uma mensagem sem *action* ou com algum *action* desconhecido foi recebida.
        */
        function showUnknowDetails(message, sender) {
            var messageInfoDiv = document.getElementById("message-info");
            messageInfoDiv.innerHTML = JSON.stringify(message);
        }

        var debug_mode_on = false;

        /**
        * Função que irá armazenar no log e chamar as funções que produzem a interface caso o
        * modo de debug esteja ligado.
        * @param {Object}  message - Mensagem recebida pelo módulo
        * @param {Object}  sender - Objeto que representa quem enviou a Mensagem
        * @param {function} sendResponse - Função que pode ser utilizada para enviar uma resposta direta ao {sender}.
        * @memberOf debug_module
        */
        backgroundConnection.onMessage.addListener(function (message, sender, sendResponse) {
            if (!debug_mode_on) {
                return;
            }

            // Algumas mensagens vem em forma de objeto
            // Outras em string json...
            try {
                message = JSON.parse(message);
            } catch (e) {
                // ignora
            }
            var now = new Date();

            message.moment = now;
            log.push(message);

            var table = document.getElementById("debug-area");
            var row = table.insertRow(0);
            var cellDirection = row.insertCell(0);
            var cellMessage = row.insertCell(1);
            var cellMoment = row.insertCell(2);

            var logEntry = function logEntry(fromExtensao, detailsFunction) {
                if (fromExtensao) {
                    cellDirection.innerHTML = extensaoHTML;
                } else {
                    cellDirection.innerHTML = paginaClienteHTML;
                }
                var messageAction = document.createElement("a");
                messageAction.innerHTML = message.action;
                messageAction.href = "#";
                messageAction.onclick = function () {
                    detailsFunction(message, sender);
                };
                cellMessage.appendChild(messageAction);
                cellMoment.innerHTML = JSON.stringify(now);
            };

            var functionPrefix = (0, _config.GetExtensionFunctionPrefix)();

            switch (message.action) {
                case functionPrefix + "_list_certificates":
                    var fromExtensao = message.certificates !== undefined;
                    logEntry(fromExtensao, showListCertificateDetails);
                    break;
                case functionPrefix + "_sign":
                    var fromExtensao = message.algoritmoHash === undefined;
                    logEntry(fromExtensao, showSignDetails);
                    break;
                case functionPrefix + "_error":
                    var fromExtensao = true;
                    logEntry(fromExtensao, showErrorDetails);
                    break;
                case functionPrefix + "_verificarInstalacao":
                    var fromExtensao = true;
                    logEntry(fromExtensao, showVerificarExtensaoDetails);
                    break;
                case "is_installed_test":
                    var fromExtensao = true;
                    logEntry(fromExtensao, showIsInstalledTestDetails);
                    break;
                default:
                    cellDirection.innerHTML = mensagemDesconhecidaAviso;
                    var messageAction = document.createElement("a");
                    messageAction.innerHTML = message.action;
                    messageAction.href = "#";
                    messageAction.onclick = function () {
                        showUnknowDetails(message, sender);
                    };
                    cellMessage.appendChild(messageAction);
                    cellMoment.innerHTML = JSON.stringify(now);
            }
        });

        function promptDownload(logname, log) {
            var elementDownload = document.createElement("a");
            elementDownload.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(log));
            elementDownload.setAttribute('download', logname);

            elementDownload.style.display = 'none';
            document.body.appendChild(elementDownload);

            elementDownload.click();

            document.body.removeChild(elementDownload);
        }

        document.addEventListener('DOMContentLoaded', function () {
            document.getElementById("turn-debug-mode").addEventListener("click", function () {
                debug_mode_on = !debug_mode_on;

                if (debug_mode_on) {
                    document.getElementById("turn-debug-mode").innerHTML = desligarModoDebugTexto;
                } else {
                    document.getElementById("turn-debug-mode").innerHTML = ligarModoDebugTexto;
                }
            });

            document.getElementById("clear-debug").addEventListener("click", function () {
                var table = document.getElementById("debug-area");
                table.innerHTML = "";
                var messageInfoDiv = document.getElementById("message-info");
                messageInfoDiv.innerHTML = "";
                log = [];
            });

            document.getElementById("export-log").addEventListener("click", function () {
                var logData = JSON.stringify(log);
                var now = new Date();
                promptDownload('log-' + now + '.log', logData);
            });
        });
    })();
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

/***/ }),

/***/ 58:
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _config = __webpack_require__(3);

var _devtools = __webpack_require__(11);

(0, _config.GlobalConfiguration)();
(0, _devtools.InitializeDevtools)();

/***/ })

/******/ });