const csv = require('csvtojson');

const csvFilePath = process.argv[2];
const radius = parseFloat(process.argv[3]);
const lambda = process.argv[4];

let totalClusteredMarks = 0;
let distMatrix = new Array();
let tauMatrix = new Array();
let vectorFields ;

/**
 * Функция для рассчета метрики
 * @param {number} i номер 1го элемента множества
 * @param {number} j номер 2го элемента множества
 * @returns {number}
 */
const metric = function(i,j){
    const d = distMatrix[i][j];
    const t = tauMatrix[i][j];
    return lambda ? d*t*t : d;
};

/**
 * Функция рассчета Евклидова расстояния
 * @param {array.<number>} a1
 * @param {array.<number>} a2
 * @returns {number}
 */
const euclidianDist = function(a1, a2){
    let res = 0;
    let len = vectorFields.length;
    let delta = 0;
    while (len--) {
        delta = (a1[vectorFields[len]] - a2[vectorFields[len]]);
        res += delta * delta;
    }
    return Math.sqrt(res);
};


/**
 * Функция для очистки признаков - кластеризован или нет объект в выборке и сброс номера кластера,
 * сбрасывает глобальную переменную количества кластеризованных объектов
 *
 * @param dataSet {array.<vector>}
 */
const clearClusteredMarks = function(dataSet){
    let len = dataSet.length;
    while (len--) {
        dataSet[len].clustered = false;
        dataSet[len].cluster = -1;
    }
    totalClusteredMarks = 0;
};


/**
 * Подготовка и очистка входных данных, превращаем строчки во float, пустые значения устанавливаем в 0
 * @param dataSet
 */
const prepareData = function(dataSet){
    let len = dataSet.length;
    while (len--) {
        for (let i = 1 ; i <= 127 ; i++) {
            dataSet[len]['stat' + i] = parseFloat('0' + dataSet[len]['stat' + i].replace(',','.'));
        }
    }
};

/**
 *  Функция рассчета матрицы расстояний м/у всеми точками выборки
 * @param dataSet
 */
const calcDistMatrix = function(dataSet){
    let j = 0;
    let i = 0;
    let row;
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

/**
 * Функция поиска длинны минимального смежного ребра к данному
 * @param {number} N - размер выборки
 * @param {number} a - первая точка ребра
 * @param {number} b - вторая точка ребра
 * @returns {number} - длинна самого короткого смежного ребра
 */
const calcMinBeta = function(N, a, b){
    let min = 1000000;
    let i = N;
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

/**
 *  Функция рассчета матрицы нормированной локальной плотности для каждой пары элементов выборки
 * @param N
 */
const calcTauMatrix = function(N){
    let j = 0;
    let tau = 0;
    let max = 0;
    let i = 0;
    while (j < N) {
        i = 0;
        const row = new Array(N);
        while (i < N) {
            tau  = (i == j) ? 0 : distMatrix[i][j]/calcMinBeta(N, i, j);
            if (tau > max) {
                max = tau
            }
            row[i] = tau;
            i++;
        }
        tauMatrix.push(row);
        j++
    }

    j = N;
    while (j--) {
        i = N;
        while (i--) {
            tauMatrix[i][j] /= max;
        }
    }

};

/**
 * Функция рассчета диаметра для набора данных. Максимум по матрице расстояний
 * @param N
 * @returns {number}
 */
const diameter = function(N){
    let j = N;
    let i = N;
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

/**
 * Ищщем следующую не клстеризованную точку начиная с начала выборки
 * @param dataSet
 * @returns {number}
 */
const nextPoint1 = function(dataSet){
    let j = 0;
    while (j<dataSet.length ) {
        if (!dataSet[j].clustered) {
            return j;
        }
        j++;
    }
};

/**
 * Ищщем следующую не клстеризованную точку начиная с конца выборки
 * @param dataSet
 * @returns {*}
 */
const nextPoint2 = function(dataSet){
    let j = dataSet.length;
    while (j--) {
        if (!dataSet[j].clustered) {
            return j;
        }
    }
};

/**
 * Функция выбора следующей некластеризованной точки
 * @param dataSet
 * @param firstIteration
 * @param N
 * @returns {number}
 */
const nextPoint = function(dataSet, firstIteration, N){
  if (firstIteration) {
      // Перваую да и все последующие точки рекомендовано выбирать случайным образом,
      // зафиксировал чтобы совпадали результаты, хотя они достаточно близкими были и при случайном выборе
      return 9;
  }
  return nextPoint1(dataSet);
  // тут так же зафиксировал только с начала поиск, убрал случайный выбор направления 1 или  2 поиска некластеризованной точки
};

/**
 * Функция возвращает массив индексов точек из выборки, которые поппадают внутрь сферы
 * с цетнром в точке с индексом inx и радиусом rr
 * @param dataSet Выборка
 * @param inx     Индекс точки - центра
 * @param rr      значение радиуса
 * @returns {Array}
 */
const nearPoints = function(dataSet, inx, rr){
    let res = [];
    let i = dataSet.length;
    while (i--) {
        if (metric(inx,i) <= rr && !dataSet[i].clustered ) {
            res.push(i);
        }
    }
    return res;
};

/**
 * Функция поиска центральной точки кластера, центральной считается та точка,
 * сумма расстояний до которой от всех точек кластера будет минимальным
 * @param pts  {array} - массив индексов точек выборки, которые считаются кластером,
 *                       из которых и нужно найти центральную точку
 * @returns {number} Индекс точки из выборки
 */
const centerPoint = function(pts) {
    let j = pts.length;
    let min = 1000000;
    let inx = -1;
    let sum = 0;
    while (j--) {
        sum = clusterWeight(pts[j],pts);
        if (sum < min){
            min = sum;
            inx = j;
        }
    }
    return pts[inx];
};

/**
 *  Функция расчета "веса" кластера = суммы всех расстояний от всех элементов до центра
 * @param centerPoint
 * @param cluster
 * @returns {number}
 */
const clusterWeight = function(centerPoint, cluster){
    let res1 = 0;
    let len = cluster.length;
    while (len--) {
        res1 += metric(centerPoint, cluster[len]);
    }
    return res1;
};


/**
 * Помещаем указанные точки в нужный кластер, устанавливаем признак кластеризации и добавляем
 * к глобальной переменной количество кластеризованных точек
 * @param dataSet
 * @param pts {array.<number>} масив индексов выборки
 * @param cluster {number} номер кластера
 */
const markAsClustered = function(dataSet, pts, cluster){
    let j = pts.length;
    while (j--) {
        dataSet[pts[j]].clustered = true;
        dataSet[pts[j]].cluster = cluster;
    }
    totalClusteredMarks+=pts.length;
};


/**
 * Отправляем в стдаут игрока ; номер кластера
 * @param dataSet
 */
const printCluster = function(dataSet){
    let j = 0;
    while (j < dataSet.length ) {
        console.log(dataSet[j].player + ';' + dataSet[j].cluster);
        j++;
    }
};

/**
 * Функция рассчета веса признака кластера. Наиболее плотно кучкующиеся (ско -> min) значения по каждому признаку.
 * Минимальные значения ско для данного признака являются более весомыми при определении растояния до центра
 * @param dataSet -  выборка
 * @param pts {Array.<number>} - массив индексов элементов кластера из выборки  dataSet
 * @returns {Array.<T>}
 */
const mostValuableProp = function(dataSet, pts){
    let j = pts.length;
    let len = vectorFields.length;
    let res = new Array(len).fill(0);
    let sum = new Array(len).fill(0);
    let result = [];

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

    //Нашли вектор средних значений

    j = pts.length;
    while (j--) {
        len = vectorFields.length;
        while (len--) {
            res[len] += Math.pow(sum[len] - dataSet[pts[j]][vectorFields[len]],2);
        }
    }
    //Нашли вектор сумм квадратов разностей

    len = vectorFields.length;
    let max = 0;
    while (len--) {
        res[len] = res[len]/pts.length;
        if (res[len] > max) {max = res[len]}
    }
    // Нашли норму

    len = vectorFields.length;
    while (len--) {
        if (res[len] > 0) {
            result.push({
                name: vectorFields[len],
                value: Math.log10(1 / res[len] / max)
            });
        }
    }

    return result
            .sort((a,b) => (a.value < b.value) ? 1 : ((b.value < a.value) ? -1 : 0))
            .slice(0, 20) ;
    // сортируем и выдаем 20 самых самых
};

/**
 * Функция разбиения выборки на кластера FOREL
 * @see http://sernam.ru/book_zg.php?id=16
 *
 * @param dataSet - Выборка
 * @param radius {number} - Максимальный радиус класера
 * @param printStats
 * @returns {{cluster: number, weight: number}}
 */
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

        weight += clusterWeight(centerPointInx, nearPointsIndexArray);
    }
    return {cluster, weight};
};


csv().fromFile(csvFilePath).then((dataSet) => {

    const N = dataSet.length;
    prepareData(dataSet);
    vectorFields = Object.keys(dataSet[0]).filter(value => value.substr(0, 4) == 'stat' && value !== 'stat54');

    clearClusteredMarks(dataSet);
    calcDistMatrix(dataSet);
    calcTauMatrix(N);

    const D = diameter(N);
    let totalWeight = lambda ? 13.1 : 332; // максимальное значения "веса" всей выборки - 1(2) кластер(а) для нормирования
    let radiusRate = lambda ? 1000 : 100; // Шаг для поиска оптимального радиуса

    if (csvFilePath == 'player_stats_3.csv') {
        totalWeight = lambda ? 1.9 : 21;
        radiusRate = lambda ? 400 : 100;
    }

    if (radius < 0) {
        // Если передали отрицательный радиус, значит работаем в режиме исследования те многократно запускаем
        // изменяем с определенным шагом радиус и запускаем кластеризацию смотрим суммы весов получившихся кластеров
        // и значение целевой ф-ции

        for (let i= 1; i<100; i++) {
            const rr = (i/radiusRate)*(D);
            const result = forel(dataSet, rr, false);
            const objectiveFunctionValue = result.cluster/(N + 1) + result.weight/totalWeight;

            const string = i +';'+rr+';'+result.cluster+';'+result.weight+';'+objectiveFunctionValue;
            console.log(string.split('.').join(','));
        }
    } else {

        // если радиус задали то считаем кластеризацию 1 раз, выводим статистику по признакам и само разбиение на экран

        console.log('--------------- stats ---------------------');
        const result = forel(dataSet, radius, true);
        console.log('--------------- result --------------------');
        printCluster(dataSet);
    }

});



