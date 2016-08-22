// ==UserScript==
// @id             iitc-plugin-extend-link@Jormund
// @name           IITC plugin: extend link
// @category       Layer
// @version        0.1.1.20160822.1314
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @downloadURL    https://raw.githubusercontent.com/Jormund/extend_link/master/extend_link.user.js
// @description    [2016-08-22-1314] Draw the line between consecutive bookmarks and extend it
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
    window.plugin.extendLink.debug = false; //log more messages if true

    window.plugin.extendLink.KEY_STORAGE = 'extendLink-storage';
    window.plugin.extendLink.DEFAULT_LINK_LENGTH = 1000000; //in m
    window.plugin.extendLink.DEFAULT_CLEAR_BEFORE_DRAW = true;
    window.plugin.extendLink.DEFAULT_SKIP_FOLDER_CHANGE = true;
    window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE = true;
    window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_RATIO = 5; //skip if current length over previous length is over the ratio
    window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_THRESHOLD = 100; //in m //skip if current length > threshold

    window.plugin.extendLink.storage = {
        linkLength: window.plugin.extendLink.DEFAULT_LINK_LENGTH,
        clearBeforeDraw: window.plugin.extendLink.DEFAULT_CLEAR_BEFORE_DRAW,
        skipFolderChange: window.plugin.extendLink.DEFAULT_SKIP_FOLDER_CHANGE,
        skipByDistance: window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE,
        skipByDistanceRatio: window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_RATIO,
        skipByDistanceThreshold: window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_THRESHOLD
    };

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
        if (typeof window.plugin.extendLink.storage.skipFolderChange == "undefined") {
            window.plugin.extendLink.storage.skipFolderChange = window.plugin.extendLink.DEFAULT_SKIP_FOLDER_CHANGE;
        }
        if (typeof window.plugin.extendLink.storage.skipByDistance == "undefined") {
            window.plugin.extendLink.storage.skipByDistance = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE;
        }
        if (typeof window.plugin.extendLink.storage.skipByDistanceRatio == "undefined") {
            window.plugin.extendLink.storage.skipByDistanceRatio = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_RATIO;
        }
        if (typeof window.plugin.extendLink.storage.skipByDistanceThreshold == "undefined") {
            window.plugin.extendLink.storage.skipByDistanceThreshold = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_THRESHOLD;
        }
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
        layer = L.geodesicPolyline(latlngs, //window.plugin.drawTools.lineOptions//TODO: user preferences ?
			{
			color: "black",
			dashArray: [8, 12],
			opacity: 0.7,
			weight: 2,
			clickable: false
}
            );
        //map.fire('draw:created', {//draw tools event, we use different event name to use a different layer
        map.fire('extendLink:drawCreated', {
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
            linkLength: window.plugin.extendLink.storage.linkLength,
            skipFolderChange: window.plugin.extendLink.storage.skipFolderChange,
            skipByDistance: window.plugin.extendLink.storage.skipByDistance,
            skipByDistanceRatio: window.plugin.extendLink.storage.skipByDistanceRatio,
            skipByDistanceThreshold: window.plugin.extendLink.storage.skipByDistanceThreshold
        }
        window.plugin.extendLink.drawExtendedLink(options);
    }

    window.plugin.extendLink.drawExtendedLink = function (options) {
        if (typeof options == 'undefined') options = {};
        if (typeof options.linkLength == 'undefined') options.linkLength = window.plugin.extendLink.DEFAULT_LINK_LENGTH;
        if (typeof options.skipFolderChange == 'undefined') options.skipFolderChange = window.plugin.extendLink.DEFAULT_SKIP_FOLDER_CHANGE;
        if (typeof options.skipByDistance == 'undefined') options.skipByDistance = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE;
        if (typeof options.skipByDistanceRatio == 'undefined') options.skipByDistanceRatio = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_RATIO;
        if (typeof options.skipByDistanceThreshold == 'undefined') options.skipByDistanceThreshold = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_THRESHOLD;

        try {
            window.plugin.extendLink.log('Start of extend links');
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
                msg = 'Requires at least 2 bookmarks';
                //window.plugin.extendLink.log(msg);
                alert(msg);
                return; //when less than 2 bookmarks, do nothing
            }
            window.plugin.extendLink.log(portalCount + ' portals found');

            //loop over portals
            // var previousBearing = null;
            var previousDistance = null;
            var previousWasSkiped = false;
            for (var i = 1; i < portalCount; i++) {
                var previousBkmrk = bkmrkArr[i - 1];
                var currentBkmrk = bkmrkArr[i];
                msg = 'Computing between ' + currentBkmrk.latLng + ' and ' + previousBkmrk.latLng;
                window.plugin.extendLink.log(msg);

                //check folder
                if (options.skipFolderChange) {
                    var skip = false;
                    if (currentBkmrk.folderId != previousBkmrk.folderId) {
                        skip = true;
                    }
                    if (skip) {
                        msg = 'Skipping because folder changes from ' + previousBkmrk.folderId + ' to ' + currentBkmrk.folderId;
                        window.plugin.extendLink.log(msg);
                        previousWasSkiped = true;
                        continue;
                    }
                }

                //check for distance
                var currentDistance = currentBkmrk.latLng.distanceTo(previousBkmrk.latLng);
                //msg = 'currentDistance : ' + currentDistance + ', previousDistance: ' + previousDistance + '';
                //window.plugin.extendLink.log(msg);
                if (options.skipByDistance && !previousWasSkiped && previousDistance != null) {
                    var skip = false;
                    var ratio = currentDistance / previousDistance;
                    if (ratio > options.skipByDistanceRatio
                        && currentDistance > options.skipByDistanceThreshold) {
                        skip = true;
                    }
                    if (skip) {
                        msg = 'Skipping because distance ratio is ' + ratio + ' and distance is ' + currentDistance + '>' + options.skipByDistanceThreshold + ' (' + currentDistance + '/' + previousDistance + ' > ' + options.skipByDistanceRatio + ')';
                        window.plugin.extendLink.log(msg);
                        previousDistance = currentDistance;
                        previousWasSkiped = true;//remember the skipping so we don't skip twice
                        continue;
                    }
                }

                //http://www.movable-type.co.uk/scripts/latlong.html
                //first we get the bearing
                var φ1 = L.LatLng.DEG_TO_RAD * currentBkmrk.latLng.lat;
                var λ1 = L.LatLng.DEG_TO_RAD * currentBkmrk.latLng.lng;
                var φ2 = L.LatLng.DEG_TO_RAD * previousBkmrk.latLng.lat;
                var λ2 = L.LatLng.DEG_TO_RAD * previousBkmrk.latLng.lng;
                var Δλ = λ2 - λ1;
                var y = Math.sin(Δλ) * Math.cos(φ2);
                var x = Math.cos(φ1) * Math.sin(φ2) -
						Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
                var θ = Math.atan2(y, x);
                var bearing = (θ * L.LatLng.RAD_TO_DEG + 360) % 360;
                msg = 'Bearing is ' + bearing + '°';
                window.plugin.extendLink.log(msg);

                //then compute line end
                var distance = options.linkLength;
                var earthRadius = 6371e3;
                var δ = Number(distance) / earthRadius; // angular distance in radians
                var θ = Number(bearing) * L.LatLng.DEG_TO_RAD;
                var φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
                var x = Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2);
                var y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
                var λ2 = λ1 + Math.atan2(y, x);
                var otherEndLatLng = L.latLng(φ2 * L.LatLng.RAD_TO_DEG, (λ2 * L.LatLng.RAD_TO_DEG + 540) % 360 - 180); // normalise to −180..+180°
                msg = 'New end is ' + otherEndLatLng;
                window.plugin.extendLink.log(msg);
                latLngs = [currentBkmrk.latLng, otherEndLatLng];
                window.plugin.extendLink.drawLine(latLngs); //actually draw the line

                previousDistance = currentDistance;
                if (previousWasSkiped) {
                    previousWasSkiped = false;
                }
            }

            if (window.plugin.extendLink.isSmart) {
                window.show('map');
            }

            //Show the layer if it is hidden
            if (!map.hasLayer(window.plugin.extendLink.drawnItems)) {
                map.addLayer(window.plugin.extendLink.drawnItems);
            }

            window.plugin.extendLink.log('End of extend links');
        }
        catch (err) {
            if (window.plugin.extendLink.isSmart)
                window.plugin.extendLink.log(err.stack, true);
            else
                throw err;
        }
    }
    /***************************************************************************************************************************************************************/
    //Options//
    /*********/
    window.plugin.extendLink.resetOpt = function () {
        window.plugin.extendLink.storage.linkLength = window.plugin.extendLink.DEFAULT_LINK_LENGTH;
        window.plugin.extendLink.storage.clearBeforeDraw = window.plugin.extendLink.DEFAULT_CLEAR_BEFORE_DRAW;
        window.plugin.extendLink.storage.skipFolderChange = window.plugin.extendLink.DEFAULT_SKIP_FOLDER_CHANGE;
        window.plugin.extendLink.storage.skipByDistance = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE;
        window.plugin.extendLink.storage.skipByDistanceRatio = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_RATIO;
        window.plugin.extendLink.storage.skipByDistanceThreshold = window.plugin.extendLink.DEFAULT_SKIP_BY_DISTANCE_THRESHOLD;

        window.plugin.extendLink.saveStorage();
        window.plugin.extendLink.openOptDialog();
    }
    window.plugin.extendLink.saveOpt = function () {
        window.plugin.extendLink.storage.clearBeforeDraw = $('#extendLink-clearBeforeDraw').is(":checked");
        var linkLength = $('#extendLink-linkLength').val();
        linkLength = parseFloat(linkLength);
        if (!isNaN(linkLength)) window.plugin.extendLink.storage.linkLength = linkLength;
        window.plugin.extendLink.storage.skipFolderChange = $('#extendLink-skipFolderChange').is(":checked");
        window.plugin.extendLink.storage.skipByDistance = $('#extendLink-skipByDistance').is(":checked");
        var skipByDistanceRatio = $('#extendLink-skipByDistanceRatio').val();
        skipByDistanceRatio = parseFloat(skipByDistanceRatio);
        if (!isNaN(skipByDistanceRatio)) window.plugin.extendLink.storage.skipByDistanceRatio = skipByDistanceRatio;
        var skipByDistanceThreshold = $('#extendLink-skipByDistanceThreshold').val();
        skipByDistanceThreshold = parseFloat(skipByDistanceThreshold);
        if (!isNaN(skipByDistanceThreshold)) window.plugin.extendLink.storage.skipByDistanceThreshold = skipByDistanceThreshold;

        window.plugin.extendLink.saveStorage();
    }
    window.plugin.extendLink.optClicked = function () {
        window.plugin.extendLink.openOptDialog();
    }
    window.plugin.extendLink.openOptDialog = function () {
        var html =
		'<div>' +
			'<table>';
        html +=
			'<tr>' +
				'<td>' +
					'Clear before draw' +
				'</td>' +
				'<td>' +
					'<input id="extendLink-clearBeforeDraw" type="checkbox" ' +
						(window.plugin.extendLink.storage.clearBeforeDraw ? 'checked="checked" ' : '') +
						'/>' + //onclick="window.plugin.extendLink.clearBeforeDrawClicked()"
				'</td>' +
			'</tr>';
        html +=
			'<tr>' +
				'<td>' +
        //'<acronym title="Guesses when the bookmarks are not close and doesn\'t link them">No link when vertex changes</acronym>' +
                    'Skip link between folders' +
                '</td>' +
				'<td>' +
					'<input id="extendLink-skipFolderChange" type="checkbox" ' +
						(window.plugin.extendLink.storage.skipFolderChange ? 'checked="checked" ' : '') +
						'/>' +
				'</td>' +
			'</tr>';
        html +=
			'<tr>' +
				'<td>' +
                    'Skip link between distant bookmarks' +
                '</td>' +
				'<td>' +
					'<input id="extendLink-skipByDistance" type="checkbox" ' +
						(window.plugin.extendLink.storage.skipByDistance ? 'checked="checked" ' : '') +
						'/>' +
				'</td>' +
			'</tr>';
        html +=
			'<tr>' +
				'<td>' +
                    'Ratio for skipping by distance' +
                '</td>' +
				'<td>' +
                    '<input id="extendLink-skipByDistanceRatio" size="10" maxlength="8" type="text" ' +
						'value="' + window.plugin.extendLink.storage.skipByDistanceRatio + '"' +
						'/>' +
				'</td>' +
			'</tr>';
        html +=
			'<tr>' +
				'<td>' +
                    'Distance threshold in m' +
                '</td>' +
				'<td>' +
                    '<input id="extendLink-skipByDistanceThreshold" size="10" maxlength="8" type="text" ' +
						'value="' + window.plugin.extendLink.storage.skipByDistanceThreshold + '"' +
						'/>' +
				'</td>' +
			'</tr>';
        html +=
			'<tr>' +
				'<td>' +
					'Drawn link length in m' +
				'</td>' +
				'<td>' +
					'<input id="extendLink-linkLength" size="10" maxlength="8" type="text" ' +
						'value="' + window.plugin.extendLink.storage.linkLength + '"' +
						'/>' +
				'</td>' +
			'</tr>';
        html +=
			'</table>' +
		'</div>' +
		'<div style="text-align:center">' +
			'<button type="button" onclick="window.plugin.extendLink.resetOpt()">Reset</button> ' +
			'<button type="button" onclick="window.plugin.extendLink.saveOpt()">Save</button>' +
		'</div>';
        dialog({
            html: html,
            id: 'extendLink_opt',
            title: 'Extend link preferences',
            width: 'auto'
        });
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
        var elToolbox = $('#extendLink-toolbox');
        elToolbox.append(' <strong>Extend links : </strong>');
        elToolbox.append('<a onclick="window.plugin.extendLink.drawClicked()" title="Draw extended links">Draw links</a>&nbsp;&nbsp;');
        elToolbox.append('<a onclick="window.plugin.extendLink.clearDrawClicked()" title="Clear extended links">Clear</a>&nbsp;&nbsp;');
        elToolbox.append('<a onclick="window.plugin.extendLink.optClicked()" title="Clear extended links">Opt</a>&nbsp;&nbsp;');
        // elToolbox.append(' <br /><input id="extendLink-clearBeforeDraw" type="checkbox" onclick="window.plugin.extendLink.clearBeforeDrawClicked()" />');
        // elToolbox.append('<label for="extendLink-clearBeforeDraw">Clear before draw</label>');

        //$('#extendLink-clearBeforeDraw').prop('checked', window.plugin.extendLink.storage.clearBeforeDraw);


        if (window.plugin.extendLink.isSmart) {
            $('#extendLink-toolbox').append('<div id="extendLink-log"></div>');
        }

        window.plugin.extendLink.drawnItems = new L.FeatureGroup();

        window.addLayerGroup('Extended links', window.plugin.extendLink.drawnItems, true);

        map.on('extendLink:drawCreated', function (e) {
            var type = e.layerType;
            var layer = e.layer;
            window.plugin.extendLink.drawnItems.addLayer(layer);
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
