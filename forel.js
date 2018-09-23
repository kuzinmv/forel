const csv = require('csvtojson');

const csvFilePath = process.argv[2];
const radius = parseFloat(process.argv[3]);
const lambda = process.argv[4];

let totalClusteredMarks = 0;
let distMatrix = new Array();
let tauMatrix = new Array();
let vectorFields ;

const metric = function(i,j){
    return lambda
        ? distMatrix[i][j]*tauMatrix[i][j]*tauMatrix[i][j]
        : distMatrix[i][j];
};

const euclidianDist = function(a1, a2){
    let res = 0;
    var len = vectorFields.length;
    var delta = 0;
    while (len--) {
        delta = (a1[vectorFields[len]] - a2[vectorFields[len]]);
        res += delta * delta;
    }
    return Math.sqrt(res);
};

const clearClusteredMarks = function(dataSet){
    var len = dataSet.length;
    while (len--) {
        dataSet[len].clustered = false;
        dataSet[len].cluster = -1;
    }
    totalClusteredMarks = 0;
};

const prepareData = function(dataSet){
    var len = dataSet.length;
    while (len--) {
        for (let i = 1 ; i <= 127 ; i++) {
            dataSet[len]['stat' + i] = parseFloat('0' + dataSet[len]['stat' + i].replace(',','.'));
        }
    }
};

const calcDistMatrix = function(dataSet){
    var j = 0;
    var i = 0;
    var row;
    while (j < dataSet.length) {
        i = 0;
        row = new Array(dataSet.length);
        while (i < dataSet.length) {
            row[i] = euclidianDist(dataSet[i],dataSet[j]);
            i++;
        }
        distMatrix.push(row);
        j++
    }
};

const calcMinBeta = function(N, a, b){
    let min = 1000000;
    var i = N;
    while (i--) {
        if (!(i == a || i == b)) {
            const d1 = distMatrix[a][i];
            const d2 = distMatrix[b][i];
            if (d1 < min) { min = d1;}
            if (d2 < min) { min = d2;}
        }
    }
    return min;
};

const calcTauMatrix = function(N){
    var j = 0;
    let tau = 0;
    let max = 0;
    while (j < N) {
        var i = 0;
        const row = new Array(N);
        while (i < N) {
            if (i == j) {
                tau = 0;
            } else {
                tau = distMatrix[i][j]/calcMinBeta(N, i, j);
            }
            if (tau > max) {max = tau};
            row[i] = tau;
            i++;
        }
        tauMatrix.push(row);
        j++
    }

    j = 0;
    while (j < N) {
        var i = 0;
        while (i < N) {
            tauMatrix[i][j] = tauMatrix[i][j]/max;
            i++;
        }
        j++
    }

};

const diameter = function(N){
    var j = N;
    var i = N;
    let max = 0;
    let d = 0;
    while (j--) {
        i = N;
        while (i--) {
            if (j > i) {
                d = metric(i,j);
                if (d > max) {
                    max = d;
                }
            }
        }
    }
    return max;
};

const nextPoint1 = function(dataSet){
    var j = 0;
    while (j<dataSet.length ) {
        if (!dataSet[j].clustered) {
            return j;
        }
        j++;
    }
};

const nextPoint2 = function(dataSet){
    var j = dataSet.length;
    while (j--) {
        if (!dataSet[j].clustered) {
            return j;
        }
    }
};

const nextPoint = function(dataSet, firstIteration, N){
  if (firstIteration) {
      return 9;
  }
  return nextPoint1(dataSet);
};

const nearPoints = function(dataSet, inx, rr){
    var res = [];
    var i = dataSet.length;
    while (i--) {
        if (metric(inx,i) <= rr && !dataSet[i].clustered ) {
            res.push(i);
        }
    }
    return res;
};

const centerPoint = function(pts) {
    var j = pts.length;
    let min = 1000000;
    let inx = -1;
    while (j--) {
        let i = pts.length;
        let sum = 0;
        while (i--) {
            sum += metric(pts[j],pts[i]);
        }
        if (sum < min){
            min = sum;
            inx = j;
        }
    }
    return pts[inx];
};

const clusterWeight = function(dataSet, centerPoint, cluster){
    let res1 = 0;
    var len = cluster.length;
    while (len--) {
        res1 += metric(centerPoint,cluster[len]);
    }
    return res1;
};

const markAsClustered = function(dataSet, pts, cluster){
    var j = pts.length;
    while (j--) {
        dataSet[pts[j]].clustered = true;
        dataSet[pts[j]].cluster = cluster;
    }
    totalClusteredMarks+=pts.length;
};

const printCluster = function(dataSet){
    var j = 0;
    while (j < dataSet.length ) {
        console.log((dataSet[j].player+','+dataSet[j].cluster+','+dataSet[j].stat1+','+dataSet[j].stat97));
        j++;
    }
};

const mostValuableProp = function(dataSet, pts){
    var j = pts.length;
    var len = vectorFields.length;
    var res = new Array(len).fill(0);
    var sum = new Array(len).fill(0);
    var result = [];

    while (j--) {
        len = vectorFields.length;
        while (len--) {
            sum[len] += dataSet[pts[j]][vectorFields[len]]
        }
    }
    len = vectorFields.length;
    while (len--) {
        sum[len] = sum[len]/pts.length;
    }

    j = pts.length;
    while (j--) {
        len = vectorFields.length;
        while (len--) {
            res[len] += Math.pow(sum[len] - dataSet[pts[j]][vectorFields[len]],2);
        }
    }
    len = vectorFields.length;
    let max = 0;
    while (len--) {
        res[len] = res[len]/pts.length;
        if (res[len] > max) {max = res[len]}
    }
    len = vectorFields.length;
    while (len--) {
        if (res[len] > 0) {
            result.push({
                name: vectorFields[len],
                value: Math.log10(1 / res[len]/max)
            });
        }
    }

    return result.sort((a,b) => (a.value < b.value) ? 1 : ((b.value < a.value) ? -1 : 0)).slice(0,20) ;
};


const forel = function(dataSet, radius, printStats){
    const N = dataSet.length;
    let cluster = 0;
    let weight  = 0;

    clearClusteredMarks(dataSet);
    while (totalClusteredMarks < N) {
        let currentlyPointIndex  = nextPoint(dataSet, cluster==0, N);
        let nearPointsIndexArray = nearPoints(dataSet, currentlyPointIndex, radius);
        let centerPointInx       = centerPoint(nearPointsIndexArray);
        while(centerPointInx != currentlyPointIndex && nearPointsIndexArray.length > 0) {
            currentlyPointIndex  = centerPointInx;
            nearPointsIndexArray = nearPoints(dataSet, currentlyPointIndex, radius);
            centerPointInx       = centerPoint(nearPointsIndexArray);
        }
        cluster++;
        markAsClustered(dataSet, nearPointsIndexArray, cluster);
        if (nearPointsIndexArray.length > 1 && printStats) {
            console.log('cluster:'+cluster, 'points:', nearPointsIndexArray.length);
            console.log('most valuable stats ', mostValuableProp(dataSet, nearPointsIndexArray));
        }

        weight += clusterWeight(dataSet, centerPointInx, nearPointsIndexArray);
    }
    return {cluster, weight};
};


csv().fromFile(csvFilePath).then((dataSet) => {

    const N = dataSet.length;
    prepareData(dataSet);
    //vectorFields = Object.keys(dataSet[0]).filter(value => value.substr(0, 4) == 'stat' && value !== 'stat54');
    vectorFields = Object.keys(dataSet[0]).filter(value => value == 'stat1' || value == 'stat97');

    clearClusteredMarks(dataSet);
    calcDistMatrix(dataSet);
    calcTauMatrix(N);

    const D = diameter(N);
    let totalWeight = lambda ? 13.1 : 0.05254811617086335;
    let radiusRate = lambda ? 1000 : 10000;

    if (csvFilePath == 'player_stats_3.csv') {
        totalWeight = lambda ? 1.9 : 21;
        radiusRate = lambda ? 400 : 100;
    }

    if (radius < 0) {
        for (let i= 1; i<100; i++) {
            const rr = (i/radiusRate)*(D);
            const result = forel(dataSet, rr, false);
            const objectiveFunctionValue = result.cluster/(N + 1) + result.weight/totalWeight;

            const string = i +';'+rr+';'+result.cluster+';'+result.weight+';'+objectiveFunctionValue;
            console.log(string.split('.').join(','));
        }
    } else {
        console.log('--------------- stats ---------------------');
        const result = forel(dataSet, radius, true);
        console.log('--------------- result --------------------');
        printCluster(dataSet);
    }

});



