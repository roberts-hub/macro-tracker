// Base de datos de alimentos — valores por 100 g (crudo salvo que se indique).
// kcal, p=proteína(g), c=carbohidratos(g), f=grasa(g), fib=fibra(g)
// portions: presets rápidos con gramos aproximados.
window.FOOD_DB = [
  // ----- Proteínas animales -----
  { id: "pollo_pechuga", name: "Pechuga de pollo (cocida)", aliases:["pollo","pechuga"], kcal:165, p:31, c:0, f:3.6, fib:0, portions:[{label:"1 pechuga (170 g)",g:170},{label:"100 g",g:100},{label:"1 porción (120 g)",g:120}] },
  { id: "pollo_muslo", name: "Muslo de pollo (cocido, sin piel)", aliases:["muslo","pierna pollo"], kcal:209, p:26, c:0, f:11, fib:0, portions:[{label:"1 muslo (120 g)",g:120},{label:"100 g",g:100}] },
  { id: "res_magra", name: "Carne de res magra (cocida)", aliases:["res","carne","bistec","bife"], kcal:217, p:27, c:0, f:11, fib:0, portions:[{label:"1 porción (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "molida_res", name: "Carne molida de res 90/10 (cocida)", aliases:["molida","picada"], kcal:217, p:26, c:0, f:12, fib:0, portions:[{label:"1 porción (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "cerdo_lomo", name: "Lomo de cerdo (cocido)", aliases:["cerdo","puerco","chuleta"], kcal:206, p:28, c:0, f:9.6, fib:0, portions:[{label:"1 porción (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "salmon", name: "Salmón (cocido)", aliases:["salmon"], kcal:208, p:20, c:0, f:13, fib:0, portions:[{label:"1 filete (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "atun_agua", name: "Atún en agua (lata, escurrido)", aliases:["atun","tuna"], kcal:116, p:26, c:0, f:1, fib:0, portions:[{label:"1 lata (120 g)",g:120},{label:"100 g",g:100}] },
  { id: "tilapia", name: "Tilapia / pescado blanco (cocido)", aliases:["tilapia","pescado","mojarra"], kcal:128, p:26, c:0, f:2.7, fib:0, portions:[{label:"1 filete (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "camaron", name: "Camarón (cocido)", aliases:["camaron","gamba"], kcal:99, p:24, c:0.2, f:0.3, fib:0, portions:[{label:"1 porción (120 g)",g:120},{label:"100 g",g:100}] },
  { id: "huevo", name: "Huevo entero", aliases:["huevo","huevos"], kcal:143, p:13, c:1.1, f:9.5, fib:0, portions:[{label:"1 huevo (50 g)",g:50},{label:"2 huevos (100 g)",g:100},{label:"3 huevos (150 g)",g:150}] },
  { id: "clara", name: "Clara de huevo", aliases:["clara","claras"], kcal:52, p:11, c:0.7, f:0.2, fib:0, portions:[{label:"1 clara (33 g)",g:33},{label:"3 claras (100 g)",g:100}] },
  { id: "jamon_pavo", name: "Jamón de pavo", aliases:["jamon","pavo"], kcal:104, p:17, c:3, f:2.5, fib:0, portions:[{label:"2 rebanadas (50 g)",g:50},{label:"100 g",g:100}] },

  // ----- Lácteos -----
  { id: "leche_entera", name: "Leche entera", aliases:["leche"], kcal:61, p:3.2, c:4.8, f:3.3, fib:0, portions:[{label:"1 vaso (240 ml)",g:240},{label:"100 ml",g:100}] },
  { id: "leche_descremada", name: "Leche descremada", aliases:["leche light","descremada"], kcal:34, p:3.4, c:5, f:0.1, fib:0, portions:[{label:"1 vaso (240 ml)",g:240},{label:"100 ml",g:100}] },
  { id: "yogur_griego", name: "Yogur griego natural", aliases:["yogur","yogurt","griego"], kcal:59, p:10, c:3.6, f:0.4, fib:0, portions:[{label:"1 envase (150 g)",g:150},{label:"1 taza (245 g)",g:245},{label:"100 g",g:100}] },
  { id: "queso_panela", name: "Queso panela / fresco", aliases:["panela","queso fresco"], kcal:215, p:18, c:3, f:14, fib:0, portions:[{label:"1 rebanada (40 g)",g:40},{label:"100 g",g:100}] },
  { id: "queso_cheddar", name: "Queso cheddar/manchego", aliases:["queso","cheddar","manchego"], kcal:402, p:25, c:1.3, f:33, fib:0, portions:[{label:"1 rebanada (28 g)",g:28},{label:"100 g",g:100}] },
  { id: "requeson", name: "Requesón / cottage", aliases:["requeson","cottage"], kcal:98, p:11, c:3.4, f:4.3, fib:0, portions:[{label:"1/2 taza (113 g)",g:113},{label:"100 g",g:100}] },

  // ----- Carbohidratos / cereales -----
  { id: "arroz_blanco", name: "Arroz blanco (cocido)", aliases:["arroz"], kcal:130, p:2.7, c:28, f:0.3, fib:0.4, portions:[{label:"1 taza (158 g)",g:158},{label:"1/2 taza (79 g)",g:79},{label:"100 g",g:100}] },
  { id: "arroz_integral", name: "Arroz integral (cocido)", aliases:["arroz integral"], kcal:123, p:2.7, c:26, f:1, fib:1.6, portions:[{label:"1 taza (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "avena", name: "Avena (cruda)", aliases:["avena","oats"], kcal:389, p:17, c:66, f:7, fib:11, portions:[{label:"1/2 taza (40 g)",g:40},{label:"1 taza (80 g)",g:80},{label:"100 g",g:100}] },
  { id: "pan_integral", name: "Pan integral", aliases:["pan","pan integral"], kcal:247, p:13, c:41, f:3.4, fib:7, portions:[{label:"1 rebanada (28 g)",g:28},{label:"2 rebanadas (56 g)",g:56},{label:"100 g",g:100}] },
  { id: "tortilla_maiz", name: "Tortilla de maíz", aliases:["tortilla","tortillas","maiz"], kcal:218, p:5.7, c:45, f:2.9, fib:6.3, portions:[{label:"1 tortilla (30 g)",g:30},{label:"3 tortillas (90 g)",g:90},{label:"100 g",g:100}] },
  { id: "tortilla_harina", name: "Tortilla de harina", aliases:["tortilla harina","wrap"], kcal:312, p:8, c:51, f:8, fib:3, portions:[{label:"1 tortilla (45 g)",g:45},{label:"100 g",g:100}] },
  { id: "pasta", name: "Pasta (cocida)", aliases:["pasta","spaghetti","fideos","macarrones"], kcal:158, p:6, c:31, f:0.9, fib:1.8, portions:[{label:"1 taza (140 g)",g:140},{label:"100 g",g:100}] },
  { id: "papa", name: "Papa / patata (cocida)", aliases:["papa","patata"], kcal:87, p:1.9, c:20, f:0.1, fib:1.8, portions:[{label:"1 papa mediana (170 g)",g:170},{label:"100 g",g:100}] },
  { id: "camote", name: "Camote / batata (cocido)", aliases:["camote","batata","boniato"], kcal:90, p:2, c:21, f:0.1, fib:3.3, portions:[{label:"1 mediano (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "platano", name: "Plátano (banana)", aliases:["platano","banana","banano","guineo"], kcal:89, p:1.1, c:23, f:0.3, fib:2.6, portions:[{label:"1 mediano (120 g)",g:120},{label:"100 g",g:100}] },
  { id: "tortilla_avena", name: "Hojuelas de maíz/cereal", aliases:["cereal","corn flakes","hojuelas"], kcal:357, p:7, c:84, f:0.4, fib:3, portions:[{label:"1 taza (30 g)",g:30},{label:"100 g",g:100}] },
  { id: "quinoa", name: "Quinoa (cocida)", aliases:["quinoa","quinua"], kcal:120, p:4.4, c:21, f:1.9, fib:2.8, portions:[{label:"1 taza (185 g)",g:185},{label:"100 g",g:100}] },

  // ----- Legumbres -----
  { id: "frijol", name: "Frijoles (cocidos)", aliases:["frijol","frijoles","poroto","judias"], kcal:127, p:8.7, c:23, f:0.5, fib:6.4, portions:[{label:"1 taza (177 g)",g:177},{label:"1/2 taza (89 g)",g:89},{label:"100 g",g:100}] },
  { id: "lenteja", name: "Lentejas (cocidas)", aliases:["lenteja","lentejas"], kcal:116, p:9, c:20, f:0.4, fib:7.9, portions:[{label:"1 taza (198 g)",g:198},{label:"100 g",g:100}] },
  { id: "garbanzo", name: "Garbanzos (cocidos)", aliases:["garbanzo","garbanzos"], kcal:164, p:8.9, c:27, f:2.6, fib:7.6, portions:[{label:"1 taza (164 g)",g:164},{label:"100 g",g:100}] },

  // ----- Verduras -----
  { id: "brocoli", name: "Brócoli", aliases:["brocoli"], kcal:34, p:2.8, c:7, f:0.4, fib:2.6, portions:[{label:"1 taza (90 g)",g:90},{label:"100 g",g:100}] },
  { id: "espinaca", name: "Espinaca", aliases:["espinaca","espinacas"], kcal:23, p:2.9, c:3.6, f:0.4, fib:2.2, portions:[{label:"1 taza (30 g)",g:30},{label:"100 g",g:100}] },
  { id: "ensalada_mixta", name: "Ensalada verde mixta", aliases:["ensalada","lechuga","verduras"], kcal:20, p:1.5, c:3.5, f:0.2, fib:1.8, portions:[{label:"1 plato (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "tomate", name: "Tomate / jitomate", aliases:["tomate","jitomate"], kcal:18, p:0.9, c:3.9, f:0.2, fib:1.2, portions:[{label:"1 mediano (120 g)",g:120},{label:"100 g",g:100}] },
  { id: "aguacate", name: "Aguacate / palta", aliases:["aguacate","palta"], kcal:160, p:2, c:9, f:15, fib:7, portions:[{label:"1 unidad (200 g)",g:200},{label:"1/2 unidad (100 g)",g:100},{label:"100 g",g:100}] },
  { id: "zanahoria", name: "Zanahoria", aliases:["zanahoria"], kcal:41, p:0.9, c:10, f:0.2, fib:2.8, portions:[{label:"1 mediana (60 g)",g:60},{label:"100 g",g:100}] },

  // ----- Frutas -----
  { id: "manzana", name: "Manzana", aliases:["manzana"], kcal:52, p:0.3, c:14, f:0.2, fib:2.4, portions:[{label:"1 mediana (180 g)",g:180},{label:"100 g",g:100}] },
  { id: "fresa", name: "Fresas", aliases:["fresa","fresas","frutilla"], kcal:32, p:0.7, c:7.7, f:0.3, fib:2, portions:[{label:"1 taza (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "arandano", name: "Arándanos / berries", aliases:["arandano","berries","mora"], kcal:57, p:0.7, c:14, f:0.3, fib:2.4, portions:[{label:"1 taza (148 g)",g:148},{label:"100 g",g:100}] },
  { id: "naranja", name: "Naranja", aliases:["naranja"], kcal:47, p:0.9, c:12, f:0.1, fib:2.4, portions:[{label:"1 mediana (130 g)",g:130},{label:"100 g",g:100}] },
  { id: "mango", name: "Mango", aliases:["mango"], kcal:60, p:0.8, c:15, f:0.4, fib:1.6, portions:[{label:"1 taza (165 g)",g:165},{label:"100 g",g:100}] },

  // ----- Grasas / frutos secos -----
  { id: "aceite_oliva", name: "Aceite de oliva", aliases:["aceite","oliva"], kcal:884, p:0, c:0, f:100, fib:0, portions:[{label:"1 cda (14 g)",g:14},{label:"1 cdta (5 g)",g:5}] },
  { id: "mantequilla_mani", name: "Mantequilla de maní/cacahuate", aliases:["mani","cacahuate","peanut butter","crema de mani"], kcal:588, p:25, c:20, f:50, fib:6, portions:[{label:"1 cda (16 g)",g:16},{label:"2 cdas (32 g)",g:32},{label:"100 g",g:100}] },
  { id: "almendra", name: "Almendras", aliases:["almendra","almendras"], kcal:579, p:21, c:22, f:50, fib:12, portions:[{label:"1 puño (28 g)",g:28},{label:"100 g",g:100}] },
  { id: "nuez", name: "Nueces / mix de frutos secos", aliases:["nuez","nueces","frutos secos"], kcal:607, p:15, c:21, f:54, fib:7, portions:[{label:"1 puño (28 g)",g:28},{label:"100 g",g:100}] },

  // ----- Suplementos / extras -----
  { id: "whey", name: "Proteína whey (polvo)", aliases:["whey","proteina","scoop","batido"], kcal:400, p:80, c:8, f:6, fib:1, portions:[{label:"1 scoop (30 g)",g:30},{label:"2 scoops (60 g)",g:60},{label:"100 g",g:100}] },
  { id: "creatina", name: "Creatina", aliases:["creatina","creatine"], kcal:0, p:0, c:0, f:0, fib:0, portions:[{label:"1 scoop (5 g)",g:5},{label:"100 g",g:100}] },
  { id: "miel", name: "Miel", aliases:["miel"], kcal:304, p:0.3, c:82, f:0, fib:0.2, portions:[{label:"1 cda (21 g)",g:21},{label:"100 g",g:100}] },
  { id: "azucar", name: "Azúcar", aliases:["azucar"], kcal:387, p:0, c:100, f:0, fib:0, portions:[{label:"1 cdta (4 g)",g:4},{label:"1 cda (12 g)",g:12}] },
  { id: "chocolate", name: "Chocolate negro 70%", aliases:["chocolate"], kcal:579, p:7.8, c:46, f:38, fib:11, portions:[{label:"1 porción (25 g)",g:25},{label:"100 g",g:100}] },

  // ----- Platillos y comidas comunes (México/Latam) -----
  { id: "cafe", name: "Café negro", aliases:["cafe","café","americano","espresso"], kcal:2, p:0.3, c:0, f:0, fib:0, portions:[{label:"1 taza (240 ml)",g:240},{label:"1 shot (30 ml)",g:30}] },
  { id: "taco_pastor", name: "Taco al pastor", aliases:["taco","tacos","pastor"], kcal:226, p:12, c:18, f:11, fib:2, portions:[{label:"1 taco (85 g)",g:85},{label:"100 g",g:100}] },
  { id: "quesadilla", name: "Quesadilla", aliases:["quesadilla","quesadillas"], kcal:295, p:13, c:27, f:15, fib:2, portions:[{label:"1 quesadilla (120 g)",g:120},{label:"100 g",g:100}] },
  { id: "pizza", name: "Pizza", aliases:["pizza"], kcal:266, p:11, c:33, f:10, fib:2.3, portions:[{label:"1 rebanada (107 g)",g:107},{label:"2 rebanadas (214 g)",g:214},{label:"100 g",g:100}] },
  { id: "hamburguesa", name: "Hamburguesa", aliases:["hamburguesa","burger"], kcal:254, p:14, c:19, f:13, fib:1.5, portions:[{label:"1 hamburguesa (215 g)",g:215},{label:"100 g",g:100}] },
  { id: "papas_fritas", name: "Papas a la francesa", aliases:["papas fritas","papas a la francesa","french fries","frances"], kcal:312, p:3.4, c:41, f:15, fib:3.8, portions:[{label:"1 orden (117 g)",g:117},{label:"100 g",g:100}] },
  { id: "pan_blanco", name: "Pan blanco / bolillo", aliases:["bolillo","pan blanco","telera","baguette"], kcal:275, p:9, c:52, f:3.5, fib:2.4, portions:[{label:"1 bolillo (60 g)",g:60},{label:"1 rebanada (28 g)",g:28},{label:"100 g",g:100}] },
  { id: "sandwich", name: "Sándwich (jamón y queso)", aliases:["sandwich","sándwich","torta","emparedado"], kcal:250, p:13, c:28, f:9, fib:2, portions:[{label:"1 sándwich (150 g)",g:150},{label:"100 g",g:100}] },
  { id: "leche_almendras", name: "Leche de almendras", aliases:["leche de almendras","leche de almendra","almond milk","leche almendra","leche vegetal"], kcal:15, p:0.6, c:0.6, f:1.2, fib:0.3, portions:[{label:"1 vaso (240 ml)",g:240},{label:"100 ml",g:100}] },
  { id: "barra_proteina", name: "Barra de proteína", aliases:["barra de proteina","barra proteica","protein bar","barrita"], kcal:350, p:30, c:38, f:10, fib:4, portions:[{label:"1 barra (60 g)",g:60},{label:"100 g",g:100}] },
  { id: "guacamole", name: "Guacamole", aliases:["guacamole","guaca"], kcal:155, p:2, c:9, f:14, fib:6.5, portions:[{label:"1 porción (90 g)",g:90},{label:"100 g",g:100}] },
  { id: "frijol_refrito", name: "Frijoles refritos", aliases:["frijoles refritos","refritos"], kcal:145, p:7, c:19, f:4.5, fib:5.5, portions:[{label:"1 porción (130 g)",g:130},{label:"100 g",g:100}] },
];
