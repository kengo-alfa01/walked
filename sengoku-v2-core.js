/* Sengoku v2 staging: approval-gated municipality history cards; legacy storage stays intact. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SengokuV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='walked.sengoku.v2.approved.v1';
  const SOURCE='1KirrKgmmK6j9boIzsOGlGqFAGVK7t8K5yoDvWsxfSsw';
  const PEOPLE=new Set(["sg-6eaf66c3d7c8","sg-f47391608dbb","sg-a7bb09927601","sg-4cb1a557e060","sg-29c3bc68aa37","sg-4c0c12460efa","sg-dc8c550d8769","sg-31e0e85d7a10","sg-98139e31efb2","sg-master-0817","sg-b9bb61125a1b","sg-22f595e1c616","sg-added-maeda-toshiie","sg-a94db8113d4e","sg-master-0891","sg-819c365a83e4","sg-281d92dc2e0f","sg-1a91ae29cb5a","sg-2d3f90c28c8f","sg-025ab3a6ee3f"]);
  const INTRO_PENDING=new Set(["sg-281d92dc2e0f","sg-1a91ae29cb5a","sg-2d3f90c28c8f","sg-025ab3a6ee3f"]);
  // Immutable release manifest: ⑥ row, ③ row, [longitude,latitude], status, and reviewed date.
  const PIN_APPROVED_META=Object.freeze({
  "sg2site-hideyoshi-fushimi-kohata": [1567, 37, 135.780854, 34.941691, "yellow", "2026-11-08"],
  "sg2site-hideyoshi-fushimi-shigetsu": [1566, 36, 135.77034, 34.929703, "yellow", "2026-11-09"],
  "sg2site-hideyoshi-juraku": [1565, 31, 135.7460625, 35.0249375, "green", "2026-11-08"],
  "sg2site-hideyoshi-gakuden": [1564, 30, 136.950542, 35.32825, "yellow", "2026-11-08"],
  "sg2site-hideyoshi-shizugatake": [1563, 28, 136.19306, 35.50611, "yellow", "2026-11-08"],
  "sg2site-hideyoshi-bitchu-takamatsu": [1562, 27, 133.822263, 34.692673, "green", "2026-11-08"],
  "sg2site-nobu-ishiyama-honganji": [1561, 19, 135.5244375, 34.6845625, "green", "2026-11-08"],
  "sg2site-nobu-azuchi-town": [1560, 17, 136.1352344, 35.15029465, "green", "2026-11-08"],
  "sg2site-nobu-nagashima-castle": [1559, 16, 136.698899, 35.092373, "yellow", "2026-11-08"],
  "sg2site-nobu-enryakuji": [1558, 13, 135.84096, 35.070503, "yellow", "2026-11-08"],
  "sg2site-nobu-anegawa": [1557, 12, 136.3222, 35.415961, "yellow", "2026-11-08"],
  "sg2site-nobu-shotokuji-disputed": [1556, 9, 136.7350625, 35.2991875, "green", "2026-11-08"],
  "sg2site-nobu-honnoji-old": [1555, 8, 135.7536875, 35.0059375, "green", "2026-11-08"],
  "sg2site-nobu-shitaragahara": [1554, 6, 137.52502778, 34.92175, "green", "2026-11-08"],
  "sg2site-hideyoshi-taiheiji": [1553, 216, 130.305374, 31.824417, "green", "2026-11-08"],
  "sg2site-ieyasu-edo": [1546, 54, 139.7559375, 35.6861875, "yellow", "2026-11-10"],
  "sg2site-nobu-okehazama-tradition": [
    465,
    2,
    136.9807,
    35.05998,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-komakiyama": [
    466,
    3,
    136.9133984,
    35.2924575,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-gifu": [
    467,
    4,
    136.782034,
    35.433927,
    "yellow",
    "2026-11-07"
  ],
  "sg2site-nobu-toji": [
    468,
    5,
    135.747703,
    34.980317,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-azuchi": [
    469,
    7,
    136.139542,
    35.155818,
    "yellow",
    "2026-11-07"
  ],
  "sg2site-nobu-kiyosu-old": [
    470,
    10,
    136.8420625,
    35.2171875,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-kanegasaki": [
    471,
    11,
    136.074112,
    35.666393,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-ichijodani": [
    472,
    14,
    136.295692,
    35.999445,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-odani": [
    473,
    15,
    136.272303,
    35.449437,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-arioka": [
    474,
    18,
    135.420992,
    34.781112,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-ohkawachi": [
    475,
    20,
    136.472926,
    34.527127,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-inou-battle-commemorative": [
    476,
    21,
    136.8905,
    35.206083,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-fujisan-hongu-sengen": [
    477,
    22,
    138.610535,
    35.225037,
    "green",
    "2026-11-07"
  ],
  "sg2site-nobu-inuyama": [
    478,
    23,
    136.939177,
    35.38836,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-birth-memorial": [
    479,
    24,
    136.85409,
    35.17472,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-nagahama": [
    480,
    25,
    136.261784,
    35.377409,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-himeji": [
    481,
    26,
    134.6939,
    34.83935,
    "yellow",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-osaka-castle": [
    482,
    29,
    135.526,
    34.68734,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-kitano": [
    483,
    32,
    135.735123,
    35.031174,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-ishigakiyama": [
    484,
    33,
    139.1278124,
    35.23538433,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-odawara": [
    485,
    34,
    139.1573811,
    35.24966708,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-hizen-nagoya": [
    486,
    35,
    129.868966,
    33.530396,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-daigoji": [
    487,
    38,
    135.822634,
    34.950962,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-miki": [
    488,
    39,
    134.987864,
    34.799872,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-hiraiyama": [
    489,
    40,
    135.0160625,
    34.8081875,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-tottori": [
    490,
    41,
    134.23872,
    35.50416,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-negoroji": [
    491,
    42,
    135.321625,
    34.294727,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-kurokawa": [
    492,
    43,
    139.932324,
    37.487317,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-odoi-hirano": [
    493,
    44,
    135.7349167,
    35.03330556,
    "green",
    "2026-11-07"
  ],
  "sg2site-hideyoshi-yamazaki-castle": [
    494,
    45,
    135.676282,
    34.901786,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-okazaki": [
    495,
    46,
    137.1596639,
    34.956153,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-odaka": [
    496,
    47,
    136.936302,
    35.064525,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-honshoji": [
    497,
    48,
    137.085083,
    34.900173,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-kakegawa": [
    498,
    49,
    138.015145,
    34.776906,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-hamamatsu": [
    499,
    50,
    137.723698,
    34.712366,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-saigagake": [
    500,
    51,
    137.7183622,
    34.7196531,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-takatenjin": [
    501,
    52,
    138.035571,
    34.698262,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-sunpu": [
    502,
    53,
    138.383163,
    34.979285,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-momokubari": [
    503,
    55,
    136.488411,
    35.365395,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-jinbano": [
    504,
    56,
    136.465098,
    35.365809,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-nijo": [
    505,
    57,
    135.7503,
    35.01263,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-chausu": [
    506,
    58,
    135.5114375,
    34.6518125,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-kunozan": [
    507,
    59,
    138.4676128,
    34.9648125,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-nagakute": [
    508,
    60,
    137.049856,
    35.171566,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-oyama-council-tradition": [
    509,
    61,
    139.800754,
    36.3145282,
    "green",
    "2026-11-07"
  ],
  "sg2site-ieyasu-nikko-toshogu": [
    510,
    62,
    139.597214,
    36.759941,
    "green",
    "2026-11-07"
  ],
  "sg2site-soun-bitchu-takakoshi": [1517,63,133.5078,34.608583,"green","2026-11-09","v2"],
  "sg2site-soun-koukokuji": [1568,64,138.807131,35.141468,"green","2026-11-08","v2"],
  "sg2site-soun-horigoe": [1569,65,138.9393028,35.04807222,"yellow","2026-11-08","v2"],
  "sg2site-soun-nirayama": [1570,66,138.955578,35.053648,"yellow","2026-11-08","v2"],
  "sg2site-soun-okazaki": [1571,67,139.312391,35.378569,"green","2026-11-08","v3"],
  "sg2site-soun-tamanawa": [1572,68,139.514551,35.352222,"yellow","2026-11-08","v3"],
  "sg2site-soun-sumiyoshi": [1573,69,139.552242,35.299601,"yellow","2026-11-08","v3"],
  "sg2site-soun-arai": [1574,70,139.6143125,35.1605625,"red","2026-11-08","v3"],
  "sg2site-soun-sounji": [1575,71,139.103561,35.230217,"green","2026-11-08","v2"],
  "sg2site-soun-hosenji-documents": [1576,72,133.4980625,34.6116875,"yellow","2026-11-08","v3"],
  "sg2site-soun-oba": [1577,73,139.451582,35.361743,"green","2026-11-07","v2"],
  "sg2site-satomi-hyakushu": [1578,74,139.840532,35.202674,"yellow","2026-11-09","v3"],
  "sg2site-satomi-inamura": [1579,75,139.903391,34.997582,"yellow","2026-11-07","v2"],
  "sg2site-satomi-inukake": [1580,76,139.9033125,35.0788125,"yellow","2026-11-09","v2"],
  "sg2site-satomi-takita": [1581,77,139.8933125,35.0626875,"yellow","2026-11-08","v2"],
  "sg2site-satomi-minagami": [1582,78,139.9304343,35.2131556,"yellow","2026-11-09","v2"],
  "sg2site-satomi-sanuki": [1583,79,139.897263,35.265362,"green","2026-11-08","v2"],
  "sg2site-satomi-kururi": [1584,80,140.089913,35.287636,"yellow","2026-11-07","v2"],
  "sg2site-satomi-konodai": [1585,81,139.8987782,35.7472002,"green","2026-11-07","v2"],
  "sg2site-satomi-mifune-hojo": [1586,82,139.894332,35.30034,"green","2026-11-08","v2"],
  "sg2site-masamune-yonezawa": [1611,113,140.105056,37.909274,"yellow","2026-11-07","v2"],
  "sg2site-masamune-hitotoribashi": [1612,114,140.388462,37.49829,"green","2026-11-09","v2"],
  "sg2site-masamune-nihonmatsu": [1613,115,140.42824,37.59989,"green","2026-11-07","v2"],
  "sg2site-masamune-tateyama": [518,116,140.062511,37.912059,"green","2026-11-08","v2"],
  "sg2site-masamune-suriagehara": [1614,117,140.062231,37.56031,"green","2026-11-08","v2"],
  "sg2site-masamune-kurokawa": [1615,118,139.9298613,37.4877537,"green","2026-11-07","v2"],
  "sg2site-masamune-sukagawa": [1228,119,140.37443,37.28955,"green","2026-11-08","v2"],
  "sg2site-masamune-iwadeyama": [1616,120,140.862615,38.655615,"green","2026-11-07","v2"],
  "sg2site-masamune-sendai": [1617,121,140.856128,38.253414,"green","2026-11-07","v2"],
  "sg2site-masamune-godaido": [519,122,141.064207,38.369718,"green","2026-11-07","v2"],
  "sg2site-masamune-osaki-hachimangu": [520,123,140.8449,38.27252,"green","2026-11-07","v2"],
  "sg2site-masamune-kokubunji": [521,124,140.901428,38.250732,"green","2026-11-07","v2"],
  "sg2site-masamune-zuiganji": [522,125,141.060089,38.372021,"green","2026-11-07","v2"],
  "sg2site-masamune-tsukinoura": [1618,126,141.4299055,38.3816572,"green","2026-11-08","v3"],
  "sg2site-masamune-wakabayashi": [1619,127,140.902586,38.238366,"red","2026-11-09","v3"],
  "sg2site-masamune-zuihoden": [525,128,140.866679,38.2504692,"green","2026-11-07","v2"],
  "sg2site-motonari-sarukake": [1620,129,132.664167,34.679929,"green","2026-11-07","v3"],
  "sg2site-motonari-koriyama": [1621,130,132.710575,34.670078,"green","2026-11-07","v3"],
  "sg2site-motonari-arita": [1622,131,132.530306,34.670739,"green","2026-11-08","v3"],
  "sg2site-motonari-arita-field": [1623,132,132.5320472,34.6682718,"green","2026-11-08","v3"],
  "sg2site-motonari-kagamiyama": [1518,133,132.726991,34.403688,"yellow","2026-11-08","v3"],
  "sg2site-motonari-ginzan": [1624,134,132.448479,34.455998,"green","2026-11-08","v3"],
  "sg2site-motonari-sakurao": [1625,135,132.34226,34.357514,"green","2026-11-07","v3"],
  "sg2site-motonari-miyanoo": [1626,136,132.322299,34.300531,"green","2026-11-08","v3"],
  "sg2site-motonari-tsutsumigaura": [1627,137,132.3416439,34.2957216,"yellow","2026-11-08","v3"],
  "sg2site-motonari-tounooka": [1628,138,132.320279,34.297321,"yellow","2026-11-09","v3"],
  "sg2site-motonari-niitakayama": [1629,139,132.976328,34.419327,"green","2026-11-07","v3"],
  "sg2site-motonari-toda": [1630,140,133.185265,35.360805,"green","2026-11-07","v3"],
  "sg2site-motonari-iwami": [1519,141,132.443739,35.11313,"green","2026-11-08","v3"],
  "sg2site-motonari-grave": [1520,142,132.70400763,34.67451155,"green","2026-11-08","v3"],
  "sg2site-masamune-edo-sakurada": [1690,205,139.7585625,35.6753125,"green","2026-11-07","v2"],
  "sg2site-motochika-hakuchi": [1695,210,133.781016,34.015657,"yellow","2026-11-08","v2"],
  "sg2site-shingen-residence": [1588,85,138.57728,35.686685,"green","2026-11-07","v2"],
  "sg2site-shingen-uehara": [1589,86,138.149006,36.008835,"green","2026-11-07","v2"],
  "sg2site-shingen-kuwabara": [1590,87,138.139674,36.025793,"green","2026-11-07","v2"],
  "sg2site-shingen-takato": [1591,88,138.062363,35.83316,"green","2026-11-07","v2"],
  "sg2site-shingen-uedahara": [658,89,138.2126875,36.3950625,"green","2026-11-08","v2"],
  "sg2site-shingen-toishi": [1592,90,138.291749,36.424196,"green","2026-11-08","v2"],
  "sg2site-shingen-ryuo-kawayo": [1593,91,138.5019977,35.6674453,"green","2026-11-08","v2"],
  "sg2site-shingen-kaizu": [1594,92,138.19617,36.566361,"green","2026-11-07","v2"],
  "sg2site-shingen-kawanakajima": [1595,93,138.185797,36.591284,"green","2026-11-08","v2"],
  "sg2site-shingen-erinji": [1596,94,138.713669,35.730755,"green","2026-11-07","v2"],
  "sg2site-shingen-minowa": [1597,95,138.951932,36.404195,"green","2026-11-07","v2"],
  "sg2site-shingen-takiyama": [1598,96,139.328166,35.701799,"green","2026-11-07","v2"],
  "sg2site-shingen-mimase": [659,97,139.2944375,35.5350625,"green","2026-11-08","v2"],
  "sg2site-shingen-futamata": [1599,98,137.808973,34.862034,"green","2026-11-07","v2"],
  "sg2site-shingen-mikatagahara": [663,99,137.70422,34.79678,"green","2026-11-09","v2"],
  "sg2site-shingen-nodajo": [1600,100,137.468389,34.882196,"green","2026-11-08","v2"],
  "sg2site-kenshin-umayabashi": [1606,107,139.0615625,36.3921875,"yellow","2026-11-08","v2"],
  "sg2site-kanbei-gochaku": [1631,143,134.74088,34.818759,"green","2026-11-07","v2"],
  "sg2site-kanbei-umagatake": [1632,146,130.946061,33.679026,"green","2026-11-07","v2"],
  "sg2site-kanbei-nakatsu": [1633,147,131.186293,33.606664,"green","2026-11-08","v2"],
  "sg2site-kenshin-kasugayama": [1601,102,138.205549,37.146655,"yellow","2026-11-07","v2"],
  "sg2site-kenshin-rinsenji": [1602,103,138.212906,37.149742,"green","2026-11-07","v2"],
  "sg2site-kenshin-tochio": [1603,104,138.987799,37.472351,"green","2026-11-07","v2"],
  "sg2site-kenshin-joanji": [1604,105,138.995026,37.473999,"green","2026-11-08","v2"],
  "sg2site-kenshin-sakado": [1605,106,138.898428,37.059197,"green","2026-11-07","v2"],
  "sg2site-kenshin-tsurugaoka": [1607,108,139.554749,35.324554,"green","2026-11-07","v2"],
  "sg2site-kenshin-iiyama": [1608,110,138.365847,36.856271,"green","2026-11-08","v2"],
  "sg2site-kenshin-masuyama": [1609,111,137.040835,36.651316,"green","2026-11-08","v2"],
  "sg2site-kenshin-nanao": [1610,112,136.985209,37.009038,"yellow","2026-11-07","v2"],
  "sg2site-kanbei-ishigakibaru": [1634,148,131.4753976,33.29111932,"green","2026-11-08","v2"],
  "sg2site-kanbei-jissoji": [1635,149,131.487009,33.299075,"green","2026-11-08","v2"],
  "sg2site-kanbei-yanagawa": [1636,150,130.4011837,33.1607721,"yellow","2026-11-09","v2"],
  "sg2site-kanbei-fukuoka": [1638,152,130.383216,33.585245,"green","2026-11-07","v2"],
  "sg2site-sanada-ueda": [1639,154,138.24493,36.404504,"yellow","2026-11-07","v2"],
  "sg2site-sanada-rengejoin": [1640,155,135.58429,34.217842,"yellow","2026-11-08","v2"],
  "sg2site-sanada-kudoyama": [1641,156,135.560211,34.290245,"green","2026-11-08","v2"],
  "sg2site-sanada-sanadamaru": [1642,157,135.5269375,34.6729375,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-ozawa": [1645,160,139.521689,35.631602,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-kawagoe": [1646,161,139.491683,35.924396,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-toumyoji": [1647,162,139.484827,35.9286264,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-matsuyama": [1650,165,139.421053,36.036729,"green","2026-11-08","v2"],
  "sg2site-maeda-arako": [1652,167,136.856367,35.135202,"green","2026-11-08","v2"],
  "sg2site-maeda-fuchu": [1653,168,136.169444,35.903502,"green","2026-11-08","v2"],
  "sg2site-maeda-komaru": [1654,169,136.960124,37.045654,"yellow","2026-11-07","v2"],
  "sg2site-maeda-kanazawa": [1655,170,136.658151,36.564893,"yellow","2026-11-07","v2"],
  "sg2site-maeda-suemori": [1656,171,136.778412,36.833927,"green","2026-11-08","v2"],
  "sg2site-mitsuhide-usayama": [1658,173,135.846446,35.034052,"green","2026-11-08","v2"],
  "sg2site-mitsuhide-sakamoto": [1659,174,135.878762,35.05838,"yellow","2026-11-08","v2"],
  "sg2site-mitsuhide-kameyama": [1660,175,135.581467,35.013284,"yellow","2026-11-08","v2"],
  "sg2site-mitsuhide-yakami": [1661,176,135.25575,35.061725,"yellow","2026-11-08","v2"],
  "sg2site-mitsuhide-kuroi": [1662,177,135.104057,35.179276,"green","2026-11-08","v2"],
  "sg2site-mitsuhide-fukuchiyama": [1663,178,135.129709,35.29687,"green","2026-11-08","v2"],
  "sg2site-mitsuhide-atago": [1664,179,135.633436,35.060345,"green","2026-11-09","v2"],
  "sg2site-mitsuhide-shoryuji": [1665,180,135.700654,34.918135,"green","2026-11-08","v2"],
  "sg2site-mitsuhide-yamazaki": [1666,181,135.692,34.906,"green","2026-11-08","v2"],
  "sg2site-mitsuhide-bush": [1667,182,135.802194,34.947167,"yellow","2026-11-08","v2"],
  "sg2site-takakage-kimura": [1668,183,132.892827,34.381671,"green","2026-11-08","v2"],
  "sg2site-takakage-takayama": [1669,184,132.984298,34.418355,"green","2026-11-08","v2"],
  "sg2site-takakage-mihara": [1670,185,133.0826068,34.40124433,"green","2026-11-08","v2"],
  "sg2site-takakage-yuzuki": [1671,186,132.78662,33.84872,"green","2026-11-08","v2"],
  "sg2site-takakage-najima": [1672,187,130.423218,33.6459,"green","2026-11-09","v2"],
  "sg2site-takakage-hakozaki": [1673,188,130.424286,33.613758,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-izaku": [1675,190,130.363493,31.513941,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-iwatsurugi": [1676,191,130.598548,31.705866,"yellow","2026-11-08","v2"],
  "sg2site-yoshihiro-gamou": [1677,192,130.572146,31.756259,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-obi": [1678,193,131.350481,31.628622,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-iino": [1679,194,130.867591,32.054126,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-kizakibaru": [1680,195,130.83012519,32.04105136,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-nejiro": [1682,197,131.456417,32.146,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-chosa": [1683,198,130.627924,31.745439,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-sekigahara": [1684,199,136.45921,35.367126,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-hiramatsu": [1686,201,130.604473,31.706312,"yellow","2026-11-08","v2"],
  "sg2site-yoshihiro-kajiki": [1687,202,130.66541,31.741033,"yellow","2026-11-08","v2"],
  "sg2site-kanbei-agaura1576": [1689,204,134.645178,34.801103,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-sunakubo": [1648,163,139.48571693,35.88478109,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-hirai": [1649,164,139.029865,36.219229,"green","2026-11-08","v2"],
  "sg2site-ujiyasu-yamanaka": [1651,166,138.994284,35.156622,"yellow","2026-11-08","v2"],
  "sg2site-sanada-yasuijinja": [1643,158,135.510757,34.653793,"green","2026-11-08","v2"],
  "sg2site-sanada-shinganji": [1644,159,135.52707,34.67282,"green","2026-11-08","v2"],
  "sg2site-satomi-enmeiji": [1587,83,139.9001778,35.01754167,"green","2026-11-08","v2"],
  "sg2site-kanbei-dazaifu": [1637,151,130.535431,33.521496,"green","2026-11-08","v2"],
  "sg2site-maeda-grave": [1657,172,136.666944,36.528611,"yellow","2026-11-08","v2"],
  "sg2site-takakage-yoneyama": [1674,189,132.999699,34.391125,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-takajo": [1681,196,131.474761,32.16771,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-utouzaka": [1685,200,136.4812177,35.3511726,"green","2026-11-08","v2"],
  "sg2site-yoshihiro-fukushoji": [1688,203,130.561649,31.611057,"green","2026-11-08","v2"],
  "sg2site-motochika-okou": [1691,206,133.622552,33.594974,"green","2026-11-08","v2"],
  "sg2site-motochika-tonomoto": [1692,207,133.537423,33.498083,"green","2026-11-08","v2"],
  "sg2site-motochika-asakura": [1693,208,133.479865,33.549592,"green","2026-11-08","v2"],
  "sg2site-motochika-aki": [1694,209,133.91259,33.519865,"green","2026-11-08","v2"],
  "sg2site-motochika-shouzui": [1696,211,134.522999,34.132026,"yellow","2026-11-08","v2"],
  "sg2site-motochika-otakasaka": [1697,212,133.530047,33.560759,"green","2026-11-08","v2"],
  "sg2site-motochika-urado": [1698,213,133.572018,33.497165,"green","2026-11-08","v2"],
  "sg2site-motochika-hetugi": [1699,214,131.6583311,33.1389025,"green","2026-11-08","v2"],
  "sg2site-motochika-grave": [1700,215,133.553047,33.497387,"green","2026-11-08","v2"],
  "sg2site-kanetsugu-untouan": [1701,217,138.89035,37.030965,"green","2026-11-08","v2"],
  "sg2site-kanetsugu-yoita": [1702,218,138.800963,37.534025,"green","2026-11-08","v2"],
  "sg2site-kanetsugu-aizu-residence": [1703,219,139.926564,37.490577,"green","2026-11-08","v2"],
  "sg2site-kanetsugu-hasedo": [1704,220,140.272397,38.212599,"green","2026-11-08","v2"],
  "sg2site-kanetsugu-dike": [1705,221,140.120788,37.865003,"yellow","2026-11-08","v2"],
  "sg2site-kanetsugu-guns": [1706,222,140.1191902,37.7803192,"yellow","2026-11-08","v2"],
  "sg2site-kanetsugu-grave": [1707,223,140.10126,37.90097,"yellow","2026-11-08","v2"],
  "sg2site-katsuie-kamewari": [1708,224,136.132027,35.105579,"green","2026-11-08","v2"],
  "sg2site-katsuie-kitanosho": [1709,225,136.219666,36.059982,"green","2026-11-08","v2"],
  "sg2site-katsuie-tsukumo": [1710,226,136.2113555,36.0630818,"green","2026-11-08","v2"],
  "sg2site-katsuie-uozu": [1711,227,137.397553,36.813238,"yellow","2026-11-09","v2"],
  "sg2site-katsuie-genba": [1712,228,136.173449,35.598548,"yellow","2026-11-08","v2"],
  "sg2site-katsuie-saikoji": [1713,229,136.213473,36.059211,"yellow","2026-11-08","v2"],
  "sg2site-ujimasa-sekiyado": [1714,230,139.780067,36.096661,"green","2026-11-08","v2"],
  "sg2site-ujimasa-nagurumi": [1715,231,138.990658,36.668823,"green","2026-11-08","v2"],
  "sg2site-ujimasa-hachigata": [1716,232,139.193361,36.107315,"green","2026-11-08","v2"],
  "sg2site-ujimasa-tamura": [1717,233,139.155663,35.244923,"yellow","2026-11-09","v2"],
  "sg2site-ujimasa-grave": [1718,234,139.1576733,35.25598004,"green","2026-11-08","v2"],
  "sg2site-a-shiojiri-nagaisaka": [1719,294,137.9893104,36.0979656,"green","2026-11-08","v2"],
  "sg2site-a-shinano-zenkoji": [1720,295,138.187714,36.661549,"green","2026-11-08","v2"],
  "sg2site-a-kai-zenkoji": [1721,296,138.592606,35.666664,"green","2026-11-08","v2"],
  "sg2site-a-kenshin-kyoto-gosho": [1722,298,135.762144,35.024098,"yellow","2026-11-08","v2"],
  "sg2site-a-maeda-moribe": [1723,299,136.6773479,35.3299437,"green","2026-11-08","v2"],
  "sg2site-a-watarigawa-monument": [1724,309,132.9240625,32.9885625,"green","2026-11-09","v2"],
  "sg2site-a-tedorigawa-monument": [1725,311,136.4794425,36.47851679,"green","2026-11-09","v2"]
});
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function check(ok,message){if(!ok)throw Error('戦国v2: '+message);}
  function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
  function id(x){return typeof x==='string'&&/^[-a-z0-9:]+$/.test(x)&&x.length<120;}
  function codeSet(codes){return codes instanceof Set?codes:new Set(codes||[]);}
  function normalizeCodes(value,known){
    const raw=Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
    check(raw.length>0,'獲得自治体コードがありません');
    const out=[];
    for(const c of raw){
      const v=String(c).trim();
      check(/^\d{5}$/.test(v),'不正な自治体コード '+v);
      check(!known||known.has(v),'未収録の自治体コード '+v);
      if(!out.includes(v))out.push(v);
    }
    return out;
  }
  function approval(a,body,hash,context){
    check(plain(a)&&Number.isInteger(a.sheetRow)&&a.sheetRow>=2,'⑥承認行がありません');
    check(/^v[1-9]\d*$/.test(a.version||''),'版番号が不正です');
    check(a.kind===context.kind&&a.personId===context.personId&&a.sourceId===context.sourceId,'承認行の人物・文章種別・元IDが一致しません');
    check(a.user==='公開OK'&&a.quality==='品質合格'&&a.sourceMatch==='一致','ユーザー承認・品質・原文照合が未完了です');
    check(a.handoff==='C候補（別途公開承認）','C受渡し判定が未完了です');
    check(typeof body==='string'&&body.length>0,'承認本文が空です');
    check(typeof a.sha256==='string'&&/^[0-9a-f]{64}$/.test(a.sha256)&&hash(body)===a.sha256,'承認済み文章のハッシュが一致しません');
  }
  function validate(doc,knownCodes,sha256){
    check(plain(doc)&&doc.schemaVersion===SCHEMA&&doc.sourceSpreadsheetId===SOURCE,'正本・スキーマが違います');
    check(Array.isArray(doc.people)&&Array.isArray(doc.histories)&&Array.isArray(doc.sites)&&Array.isArray(doc.relations),'台帳の構造が不正です');
    check(typeof sha256==='function','本文照合関数がありません');
    const known=codeSet(knownCodes), personMap=new Map(),siteMap=new Map(),historyMap=new Map(),linkKeys=new Set(),regionMap=new Map(),linkSites=new Map(),approvalRows=new Set();
    function uniqueApproval(a){check(!approvalRows.has(a.sheetRow),'⑥の同じ承認行を重複流用できません');approvalRows.add(a.sheetRow);}
    for(const p of doc.people){
      check(PEOPLE.has(p.personId)&&!personMap.has(p.personId)&&typeof p.name==='string','対象外・重複人物');
      for(const type of ['introduction','story']){
        const t=p[type];if(type==='introduction'&&!t&&INTRO_PENDING.has(p.personId))continue;
        check(plain(t),'人物紹介・通史の欠落 '+p.personId);
        approval(t.approval,t.text,sha256,{kind:type==='introduction'?'人物紹介':'完成版ストーリー',personId:p.personId,sourceId:null});
        uniqueApproval(t.approval);
        check(t.approval.rights==='位置不要・権利OK'||t.approval.rights==='自治体確認済・権利OK','権利が未確認');
      }
      const unlock=p.story.unlock;
      check(plain(unlock)&&Number.isInteger(unlock.requiredHistoryCount)&&unlock.requiredHistoryCount>0&&Number.isInteger(unlock.requiredPlaceHistoryCount)&&unlock.requiredPlaceHistoryCount>=0&&unlock.requiredPlaceHistoryCount<=unlock.requiredHistoryCount&&/^[a-f0-9]{64}$/.test(unlock.historyIdsSHA256||''),'完成版ストーリーの全経歴解放条件が不正です');
      personMap.set(p.personId,p);
    }
    check(personMap.size===3||personMap.size===20,'先行3人物または承認20人物以外を混入させないでください');
    for(const s of doc.sites){
      check(id(s.siteId)&&!siteMap.has(s.siteId),'史跡IDの重複・欠落');
      check(Array.isArray(s.personIds)&&s.personIds.length>0&&s.personIds.every(x=>personMap.has(x)),'史跡承認に対象外人物を含む');
      check(s.locationReviewed===true&&s.rightsReviewed===true&&s.bStatus==='合格','史跡B審査・権利が未完了');
      approval(s.approval,s.description,sha256,{kind:'史跡',personId:s.personIds.join('\n'),sourceId:s.siteId});
      uniqueApproval(s.approval);
      check(['自治体確認済・権利OK','地点確認済・権利OK'].includes(s.approval.rights),'史跡の権利・所在地確認が未承認');
      check(typeof s.name==='string'&&s.name&&typeof s.description==='string'&&s.description,'史跡の表示名・本文がありません');
      check(Array.isArray(s.sourceUrls)&&s.sourceUrls.every(x=>typeof x==='string'&&/^https:\/\//.test(x)),'史跡出典URL不正');
      const codes=normalizeCodes(s.municipalityCodes?.length?s.municipalityCodes:s.municipalityCode,known);
      check(!s.point||(s.publicPin===true&&Array.isArray(s.point)&&s.point.length===2&&s.point.every(Number.isFinite)&&s.point[0]>=122&&s.point[0]<=154&&s.point[1]>=20&&s.point[1]<=47),'未承認または範囲外のピン');
      if(s.publicPin===true){
        check(Array.isArray(s.point),'公開ピンの位置がありません');
        check(plain(s.pinApproval),'位置更新版の⑥公開承認がありません');
        const approvedPinPersonIds=s.pinPersonIds||s.personIds;
        check(Array.isArray(approvedPinPersonIds)&&approvedPinPersonIds.length>0&&approvedPinPersonIds.every(x=>personMap.has(x))&&s.personIds.every(x=>approvedPinPersonIds.includes(x))&&new Set(approvedPinPersonIds).size===approvedPinPersonIds.length,'位置版⑥人物IDが未承認です');
        approval(s.pinApproval,s.description,sha256,{kind:'史跡',personId:approvedPinPersonIds.join('\n'),sourceId:s.siteId});
        if(s.pinApproval.sheetRow!==s.approval.sheetRow)uniqueApproval(s.pinApproval);
        else check(s.pinApproval.version===s.approval.version&&s.pinApproval.sha256===s.approval.sha256&&
          s.pinApproval.personId===s.approval.personId&&s.pinApproval.sourceId===s.approval.sourceId,
          '史跡本文と位置版が同一⑥承認行の場合の根拠が一致しません');
        check(['v2','v3'].includes(s.pinApproval.version)&&s.pinApproval.sheetRow===PIN_APPROVED_META[s.siteId]?.[0],'位置版v2と史跡IDの⑥承認行が一致しません');
        check(['自治体確認済・権利OK','地点確認済・権利OK'].includes(s.pinApproval.rights),'位置版の権利・所在地確認が未承認');
        const p=s.pinReview;
        check(plain(p)&&p.decision==='可'&&['green','yellow','red'].includes(p.accessStatus),'Bの最新公開ピン・見学区分が未確認');
        const expected=PIN_APPROVED_META[s.siteId];
        check(!!expected&&p.sourceSheetRow===expected[1]&&s.point[0]===expected[2]&&s.point[1]===expected[3]&&p.accessStatus===expected[4]&&p.checkedAt===expected[5]&&s.pinApproval.version===(expected[6]||'v2'),'⑥位置版と③最新B記録の座標・見学区分が一致しません');
        check(typeof p.locationKind==='string'&&p.locationKind.length>0&&p.locationKind!=='未設定','表示位置の種別が未確認');
        check(typeof p.municipality==='string'&&p.municipality.length>0&&Number.isInteger(p.sourceSheetRow)&&p.sourceSheetRow>=2,'③史跡の参照行・市区町村がありません');
        check(/^\d{4}-\d{2}-\d{2}$/.test(p.checkedAt||''),'見学情報の確認日がありません');
        check(typeof p.restriction==='string'&&(p.accessStatus==='green'||p.restriction.trim()),'立入制限の内容がありません');
        check([p.officialInfoUrl,p.positionEvidenceUrl].every(u=>u===null||typeof u==='string'&&/^https:\/\//.test(u)),'史跡案内・根拠URL不正');
        check(Array.isArray(p.positionSourceIds)&&p.positionSourceIds.every(x=>typeof x==='string'),'位置情報の出典IDが不正です');
      }else{
        check(s.publicPin===false&&s.point===null&&!s.pinApproval&&!s.pinReview,'未承認史跡に位置情報が混入しています');
      }
      siteMap.set(s.siteId,{...s,codes});
    }
    for(const h of doc.histories){
      check(id(h.historyId)&&h.historyId.startsWith('sg2hist-')&&!historyMap.has(h.historyId),'経歴IDの重複・形式不正');
      check(personMap.has(h.personId)&&['place','nonplace'].includes(h.kind),'対象外人物・経歴種別');
      check(typeof h.title==='string'&&h.title&&typeof h.yearText==='string','経歴の年次・タイトルがありません');
      approval(h.approval,h.text,sha256,{kind:'経歴',personId:h.personId,sourceId:h.historyId});
      uniqueApproval(h.approval);
      check((h.kind==='place'&&['自治体確認済・権利OK','地点確認済・権利OK'].includes(h.approval.rights))||(h.kind==='nonplace'&&h.approval.rights==='位置不要・権利OK'),'経歴の場所区分と権利承認が一致しません');
      check(Array.isArray(h.sourceUrls)&&h.sourceUrls.every(x=>typeof x==='string'&&/^https:\/\//.test(x)),'経歴出典URL不正');
      historyMap.set(h.historyId,h);
    }
    for(const r of doc.relations){
      check(id(r.siteId)&&historyMap.has(r.historyId)&&siteMap.has(r.siteId),'未承認の経歴・史跡参照');
      const h=historyMap.get(r.historyId);
      check(h.kind==='place'&&h.personId===r.personId,'人物と経歴の関連が不一致');
      const key=r.historyId+'|'+r.siteId;
      check(!linkKeys.has(key),'経歴×史跡の重複');linkKeys.add(key);
      check(r.bStatus==='合格'&&r.linkDecision==='関係上対象'&&['本人直接','出来事直接（史料）','出来事直接（公的伝承）'].includes(r.classification),'④B関連審査または獲得対象が不適格');
      if(!regionMap.has(r.historyId))regionMap.set(r.historyId,new Set());
      if(!linkSites.has(r.historyId))linkSites.set(r.historyId,new Set());
      linkSites.get(r.historyId).add(r.siteId);
      for(const code of siteMap.get(r.siteId).codes)regionMap.get(r.historyId).add(code);
    }
    for(const h of historyMap.values()){
      if(h.kind==='place')check(regionMap.has(h.historyId)&&regionMap.get(h.historyId).size>0,'経歴に承認済みの獲得リンクがありません: '+h.historyId);
      else check(!regionMap.has(h.historyId),'場所不要経歴には史跡獲得リンクを設定できません');
    }
    for(const p of personMap.values()){
      const histories=[...historyMap.values()].filter(h=>h.personId===p.personId);
      const unlock=p.story.unlock;
      if(histories.length){
        check(histories.length===unlock.requiredHistoryCount&&histories.filter(h=>h.kind==='place').length===unlock.requiredPlaceHistoryCount,'通史の対象経歴件数が一致しません');
        check(sha256(histories.map(h=>h.historyId).sort().join('\n'))===unlock.historyIdsSHA256,'通史の対象経歴ID集合が承認版と一致しません');
      }
    }
    return {people:personMap,histories:historyMap,sites:siteMap,codes:regionMap,linkSites,version:doc.version||'v2-stage'};
  }
  function municipalityFromKey(key){
    const raw=String(key||'');
    if(/^\d{5}$/.test(raw))return raw;
    if(/^[ms]:\d{5}/.test(raw)||/^n:\d{5}:/.test(raw))return raw.slice(2,7);
    return '';
  }
  function visitedCodes(visited){
    const set=new Set();
    for(const k of Object.keys(visited||{}))if(visited[k]){const code=municipalityFromKey(k);if(code)set.add(code);}
    return set;
  }
  // Return ONLY visited municipalities that genuinely qualified an approved,
  // acquired location history. Never reveal unvisited eligible locations or
  // attach a made-up place to a non-location history.
  function earnedMunicipalities(index,historyId,visited,found){
    if(!index||!index.histories.has(historyId)||!found||
       !own(found,historyId)||index.histories.get(historyId).kind!=='place')return [];
    const eligible=index.codes.get(historyId);
    if(!eligible)return [];
    const visitedSet=visitedCodes(visited);
    return [...eligible].filter(code=>visitedSet.has(code)).sort();
  }
  function acquired(index,found,personId){
    let count=0;
    if(!index)return count;
    for(const h of index.histories.values())if(h.personId===personId&&own(found,h.historyId))count++;
    return count;
  }
  function award(index,visited,found,unlockedPeople,at){
    const seen=visitedCodes(visited),next={...found},added=[],when=at||new Date().toISOString(),personUnlocked=new Set(unlockedPeople||[]);
    for(const h of index.histories.values()){
      if(h.kind!=='place'||own(next,h.historyId))continue;
      if(![...(index.codes.get(h.historyId)||[])].some(c=>seen.has(c)))continue;
      const site=[...(index.linkSites.get(h.historyId)||[])].map(sid=>index.sites.get(sid)).find(s=>s.codes.some(c=>seen.has(c)));
      next[h.historyId]={at:when,siteId:site?.siteId||'',basis:index.version};added.push(h.historyId);personUnlocked.add(h.personId);
    }
    for(const h of index.histories.values()){
      if(h.kind!=='nonplace'||own(next,h.historyId)||!personUnlocked.has(h.personId))continue;
      next[h.historyId]={at:when,basis:index.version};added.push(h.historyId);
    }
    return {records:next,added};
  }
  // Do not unlock a 1000-character biography just because only a subset of the
  // required histories has received final ⑥ approval. Both count and exact ID-set
  // digest must match the authorized release rule before all acquired IDs count.
  function canUnlockStory(index,personId,found,sha256){
    if(!index||typeof sha256!=='function')return false;
    const rule=index.people.get(personId)?.story?.unlock;
    if(!rule)return false;
    const histories=[...index.histories.values()].filter(h=>h.personId===personId);
    if(histories.length!==rule.requiredHistoryCount||
       histories.filter(h=>h.kind==='place').length!==rule.requiredPlaceHistoryCount)return false;
    if(sha256(histories.map(h=>h.historyId).sort().join('\n'))!==rule.historyIdsSHA256)return false;
    return histories.every(h=>own(found,h.historyId));
  }

  // Color communicates published access conditions, never discovery or card ownership.
  function pinPresentation(status){
    const config={
      green:{label:'通常見学可能',symbol:'○',fill:'#21864e',stroke:'#125c35'},
      yellow:{label:'一部立入制限',symbol:'△',fill:'#edb42d',stroke:'#77510c'},
      red:{label:'全面立入禁止',symbol:'×',fill:'#ca3a3a',stroke:'#7f1d1d'}
    };
    const selected=config[status];
    check(!!selected,'未確認の立入区分はピンに表示できません');
    return {...selected,colorName:{green:'緑',yellow:'黄',red:'赤'}[status]};
  }
  function pinDetails(site){
    check(plain(site)&&site.publicPin===true&&plain(site.pinReview),'未承認の公開ピンです');
    const p=site.pinReview;
    return {
      name:site.name,municipality:p.municipality,
      positionKind:p.locationKind,checkedAt:p.checkedAt,
      access:pinPresentation(p.accessStatus),restriction:p.restriction,
      officialInfoUrl:p.officialInfoUrl,
      guidance:'立入状況は変わる場合があります。現地の案内に従ってください。',
      noRouting:p.accessStatus==='red'
    };
  }
  return {SCHEMA,SOURCE,PEOPLE,normalizeCodes,municipalityFromKey,visitedCodes,earnedMunicipalities,validate,award,acquired,canUnlockStory,pinPresentation,pinDetails};
});