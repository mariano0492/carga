# Carga

Tu bitácora de entrenamiento: planes de 2 a 5 días por semana que armás y editás, recuperación muscular con avisos, correr con GPS, nutrición y un coach con IA (Claude).

Es una app web instalable (PWA): no tiene servidor propio ni cuentas. Tus datos se guardan en tu celular.

## Qué hace

- **Bienvenida:** la primera vez que abrís la app cada día te saluda por tu nombre (se carga en Ajustes) con la fecha, el entreno que toca, cómo vas en la semana, cuántos músculos están listos y los avisos del día (pendientes, recuperación, readaptación). El fondo cambia con la hora: mañana, tarde y noche. Se cierra con "Entrenar", "Ir a Hoy" o deslizando hacia arriba.
- **Hoy:** la fecha y los ajustes arriba; debajo, una tarjeta con el fondo de la bienvenida (cambia con la hora) que dice qué entreno toca o, si estás entrenando, las series hechas y el cronómetro (con horas a partir de los 60 minutos). La misma tarjeta encabeza Entrenar. Además: músculos listos para entrenar (figura del cuerpo), puntaje del día según sueño, energía y molestias, frase del día, peso corporal.
- **Entrenar:** los días de tu plan en rotación (si faltás, el que toca te espera), cronómetro desde la primera serie, marca anterior en cada serie, progresión automática con la regla visible, descanso entre series, récords y encuesta al terminar.
- **Cambios durante el entreno:** tocando el nombre de un ejercicio lo cambiás (primero las opciones del bloque, después el mismo músculo y al final el resto del catálogo); con − y + sumás o sacás series (las hechas no se pueden sacar); podés saltear un ejercicio o agregar otro al final. El cronómetro no se reinicia. Al terminar, la app pregunta qué cambios guardar en el plan.
- **Pendientes:** los ejercicios que quedaron sin ninguna serie se suman al final del próximo día, si el músculo ya se recuperó y ese día no lo vuelve a entrenar (en el hombro cuenta la zona: anterior, lateral o posterior). Si el músculo se entrenó con otro ejercicio, solo se recupera lo que falta para la meta semanal. Desde Entrenar se pueden hacer aparte o sacar; si el día pasa de 90 minutos, la app sugiere hacerlos aparte. Vencen cuando volvés a entrenar ese músculo o a los 14 días. Se basa en que, con el mismo volumen semanal, repartir las series en más o menos días cambia poco el resultado (Schoenfeld y col., 2019).
- **Músculos y ejercicios:** pecho, espalda, hombros, bíceps, tríceps, cuádriceps, isquios, glúteos, pantorrillas y abdomen (opcional), con 76 ejercicios. El catálogo ordena el hombro en anterior, lateral y posterior.
- **Aviso de recuperación:** si al músculo principal de un ejercicio le faltan más de 12 h para recuperarse, la app avisa en bordó y sugiere un reemplazo de un músculo listo (un toque para aceptarlo; queda anotado en el historial). Si le faltan menos de 12 h, muestra una nota rosa. Al abrir Entrenar, si el día que toca tiene músculos sin recuperar, sugiere otro día del plan. El tiempo de recuperación sube 25% con más de 6 series para ese músculo y baja 25% con 2 o menos.
- **Readaptación después de una pausa:** si un músculo pasa más de 14 días sin entrenarse con pesas, los ejercicios donde es el principal vuelven escalonados desde la serie más pesada de antes de la pausa: 15 a 28 días → 70%, 85% y 100% en 3 sesiones; 29 a 56 días → 60%, 75%, 90% y 100%; más de 8 semanas → 50%, 65%, 80% y 100%. El peso sugerido ya viene bajado y cada ejercicio explica por qué; se puede cambiar a mano. Si en la vuelta no completás las repeticiones, repetís ese peso, y nunca sube más de 20% del peso de antes en una sesión. Hoy marca los músculos para readaptar, Entrenar avisa al empezar y el historial anota cada sesión de readaptación.
- **Mi plan:** asistente de 3 pasos (tipo → días → división). Tipos: Fuerza (planes generados para 2 a 5 días con división sugerida) y Manual (días vacíos que armás vos). Editor por día: nombre, ejercicios del catálogo, series, repeticiones, RIR y descanso, orden de días y ejercicios. Muestra series por semana contra la meta de cada músculo y recomendaciones. Los planes anteriores quedan guardados.
- **Correr:** GPS, vueltas, intervalos con aviso sonoro y vibración, voz en cada kilómetro, temporizador de descanso y récords (carrera más larga y mejor ritmo).
- **Progreso:** tres pestañas, inspiradas en la guía de seguimiento de Symmetry.
  - **Resumen:** rango de fuerza global y de los 4 básicos (Inicio · Base · Intermedio · Avanzado · Experto, cada uno con I, II y III, y Élite), calculado con tu 1RM estimado de las últimas 12 semanas contra tu peso corporal. Debajo, la tarjeta de la semana (de lunes a domingo, con flechas para ver semanas anteriores): entrenos, series, minutos, series por músculo contra la meta del plan, récords y ejercicios estancados. Después, la racha (actual, la mejor y las últimas 12 semanas; la semana en curso queda en juego hasta el domingo), la tendencia del peso corporal y el historial por **Mes** y por **Año** (calendario, comparaciones con el período anterior y 1RM por ejercicio).
  - **Ejercicios:** los que hiciste, filtrables por músculo principal y ordenados por la última vez. Cada uno muestra su mejor marca, una flecha (las últimas 4 semanas contra las 4 anteriores; ±1% es estable) y la marca "estancado" si en 4 semanas, con 3 sesiones o más, no superó su mejor marca. El detalle tiene un gráfico por semana (3 meses, 6 meses, 1 año o todo), el rango (solo los 4 básicos), récords (mejor marca, más peso, más volumen en una sesión y más repeticiones con cada peso) y el historial de series. La marca es el 1RM estimado; con banda, repeticiones; de tiempo, segundos; con lastre, peso corporal de ese día + lastre. Las sesiones de readaptación salen marcadas en rosa y no cuentan para la flecha ni para el estancamiento.
  - **Músculos:** series de la semana contra la meta del plan. El detalle muestra las últimas 12 semanas, el desglose por zona en hombros y los ejercicios de ese músculo.
- **Descarga:** la app recomienda una semana más liviana a las 6 semanas seguidas cumpliendo el plan, o antes si aparecen señales de fatiga (fatiga alta en 2 de las últimas 3 sesiones, rendimiento peor dos veces seguidas o puntaje del día menor a 50 en 3 días de una semana). Una semana con la mitad de los entrenos o menos, o una pausa de 7 días, reinicia la cuenta. Con "Empezar descarga", durante 7 días Entrenar trae los mismos días y ejercicios con la mitad de las series, el mismo peso y 2 repeticiones más en reserva; esas sesiones no cuentan para récords, flechas ni estancamiento, y después la progresión sigue desde la última sesión normal. "Ahora no" la pospone una semana, salvo que aparezca una señal nueva. Se basa en el consenso de entrenadores de Bell y col. (2023), la encuesta a 246 atletas de Rogerson y col. (2024: cada 5,6 ± 2,3 semanas, unos 6 días) y el ensayo de Coleman y col. (2024: una semana sin entrenar no sumó músculo y restó algo de fuerza).
- **Resumen semanal en la bienvenida:** la primera vez que abrís la app en la semana, la bienvenida resume la semana pasada (entrenos, récords y estancados) con un botón para verla en Progreso.
- **Nutrición:** escribís lo que comiste y Claude calcula calorías y macros. Sin clave o sin conexión usa una tabla de alimentos.
- **Coach:** chat con Claude que conoce tus entrenamientos, recuperación, comidas, rango, resumen semanal y ejercicios estancados.

## Instalarla en Android

1. Abrí la dirección de la app en Chrome.
2. Menú ⋮ → **Instalar app** (o "Agregar a pantalla de inicio").
3. Abrila desde el ícono. Funciona sin conexión, salvo la IA.

## La IA

En **Ajustes** cargá tu clave de API de Anthropic (se crea en console.anthropic.com). La clave queda guardada solo en tu celular y no se incluye en las copias de seguridad. El uso se cobra en tu cuenta de Anthropic; conviene poner un límite de gasto mensual en la consola.

Modelo por defecto: Claude Opus 5, con respaldo automático del servidor (`fallbacks: "default"`) por si un filtro de seguridad rechaza un pedido. En Ajustes podés elegir Sonnet 5 o Haiku 4.5, que son más baratos.

## Tus datos

Se guardan en el navegador del celular (localStorage). Si desinstalás Chrome, borrás sus datos o cambiás de teléfono, se pierden: bajá una copia de seguridad desde **Ajustes → Copia de seguridad** de vez en cuando.

## Probarla en la PC

```bash
node tools/serve.js
```

y abrí http://localhost:5178.

## Publicar cambios

Cada cambio que se sube a la rama `main` se publica en GitHub Pages. Antes de publicar, subí la versión en `sw.js` (`VERSION`) para que los celulares bajen los archivos nuevos.

## Archivos

- `index.html`: pantallas.
- `css/styles.css`: estilos (paleta bordó, rosa y verdes).
- `js/app.js`: lógica de la app.
- `js/data.js`: ejercicios, plantillas de días y divisiones por cantidad de días, alimentos, recetas y frases.
- `js/plans.js`: generar, editar y revisar planes.
- `js/store.js`: guardado local y copias de seguridad.
- `js/ai.js`: llamadas a Claude.
- `sw.js`: funcionamiento sin conexión.
- `tools/make-icons.js`: genera los íconos.
