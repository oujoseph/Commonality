var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var path = require('path');
var haversine = require('haversine')



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


app.post('/addrToBackend/', function(req, res){
    
    var search = req.body.search;
    var distanceOptions = req.body.distanceOptions;
    var addr1 = req.body.data.addr1;
    var addr2 = req.body.data.addr2;
    var data = req.body.data;
    var addr = [addr1, addr2];

    console.log([search,distanceOptions,data]);

    //rezero the table when new addresses are found
    global.searchResponse = [];
    //rezero the number of addresses being counted
    runSearchCount = 0;
        
//        parseCoord(addr);
    res.end();
    
});

app.post('/addrToFrontend/', function(req, res){
    res.type('text/plain');
    res.json(JSON.stringify(global.searchResponse));
    res.end();
    console.log("Posting to frontend");
//    console.log(JSON.stringify(global.searchResponse));
});

//AWS Elastic Beanstalk defaults to port 8081 when using node.js
app.listen(8081, function () {
    console.log('running index.html');
})

var googleMapsClient = require('@google/maps').createClient({
  key: 'AIzaSyBobCvR6fD_t4KwHfSL-EjprfmuYk5QJrw'
});


//this function gets distances of each element from 
function runSort(){
    console.log("in runsort()");
    var distancedResponse = [];
    
    //uses Haversine formula by niix to calculate distance from each input address to each google address
//    haversine(start, end, {unit: 'mile'});
        var addr1 = {
            latitude: global.coordinateAddress[0][0],
            longitude: global.coordinateAddress[0][1]
        }
        var addr2 = {
            latitude: global.coordinateAddress[1][0],
            longitude: global.coordinateAddress[1][1]
        }
        
    for(var i = 0; i < global.searchResponse.length; i++){
        var addr = {
            latitude: global.searchResponse[i].coordinates.lat,
            longitude: global.searchResponse[i].coordinates.lng
        }
        
        //get total distance
        var distance = haversine(addr1, addr, {unit: 'mile'});
        var distance2 = haversine(addr2, addr, {unit: 'mile'});
        //omit selections with distances farther than 10miles
        var combinedDistance = distance + distance2;
        if (distance <= 10.0 || distance2 <= 10.0){
            distancedResponse.push({
                name: global.searchResponse[i].name,
                address: global.searchResponse[i].address,
                distance: combinedDistance
            });
        }
    }
    
    console.log("Performing sorting by distance");
    //set searchResponse to be distancedResponse
    global.searchResponse = distancedResponse;
    
    global.searchResponse.sort(function(a,b){
        if (a.distance < b.distance)return -1;
        if (a.distance > b.distance)return 1;
    });
    console.log("All Operations Complete.");
}


function pushResponseToArray(results){
    for(var i = 0; i< results.length; i++){
        var elementName = results[i].name;
        var textAddress = results[i].vicinity;
        var geoAddress = results[i].geometry.location;
        global.searchResponse.push({name: elementName, address: textAddress, coordinates: geoAddress});
    }
}


//This function is not needed. It prunes out locations that are not 
function removeNonDupes(){
    var prunedResponse = [];
    
    
    //sort the two concatenated arrays
    global.searchResponse.sort(function(a,b){
        if (a.name < b.name)return -1;
        if (a.name > b.name)return 1;
    });
    
    for (var i = 1; i < global.searchResponse.length; i++){
        //each pair is now together, so compare curr to curr-1. if the same, push to new array
        if (global.searchResponse[i].address != global.searchResponse[i-1].address){
            if (global.searchResponse[i].name != global.searchResponse[i-1].name){
                prunedResponse.push(global.searchResponse[i]);
            }
        }
    }

    global.searchResponse = prunedResponse;
    
    //calls runSort(), which sorts by distance and returns the final data we want
    runSort();
}

//checks for when the search has been completed, and then runs removeNonDupes();
function checkAndExecuteSort(){
    runSearchCount++;
    console.log("in checkandexecutesort");
    if (runSearchCount > 1){
        runSearchCount = 0;
        removeNonDupes();
    }
}

//google places api allows up to 60 results to be returned, with 20 results per page
//this function gets the other 40 results.
//also will work fine if google ever decides to be generous and give more than 60 results.
function recurseSearch(addr, ptoken){
    console.log("in recurseSearch");
    googleMapsClient.placesNearby(
        {   //16093.4m == 10.000mi
            location: addr,
            radius: 16093.4,
            keyword: 'real_estate_agency',
            pagetoken: ptoken
        },
        function(err, response) {
            console.log("in gmaps client function");
            if (!err) {
                pushResponseToArray(response.json.results);
                if (response.json.next_page_token != null){
                    //must wait for google's servers to update its pagetokens
                    //2 sec appears to be the threshold. 1.5sec wait results in inconsistent
                    //results
                    setTimeout(function(){recurseSearch(addr, response.json.next_page_token);}, 2000);
                }else {
                    checkAndExecuteSort();
                }
                
            } else checkAndExecuteSort();
        }
    )
}

//runs google maps api's geocode function to grab the coordinates
function runSearch(addr){
    //note: depending on keyword, the returned results may change slightly.
    //also, due to the 60 result limit, if more than 60 hits exist
    //possible candidates on the list will be truncated and the end result
    //may differ because of this.
    
    //realtor and realty may provide differing results.
    //as the requested requirement in the assignment prompt was "real estate agency"
    //the only keyword will thus be google's official keyword, "real_estate_agency"
    googleMapsClient.placesNearby(
        {
            location: addr,
            radius: 16093.4,
            keyword: 'real_estate_agency'
            //rankby: 'distance' should theoretically get better results, but some testing reveals
            //using radius instead appears to give many more valid hits
        },
        function(err, response) {
            if (!err) {
                console.log("in runSearch");
                pushResponseToArray(response.json.results);
                if (response.json.next_page_token != null){
                    console.log("starting recursesearch");
                    //must wait for google's servers to update its pagetokens
                    //2 sec appears to be the threshold. 1.5sec wait results in inconsistent
                    //results
                    setTimeout(function(){recurseSearch(addr, response.json.next_page_token);}, 2000);
                }else {
                    checkAndExecuteSort();
                }
                
            } else return;
        }
    )
}

function parseCoord(addr){
    
    console.log("passing in data: " + addr);
    // Geocode the two addresses.
    googleMapsClient.geocode(
        {
        address: addr[0]
        }, function(err, response) {
        if (!err) {
            var addr1coordTemp = response.json.results[0].geometry.location;
            var addr1coord = [addr1coordTemp.lat, addr1coordTemp.lng];
            console.log("processing addr1 coordinates");
            global.coordinateAddress[0] = addr1coord;
//            console.log(addr1coord);
            
            //nesting placesNearby inside geocode to effectively render this
            //to run sequentially as opposed to asynchronously.
            //this is done to guarantee placesNearby has the geocode
            //it needs-- else, addr1Coord may be undefined at run time
            runSearch(addr1coord);
        } else return;
    });
    
    googleMapsClient.geocode(
        {
        address: addr[1]
        }, function(err, response) {
        if (!err) {
            var addr2coordTemp = response.json.results[0].geometry.location;
            addr2coord = [addr2coordTemp.lat, addr2coordTemp.lng];
            console.log("processing addr2 coordinates");
            global.coordinateAddress[1] = addr2coord;
//            console.log(addr2coord);
            
            runSearch(addr2coord);
        } else return;
    });
}