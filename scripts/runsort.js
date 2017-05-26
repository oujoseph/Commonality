//this function gets distances of each element from each address
function runSort(){
    console.log("in runsort()");
    var distancedResponse = [];

    // for(var i = 0; i < global.coordinateAddress.length; i++){
        console.log(global.coordinateAddress.length);
        console.log(global.coordinateAddress);
    // }






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
        // console.log(distancedResponse);
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