// ==UserScript==
// @id             iitc-plugin-extend-link@Jormund
// @name           IITC plugin: extend link
// @category       Layer
// @version        0.1.0.20160818.2030
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @downloadURL    https://raw.githubusercontent.com/Jormund/extendLink/master/extendLink.user.js
// @description    [2016-08-18-2030] 
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @include        https://www.ingress.com/mission/*
// @include        http://www.ingress.com/mission/*
// @match          https://www.ingress.com/mission/*
// @match          http://www.ingress.com/mission/*
// @grant          none 
// ==/UserScript==

function wrapper(plugin_info) {
    // ensure plugin framework is there, even if iitc is not yet loaded
    if (typeof window.plugin !== 'function') window.plugin = function () { };

    // PLUGIN START ////////////////////////////////////////////////////////

    // use own namespace for plugin
    window.plugin.extendLink = function () { };
    window.plugin.extendLink.KEY_STORAGE = 'extendLink-storage';
	window.plugin.extendLink.DEFAULT_LINK_LENGTH = 1000000;//in m//TODO: input
    window.plugin.extendLink.DEFAULT_CLEAR_BEFORE_DRAW = true;
	
    window.plugin.extendLink.storage = { 
        linkLength: window.plugin.extendLink.DEFAULT_LINK_LENGTH,
		clearBeforeDraw: window.plugin.extendLink.DEFAULT_CLEAR_BEFORE_DRAW
    };
    window.plugin.extendLink.debug = true;
    window.plugin.extendLink.isSmart = undefined; //will be true on smartphones after setup

    // update the localStorage datas
    window.plugin.extendLink.saveStorage = function () {
        localStorage[window.plugin.extendLink.KEY_STORAGE] = JSON.stringify(window.plugin.extendLink.storage);
    };

    // load the localStorage datas
    window.plugin.extendLink.loadStorage = function () {
        if (typeof localStorage[window.plugin.extendLink.KEY_STORAGE] != "undefined") {
            window.plugin.extendLink.storage = JSON.parse(localStorage[window.plugin.extendLink.KEY_STORAGE]);
        }

        //ensure default values are always set
        if (typeof window.plugin.extendLink.storage.linkLength == "undefined") {
            window.plugin.extendLink.storage.linkLength = window.plugin.extendLink.DEFAULT_LINK_LENGTH;
        }
		if (typeof window.plugin.extendLink.storage.clearBeforeDraw == "undefined") {
            window.plugin.extendLink.storage.clearBeforeDraw = window.plugin.extendLink.DEFAULT_CLEAR_BEFORE_DRAW;
        }
    };

    window.plugin.extendLink.clearBeforeDrawClicked = function () {
        window.plugin.extendLink.storage.clearBeforeDraw = $("#extendLink-clearBeforeDraw").is(":checked");
        window.plugin.extendLink.saveStorage();
    };

    /***************************************************************************************************************************************************************/
    /** DRAW **************************************************************************************************************************************************/
    /***************************************************************************************************************************************************************/
    window.plugin.extendLink.resetGuide = function () {
        //similar to window.plugin.drawTools.optReset but without confirmation
        window.plugin.extendLink.drawnItems.clearLayers();
        //window.plugin.extendLink.load();
        //runHooks('pluginextendLink', { event: 'clear' });
    };

    //convert latlng string from Bookmarks to array of numbers
    window.plugin.extendLink.latlngToLatLngArr = function (latlngstring) {
        var arr = latlngstring.split(',');
        if (arr.length != 2) return null;
        arr[0] = parseFloat(arr[0]);
        arr[1] = parseFloat(arr[1]);
        if (isNaN(arr[0]) || isNaN(arr[1])) return null;
        return arr;
    }

    window.plugin.extendLink.drawLine = function (latlngs) {
        var layer;
        var layerType = 'polyline';
        layer = L.geodesicPolyline(latlngs, //window.plugin.drawTools.lineOptions
			{
			color: "black",
			dashArray: [8,12],
			opacity: 0.7,
            weight: 2,
            clickable: false
			}
		);
        //map.fire('draw:created', {
		map.fire('extendLink:created', {
            layer: layer,
            layerType: layerType
        });
        return layer;
    }
	window.plugin.extendLink.clearDraw = function () {
	   window.plugin.extendLink.drawnItems.clearLayers();
	}
	window.plugin.extendLink.clearDrawClicked = function () {
	   window.plugin.extendLink.clearDraw();
	}
    window.plugin.extendLink.drawClicked = function () {
		if (window.plugin.extendLink.storage.clearBeforeDraw) {
			window.plugin.extendLink.clearDraw();
		}

		var options = {
			linkLength: window.plugin.extendLink.storage.linkLength
		}
		window.plugin.extendLink.drawExtendedLink(options);
    }

    window.plugin.extendLink.drawExtendedLink = function (options) {
        if (typeof options == 'undefined') options = {};
        if (typeof options.linkLength == 'undefined') options.linkLength = window.plugin.extendLink.DEFAULT_LINK_LENGTH;

        try {
			window.plugin.extendLink.log('Start of extended links');
            var msg = '';

            //copying portals from bookmarks
            var bkmrkArr = [];
            var folders = {};
            if (typeof window.plugin.bookmarks.bkmrksObj != 'undefined'
		            && window.plugin.bookmarks.bkmrksObj.portals != 'undefined') {
                $.each(window.plugin.bookmarks.bkmrksObj.portals, function (folderId, folder) {
                    if (typeof folder.bkmrk != 'undefined') {
                        $.each(folder.bkmrk, function (bookmarkId, bookmarkOri) {
                            var bookmark = {}; //new object so as to not interfere
                            bookmark.folderId = folderId;
                            bookmark.globalIndex = bkmrkArr.length;
                            bookmark.latLngArr = window.plugin.extendLink.latlngToLatLngArr(bookmarkOri.latlng);
                            bookmark.latLng = L.latLng(bookmark.latLngArr);
                            bkmrkArr.push(bookmark);

                            if (typeof folders[folderId] == 'undefined') folders[folderId] = {};
                            folders[folderId].hasBookmarks = true;
                        });
                    }
                });
            }

            var portalCount = bkmrkArr.length;
            if (portalCount < 2) {
                msg = 'Requires at least 2 portals';
                //window.plugin.extendLink.log(msg);
                alert(msg);
                return;//when less than 2 bookmarks, do nothing
            }
            window.plugin.extendLink.log(portalCount + ' portals found');

            //loop over portals
			for(var i = 1; i < portalCount;i++) {
				var previousBkmrk = bkmrkArr[i-1];
				var currentBkmrk = bkmrkArr[i];
				msg = 'Computing between '+currentBkmrk.latLng+' and '+previousBkmrk.latLng;
				window.plugin.extendLink.log(msg);
				
				//http://www.movable-type.co.uk/scripts/latlong.html
				//first we get the bearing
				var φ1 = L.LatLng.DEG_TO_RAD*currentBkmrk.latLng.lat;
				var λ1 = L.LatLng.DEG_TO_RAD*currentBkmrk.latLng.lng;
				var φ2 = L.LatLng.DEG_TO_RAD*previousBkmrk.latLng.lat;
				var λ2 = L.LatLng.DEG_TO_RAD*previousBkmrk.latLng.lng;
				var Δλ = λ2-λ1;
				var y = Math.sin(Δλ) * Math.cos(φ2);
				var x = Math.cos(φ1)*Math.sin(φ2) -
						Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
				var θ = Math.atan2(y, x);
				var bearing = (θ*L.LatLng.RAD_TO_DEG+360) % 360;
				msg = 'Bearing is '+bearing+'';
				window.plugin.extendLink.log(msg);
				//then compute line end
				var distance = options.linkLength;
				var earthRadius = 6371e3;
				var δ = Number(distance) / earthRadius; // angular distance in radians
				var θ = Number(bearing)*L.LatLng.DEG_TO_RAD;
				var φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));
				var x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
				var y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
				var λ2 = λ1 + Math.atan2(y, x);
				var otherEndLatLng = L.latLng(φ2*L.LatLng.RAD_TO_DEG,(λ2*L.LatLng.RAD_TO_DEG+540)%360-180);// normalise to −180..+180°
				msg = 'New end is '+otherEndLatLng;
				window.plugin.extendLink.log(msg);
				latLngs = [currentBkmrk.latLng, otherEndLatLng];
                window.plugin.extendLink.drawLine(latLngs);//actually draw the line
			}

            if (window.plugin.extendLink.isSmart) {
                window.show('map');
            }

            //Show the layer if it is hidden
			if (!map.hasLayer(window.plugin.extendLink.drawnItems)) {
			   map.addLayer(window.plugin.extendLink.drawnItems);
			}

            window.plugin.extendLink.log('End of extended links');
        }
        catch (err) {
            //$('#mobileinfo').html(err.message); //debug
            //window.debug.console.error(err.message);
            //window.plugin.extendLink.log('Message:'+err.message);
            if (window.plugin.extendLink.isSmart)
                window.plugin.extendLink.log(err.stack, true);
            else
                throw err;
        }
    }
    /***************************************************************************************************************************************************************/
    window.plugin.extendLink.clearLog = function () {
        if (window.plugin.extendLink.isSmart) {
            $('#extendLink-log').html();
        }
    }

    window.plugin.extendLink.log = function (text, isError) {
        if (window.plugin.extendLink.debug || isError) {
            if (window.plugin.extendLink.isSmart) {
                $('#extendLink-log').prepend(text + '<br/>');
            }
            else {
                console.log(text);
            }
        }
    }

    /***************************************************************************************************************************************************************/

    var setup = function () {
        if (!window.plugin.bookmarks) {
            alert('Bookmarks plugin required');
            return false;
        }
        if (!window.plugin.drawTools) {
            alert('Draw tools plugin required');
            return false;
        }
        window.plugin.extendLink.isSmart = window.isSmartphone();

        window.plugin.extendLink.loadStorage();
        // window.plugin.extendLink.setupCSS();

        // toolbox menu
        $('#toolbox').after('<div id="extendLink-toolbox" style="padding:3px;"></div>');
        var amdToolbox = $('#extendLink-toolbox');
        amdToolbox.append(' <strong>Extended links : </strong>');
        amdToolbox.append('<a onclick="window.plugin.extendLink.drawClicked()" title="Draw extended links">Draw extended links</a>&nbsp;&nbsp;');
        amdToolbox.append('<a onclick="window.plugin.extendLink.clearDrawClicked()" title="Clear extended links">Clear</a>&nbsp;&nbsp;');
        // amdToolbox.append(' <br /><input id="extendLink-clearBeforeDraw" type="checkbox" onclick="window.plugin.extendLink.clearBeforeDrawClicked()" />');
        // amdToolbox.append('<label for="extendLink-clearBeforeDraw">Clear before draw</label>');

        $('#extendLink-clearBeforeDraw').prop('checked', window.plugin.extendLink.storage.clearBeforeDraw);
        //$('#extendLink-fieldMode').val(window.plugin.extendLink.storage.fieldMode);


        if (window.plugin.extendLink.isSmart) {
            $('#extendLink-toolbox').append('<div id="extendLink-log"></div>');
        }
		
		window.plugin.extendLink.drawnItems = new L.FeatureGroup();
		
		window.addLayerGroup('Extended links', window.plugin.extendLink.drawnItems, true);
		
		map.on('extendLink:created', function(e) {
			var type=e.layerType;
			var layer=e.layer;
			window.plugin.extendLink.drawnItems.addLayer(layer);
			//window.plugin.extendLink.save();

			// if(layer instanceof L.Marker) {
			  // window.registerMarkerForOMS(layer);
			// }

			//runHooks('pluginDrawTools',{event:'layerCreated',layer:layer});
		  });

        //alert('end of extendLink setup');
    }

    // PLUGIN END //////////////////////////////////////////////////////////


    setup.info = plugin_info; //add the script info data to the function as a property
    if (!window.bootPlugins) window.bootPlugins = [];
    window.bootPlugins.push(setup);
    // if IITC has already booted, immediately run the 'setup' function
    if (window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
(document.body || document.head || document.documentElement).appendChild(script);
