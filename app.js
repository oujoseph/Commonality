var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var path = require('path');
var haversine = require('haversine');
var WebSocket = require('ws');

//stores a list of all clients' unique ids, linked to ws instance
var CLIENTS={};
var clientCount = 0;

const wss = new WebSocket.Server({
    perMessageDeflate: false,
    port: 9000
});

//AWS Elastic Beanstalk defaults to port 8081 when using node.js
app.listen(8081, function () {
    console.log('running index.html');
})

app.use(express.static(__dirname + '/public'));

wss.on('connection', function connection(ws) {
    console.log("New client connected");
    ws.id = clientCount++;
    //index 1 of every element in CLIENTS contains data
    CLIENTS[ws.id] = [ws, "", ""];
    // index 1 is address, index 2 is data
    
    console.log("CLIENTS[ws.id] added: " + CLIENTS[ws.id]);
    
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
        
        var msgData = JSON.parse(message);
        var search = msgData.search;
        var distanceOptions = parseFloat(msgData.distanceOptions);
        var data = JSON.parse(msgData.data.addr);

        console.log([search,distanceOptions,data]);

        //rezero the table when new addresses are found
//        CLIENTS[uID][2] = [];
        CLIENTS[ws.id][2] = [];
        CLIENTS[ws.id][1] = [];
        //rezero the number of addresses being counted
        runSearchCount = 0;

        parseCoord(data,search,distanceOptions,ws.id);
    });
});

wss.on('close', function close() {
    console.log('a client has disconnected');
    delete CLIENTS[ws.id];
});

//bodyparser parses our json file for post and get
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
    
});

runSearchCount = 0;
searchResponse = [];

coordinateAddress = [];


var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyBwQXLLkxWCyoOUfwMRVkfsk6lECoFmNFk'
});


////this function gets distances of each element from each address
//function runSort(uID){
//    console.log("in runsort()");
//    var distancedResponse = [];
//
//    // for(var i = 0; i < CLIENTS[uID][1].length; i++){
//        console.log(CLIENTS[uID][1].length);
//        console.log(CLIENTS[uID][1]);
//    // }
//
//
//
//
//
//
//    //uses Haversine formula by niix to calculate distance from each input address to each google address
////    haversine(start, end, {unit: 'mile'});
//    var addr1 = {
//        latitude: CLIENTS[uID][1][0][0],
//        longitude: CLIENTS[uID][1][0][1]
//    }
//    var addr2 = {
//        latitude: CLIENTS[uID][1][1][0],
//        longitude: CLIENTS[uID][1][1][1]
//    }
//        
//    for(var i = 0; i < CLIENTS[uID][2].length; i++){
//        var addr = {
//            latitude: CLIENTS[uID][2][i].coordinates.lat,
//            longitude: CLIENTS[uID][2][i].coordinates.lng
//        }
//        
//        //get total distance
//        var distance = haversine(addr1, addr, {unit: 'mile'});
//        var distance2 = haversine(addr2, addr, {unit: 'mile'});
//        //omit selections with distances farther than 10miles
//        var combinedDistance = distance + distance2;
//        if (distance <= 10.0 || distance2 <= 10.0){
//            distancedResponse.push({
//                name: CLIENTS[uID][2][i].name,
//                address: CLIENTS[uID][2][i].address,
//                distance: combinedDistance
//            });
//        }
//        // console.log(distancedResponse);
//    }
//    
//    console.log("Performing sorting by distance");
//    //set searchResponse to be distancedResponse
//    CLIENTS[uID][2] = distancedResponse;
//    
//    CLIENTS[uID][2].sort(function(a,b){
//        if (a.distance < b.distance)return -1;
//        if (a.distance > b.distance)return 1;
//    });
//    console.log("All Operations Complete.");
//}

function pushResponseToArray(results, uID){
    console.log("in pushResponseToArray");
    for(var i = 0; i < results.length; i++){
        var elementName = results[i].name;
        var textAddress = results[i].vicinity;
        var geoAddress = results[i].geometry.location;
        var placeData = results[i].placeID;
        var rating = results[i].rating;
        var price = results[i].price_level;
        CLIENTS[uID][2].push({name: elementName, address: textAddress, coordinates: geoAddress,
             placeID: placeData, rating: rating, price: price});
    }
    console.log("pushed data");
}

function removeNonDupes(uID){
    console.log("removing all dupes");
    var prunedResponse = [];
    
    
    //sort the two concatenated arrays
    CLIENTS[uID][2].sort(function(a,b){
        if (a.name < b.name)return -1;
        if (a.name > b.name)return 1;
    });
    
    for (var i = 1; i < CLIENTS[uID][2].length; i++){
        //each pair is now together, so compare curr to curr-1. if the same, push to new array
        if (CLIENTS[uID][2][i].address != CLIENTS[uID][2][i-1].address){
            if (CLIENTS[uID][2][i].name != CLIENTS[uID][2][i-1].name){
                prunedResponse.push(CLIENTS[uID][2][i]);
            }
        }
    }

    CLIENTS[uID][2] = prunedResponse;
    console.log("removed all dupes");
    for(var i = 0; i < CLIENTS[uID][2].length; i++){
        console.log(CLIENTS[uID][2][i].name);
    }
    
    console.log("sending pruned data to client");
    CLIENTS[uID][0].send(JSON.stringify([CLIENTS[uID][2], CLIENTS[uID][1]]));
}

//checks for when the search has been completed, and then runs removeNonDupes();
function checkAndExecuteSort(addrCount, uID){
    runSearchCount++;
    console.log("in checkandexecutesort");
    if (runSearchCount == addrCount){
        runSearchCount = 0;
        console.log("final iteration, running removeNonDupes");
        removeNonDupes(uID);
    }
}

//runs google maps api's geocode function to grab the coordinates
function runSearch(addr, search, distanceOptions, addrCount, uID){
    //note: depending on keyword, the returned results may change slightly.
    //also, due to the 60 result limit, if more than 60 hits exist
    //possible candidates on the list will be truncated and the end result
    //may differ because of this.
    console.log("in runSearch()");

    googleMapsClient.placesNearby(
        {
            location: addr,
            radius: distanceOptions,
            keyword: search
            //rankby: 'distance' should theoretically get better results, but some testing reveals
            //using radius instead appears to give many more valid hits
        },
        function(err, response) {
            if (!err) {
                console.log("success in retrieving data from googlemapsclient");
                
                pushResponseToArray(response.json.results, uID);
                if (response.json.next_page_token != null){
                    // console.log("starting recursesearch");
                    //must wait for google's servers to update its pagetokens
                    //2 sec appears to be the threshold. 1.5sec wait results in inconsistent
                    //results
                    setTimeout(function(){runSearch2(addr, search, distanceOptions, addrCount, uID, response.json.next_page_token);}, 2000);
                }
            }
        }
    )
}

function runSearch2(addr, search, distanceOptions, addrCount, uID, ptoken){
    console.log("in runSearch2()");

    googleMapsClient.placesNearby(
        {
            location: addr,
            radius: distanceOptions,
            keyword: search,
            pagetoken: ptoken
        },
        function(err, response) {
            if (!err) {
                console.log("success in retrieving data from googlemapsclient");
                
                pushResponseToArray(response.json.results, uID);
                if (response.json.next_page_token != null){
                    setTimeout(function(){runSearch3(addr, search, distanceOptions, addrCount, uID, response.json.next_page_token);}, 2000);
                }
                
            }
        }
    )
}

function runSearch3(addr, search, distanceOptions, addrCount, uID, ptoken){
    console.log("in runSearch3()");

    googleMapsClient.placesNearby(
        {
            location: addr,
            radius: distanceOptions,
            keyword: search,
            pagetoken: ptoken
        },
        function(err, response) {
            if (!err) {
                console.log("success in retrieving data from googlemapsclient");
                
                pushResponseToArray(response.json.results, uID);
                checkAndExecuteSort(addrCount, uID);
                
            }
            
        }
    )
}

function parseCoord(data, search, distanceOptions, uID){
    
    console.log("passing in data: " + data);
    // Geocode the two addresses.
    for (var i = 0; i < data.length; i++){
        console.log("data.length =" + data.length);
        googleMapsClient.geocode(
            {
            address: data[i]
            }, function(err, response) {
            if (!err) {
                var addrCoordTemp = response.json.results[0].geometry.location;
                // console.log("processing addr coordinates");
                var addrCoord = [addrCoordTemp.lat, addrCoordTemp.lng];
                CLIENTS[uID][1].push(addrCoord);
                //nesting placesNearby inside geocode to effectively render this
                //to run sequentially as opposed to asynchronously.
                //this is done to guarantee placesNearby has the geocode
                //it needs-- else, addr1Coord may be undefined at run time


                runSearch(addrCoord, search, distanceOptions, data.length, uID);
            } else console.log("FAILURE to retrieve google maps data in parseCoord()");
        });
    }
}

//google places api allows up to 60 results to be returned, with 20 results per page
//this function gets the other 40 results.
//also will work fine if google ever decides to be generous and give more than 60 results.
// function recurseSearch(addr, ptoken){
//     console.log("in recurseSearch");
//     googleMapsClient.placesNearby(
//         {   //16093.4m == 10.000mi
//             location: addr,
//             radius: 16093.4,
//             keyword: 'real_estate_agency',
//             pagetoken: ptoken
//         },
//         function(err, response) {
//             console.log("in gmaps client function");
//             if (!err) {
//                 pushResponseToArray(response.json.results);
//                 if (response.json.next_page_token != null){
//                     //must wait for google's servers to update its pagetokens
//                     //2 sec appears to be the threshold. 1.5sec wait results in inconsistent
//                     //results
//                     setTimeout(function(){recurseSearch(addr, response.json.next_page_token);}, 2000);
//                 }else {
//                     checkAndExecuteSort();
//                 }
                
//             } else checkAndExecuteSort();
//         }
//     )
// }