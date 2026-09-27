# Carga

Tu bitácora de fuerza: entrenamiento de cuerpo completo 3 días por semana, recuperación muscular, correr con GPS, nutrición y un coach con IA (Claude).

Es una app web instalable (PWA): no tiene servidor propio ni cuentas. Tus datos se guardan en tu celular.

## Qué hace

- **Hoy:** músculos listos para entrenar (figura del cuerpo), puntaje del día según sueño, energía y molestias, frase y canción del día, peso corporal.
- **Entrenar:** programa A/B/C con ejercicios intercambiables por otros similares, marca anterior en cada serie, progresión automática con la regla visible, descanso entre series, récords y encuesta al terminar.
- **Correr:** GPS, vueltas, intervalos con aviso sonoro y vibración, voz en cada kilómetro y temporizador de descanso.
- **Progreso:** calendario del mes, nivel de fuerza comparado con tu peso corporal, 1RM estimado por semana, tendencia del peso, series por músculo y récords.
- **Nutrición:** escribís lo que comiste y Claude calcula calorías y macros. Sin clave o sin conexión usa una tabla de alimentos.
- **Coach:** chat con Claude que conoce tus entrenamientos, recuperación y comidas.

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
- `js/data.js`: ejercicios, programa A/B/C, alimentos, recetas, frases y canciones.
- `js/store.js`: guardado local y copias de seguridad.
- `js/ai.js`: llamadas a Claude.
- `sw.js`: funcionamiento sin conexión.
- `tools/make-icons.js`: genera los íconos.
