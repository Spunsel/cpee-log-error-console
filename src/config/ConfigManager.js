/**
 * Centralized Configuration Manager
 * Consolidates all configuration settings from scattered files and hardcoded values
 * Provides a single source of truth for all application configuration
 */

export class ConfigManager {
    constructor() {
        this.config = this.loadAllConfigurations();
        this.observers = new Map(); // For configuration change notifications
    }

    /**
     * Load and consolidate all configuration from various sources
     * @returns {Object} Complete configuration object
     */
    loadAllConfigurations() {
        return {
            api: this.loadAPIConfig(),
            ui: this.loadUIConfig(),
            rendering: this.loadRenderingConfig(),
            network: this.loadNetworkConfig(),
            mermaid: this.loadMermaidConfig(),
            cpee: this.loadCPEEConfig(),
            dom: this.loadDOMConfig(),
            timing: this.loadTimingConfig(),
            styling: this.loadStylingConfig(),
            syntaxHighlighting: this.loadSyntaxHighlightingConfig(),
            recentAdditions: this.loadRecentAdditionsConfig()
        };
    }

    /**
     * Load API configuration
     * @returns {Object} API configuration
     */
    loadAPIConfig() {
        return {
            endpoints: {
                cpeeBase: 'https://cpee.org/flow/engine',
                cpeeLogs: 'https://cpee.org/logs',
                cpeeGraph: 'https://cpee.org/flow/graph.html'
            },
            cors: {
                proxy: 'https://cpee-cors-proxy.vercel.app/api/proxy?url=',  // Self-hosted CORS proxy (Vercel)
                logProxy: 'https://cpee-cors-proxy.vercel.app/api/proxy?url=',  // Self-hosted CORS proxy (Vercel)
                timeout: 10000,
                retryCount: 3
            },
            headers: {
                yamlAccept: 'text/plain, application/x-yaml, text/yaml',
                jsonAccept: 'text/plain, application/json, */*'
            }
        };
    }

    /**
     * Load UI configuration
     * @returns {Object} UI configuration
     */
    loadUIConfig() {
        return {
            layout: {
                minHeight: '100vh',
                maxWidth: '1200px',
                containerPadding: '20px',
                sectionSpacing: '20px'
            },
            forms: {
                uuidInput: {
                    maxWidth: '400px',
                    minWidth: '300px',
                    flex: 1
                },
                processNumberInput: {
                    width: '120px'
                }
            },
            navigation: {
                stepControls: {
                    buttonSpacing: '10px',
                    fontSize: '0.9rem'
                },
                sidebar: {
                    width: '250px',
                    minWidth: '200px'
                }
            },
            notifications: {
                successDuration: 2000,
                errorDuration: 3000,
                warningDuration: 2500,
                autoHideDelay: 100
            },
            instances: {
                // Per-generation process numbers sourced from uuid-mapping.json
                generation1: [
                    142586, 142585, 142583, 142576, 142573, 142572, 142526, 142525, 142524, 142522,
                    142521, 141997, 141996, 141994, 141992, 141462, 141461, 141460, 141401, 141384,
                    141377, 141365, 141342, 141331, 141329, 141255, 141034, 141033, 141032, 141031,
                    140984, 140971, 140969, 140967, 140660, 140651, 140645, 140644, 140613, 140609,
                    140608, 139378, 139027, 139009, 138931, 138804, 138670, 138669, 138668, 138667,
                    138666, 138665, 138664, 138663, 138662, 138661, 138655, 138639, 138638, 138637,
                    138634, 138488, 138470, 138388, 138179, 138083, 138058, 138054, 138053, 118236,
                    118226, 115840, 115827, 115810, 115794, 115519, 115506, 107611, 107610, 107139,
                    105437, 105056, 104853, 104847, 104821, 104722, 104703, 104630, 104629, 104608,
                    104588, 104530, 104440, 104434, 104433, 104432, 104431, 104429, 104306, 104298,
                    104297, 104296, 104295, 104294, 104293, 104292, 104290, 104287, 104286, 104278,
                    104267, 104260, 104256, 103603, 103577, 103562, 103161, 101804, 101478, 101461,
                    101460, 101459, 101458, 101457, 101456, 101455, 101448, 98871, 98855, 98797,
                    98795, 98793, 98792, 98791, 98622, 98621, 98618, 98615, 88803, 88782, 88781,
                    88753, 88741, 88740, 88719, 88503, 85514, 85513, 84963, 84957, 84954, 84953,
                    84950, 84949, 84946, 84945, 84882, 84747, 84687, 83316, 83313, 83270, 83268,
                    83265, 83264, 83260, 83258, 83256, 83254, 83252, 83242, 83241, 83213, 83199,
                    83193, 83170, 83162, 83131, 83129, 83125, 83124, 83118, 83110, 83108, 82868,
                    82862, 82268, 82267, 82264, 82263, 82226, 82187, 82151, 82143, 82141, 82120,
                    82118, 82117, 82116, 82115, 82114, 82072, 82060, 82050, 82025, 82019, 81951,
                    77655, 77526, 77275, 77237, 77235, 77228, 77050, 77013, 76934, 76762, 76600,
                    76461, 76446, 76403, 76400, 76397, 76385, 75608, 75605, 75050, 75048, 75015,
                    75001, 75000, 74996, 74992, 74988, 74976, 74974, 74971, 74966, 73589, 73557,
                    73373, 73227, 73190, 70783, 65138, 65082, 64998, 64992, 64331, 64307, 64300,
                    64207, 64206, 19044, 18195, 18184, 14972, 12919, 12505, 12377, 12376, 12328,
                    12319, 12318, 12317, 12316, 12315, 12314, 12312, 11540, 10918, 10917, 10915,
                    10904, 10903, 10902, 10900, 10887, 10886, 10884, 10883, 10882, 10881, 10879,
                    10876, 10741, 10460, 10458, 10410, 10405, 10398, 10393, 10347, 10331, 10306,
                    10299, 10298, 10297, 10246, 10241, 10240, 10237, 10227, 10190, 10189, 10187,
                    10156, 10151, 10150, 10145, 10136, 10045, 9934, 9808, 9802, 9785, 9784, 9779,
                    7676, 7567, 7491, 7414, 7402, 7401, 7400, 6909, 6775, 6770, 6561, 6560, 6554,
                    6552, 6550, 6548, 6547, 6269, 6098, 5919, 5898, 5820, 5814, 5693, 5130, 5128,
                    5050, 5049, 5045, 5044, 5040, 5035, 4913, 4908, 4906, 4807, 3833, 2181, 1606,
                    1574, 1568, 1567, 1529, 1528, 1527, 1524, 1523, 1510, 1467, 1465, 1388, 1317,
                    1314, 1266, 1258, 1134, 1133, 1132, 1126, 1124, 1123, 1118, 1098, 1091, 1087,
                    1086, 1069, 1055, 1047, 1046, 1039, 1021, 975, 972, 967, 930, 926, 920, 914,
                    890, 860, 853, 852, 850, 849, 845, 694, 665, 664, 561, 559, 558, 461, 460,
                    457, 449, 424, 384, 378, 377, 361, 266, 262, 260, 259, 214, 193
                ],
                generation2: [
                    85659, 85645, 85639, 85631, 85521, 85510, 85467, 85445, 85444, 85443,
                    85442, 85441, 85418, 85370, 85347, 85336, 85334, 85332, 85290, 85283,
                    85282, 85280, 85279, 85277, 85275, 85274, 85273, 85271, 84992, 84860,
                    84859, 84851, 84850, 84849, 84847, 84845, 84844, 84843, 84839, 84838,
                    84837, 84836, 84835, 84778, 84776, 84775, 84774, 84768, 84766, 84765,
                    84763, 84556, 84555, 84540, 84537, 84530, 83998, 83994, 83972, 83815,
                    83804, 83800, 83762, 83761, 83752, 83745, 83735, 83708, 83706, 83705,
                    83686, 83641, 83625, 83619, 83618, 83612, 83609, 83608, 83606, 83604,
                    83599, 83597, 83593, 83576, 83574, 83573, 83572, 83571, 83569, 83568,
                    83566, 83563, 83562, 83560, 83542, 83541, 83539, 83416, 83415, 83337,
                    83138, 83104, 83035, 82975, 82785, 82784, 82783, 82782, 82778, 82742,
                    82741, 82721, 82718, 82717, 82712, 82711, 82706, 82705, 82702, 82698,
                    82692, 82687, 82685, 82679, 82655, 82555, 82391, 82388, 82386, 82343,
                    82338, 82308, 82300, 82296, 82284, 82283, 82177, 82175, 82174, 82173,
                    82172, 82171, 82145, 82144, 82143, 82142, 82135, 82134, 82132, 82131,
                    82130, 82129, 82128, 82127, 82115, 82100, 82099, 82098, 82094, 82093,
                    82092, 82090, 82087, 82085, 82084, 82083, 82082, 82080, 82068, 82067,
                    82066, 82065, 82064, 82063, 82062, 82061, 82060, 82059, 82055, 82052,
                    82049, 82045, 82043, 82041, 82036, 82035, 82034, 82033, 82031, 81998,
                    81997, 81986, 81932, 81929, 81926, 81925, 81923, 81922, 81921, 81920,
                    81917, 81915, 81914, 81913, 81910, 81909, 81907, 81905, 81903, 81902,
                    81901, 81900, 81899, 81897, 81895, 81894, 81892, 81891, 81890, 81771,
                    81770, 81769, 81768, 81757, 81756, 81755, 81754, 81753, 81752, 81751,
                    81750, 81747, 81746, 81745, 81744, 81742, 81741, 81740, 81739, 81737,
                    81736, 81735, 81734, 81732, 81731, 81730, 81728, 81723, 81722, 81721,
                    81705, 81702, 81698, 81691, 81674, 81673, 81665, 81663, 81662, 81660,
                    81659, 81646, 81645, 81644, 81643, 81642, 81641, 81640, 81639, 81637,
                    81636, 81635, 81634, 81633, 81632, 81630, 81628, 81627, 81626, 81624,
                    81622, 81621, 81620, 81619, 81618, 81616, 81615, 81613, 81609, 81607,
                    81606, 81605, 81602, 81598, 81597, 81596, 81595, 81594, 81593, 81592,
                    81590, 81589, 81587, 81586, 81501, 81497, 81491, 81462, 81446, 81420,
                    81419, 81418, 81414, 81413, 81412, 81411, 81404, 81403, 81402, 81401,
                    81399, 81393, 81392, 81391, 81390, 81389, 81388, 81387, 81384, 81383,
                    81382, 81381, 81380, 81379, 81378, 81377, 81376, 81375, 81374, 81373,
                    81372, 81371, 81363, 81361, 81360, 81359, 81357, 81355, 81354, 81352,
                    81351, 81350, 81339, 81338, 81337, 81336, 81335, 81334, 81333, 81327,
                    81326, 81323, 81320, 81318, 81312, 81311, 81308, 81301, 81300, 81298,
                    81297, 81296, 81295, 81294, 81293, 81292, 81291, 81289, 81288, 81286,
                    81283, 81282, 81281, 81277, 81276, 81275, 81272, 81268, 81267, 81266,
                    81250, 81248, 81247, 81245, 81243, 81242, 81240, 81239, 81236, 81225,
                    81198, 81191, 81181, 81167, 81166, 81165, 81164, 81163, 81162, 81157,
                    81156, 81155, 81154, 81153, 81152, 81110, 81108, 81107, 81106, 81105,
                    81104, 81099, 81098, 81097, 81096, 81089, 81088, 81087, 81084, 81082,
                    81081, 81078, 81071, 81069, 81067, 81065, 81064, 81061, 81060, 81059,
                    81058, 81051, 81045, 81041, 81039, 81038, 81034, 81032, 81031, 81020,
                    81017, 81016, 81015, 81013, 81010, 81009, 81006, 80995, 80992, 80988,
                    80986, 80983, 80981, 80980, 80973, 80972, 80968, 80957, 80956, 80954,
                    80951, 80950, 80946, 80943, 80942, 80940, 80938, 80936, 80933, 80930,
                    80875, 80734, 80731, 80730, 80729, 80728, 80727, 80725, 80724, 80723,
                    80721, 80720, 80719, 80718, 80717, 80716, 80715, 80714, 80713, 80712,
                    80711, 80709, 80708, 80706, 80705, 80703, 80702, 80698, 80697, 80693,
                    80690, 80688, 80687, 80679, 80678, 80676, 80674, 80672, 80671, 80668,
                    80666, 80662, 80661, 80658, 80657, 80654, 80650, 80645, 80644, 80642,
                    80641, 80638, 80637, 80635, 80634, 80632, 80631, 80599, 80597, 80593,
                    80461, 80440, 80439, 80438, 80436, 80421, 80416, 80415, 80408, 80298,
                    80295, 80270, 80255, 80253, 80252, 80248, 80154, 80153, 80151, 80150,
                    80147, 80146, 80145, 80143, 80142, 80120, 80070, 80051, 80047, 80045,
                    80031, 80010, 80003, 80001, 79998, 79997, 79996, 79995, 79987, 79915,
                    79894, 79893, 79892, 79885, 79883, 79881, 79880, 79879, 79878, 79875,
                    79874, 79872, 79871, 79862, 79850, 79831, 79821, 79816, 79815, 79814,
                    79813, 79812, 79811, 79809, 79808, 79807, 79804, 79800, 79799, 79797,
                    79792, 79790, 79788, 79782, 79776, 79774, 79767, 79766, 79764, 79763,
                    79762, 79755, 79746, 79742, 79738, 79729, 79727, 79722, 79712, 79677,
                    79676, 79675, 79673, 79553, 79528, 79527, 79526, 79510, 79503, 79502,
                    79501, 79500, 79499, 79497, 79496, 79495, 79494, 79493, 79492, 79491,
                    79484, 79327, 79324, 79317, 79302, 79298, 79297, 79295, 79188, 79178,
                    79053, 79037, 78999, 78938, 78937, 78933, 78928, 78926, 78708, 78673,
                    78649, 78619, 78425, 78419, 78411, 78404, 78395, 78068, 78012, 78011,
                    78010, 78006, 78005, 77994, 77963, 77961, 77950, 77949, 77947, 77945,
                    77941, 77940, 77930, 77929, 77924, 77923, 77921, 77918, 77917, 77884,
                    77883, 77869, 77854, 77853, 77849, 77844, 77842, 77841, 77840, 77839,
                    77838, 77813, 77809, 77764, 77761, 77728, 77719, 77717, 77716, 77682,
                    77677, 77676, 77675, 77607, 77477, 77453, 77405, 77402, 77400, 77399,
                    77391, 77388, 77360, 77359, 77302, 77282, 77275, 77260, 77240, 77234,
                    77233, 77232, 77230, 77229, 77228, 77227, 77223, 71617, 71547, 71534,
                    71491, 71490, 71449, 61793, 58726, 46918, 46917, 46916, 46915, 46913,
                    45117, 42876, 24306, 24305, 24000, 21359, 19437, 19434, 19429, 14367,
                    12367, 12264, 12262, 12260, 12257, 12256, 12255, 12252, 12251, 12250,
                    12249, 12248, 12247, 12246, 12245, 12244, 12242, 12241, 12240, 12238,
                    12237, 12236, 12235, 12233, 12232, 12231, 12230, 12229, 12228, 12227,
                    12226, 12225, 12224, 12223, 12222, 12221, 12220, 12219, 12218, 11866,
                    11837, 11836, 11834, 11833, 11830, 11741, 11725, 11688, 11429, 11404,
                    11402, 11400, 11399, 11392, 11344, 11339, 11336, 11334, 11317, 11309,
                    11304, 11303, 11298, 11297, 11295, 11290, 11289, 11288, 11287, 11284,
                    10929, 10925, 10924, 10920, 10919, 9997, 9989, 9987, 9986, 9985,
                    9979, 9978, 9893, 9892, 9771, 9708, 9705, 9699, 9684, 9668,
                    9667, 9666, 9661, 9660, 9658, 9657, 9656, 9648, 9594, 9583,
                    9582, 9581, 9580, 9579, 9578, 9577, 9576, 9575, 9574, 9573,
                    9572, 9571, 9570, 9569, 9568, 9567, 9566, 9565, 9564, 9563,
                    9562, 9561, 9560, 9559, 9558, 9557, 9556, 9555, 9554, 9552,
                    9551, 9550, 9549, 9548, 9547, 9546, 9545, 9544, 9543, 9542,
                    9541, 9540, 9539, 9538, 9537, 9536, 9535, 9534, 9532, 9526,
                    9525, 9518, 9513, 9499, 9496, 9495, 9494, 9493, 9492, 9488,
                    9486, 9470, 9468, 9463, 9462, 9460, 9452, 9436, 9342, 9339,
                    9296, 9280, 9274, 9269, 9266, 9265, 9264, 9195, 9171, 9163,
                    9161, 9160, 9159, 9158, 9152, 9149, 9148, 9147, 9144, 9143,
                    9142, 9140, 9139, 9138, 9135, 9134, 9130, 9129, 9124, 9123,
                    9024, 8883, 8804, 8802, 8800, 8799, 8798, 8797, 8752, 8751,
                    8750, 8749, 8748, 8747, 8744, 8743, 8742, 8741, 8740, 8738,
                    8737, 8735, 8734, 8733, 8732, 8731, 8728, 8697, 8695, 8686,
                    8685, 8684, 8683, 8652, 8648, 8646, 8644, 8609, 8575, 8574,
                    8573, 8466, 8453, 8451, 8450, 8389, 6470, 4949, 4933, 4460,
                    4459, 4458, 4456, 4455, 4453, 4452, 4451, 4450, 4449, 4448,
                    4443, 2187, 560, 553, 524, 523, 521, 520, 508, 503,
                    488, 487, 486, 45, 42, 41, 40, 39, 38, 37,
                    36, 34, 33, 9, 8, 4, 1
                ],
                // Combined list for backward compatibility (all generations merged)
                get processNumbers() {
                    return [...this.generation2, ...this.generation1];
                }
            }
        };
    }

    /**
     * Load rendering configuration
     * @returns {Object} Rendering configuration
     */
    loadRenderingConfig() {
        return {
            containers: {
                graphContainer: {
                    minHeight: '100px',
                    width: '100%',
                    height: 'auto',
                    border: 'none',
                    borderRadius: '0',
                    background: 'white',
                    position: 'relative',
                    margin: '0',
                    padding: '0'
                },
                cpeeSection: {
                    height: '400px',
                    maxHeight: '400px',
                    minHeight: '400px',
                    overflowY: 'auto',
                    overflowX: 'auto'
                },
                mermaidSection: {
                    maxHeight: '400px',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    padding: '0'
                }
            },
            svg: {
                defaultHeight: '400px',
                minHeight: '100px',
                padding: '20px',
                namespace: 'http://www.w3.org/2000/svg',
                version: '1.1',
                xmlnsX: 'http://www.w3.org/1999/xlink'
            },
            scaling: {
                // Graph scaling levels - can be any positive numbers
                // Values represent multiplier (e.g., 0.3 = 30%, 1.0 = 100%)
                // Range: 30% to 100% in 0.1 (10%) increments
                levels: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
                // Default scale when no scale is stored
                default: 1.0
            },
            fallback: {
                errorMessage: {
                    margin: '20px',
                    padding: '15px',
                    border: '1px solid #ffc107',
                    backgroundColor: '#fff3cd',
                    color: '#856404',
                    borderRadius: '4px'
                }
            }
        };
    }

    /**
     * Load network configuration
     * @returns {Object} Network configuration
     */
    loadNetworkConfig() {
        return {
            timeouts: {
                default: 15000,
                libraryLoad: 10000,
                uiAutoHide: 3000,
                transitionDelay: 100
            },
            retries: {
                maxAttempts: 3,
                backoffMultiplier: 1.5,
                initialDelay: 1000
            },
            interRequestDelay: 1000,  // Delay between batches in ms (2 seconds to avoid rate limits)
            scanConcurrency: 50  // Max parallel requests
        };
    }

    /**
     * Load Mermaid configuration
     * @returns {Object} Mermaid configuration
     */
    loadMermaidConfig() {
        return {
            default: {
                startOnLoad: false,
                theme: 'base',
                securityLevel: 'loose',
                fontFamily: 'Adwaita Sans Regular',
                fontSize: 14,
                maxEdges: 5000,  // Increase edge limit (default is 500)
                suppressErrorRendering: true  // Prevent Mermaid from automatically appending error messages to DOM
            },
            // css: {
            //     textFontSize: '30px',
            //     tspanFontSize: '30px'
            // },
            themeVariables: {
                fontSize: '14px',
                primaryColor: '#ffffff',
                primaryBorderColor: '#000000',
                primaryTextColor: '#000000',
                mainBkg: '#ffffff',
                secondBkg: '#ffffff',
                tertiaryColor: '#ffffff',
                altBackground: '#ffffff',
                nodeBorder: '#000000',
                secondaryBorderColor: '#000000',
                tertiaryBorderColor: '#000000',
                secondaryTextColor: '#000000',
                tertiaryTextColor: '#000000',
                clusterBkg: 'none',
                clusterBorder: '#000000'
            },
            flowchart: {
                htmlLabels: true,
                curve: 'basis',
                padding: 15,
                nodeSpacing: 25,
                rankSpacing: 35,
                useMaxWidth: false
            },
            sequence: {
                diagramMarginX: 25,
                diagramMarginY: 6,
                actorMargin: 25,
                width: 100,
                height: 40,
                boxMargin: 6,
                boxTextMargin: 3,
                noteMargin: 6,
                messageMargin: 20,
                useMaxWidth: false
            },
            gantt: {
                titleTopMargin: 15,
                barHeight: 12,
                fontSize: 8,
                fontFamily: 'Adwaita Sans Regular',
                numberSectionStyles: 4,
                axisFormat: '%Y-%m-%d',
                useMaxWidth: false
            },
            availableThemes: ['base', 'default', 'dark', 'forest', 'neutral']
        };
    }

    /**
     * Load CPEE-specific configuration
     * @returns {Object} CPEE configuration
     */
    loadCPEEConfig() {
        return {
            wfadaptor: {
                // Theme resources loaded from cpee.org - CORS proxy handles rngs/*.rng and symbols/*.svg
                themeBaseUrl: 'https://cpee.org/flow/themes',
                themePath: 'https://cpee.org/flow/themes/presetaltid/theme.js',
                cssPath: 'https://cpee.org/flow/css/wfadaptor.css',
                baseThemePath: 'https://cpee.org/flow/themes/base.js',
                wfadaptorPath: 'https://cpee.org/flow/js/wfadaptor.js'
            },
            rendering: {
                minHeight: '100px',
                defaultHeight: '400px',
                padding: '20px',
                backgroundColor: '#ffffff',
                // Switch to control proxy vs fallback behavior
                // When true: directly use fallback (skip proxy)
                // When false: try proxy first, then fallback
                useFallbackDirectly: true
            },
            validation: {
                requireDescription: true,
                validateXMLStructure: true,
                checkElementExistence: true
            }
        };
    }

    /**
     * Load DOM-related configuration
     * @returns {Object} DOM configuration
     */
    loadDOMConfig() {
        return {
            elementIds: {
                // Content sections
                processAnalysis: 'process-analysis',
                inputCpeeContent: 'input-cpee-content',
                outputCpeeContent: 'output-cpee-content',
                inputIntermediateContent: 'input-intermediate-content',
                outputIntermediateContent: 'output-intermediate-content',
                userInputContent: 'user-input-content',
                
                // Log display
                rawLogSection: 'raw-log-section',
                rawLogContent: 'raw-log-content',
                viewLog: 'view-log',
                
                // Form elements
                uuidInput: 'uuid-input',
                processNumberInput: 'process-number-input',
                loadInstance: 'load-instance',
                scanStartInput: 'scan-start-input',
                scanEndInput: 'scan-end-input',
                scanInstances: 'scan-instances',
                loadAllInstances: 'load-all-instances',
                loadGeneration1Instances: 'load-generation1-instances',
                loadGeneration2Instances: 'load-generation2-instances',
                loadAllKnownInstances: 'load-all-known-instances',
                instanceListContainer: 'instance-list-container',
                instanceList: 'instance-list',
                loadAllInstancesListContainer: 'load-all-instances-list-container',
                knownInstancesFilter: 'known-instances-filter',
                knownInstancesFilterInput: 'known-instances-filter-input',
                knownInstancesErrorSelect: 'known-instances-error-select',
                knownInstancesFilterClear: 'known-instances-filter-clear',
                knownInstancesErrorClear: 'known-instances-error-clear',
                loadAllInstancesList: 'load-all-instances-list',
                
                // Instance management
                instanceTabs: 'instance-tabs',
                
                // Main app structure
                app: 'app',
                appTitle: 'app-title',
                headerContent: 'header-content',
                
                // Section IDs (for dynamic access)
                inputCpee: 'input-cpee',
                inputIntermediate: 'input-intermediate',
                outputIntermediate: 'output-intermediate',
                outputCpee: 'output-cpee',
                
                
                // UI elements
                darkModeToggleContainer: 'dark-mode-toggle-container',
                
                // Note: The following elements are dynamically created and registered by their components:
                // - themeDropdownTrigger, themeDropdownMenu, themeDropdownContainer (registered by ThemeSelector.initialize())
                // - darkModeToggleBtn, darkModeToggle (registered by DarkModeToggle.initialize())
                // - prism-theme (created lazily by SyntaxHighlightingService)
            },
            classes: {
                hidden: 'hidden',
                transitioning: 'transitioning',
                noContent: 'no-content',
                contentError: 'content-error',
                userInputSection: 'user-input-section',
                rawContentActions: 'raw-content-actions'
            },
            attributes: {
                contentType: 'data-content-type',
                processNumber: 'data-process-number'
            }
        };
    }

    /**
     * Load timing configuration
     * @returns {Object} Timing configuration
     */
    loadTimingConfig() {
        return {
            transitions: {
                fadeIn: 150,
                fadeOut: 100,
                slideIn: 200,
                slideOut: 150
            },
            delays: {
                successMessage: 2000,
                errorMessage: 3000,
                warningMessage: 2500,
                autoHide: 100,
                heightPreservation: 100
            },
            intervals: {
                statusCheck: 1000,
                progressUpdate: 500,
                cacheCleanup: 300000 // 5 minutes
            }
        };
    }

    /**
     * Load styling configuration
     * @returns {Object} Styling configuration
     */
    loadStylingConfig() {
        return {
            colors: {
                primary: '#007bff',
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8',
                background: '#ffffff',
                surface: '#f8f9fa',
                border: '#dee2e6',
                textPrimary: '#212529',
                textSecondary: '#6c757d'
            },
            spacing: {
                xs: '4px',
                sm: '8px',
                md: '16px',
                lg: '24px',
                xl: '32px'
            },
            borderRadius: {
                sm: '4px',
                md: '8px',
                lg: '12px'
            },
            shadows: {
                sm: '0 1px 2px rgba(0,0,0,0.1)',
                md: '0 2px 4px rgba(0,0,0,0.1)',
                lg: '0 4px 8px rgba(0,0,0,0.1)'
            },
            typography: {
                fontFamily: {
                    primary: 'Adwaita Sans Regular',
                    monospace: 'Adwaita Mono Regular'
                },
                fontSize: {
                    xs: '0.75rem',
                    sm: '0.875rem',
                    md: '1rem',
                    lg: '1.125rem',
                    xl: '1.25rem'
                },
                fontWeight: {
                    normal: '400',
                    medium: '500',
                    semibold: '600',
                    bold: '700'
                }
            }
        };
    }

    /**
     * Load syntax highlighting (Prism.js) configuration
     * @returns {Object} Syntax highlighting configuration
     */
    loadSyntaxHighlightingConfig() {
        return {
            enabled: true,
            highlightOnRender: true,
            // themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-coldark-cold.min.css',
            // themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-base16-ateliersulphurpool.light.min.css',
            themeUrl: 'https://cdn.jsdelivr.net/npm/prism-themes@1.9.0/themes/prism-duotone-light.min.css',

            autoloaderPath: 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/',
            languages: ['xml', 'mermaid'],
            typography: {
                fontSize: '13px',
                fontFamily: 'Adwaita Mono Regular',
                fontFace: {
                    enabled: true,
                    name: 'Adwaita Mono Regular',
                    src: 'src/assets/fonts/adwaita-mono-regular.ttf',
                    weight: '400',
                    style: 'normal'
                }
            },
            codeBlockBackground: 'transparent',
            colors: {
                tag: '#374151',
                attrName: '#2563eb',
                attrValue: '#b91c1c',
                punctuation: '#9ca3af',
                textContent: '#008000',
                dark: {
                    tag: '#a8b8d0',
                    attrName: '#6ba3f5',
                    attrValue: '#f5a5a5',
                    punctuation: '#94a3b8',
                    textContent: '#86efac'
                }
            },
            mermaid: {
                id: '#b91c1c',
                punctuation: '#9ca3af',
                parentheses: '#008000',
                condition: '#2563eb',
                default: '#374151',
                dark: {
                    id: '#f5a5a5',
                    punctuation: '#94a3b8',
                    parentheses: '#86efac',
                    condition: '#6ba3f5',
                    default: '#a8b8d0'
                }
            },
            trace: {
                punctuation: '#9ca3af',
                keys: '#000000',
                ids: '#b91c1c',
                tasks: '#008000',
                dark: {
                    punctuation: '#94a3b8',
                    keys: '#b8c5d8',
                    ids: '#f5a5a5',
                    tasks: '#86efac'
                }
            }             
        };
    }

    /**
     * Get configuration value by path
     * @param {string} path - Dot-separated path to configuration value
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Configuration value or default
     */
    get(path, defaultValue = null) {
        try {
            return path.split('.').reduce((obj, key) => {
                if (obj && typeof obj === 'object' && key in obj) {
                    return obj[key];
                }
                return defaultValue;
            }, this.config);
        } catch (error) {
            console.warn(`ConfigManager: Error accessing path '${path}':`, error);
            return defaultValue;
        }
    }

    /**
     * Set configuration value by path
     * @param {string} path - Dot-separated path to configuration value
     * @param {*} value - Value to set
     */
    set(path, value) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, key) => {
                if (!obj[key] || typeof obj[key] !== 'object') {
                    obj[key] = {};
                }
                return obj[key];
            }, this.config);
            
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // Notify observers of the change
            this.notifyObservers(path, value, oldValue);
            
        } catch (error) {
            console.error(`ConfigManager: Error setting path '${path}':`, error);
        }
    }

    /**
     * Check if configuration path exists
     * @param {string} path - Dot-separated path to check
     * @returns {boolean} True if path exists
     */
    has(path) {
        try {
            const keys = path.split('.');
            let current = this.config;
            
            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.warn(`ConfigManager: Error checking path '${path}':`, error);
            return false;
        }
    }

    /**
     * Get entire configuration object
     * @returns {Object} Complete configuration
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.config)); // Deep clone
    }

    /**
     * Get configuration section
     * @param {string} section - Section name (api, ui, rendering, etc.)
     * @returns {Object} Configuration section
     */
    getSection(section) {
        return this.get(section, {});
    }

    /**
     * Merge configuration with existing values
     * @param {string} path - Dot-separated path to merge into
     * @param {Object} values - Values to merge
     */
    merge(path, values) {
        const existing = this.get(path, {});
        const merged = this.deepMerge(existing, values);
        this.set(path, merged);
    }

    /**
     * Subscribe to configuration changes
     * @param {string} path - Path to watch (supports wildcards with *)
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.observers.has(path)) {
            this.observers.set(path, new Set());
        }
        
        this.observers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const observers = this.observers.get(path);
            if (observers) {
                observers.delete(callback);
                if (observers.size === 0) {
                    this.observers.delete(path);
                }
            }
        };
    }

    /**
     * Notify observers of configuration changes
     * @param {string} path - Changed path
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    notifyObservers(path, newValue, oldValue) {
        // Notify exact path matches
        const exactObservers = this.observers.get(path);
        if (exactObservers) {
            exactObservers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('ConfigManager: Observer callback error:', error);
                }
            });
        }

        // Notify wildcard matches
        this.observers.forEach((observers, observerPath) => {
            if (observerPath.includes('*')) {
                const pattern = observerPath.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                if (regex.test(path)) {
                    observers.forEach(callback => {
                        try {
                            callback(newValue, oldValue, path);
                        } catch (error) {
                            console.error('ConfigManager: Observer callback error:', error);
                        }
                    });
                }
            }
        });
    }

    /**
     * Deep merge utility for configuration objects
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = this.deepMerge(result[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        
        return result;
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result with errors and warnings
     */
    validate(config = this.config) {
        const result = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Validate required sections
        const requiredSections = ['api', 'ui', 'rendering', 'network'];
        requiredSections.forEach(section => {
            if (!config[section]) {
                result.errors.push(`Missing required section: ${section}`);
                result.valid = false;
            }
        });

        // Validate API configuration
        if (config.api) {
            if (!config.api.endpoints?.cpeeBase) {
                result.errors.push('Missing API endpoint: cpeeBase');
                result.valid = false;
            }
            if (!config.api.cors?.proxy) {
                result.warnings.push('No CORS proxy configured');
            }
        }

        // Validate timing configuration
        if (config.timing) {
            Object.entries(config.timing).forEach(([category, timings]) => {
                Object.entries(timings).forEach(([key, value]) => {
                    if (typeof value === 'number' && value < 0) {
                        result.errors.push(`Invalid timing value: ${category}.${key} = ${value}`);
                        result.valid = false;
                    }
                });
            });
        }

        return result;
    }

    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = this.loadAllConfigurations();
        this.notifyObservers('*', this.config, null);
    }

    /**
     * Export configuration to JSON string
     * @returns {string} JSON string representation
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON string
     * @param {string} jsonString - JSON string to import
     * @returns {boolean} True if import successful
     */
    import(jsonString) {
        try {
            const importedConfig = JSON.parse(jsonString);
            const validation = this.validate(importedConfig);
            
            if (validation.valid) {
                this.config = this.deepMerge(this.config, importedConfig);
                this.notifyObservers('*', this.config, null);
                return true;
            } else {
                console.error('ConfigManager: Import validation failed:', validation.errors);
                return false;
            }
        } catch (error) {
            console.error('ConfigManager: Import failed:', error);
            return false;
        }
    }

    /**
     * Load Recent Additions and Fixes configuration
     * @returns {Object} Recent additions and fixes configuration
     */
    loadRecentAdditionsConfig() {
        return {
            issues: [
                {
                    title: 'Fixed CPEE SVG task rendering issue',
                    status: 'closed',
                    labels: ['cpee rendering', 'bug'],
                    date: '2025-11-10',
                    description: 'SVG reference attributes resolve globally -> solved by using namespace IDs for each graph, to avoid clipPath ID collisions (4913)'
                },
                {
                    title: 'Filter duplicate control flow arrows in Mermaid Graphs',
                    status: 'closed',
                    labels: ['mermaid preprocessing', 'feature'],
                    date: '2025-11-11',
                    description: 'Made control flow arrows unique, e.g.: "gw40s:exclusivegateway:{x}-->gw40e:exclusivegateway:{x}" appears 20+ times in 1465. Resolved "Too many edges" mermaid rendering error (1465)'
                },
                {
                    title: 'Fix faulty Mermaid Trace calculation',
                    status: 'closed',
                    labels: ['mermaid preprocessing', 'traces', 'bug'],
                    date: '2025-11-11',
                    description: '"{AND}" was missing after ":parallelgateway:" edges, causing edges not to be recognized as parallel AND-join or AND-split (5040)'
                },
                {
                    title: 'Add logic for reachability + bounds structure',
                    status: 'closed',
                    labels: ['traces', 'feature'],
                    date: null,
                    description: null
                },
                {
                    title: 'Improve cross-sectional highlighting',
                    status: 'closed',
                    labels: ['cross sectional highlighting', 'feature'],
                    date: null,
                    description: 'Include script tasks, message events, and other non-standard node types (6548)'
                },


            
                {
                    title: 'Task/Gateway hover functionality',
                    status: 'open',
                    labels: ['feature'],
                    date: null,
                    description: 'On Task/Gateway hover: show alt_id, id, (confidence of match)'
                }
            ]
        };
    }

    /**
     * Get configuration summary for debugging
     * @returns {Object} Configuration summary
     */
    getSummary() {
        return {
            sections: Object.keys(this.config),
            totalKeys: this.countKeys(this.config),
            observers: this.observers.size,
            validation: this.validate()
        };
    }

    /**
     * Count total configuration keys recursively
     * @param {Object} obj - Object to count keys in
     * @returns {number} Total key count
     */
    countKeys(obj) {
        let count = 0;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                count++;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    count += this.countKeys(obj[key]);
                }
            }
        }
        return count;
    }
}

// Create singleton instance
export const configManager = new ConfigManager();

// Export for backward compatibility
export default configManager;