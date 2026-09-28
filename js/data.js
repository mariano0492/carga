// Contenido fijo de la app: ejercicios, programa, alimentos, recetas, frases y canciones.

/* ---------- Músculos ----------
   `need`: horas de recuperación. Los que tienen `fig` aparecen en la figura del cuerpo. */
export const MUSCLES = [
  { id: 'pecho', n: 'Pecho', need: 60, fig: true, target: 10 },
  { id: 'espalda', n: 'Espalda', need: 60, fig: true, target: 12 },
  { id: 'hombros', n: 'Hombros', need: 48, fig: true, target: 9 },
  { id: 'isquios', n: 'Isquios y glúteos', need: 72, fig: true, target: 9 },
  { id: 'cuad', n: 'Cuádriceps', need: 72, fig: true, target: 9 },
  { id: 'pant', n: 'Pantorrillas', need: 48, fig: true, target: 6 },
  { id: 'brazos', n: 'Brazos', need: 48, fig: false, target: 6 },
];

/* ---------- Ejercicios ----------
   big: sube 5 kg por paso · perHand: peso por mancuerna · added: lastre sobre el peso corporal · band: banda elástica */
export const EXERCISES = {
  // Rodilla dominante
  sentadilla: { n: 'Sentadilla', m: ['cuad'], big: true,
    tip: 'Pies al ancho de hombros, puntas un poco afuera. Rodillas siguiendo la línea de los pies. Bajá hasta que la cadera pase la rodilla y subí empujando el piso con todo el pie.' },
  sentadilla_frontal: { n: 'Sentadilla frontal', m: ['cuad'], big: true,
    tip: 'Barra apoyada sobre los hombros delanteros y codos altos. El torso queda más vertical: bajá profundo sin dejar caer los codos.' },
  prensa: { n: 'Prensa de piernas', m: ['cuad'], big: true,
    tip: 'Pies en el centro de la plataforma. Bajá hasta 90° de rodilla sin despegar la cadera del asiento. No bloquees las rodillas arriba.' },
  bulgara: { n: 'Sentadilla búlgara', m: ['cuad'], perHand: true,
    tip: 'Pie trasero apoyado en un banco. Bajá vertical hasta que la rodilla de atrás casi toque el piso. El peso va sobre la pierna de adelante.' },
  hack: { n: 'Sentadilla hack', m: ['cuad'], big: true,
    tip: 'Espalda apoyada en el respaldo, pies a la mitad de la plataforma. Bajá controlado y subí sin trabar las rodillas.' },
  // Empuje horizontal
  banca: { n: 'Press banca', m: ['pecho'],
    tip: 'Omóplatos juntos y hacia abajo, pies firmes en el piso. Bajá la barra al esternón con los codos a unos 45° y empujá hacia arriba y un poco atrás.' },
  banca_mancuernas: { n: 'Press con mancuernas', m: ['pecho'], perHand: true,
    tip: 'Bajá las mancuernas hasta los costados del pecho con los codos a 45°. Subí juntándolas arriba sin chocarlas.' },
  banca_inclinada: { n: 'Press inclinado', m: ['pecho'],
    tip: 'Banco a 30°. Bajá la barra a la parte alta del pecho. Mantené los omóplatos apretados contra el banco.' },
  fondos: { n: 'Fondos en paralelas', m: ['pecho', 'brazos'], added: true,
    tip: 'Inclinate un poco hacia adelante para cargar el pecho. Bajá hasta que los hombros queden a la altura de los codos.' },
  flexiones: { n: 'Flexiones lastradas', m: ['pecho'], added: true,
    tip: 'Disco en la espalda o chaleco. Cuerpo en línea recta, pecho hasta casi tocar el piso.' },
  // Remo
  remo_barra: { n: 'Remo con barra', m: ['espalda'],
    tip: 'Torso inclinado a unos 45°, espalda neutra. Llevá la barra al ombligo apretando los omóplatos. Sin balancearte.' },
  remo_apoyado: { n: 'Remo con pecho apoyado', m: ['espalda'],
    tip: 'Pecho contra el banco inclinado. Tirá con los codos hacia atrás y apretá arriba un segundo. Sin impulso de la espalda baja.' },
  remo_mancuerna: { n: 'Remo con mancuerna', m: ['espalda'], perHand: true,
    tip: 'Rodilla y mano apoyadas en el banco. Llevá la mancuerna hacia la cadera, no hacia el hombro.' },
  remo_polea: { n: 'Remo en polea baja', m: ['espalda'],
    tip: 'Pecho alto, tirá hacia el ombligo y dejá que los omóplatos se estiren al volver.' },
  remo_t: { n: 'Remo en T', m: ['espalda'],
    tip: 'Pecho sobre el apoyo o torso inclinado. Tirá con los codos cerca del cuerpo.' },
  // Bíceps
  curl_barra: { n: 'Curl con barra', m: ['brazos'],
    tip: 'Codos pegados al cuerpo. Subí sin balancear el torso y bajá en dos segundos.' },
  curl_mancuernas: { n: 'Curl con mancuernas', m: ['brazos'], perHand: true,
    tip: 'Girá la palma hacia arriba mientras subís. Un brazo por vez o los dos juntos, sin impulso.' },
  curl_martillo: { n: 'Curl martillo', m: ['brazos'], perHand: true,
    tip: 'Palmas enfrentadas todo el recorrido. Trabaja también el antebrazo.' },
  curl_polea: { n: 'Curl en polea', m: ['brazos'],
    tip: 'Tensión constante. Codos quietos y apretá arriba.' },
  // Pantorrillas
  pant_pie: { n: 'Elevación de talones de pie', m: ['pant'],
    tip: 'Bajá el talón por debajo del escalón y subí bien arriba con pausa de un segundo.' },
  pant_sentado: { n: 'Elevación de talones sentado', m: ['pant'],
    tip: 'Rodillas a 90°. Recorrido completo y lento: trabaja el sóleo.' },
  pant_prensa: { n: 'Pantorrillas en prensa', m: ['pant'],
    tip: 'Solo la punta de los pies en la plataforma. Estirá bien abajo y empujá con los dedos.' },
  // Bisagra de cadera
  peso_muerto: { n: 'Peso muerto', m: ['isquios', 'espalda'], big: true,
    tip: 'Barra pegada a las piernas todo el recorrido. Antes de despegar, tensá dorsales como si quisieras doblar la barra. Empujá el piso con las piernas; la cadera y los hombros suben juntos.' },
  pm_hex: { n: 'Peso muerto con barra hexagonal', m: ['isquios', 'espalda'], big: true,
    tip: 'Parate en el centro de la barra y agarrá las manijas altas. Empujá el piso como en una sentadilla-peso muerto; el torso queda más vertical que en el convencional.' },
  pm_sumo: { n: 'Peso muerto sumo', m: ['isquios', 'espalda'], big: true,
    tip: 'Pies bien abiertos y puntas hacia afuera. Rodillas empujando hacia afuera y cadera cerca de la barra. Los brazos caen verticales entre las piernas.' },
  pm_rumano: { n: 'Peso muerto rumano', m: ['isquios'], big: true,
    tip: 'Empezás arriba. Llevá la cadera hacia atrás con rodillas apenas flexionadas hasta sentir tensión en los isquios. La barra baja pegada a los muslos.' },
  buenos_dias: { n: 'Buenos días con barra', m: ['isquios'],
    tip: 'Barra en la espalda como en la sentadilla. Inclinate llevando la cadera atrás con la espalda neutra hasta casi quedar paralelo al piso.' },
  curl_femoral: { n: 'Curl femoral', m: ['isquios'],
    tip: 'Cadera pegada al banco. Flexioná hasta tocar los glúteos y bajá lento.' },
  // Empuje vertical
  press_militar: { n: 'Press militar', m: ['hombros'],
    tip: 'Apretá glúteos y abdomen para no arquear la espalda baja. Llevá la cabeza hacia atrás al subir la barra y metela debajo de ella arriba del todo.' },
  press_mancuernas: { n: 'Press con mancuernas sentado', m: ['hombros'], perHand: true,
    tip: 'Respaldo casi vertical. Bajá las mancuernas a la altura de las orejas con los codos un poco adelante del cuerpo y empujá hasta juntarlas arriba.' },
  push_press: { n: 'Push press', m: ['hombros'],
    tip: 'Flexioná apenas las rodillas y extendé rápido para lanzar la barra. Terminá el recorrido con los brazos, bloqueando arriba.' },
  landmine: { n: 'Landmine press', m: ['hombros'],
    tip: 'De pie o arrodillado, empujá la punta de la barra hacia arriba y adelante. Mantené las costillas abajo y el core firme.' },
  press_arnold: { n: 'Press Arnold', m: ['hombros'], perHand: true,
    tip: 'Arrancá con palmas mirándote y rotá mientras subís hasta terminar con palmas hacia adelante. Bajá deshaciendo la rotación.' },
  // Tirón vertical
  dominadas: { n: 'Dominadas lastradas', m: ['espalda'], added: true,
    tip: 'Empezá desde brazos extendidos y hombros activos. Llevá el pecho hacia la barra en lugar del mentón. Si no llegás a las repeticiones limpias, sacá lastre.' },
  chinups: { n: 'Dominadas supinas (chin-ups)', m: ['espalda'], added: true,
    tip: 'Agarre al ancho de hombros con palmas hacia vos. Subí hasta que el mentón pase la barra sin balancearte.' },
  jalon: { n: 'Jalón al pecho', m: ['espalda'],
    tip: 'Pecho alto y leve inclinación atrás. Tirá la barra a la parte alta del pecho llevando los codos hacia las costillas.' },
  jalon_neutro: { n: 'Jalón agarre neutro', m: ['espalda'],
    tip: 'Usá el agarre en V o paralelo. Llevá los codos hacia abajo y atrás y controlá la subida en dos segundos.' },
  // Glúteos
  hip_thrust: { n: 'Hip thrust', m: ['isquios'],
    tip: 'Mentón hacia el pecho y costillas abajo. Pausa de un segundo arriba apretando glúteos. Las tibias quedan verticales en la posición final.' },
  hip_maquina: { n: 'Hip thrust en máquina', m: ['isquios'],
    tip: 'Ajustá el respaldo a la altura de los omóplatos. Subí hasta alinear rodillas, cadera y hombros y sostené un segundo.' },
  puente: { n: 'Puente de glúteo con barra', m: ['isquios'],
    tip: 'Acostado con la barra sobre la cadera. Empujá con los talones y apretá glúteos arriba sin arquear la espalda.' },
  patada_polea: { n: 'Patada de glúteo en polea', m: ['isquios'],
    tip: 'Tobillera en la polea baja. Llevá la pierna hacia atrás sin rotar la cadera y sin arquear la espalda baja.' },
  // Hombro posterior
  face_pull: { n: 'Face pull', m: ['hombros'],
    tip: 'Tirá hacia la frente separando la cuerda y rotando los hombros hacia afuera. Protege los hombros de todo el trabajo de press.' },
  reverse_fly: { n: 'Reverse fly en máquina', m: ['hombros'],
    tip: 'Pecho contra el respaldo, brazos casi estirados. Abrí hacia atrás apretando entre los omóplatos y volvé lento.' },
  pajaros: { n: 'Pájaros con mancuernas', m: ['hombros'], perHand: true,
    tip: 'Inclinado hacia adelante con la espalda neutra. Abrí los brazos hacia los costados guiando con los codos, sin balanceo.' },
  pull_apart: { n: 'Band pull-apart', m: ['hombros'], band: true,
    tip: 'Brazos estirados a la altura del pecho. Separá la banda hasta tocarte el pecho y volvé controlando.' },
  // Tríceps
  press_frances: { n: 'Press francés', m: ['brazos'],
    tip: 'Acostado, bajá la barra hacia la frente moviendo solo los codos. Codos apuntando al techo.' },
  ext_polea: { n: 'Extensión de tríceps en polea', m: ['brazos'],
    tip: 'Codos pegados al cuerpo. Extendé del todo y separá la cuerda abajo.' },
  press_cerrado: { n: 'Press banca agarre cerrado', m: ['brazos', 'pecho'],
    tip: 'Manos al ancho de hombros. Codos cerca del cuerpo al bajar.' },
};

/* Los 4 levantamientos que se usan para el nivel de fuerza y el 1RM inicial */
export const MAIN_LIFTS = [
  { id: 'sentadilla', n: 'Sentadilla' },
  { id: 'banca', n: 'Banca' },
  { id: 'peso_muerto', n: 'Peso muerto' },
  { id: 'press_militar', n: 'Press militar' },
];

/* ---------- Plantillas de días ----------
   Cada día tiene bloques (patrones de movimiento). La primera opción de cada bloque
   es la del plan; las demás trabajan los mismos músculos. `rec` marca el reemplazo
   más parecido. Los planes se generan copiando estas plantillas y después se editan. */
const o = (id, sets, reps, rir, rest, extra = {}) => ({ id, sets, reps, rir, rest, ...extra });

/* Arma un bloque poniendo primero el ejercicio `first` con las series y reps pedidas */
function block(p, m, all, first, sets, reps) {
  const main = all.find((x) => x.id === first) || all[0];
  const head = { ...main, sets: sets ?? main.sets, reps: reps ?? main.reps };
  delete head.why;
  const rest = all.filter((x) => x.id !== head.id);
  rest[0] = { ...rest[0], rec: true };
  return { p, m, opts: [head, ...rest] };
}

const SQUAT = (sets = 5, reps = 5, first = 'sentadilla') => block('Rodilla dominante', 'cuádriceps y glúteos', [
  o('sentadilla', 5, 5, 2, 180, { why: 'El básico de piernas con barra' }),
  o('sentadilla_frontal', 4, 5, 2, 180, { why: 'Más cuádriceps y torso erguido, menos carga en la espalda' }),
  o('hack', 4, 8, 2, 120, { why: 'En máquina, fácil de ajustar y sin carga en la espalda' }),
  o('prensa', 4, 10, 2, 120, { why: 'Mucho volumen de piernas sin tensión en la columna' }),
  o('bulgara', 3, 8, 2, 90, { why: 'Una pierna por vez, corrige diferencias entre lados' }),
], first, sets, reps);
const BENCH = (sets = 5, reps = 5, first = 'banca') => block('Empuje horizontal', 'pecho, hombros y tríceps', [
  o('banca', 5, 5, 2, 180, { why: 'El básico de empuje con barra' }),
  o('banca_mancuernas', 4, 8, 2, 120, { why: 'Mismo empuje, cada brazo trabaja por separado' }),
  o('banca_inclinada', 4, 6, 2, 150, { why: 'Más pecho superior y hombro anterior' }),
  o('fondos', 4, 8, 2, 120, { why: 'Con el peso del cuerpo, mucho pecho y tríceps' }),
  o('flexiones', 4, 12, 2, 90, { why: 'Sin banco ni barra: sirve si está todo ocupado' }),
], first, sets, reps);
const ROW = (first = 'remo_barra', sets, reps) => block('Remo', 'espalda media y dorsales', [
  o('remo_barra', 4, 8, 2, 120, { why: 'Remo pesado con barra' }),
  o('remo_apoyado', 4, 10, 2, 90, { why: 'Mismo tirón sin carga en la espalda baja' }),
  o('remo_mancuerna', 4, 10, 2, 90, { why: 'Un brazo por vez, recorrido más largo' }),
  o('remo_polea', 4, 12, 2, 90, { why: 'Tensión constante, fácil de ajustar' }),
  o('remo_t', 4, 8, 2, 120, { why: 'Permite cargar pesado con el torso apoyado' }),
], first, sets, reps);
const HINGE = (sets = 5, reps = 3, first = 'peso_muerto') => block('Bisagra de cadera', 'isquios, glúteos y espalda baja', [
  o('peso_muerto', 5, 3, 2, 180, { why: 'El básico de bisagra con barra' }),
  o('pm_hex', 5, 3, 2, 180, { why: 'Mismo movimiento con menos carga en la espalda baja' }),
  o('pm_sumo', 5, 3, 2, 180, { why: 'Piernas abiertas: más glúteos y aductores' }),
  o('pm_rumano', 4, 6, 2, 150, { why: 'Más isquios, menos peso total' }),
  o('buenos_dias', 3, 8, 3, 120, { why: 'Accesorio de bisagra, carga liviana' }),
], first, sets, reps);
const OHP = (sets = 4, reps = 5, first = 'press_militar') => block('Empuje vertical', 'hombros y tríceps', [
  o('press_militar', 4, 5, 2, 150, { why: 'El básico de hombros con barra' }),
  o('press_mancuernas', 4, 8, 2, 120, { why: 'Mismo empuje, cada brazo trabaja por separado' }),
  o('push_press', 4, 4, 2, 150, { why: 'Con impulso de piernas: más peso y potencia' }),
  o('landmine', 3, 8, 2, 90, { why: 'Más amable para hombros con molestias' }),
  o('press_arnold', 3, 10, 2, 90, { why: 'Recorrido largo, más deltoide anterior' }),
], first, sets, reps);
const PULLUP = (sets = 4, reps = 6, first = 'dominadas') => block('Tirón vertical', 'dorsales y bíceps', [
  o('dominadas', 4, 6, 1, 120, { why: 'Con lastre, el básico de tirón vertical' }),
  o('chinups', 4, 6, 1, 120, { why: 'Palmas hacia vos: más bíceps, igual de pesadas' }),
  o('jalon', 4, 8, 2, 90, { why: 'Mismo movimiento en máquina, fácil de ajustar el peso' }),
  o('jalon_neutro', 4, 10, 2, 90, { why: 'Palmas enfrentadas, cómodo para codos y hombros' }),
], first, sets, reps);
const GLUTE = (sets, reps, first = 'hip_thrust') => block('Glúteos', 'glúteo mayor', [
  o('hip_thrust', 3, 8, 2, 90, { why: 'El más directo para glúteos' }),
  o('hip_maquina', 3, 10, 2, 90, { why: 'Mismo ejercicio, más rápido de armar' }),
  o('puente', 3, 10, 2, 90, { why: 'Desde el piso, recorrido más corto' }),
  o('patada_polea', 3, 12, 2, 60, { why: 'Una pierna por vez, buena para corregir diferencias' }),
], first, sets, reps);
const REAR = (sets, reps, first = 'face_pull') => block('Hombro posterior', 'deltoide posterior y manguito rotador', [
  o('face_pull', 3, 15, 2, 60, { why: 'Protege los hombros de todo el trabajo de press' }),
  o('reverse_fly', 3, 15, 2, 60, { why: 'Mismo músculo con recorrido guiado' }),
  o('pajaros', 3, 15, 2, 60, { why: 'Sin máquina, solo mancuernas livianas' }),
  o('pull_apart', 3, 20, 2, 45, { why: 'Con banda elástica, sirve también de entrada en calor' }),
], first, sets, reps);
const BICEPS = (sets, reps, first = 'curl_barra') => block('Bíceps', 'bíceps y antebrazo', [
  o('curl_barra', 3, 10, 2, 60, { why: 'Curl clásico con barra' }),
  o('curl_mancuernas', 3, 12, 2, 60, { why: 'Cada brazo por separado, con giro de muñeca' }),
  o('curl_martillo', 3, 12, 2, 60, { why: 'Más antebrazo y braquial' }),
  o('curl_polea', 3, 15, 2, 45, { why: 'Tensión constante en todo el recorrido' }),
], first, sets, reps);
const TRICEPS = (sets, reps, first = 'fondos') => block('Tríceps', 'tríceps', [
  o('fondos', 3, 8, 2, 120, { why: 'Con el peso del cuerpo, permite lastre' }),
  o('press_frances', 3, 10, 2, 90, { why: 'Aísla el tríceps, carga moderada' }),
  o('ext_polea', 3, 12, 2, 60, { why: 'Suave para los codos, tensión constante' }),
  o('press_cerrado', 3, 8, 2, 120, { why: 'Permite cargar pesado, también trabaja pecho' }),
], first, sets, reps);
const HAMS = (sets, reps, first = 'pm_rumano') => block('Isquios', 'isquiotibiales', [
  o('pm_rumano', 3, 8, 2, 120, { why: 'Bisagra con barra, mucho estiramiento' }),
  o('curl_femoral', 3, 12, 2, 60, { why: 'Aísla isquios sin cargar la espalda' }),
  o('buenos_dias', 3, 8, 3, 120, { why: 'Bisagra liviana con barra' }),
], first, sets, reps);
const CALVES = (sets, reps, first = 'pant_pie') => block('Pantorrillas', 'gemelos y sóleo', [
  o('pant_pie', 4, 12, 2, 60, { why: 'De pie: más gemelos' }),
  o('pant_sentado', 4, 15, 2, 60, { why: 'Rodilla flexionada: más sóleo' }),
  o('pant_prensa', 4, 15, 2, 60, { why: 'En la prensa, sin necesidad de máquina específica' }),
], first, sets, reps);

export const DAY_TPL = {
  full_a: () => ({ n: 'Completo A', t: 'Sentadilla y empuje', slots: [SQUAT(5, 5), BENCH(5, 5), ROW('remo_barra'), BICEPS(), CALVES()] }),
  full_b: () => ({ n: 'Completo B', t: 'Tirón y hombros', slots: [HINGE(5, 3), OHP(4, 5), PULLUP(4, 6), GLUTE(), REAR()] }),
  full_c: () => ({ n: 'Completo C', t: 'Fuerza pesada', slots: [SQUAT(5, 3), BENCH(5, 3), ROW('remo_mancuerna'), TRICEPS(), HAMS()] }),
  upper_a: () => ({ n: 'Torso A', t: 'Press banca pesado', slots: [BENCH(5, 5), ROW('remo_barra', 4, 6), OHP(3, 8), PULLUP(3, 8), BICEPS()] }),
  upper_b: () => ({ n: 'Torso B', t: 'Press militar pesado', slots: [OHP(5, 5), BENCH(4, 6, 'banca_inclinada'), PULLUP(4, 6), ROW('remo_mancuerna'), TRICEPS(3, 10, 'press_frances'), REAR()] }),
  lower_a: () => ({ n: 'Pierna A', t: 'Sentadilla pesada', slots: [SQUAT(5, 5), HAMS(3, 8), GLUTE(), CALVES()] }),
  lower_b: () => ({ n: 'Pierna B', t: 'Peso muerto pesado', slots: [HINGE(5, 3), SQUAT(3, 6, 'sentadilla_frontal'), GLUTE(3, 8), HAMS(3, 12, 'curl_femoral'), CALVES(4, 15, 'pant_sentado')] }),
  push: () => ({ n: 'Empuje', t: 'Pecho, hombros y tríceps', slots: [BENCH(5, 5), OHP(4, 6), BENCH(3, 8, 'banca_inclinada'), TRICEPS(3, 12, 'ext_polea'), REAR(3, 15, 'reverse_fly')] }),
  pull: () => ({ n: 'Tirón', t: 'Espalda y bíceps', slots: [PULLUP(5, 5), ROW('remo_barra', 4, 6), ROW('remo_polea', 3, 12), REAR(), BICEPS(3, 12, 'curl_martillo')] }),
  legs: () => ({ n: 'Pierna', t: 'Sentadilla y bisagra', slots: [SQUAT(5, 5), HINGE(3, 6, 'pm_rumano'), SQUAT(3, 10, 'prensa'), GLUTE(), CALVES()] }),
};

/* ---------- Tipos de plan y divisiones sugeridas según los días ---------- */
export const PLAN_TYPES = {
  fuerza: { n: 'Fuerza', d: 'Básicos pesados de 3 a 6 repeticiones y progresión de peso. Es el programa que ya venías haciendo.', ic: 'weight' },
  hipertrofia: { n: 'Hipertrofia', d: 'Más volumen y repeticiones para ganar músculo.', ic: 'fitness_center', soon: true },
  manual: { n: 'Manual', d: 'Empezás con días vacíos y elegís vos cada ejercicio, las series y las repeticiones.', ic: 'edit_note' },
};
export const MIN_DAYS = 2, MAX_DAYS = 5;
export const SPLITS = {
  2: [
    { id: 'full2', n: 'Cuerpo completo', d: 'Todo el cuerpo en cada sesión: cada músculo se entrena dos veces por semana.', days: ['full_a', 'full_b'] },
    { id: 'ul2', n: 'Torso / Pierna', d: 'Un día de tren superior y otro de piernas. Cada músculo una vez por semana.', days: ['upper_a', 'lower_b'] },
  ],
  3: [
    { id: 'full3', n: 'Cuerpo completo A/B/C', d: 'El programa original: tres sesiones de cuerpo completo que se alternan.', days: ['full_a', 'full_b', 'full_c'] },
    { id: 'ppl3', n: 'Empuje / Tirón / Pierna', d: 'Un grupo distinto cada día: nunca repetís músculo en días seguidos.', days: ['push', 'pull', 'legs'] },
  ],
  4: [
    { id: 'ul4', n: 'Torso / Pierna ×2', d: 'Alterna tren superior e inferior: cada músculo dos veces por semana, con descanso en el medio.', days: ['upper_a', 'lower_a', 'upper_b', 'lower_b'] },
    { id: 'ppl4', n: 'Empuje / Tirón / Pierna + Torso', d: 'Los tres grupos separados y un día extra de tren superior.', days: ['push', 'pull', 'legs', 'upper_b'] },
  ],
  5: [
    { id: 'ulppl5', n: 'Torso / Pierna + Empuje / Tirón / Pierna', d: 'Dos días pesados de torso y pierna, y tres de grupos separados.', days: ['upper_a', 'lower_b', 'push', 'pull', 'legs'] },
    { id: 'pplul5', n: 'Empuje / Tirón / Pierna + Torso / Pierna', d: 'Primero los grupos separados, al final torso y pierna pesados.', days: ['push', 'pull', 'legs', 'upper_b', 'lower_a'] },
  ],
};

/* ---------- Niveles de fuerza: mínimo de 1RM / peso corporal ---------- */
export const LEVELS = ['Principiante', 'Novato', 'Intermedio', 'Avanzado', 'Élite'];
export const STANDARDS = {
  M: { sentadilla: [.75, 1.25, 1.5, 2.25, 2.75], banca: [.5, .75, 1.25, 1.75, 2], peso_muerto: [1, 1.5, 2, 2.5, 3], press_militar: [.4, .55, .8, 1.05, 1.35] },
  F: { sentadilla: [.5, .75, 1.25, 1.5, 2], banca: [.25, .5, .75, 1, 1.5], peso_muerto: [.5, 1, 1.25, 1.75, 2.5], press_militar: [.2, .35, .5, .75, 1] },
};

/* ---------- Tabla de alimentos (se usa sin IA o sin conexión) ---------- */
export const FOODS = [
  { k: ['huevo'], u: 1, kcal: 70, p: 6, c: .5, g: 5, unit: 'u' },
  { k: ['tostada', 'pan'], u: 1, kcal: 80, p: 3, c: 15, g: 1, unit: 'u' },
  { k: ['pollo', 'pechuga'], u: 150, kcal: 165, p: 31, c: 0, g: 3.6, unit: 'g' },
  { k: ['arroz'], u: 150, kcal: 130, p: 2.7, c: 28, g: .3, unit: 'g' },
  { k: ['avena'], u: 50, kcal: 389, p: 17, c: 66, g: 7, unit: 'g' },
  { k: ['banana'], u: 1, kcal: 105, p: 1.3, c: 27, g: .4, unit: 'u' },
  { k: ['leche'], u: 1, kcal: 125, p: 8, c: 12, g: 5, unit: 'u' },
  { k: ['yogur'], u: 1, kcal: 150, p: 10, c: 15, g: 5, unit: 'u' },
  { k: ['carne', 'bife', 'lomo', 'asado'], u: 200, kcal: 250, p: 26, c: 0, g: 17, unit: 'g' },
  { k: ['papa'], u: 200, kcal: 87, p: 2, c: 20, g: .1, unit: 'g' },
  { k: ['proteína', 'proteina', 'whey', 'batido'], u: 1, kcal: 120, p: 24, c: 3, g: 1.5, unit: 'u' },
  { k: ['manzana'], u: 1, kcal: 95, p: .5, c: 25, g: .3, unit: 'u' },
  { k: ['atún', 'atun'], u: 1, kcal: 130, p: 28, c: 0, g: 1, unit: 'u' },
  { k: ['fideo', 'pasta'], u: 200, kcal: 158, p: 6, c: 31, g: 1, unit: 'g' },
  { k: ['queso'], u: 30, kcal: 370, p: 23, c: 1, g: 30, unit: 'g' },
  { k: ['palta'], u: 1, kcal: 120, p: 1.5, c: 6, g: 11, unit: 'u' },
  { k: ['ensalada'], u: 1, kcal: 60, p: 2, c: 8, g: 2.5, unit: 'u' },
  { k: ['mani', 'maní'], u: 30, kcal: 570, p: 26, c: 16, g: 49, unit: 'g' },
  { k: ['brócoli', 'brocoli'], u: 150, kcal: 34, p: 2.8, c: 7, g: .4, unit: 'g' },
  { k: ['quinoa'], u: 150, kcal: 120, p: 4.4, c: 21, g: 1.9, unit: 'g' },
  { k: ['batata'], u: 200, kcal: 86, p: 1.6, c: 20, g: .1, unit: 'g' },
  { k: ['aceite', 'oliva'], u: 1, kcal: 120, p: 0, c: 0, g: 14, unit: 'u' },
  { k: ['milanesa'], u: 1, kcal: 350, p: 28, c: 18, g: 18, unit: 'u' },
  { k: ['empanada'], u: 1, kcal: 280, p: 10, c: 25, g: 15, unit: 'u' },
  { k: ['medialuna'], u: 1, kcal: 200, p: 4, c: 22, g: 11, unit: 'u' },
];

export const RECIPES = [
  { n: 'Bowl de pollo, quinoa y brócoli', tag: 'Post-entreno', ic: 'rice_bowl', bg: 'var(--forest)', ink: 'var(--forest-ink)', min: 20,
    why: 'Mucha proteína y carbohidratos para recuperar después de entrenar.',
    foods: '200 g de pollo, 150 g de quinoa, 150 g de brócoli y aceite de oliva' },
  { n: 'Avena proteica con banana', tag: 'Pre-entreno', ic: 'breakfast_dining', bg: 'var(--pink)', ink: 'var(--pink-ink)', min: 5,
    why: 'Una hora antes de entrenar: energía que dura toda la sesión.',
    foods: '60 g de avena, un batido de proteína, una banana y leche' },
  { n: 'Omelette de 4 huevos con queso', tag: 'Alta proteína', ic: 'egg_alt', bg: 'var(--wine)', ink: 'var(--wine-ink)', min: 10,
    why: 'Desayuno rápido para días de descanso.',
    foods: '4 huevos, 30 g de queso y 2 tostadas' },
  { n: 'Bife con batatas al horno', tag: 'Post-entreno', ic: 'kebab_dining', bg: 'var(--green)', ink: '#fff', min: 35,
    why: 'Hierro y creatina natural de la carne roja, buena cena para días pesados.',
    foods: '200 g de bife, 250 g de batata y ensalada' },
  { n: 'Fideos con atún y palta', tag: 'Alta proteína', ic: 'ramen_dining', bg: 'var(--surface-2)', ink: 'var(--text)', min: 15,
    why: 'Barato, rápido y con más de 40 g de proteína.',
    foods: '200 g de fideos, una lata de atún y media palta' },
];

export const QUOTES = [
  'La barra no sabe cómo te sentís. Solo sabe si la levantaste.',
  'Hoy no hace falta un récord. Hace falta presentarse.',
  'Cada kilo que sumás hoy lo pagaste con todas las sesiones anteriores.',
  'Descansar también es entrenar. Mañana volvés más fuerte.',
  'La constancia le gana al entusiasmo en cualquier bloque de 12 semanas.',
  'Un buen día es una serie limpia más que ayer.',
  'No compitas con nadie más que con tu planilla de la semana pasada.',
  'La técnica primero. El peso viene después, siempre.',
  'Lo difícil de la sentadilla es bajar. Lo hermoso es subir.',
  'Pocos días por semana, cincuenta semanas por año. Hacé la cuenta.',
  'La motivación arranca el entrenamiento. El hábito lo termina.',
  'El RIR no miente. Escuchalo.',
  'Fuerte no es el que nunca falla una serie, es el que vuelve el martes.',
  'Comé, dormí, levantá. Repetí.',
  'El progreso lento sigue siendo progreso.',
  'Hoy entrenás para la versión tuya que va a mirar este gráfico en diciembre.',
  'Una sesión mediocre vale más que una sesión perfecta que no hiciste.',
  'Respirá, apretá y empujá el piso.',
  'La fuerza se construye en silencio, serie por serie.',
  'No hay atajos en el peso muerto. Solo repeticiones.',
  'Tu cuerpo se adapta a lo que le pedís. Pedile un poco más.',
];

export const SONGS = [
  ['Eye of the Tiger', 'Survivor'], ['Till I Collapse', 'Eminem'], ['Lose Yourself', 'Eminem'],
  ['Thunderstruck', 'AC/DC'], ['Remember the Name', 'Fort Minor'], ["Can't Hold Us", 'Macklemore y Ryan Lewis'],
  ['Seven Nation Army', 'The White Stripes'], ['Enter Sandman', 'Metallica'], ['Killing in the Name', 'Rage Against the Machine'],
  ['Stronger', 'Kanye West'], ['Sabotage', 'Beastie Boys'], ["Welcome to the Jungle", "Guns N' Roses"],
  ['Matador', 'Los Fabulosos Cadillacs'], ['De música ligera', 'Soda Stereo'], ['Power', 'Kanye West'],
  ['Numb / Encore', 'JAY-Z y Linkin Park'], ['Duality', 'Slipknot'], ['Gasolina', 'Daddy Yankee'],
  ['Bulls on Parade', 'Rage Against the Machine'], ["X Gon' Give It to Ya", 'DMX'], ['Back in Black', 'AC/DC'],
];
