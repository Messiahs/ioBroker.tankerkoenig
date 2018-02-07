/* jshint -W097 */// jshint strict:false
/*jslint node: true */

"use strict";
var utils       = require(__dirname + '/lib/utils'); // Get common adapter utils
var request     = require('request');
var lang = 'de';

var adapter = utils.adapter({
    name:           'tankerkoenig',
    systemConfig:   true,
    useFormatDate:  true
});

var optinReset = false;
var optinNoLog = false;

adapter.on('ready', function () {
    //adapter.getForeignObject('system.config', function (err, data) {
        //if (data && data.common) {
        //    lang  = data.common.language;
        //}

        writeLog("initializing objects","debug");
        main();
    //});
});

function writeLog(logtext,logtype) { // wenn optinNoLog TRUE keine Ausgabe bei info, warn und debug, nur bei error
    if (!optinNoLog) { // Ausgabe bei info, debug und error
        if (logtype === "silly") adapter.log.silly(logtext);
        if (logtype === "info") adapter.log.info(logtext);
        if (logtype === "debug") adapter.log.debug(logtext);
        if (logtype === "warn") adapter.log.warn(logtext);
        if (logtype === "error") adapter.log.error(logtext);
    } else { // Ausgabe nur bei error
        if (logtype === "error") adapter.log.error(logtext);
    }
}

// Dezimalstellen des Preises ermitteln
function cutPrice(preis) {
    preis = parseFloat(preis);
    var temp = preis * 100;   // 100facher Preis jetzt mit einer Nachkommastelle
    var temp2 = preis * 1000; // 1000facher Preis ohne Nachkommastelle
    temp = Math.floor(temp);  // Nachkommastelle (.x) wird abgeschnitten
    temp = temp/100;          // es bleiben zwei Nachkommastellen
    var price_short = temp.toFixed(2); // Preis mit 2 Nachkommastellen ausgeben (abgeschnitten)
    var price_3rd_digit = Math.ceil(temp2 - (temp * 1000)); // Dritte Nachommastelle einzeln ermitteln
    return {
        'priceshort': price_short, // als String wg. Nullen zB 1.10 statt 1.1
        'price3rd': parseInt(price_3rd_digit,10)
    };
}

function readData(url) {
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var result;
            writeLog("Typ Body: " + typeof body + " >>> Body Inhalt: " + body,"debug"); // fertiges JSON als String
            try{
                result = JSON.parse(body); // String zu Objekt

                //var data = JSON.stringify(result, null, 2); // Objekt zu String für ausgabe
                // JSON check
                if (result.ok) {
                    writeLog("JSON ok","debug");
                    adapter.setState('json', {ack: true, val: body}); // nur String (also body) speichern

                    //VARIABLEN NIEDRIGSTER PREIS definieren
                    var cheapest_e5;           // wird mal 0 bis 9
                    var cheapest_e5_stationid; // passende ID der Tankstelle
                    var cheapest_e10;
                    var cheapest_e10_stationid;
                    var cheapest_diesel;
                    var cheapest_diesel_stationid;
                    // Ermitteln, wo der erste Eintrag in der Liste / Einstellungen steht (durch Runterzählen)
                    for (var j = 9; j >= 0; j--) {
                        var stationid   = adapter.config.stationsarray[j][0]; // sowas "a7cdd9cf-b467-4aac-8eab-d662f082511e"
                        if (!adapter.config.stationsarray[j][0]) adapter.log.debug('Einstellung/Eintrag Nr. ' + j + ' ist leer');
                        else {
                            if (result.prices[stationid].e5 > 0) {
                                cheapest_e5 = j;
                                cheapest_e5_stationid = adapter.config.stationsarray[j][0];
                            }
                            if (result.prices[stationid].e10 > 0) {
                                cheapest_e10 = j;
                                cheapest_e10_stationid = adapter.config.stationsarray[j][0];
                            }
                            if (result.prices[stationid].diesel > 0) {
                                cheapest_diesel = j;
                                cheapest_diesel_stationid = adapter.config.stationsarray[j][0];
                            }
                        } // die letzten gefundenen Einträge beim Runterzählen,
                          // also die ersten in der Liste sind jetzt der Maßstab für den Vergleich, ob billiger oder nicht
                    }
                    // Reset
                    if (adapter.config.resetValues) {
                        // billigstes E5
                        adapter.setState('stations.cheapest.e5.feed',  0);
                        adapter.setState('stations.cheapest.e5.short', '');
                        adapter.setState('stations.cheapest.e5.3rd',   0);// dritte stelle
                        adapter.setState('stations.cheapest.e5.combined', 'keine Daten');
                        adapter.setState('stations.cheapest.e5.name', '');
                        adapter.setState('stations.cheapest.e5.status', '');

                        // billigstes E10
                        adapter.setState('stations.cheapest.e10.feed',  0);
                        adapter.setState('stations.cheapest.e10.short', '0');
                        adapter.setState('stations.cheapest.e10.3rd',   0);
                        adapter.setState('stations.cheapest.e10.combined', 'keine Daten');
                        adapter.setState('stations.cheapest.e10.name', '');
                        adapter.setState('stations.cheapest.e10.status', '');

                        // billigster Diesel
                        adapter.setState('stations.cheapest.diesel.feed',  0);
                        adapter.setState('stations.cheapest.diesel.short', '0');// zweistellig
                        adapter.setState('stations.cheapest.diesel.3rd',   0);// dritte stelle
                        adapter.setState('stations.cheapest.diesel.combined', 'keine Daten');
                        adapter.setState('stations.cheapest.diesel.name', '');
                        adapter.setState('stations.cheapest.diesel.status', '');
                    }


                    // alle Stationen durchgehen
                    for (var i = 0; i < 10; i++) {
                        var stationid   = adapter.config.stationsarray[i][0]; // sowas "a7cdd9cf-b467-4aac-8eab-d662f082511e"
                        var stationname = adapter.config.stationsarray[i][1]; // sowas "Esso Hamburg Flughafenstraße"

                        // hier alle States für Status und Preise leeren (0.00 oder 0), falls nicht alle 10 Felder ausgefüllt sind (ohne ack true)
                        if (adapter.config.resetValues) { // Zeile testweise eingefügt
                        adapter.setState('stations.' + i + '.status',      '');
                        adapter.setState('stations.' + i + '.e5.feed',      0);
                        adapter.setState('stations.' + i + '.e5.short',     0);
                        adapter.setState('stations.' + i + '.e5.3rd',       0);
                        adapter.setState('stations.' + i + '.e5.combined', "");
                        adapter.setState('stations.' + i + '.e10.feed',     0);
                        adapter.setState('stations.' + i + '.e10.short',    0);
                        adapter.setState('stations.' + i + '.e10.3rd',      0);
                        adapter.setState('stations.' + i + '.e10.combined', "");
                        adapter.setState('stations.' + i + '.diesel.feed',  0);
                        adapter.setState('stations.' + i + '.diesel.short', 0);
                        adapter.setState('stations.' + i + '.diesel.3rd',   0);
                        adapter.setState('stations.' + i + '.diesel.combined', "");
                        } // Zeile testweise eingefügt
                        if (stationid.length == 36) { // wenn StationID bekannt, also Settings-Feld gefüllt
                            writeLog("Station " + stationid + " " + stationname + " wird bearbeitet ...","debug");
                            var status = result.prices[stationid].status;
                            // Namen und Status in jedem Fall schreiben
                            adapter.setState('stations.' + i + '.name', {ack: true, val: stationname});
                            adapter.setState('stations.' + i + '.status', {ack: true, val: status});
                            // status checken
                            if (status.indexOf("not found") != -1) {
                                writeLog("Station " + stationid + " nicht gefunden","warn");
                                adapter.setState('stations.' + i + '.e5.combined',     '<span class="station_notfound">nicht gefunden</span>');
                                adapter.setState('stations.' + i + '.e10.combined',    '<span class="station_notfound">nicht gefunden</span>');
                                adapter.setState('stations.' + i + '.diesel.combined', '<span class="station_notfound">nicht gefunden</span>');
                            } else if (status.indexOf("closed") != -1) {
                                writeLog("Station " + stationid + " " + stationname +  " geschlossen","debug");
                                adapter.setState('stations.' + i + '.e5.combined',     '<span class="station_closed">geschlossen</span>');
                                adapter.setState('stations.' + i + '.e10.combined',    '<span class="station_closed">geschlossen</span>');
                                adapter.setState('stations.' + i + '.diesel.combined', '<span class="station_closed">geschlossen</span>');

                            } else if (status.indexOf("open") != -1) {

                                // wenn false im Preis für e5 steht, ... 0 bleibt stehen
                                if (!result.prices[stationid].e5) {
                                    writeLog("In Station " + stationid + " " + stationname + " kein E5 vefügbar","debug");
                                } else {
                                    //adapter.log.debug('In Station ' + stationid + ' ' + stationname + ' kostet E5: ' + result.prices[stationid].e5 + '€');
                                    adapter.setState('stations.' + i + '.e5.feed',  {ack: true, val: parseFloat(result.prices[stationid].e5)});
                                    adapter.setState('stations.' + i + '.e5.short', {ack: true, val: cutPrice(result.prices[stationid].e5).priceshort});// zweistellig
                                    adapter.setState('stations.' + i + '.e5.3rd',   {ack: true, val: cutPrice(result.prices[stationid].e5).price3rd});// dritte stelle
                                    adapter.setState('stations.' + i + '.e5.combined', '<span class="station_open">' + cutPrice(result.prices[stationid].e5).priceshort + '<sup style="font-size: 50%">' + cutPrice(result.prices[stationid].e5).price3rd + '</sup> <span class="station_combined_euro">€</span></span>');

                                    // Niedrigsten Preis E5 ermitteln
                                    writeLog("E5-Preis-Feld " +  i + " gefüllt","debug");
                                    if ( parseFloat(result.prices[stationid].e5) < parseFloat(result.prices[cheapest_e5_stationid].e5) ) {
                                        cheapest_e5 = i;
                                        cheapest_e5_stationid = adapter.config.stationsarray[i][0];
                                        writeLog("Billigster E5 bisher: " + cheapest_e5 + ". Tankstelle","debug");
                                    } else writeLog("E5: Station " + i + " teurer als bisher billigste Station " + cheapest_e5, "debug");
                                }

                                if (!result.prices[stationid].e10) {
                                    writeLog("In Station " + stationid + " " + stationname + " kein E10 vefügbar","debug");
                                } else {
                                    //adapter.log.debug('In Station ' + stationid + ' ' + stationname + ' kostet E10: ' + result.prices[stationid].e10 + '€');
                                    adapter.setState('stations.' + i + '.e10.feed', {ack: true, val: parseFloat(result.prices[stationid].e10)});
                                    adapter.setState('stations.' + i + '.e10.short', {ack: true, val: cutPrice(result.prices[stationid].e10).priceshort});
                                    adapter.setState('stations.' + i + '.e10.3rd', {ack: true, val: cutPrice(result.prices[stationid].e10).price3rd});
                                    adapter.setState('stations.' + i + '.e10.combined', '<span class="station_open">' + cutPrice(result.prices[stationid].e10).priceshort + '<sup style="font-size: 50%">' + cutPrice(result.prices[stationid].e10).price3rd + '</sup> <span class="station_combined_euro">€</span></span>');

                                    /// Niedrigsten Preis E10 ermitteln
                                    writeLog("E10-Preis-Feld " +  i + " gefüllt","debug");
                                    if ( parseFloat(result.prices[stationid].e10) < parseFloat(result.prices[cheapest_e10_stationid].e10) ) {
                                        cheapest_e10 = i;
                                        cheapest_e10_stationid = adapter.config.stationsarray[i][0];
                                        writeLog("Billigster E10 bisher: " + cheapest_e10 + ". Tankstelle", "debug");
                                    } else writeLog("E10: Station " + i + " teurer als bisher billigste Station " + cheapest_e10, "debug");
                                }

                                if (!result.prices[stationid].diesel) {
                                    writeLog("In Station " + stationid + " " + stationname + " kein Diesel vefügbar","debug");
                                } else {
                                    //adapter.log.debug('In Station ' + stationid + ' ' + stationname + ' kostet Diesel: ' + result.prices[stationid].diesel + '€');
                                    adapter.setState('stations.' + i + '.diesel.feed', {ack: true, val: parseFloat(result.prices[stationid].diesel)});
                                    adapter.setState('stations.' + i + '.diesel.short', {ack: true, val: cutPrice(result.prices[stationid].diesel).priceshort});
                                    adapter.setState('stations.' + i + '.diesel.3rd', {ack: true, val: cutPrice(result.prices[stationid].diesel).price3rd});
                                    adapter.setState('stations.' + i + '.diesel.combined', '<span class="station_open">' + cutPrice(result.prices[stationid].diesel).priceshort + '<sup style="font-size: 50%">' + cutPrice(result.prices[stationid].diesel).price3rd + '</sup> <span class="station_combined_euro">€</span></span>');

                                    // Niedrigsten Preis Diesel ermitteln
                                    writeLog("Diesel-Preis-Feld " +  i + " gefüllt","debug");
                                    if ( parseFloat(result.prices[stationid].diesel) < parseFloat(result.prices[cheapest_diesel_stationid].diesel) ) {
                                        cheapest_diesel = i;
                                        cheapest_diesel_stationid = adapter.config.stationsarray[i][0];
                                        writLog("Billigster Diesel bisher: " + cheapest_diesel + ". Tankstelle", "debug" );
                                    } else writeLog("Diesel: Station " + i + " teurer als bisher billigste Station " + cheapest_diesel, "debug");
                                }
                            } // Ende Status "open"
                        } // Ende Station
                    } // Ende Schleife

                    // AUSGABE NIEDRIGSTER PREIS
                    // billigstes E5
                    writeLog("Billigster E5: " + cheapest_e5 + ". Tankstelle " + adapter.config.stationsarray[cheapest_e5][1] + ", Preis: " + parseFloat(result.prices[cheapest_e5_stationid].e5), "debug");
                    adapter.setState('stations.cheapest.e5.feed',  {ack: true, val: parseFloat(result.prices[cheapest_e5_stationid].e5)});
                    adapter.setState('stations.cheapest.e5.short', {ack: true, val: cutPrice(result.prices[cheapest_e5_stationid].e5).priceshort});// zweistellig
                    adapter.setState('stations.cheapest.e5.3rd',   {ack: true, val: cutPrice(result.prices[cheapest_e5_stationid].e5).price3rd});// dritte stelle
                    adapter.setState('stations.cheapest.e5.combined', '<span class="station_open">' + cutPrice(result.prices[cheapest_e5_stationid].e5).priceshort + '<sup style="font-size: 50%">' + cutPrice(result.prices[cheapest_e5_stationid].e5).price3rd + '</sup> <span class="station_combined_euro">€</span></span>');
                    adapter.setState('stations.cheapest.e5.name', {ack: true, val: adapter.config.stationsarray[cheapest_e5][1]});
                    adapter.setState('stations.cheapest.e5.status', {ack: true, val: result.prices[cheapest_e5_stationid].status});

                    // billigstes E10
                    writeLog("Billigster E10: " + cheapest_e10 + ". Tankstelle " + adapter.config.stationsarray[cheapest_e10][1] + ", Preis: " + parseFloat(result.prices[cheapest_e10_stationid].e10), "debug");
                    adapter.setState('stations.cheapest.e10.feed',  {ack: true, val: parseFloat(result.prices[cheapest_e10_stationid].e10)});
                    adapter.setState('stations.cheapest.e10.short', {ack: true, val: cutPrice(result.prices[cheapest_e10_stationid].e10).priceshort});// zweistellig
                    adapter.setState('stations.cheapest.e10.3rd',   {ack: true, val: cutPrice(result.prices[cheapest_e10_stationid].e10).price3rd});// dritte stelle
                    adapter.setState('stations.cheapest.e10.combined', '<span class="station_open">' + cutPrice(result.prices[cheapest_e10_stationid].e10).priceshort + '<sup style="font-size: 50%">' + cutPrice(result.prices[cheapest_e10_stationid].e10).price3rd + '</sup> <span class="station_combined_euro">€</span></span>');
                    adapter.setState('stations.cheapest.e10.name', {ack: true, val: adapter.config.stationsarray[cheapest_e10][1]});
                    adapter.setState('stations.cheapest.e10.status', {ack: true, val: result.prices[cheapest_e10_stationid].status});

                    // billigster Diesel
                    writeLog("Billigster Diesel: " + cheapest_diesel + ". Tankstelle " + adapter.config.stationsarray[cheapest_diesel][1] + ", Preis: " + parseFloat(result.prices[cheapest_diesel_stationid].diesel), "debug");
                    adapter.setState('stations.cheapest.diesel.feed',  {ack: true, val: parseFloat(result.prices[cheapest_diesel_stationid].diesel)});
                    adapter.setState('stations.cheapest.diesel.short', {ack: true, val: cutPrice(result.prices[cheapest_diesel_stationid].diesel).priceshort});// zweistellig
                    adapter.setState('stations.cheapest.diesel.3rd',   {ack: true, val: cutPrice(result.prices[cheapest_diesel_stationid].diesel).price3rd});// dritte stelle
                    adapter.setState('stations.cheapest.diesel.combined', '<span class="station_open">' + cutPrice(result.prices[cheapest_diesel_stationid].diesel).priceshort + '<sup style="font-size: 50%">' + cutPrice(result.prices[cheapest_diesel_stationid].diesel).price3rd + '</sup> <span class="station_combined_euro">€</span></span>');
                    adapter.setState('stations.cheapest.diesel.name', {ack: true, val: adapter.config.stationsarray[cheapest_diesel][1]});
                    adapter.setState('stations.cheapest.diesel.status', {ack: true, val: result.prices[cheapest_diesel_stationid].status});
                    // ENDE AUSGABE NIEDRIGSTER PREIS
                    
                    writeLog("objects written", "debug");

                } else {
                    writeLog("JSON returns error - Station ID or API-Key probably not correct", "error");
                }
            } catch (e) {
                writeLog("Spritpreise einlesen (gezielte Stationen via ID) - Parse Fehler: " + e, "error");
            }
        } else writeLog("Spritpreise einlesen (gezielte Stationen via ID) - Fehler: " + error, "error");
    });   // Ende request
    adapter.stop();
}

function buildQuery() { // Abfrage erstellen (max 10 Tankstellen ID)
    /* String muss so aussehenen: "ididididididid","idididididid"
       dabei werden Häkchen und Komma URLencoded dargestellt, also %2C für Komma und %22 für Häkchen
       die folgenden Zeilen fügen die Felder mit den ID der Stationen zusammen, unabhänggig, ob Felder
       freigeblieben sind. Vor dem ersten und nach dem letzten Feld kommt natürlich kein Komma.
    */
    var stations = (adapter.config.station0.length > 0) ? '%22' + adapter.config.station0 + '%22' : '';
    //adapter.log.debug('Stations 1: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station1.length > 0) ? stations + '%2C%22' + adapter.config.station1 + '%22' : stations;
    else stations = (adapter.config.station1.length > 0) ? stations + '%22' + adapter.config.station1 + '%22' : stations;
    //adapter.log.debug('Stations 2: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station2.length > 0) ? stations + '%2C%22' + adapter.config.station2 + '%22' : stations;
    else stations = (adapter.config.station2.length > 0) ? stations + '%22' + adapter.config.station2 + '%22' : stations;
    //adapter.log.debug('Stations 3: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station3.length > 0) ? stations + '%2C%22' + adapter.config.station3 + '%22' : stations;
    else stations = (adapter.config.station3.length > 0) ? stations + '%22' + adapter.config.station3 + '%22' : stations;
    //adapter.log.debug('Stations 4: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station4.length > 0) ? stations + '%2C%22' + adapter.config.station4 + '%22' : stations;
    else stations = (adapter.config.station4.length > 0) ? stations + '%22' + adapter.config.station4 + '%22' : stations;
    //adapter.log.debug('Stations 5: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station5.length > 0) ? stations + '%2C%22' + adapter.config.station5 + '%22' : stations;
    else stations = (adapter.config.station5.length > 0) ? stations + '%22' + adapter.config.station5 + '%22' : stations;
    //adapter.log.debug('Stations 6: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station6.length > 0) ? stations + '%2C%22' + adapter.config.station6 + '%22' : stations;
    else stations = (adapter.config.station6.length > 0) ? stations + '%22' + adapter.config.station6 + '%22' : stations;
    //adapter.log.debug('Stations 7: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station7.length > 0) ? stations + '%2C%22' + adapter.config.station7 + '%22' : stations;
    else stations = (adapter.config.station7.length > 0) ? stations + '%22' + adapter.config.station7 + '%22' : stations;
    //adapter.log.debug('Stations 8: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station8.length > 0) ? stations + '%2C%22' + adapter.config.station8 + '%22' : stations;
    else stations = (adapter.config.station8.length > 0) ? stations + '%22' + adapter.config.station8 + '%22' : stations;
    //adapter.log.debug('Stations 9: ' + stations);
    if (stations.length > 0) stations = (adapter.config.station9.length > 0) ? stations + '%2C%22' + adapter.config.station9 + '%22' : stations;
    else stations = (adapter.config.station9.length > 0) ? stations + '%22' + adapter.config.station9 + '%22' : stations;
    //adapter.log.debug('Stations 10: ' + stations);

    // String in URL einbetten (in eckigen Klammern) und mit APIKey
    var url = 'https://creativecommons.tankerkoenig.de/json/prices.php?ids=%5B' + stations + '%5D&apikey=' + adapter.config.apikey;
    readData(url);
}

function readSettings() {
    //APIKEY
    writeLog("Option <reset values> is " + adapter.config.resetValues, "debug");
    writeLog("API Key Länge: " + (adapter.config.apikey?adapter.config.apikey.length:0) + " Zeichen", "debug");
    if (adapter.config.apikey === undefined) {
        writeLog("No API-Key found.","error");
        return; // abbruch
    } else if (adapter.config.apikey.length < 36) {
        writeLog("API-Key too short, should be 36 digits.", "error");
        return; // abbruch
    } else if (adapter.config.apikey.length > 36) {
        writeLog("API-Key too long, should be 36 digits.", "error");
        return; // abbruch
    } else {
        buildQuery();
    }
    // noLog
    optinNoLog = adapter.config.noLogs; // wichtig für function writeLog()
}

function main() {
    readSettings();
    setTimeout(function () {
        writeLog("force terminating adapter after 1 minute", "debug");
        adapter.stop();
    }, 60000);
}
