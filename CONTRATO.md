# Contrato de trabajo · Misión RISC‑V

Juego web en español para Didhyer. Parte de cero y prepara para resolver ejercicios de Arquitectura II con papel y lápiz. La primera versión debe poder jugarse en una sesión corta. El recorrido enseña a reconstruir el proyecto de los tres asteroides por piezas. Mantener una sola página y una primera vuelta de 30–45 minutos, con misiones reiniciables.

La captura de Git en 1 minuto guía la animación. Usar rótulos gruesos, carriles con nodos y fichas que se desplazan entre registros, memoria, consola y displays. Cada animación dura menos de un segundo y muestra el efecto de una instrucción. La nave y los asteroides se representan con formas sencillas.

### Paleta · Edición Tormenta

| Uso | Color |
|---|---|
| 60 % · Lienzo y espacio visual | Gris Tormenta `#5A6068` |
| 30 % · Tarjetas, carriles y paneles | Negro Mate `#1C1D20` |
| 10 % · Botón principal, alertas y resaltado del paso activo | Naranja Seguridad `#FF5F00` |

Usar texto claro sobre el gris y el negro, y texto negro mate sobre botones naranjas. Mantener legibles el código y el foco. Acompañar aciertos, errores y estados con texto o iconos.

## Cómo se juega

La pantalla muestra un fragmento de 2 a 8 líneas, la línea actual y solo los registros o celdas de memoria relevantes. En la primera misión, antes de pedir una respuesta, se muestra un ejemplo animado: al ejecutar `li t0, 7`, aparece el 7 dentro de `t0`. Al ejecutar `addi t1, t0, 2`, el resultado 9 aparece en `t1` y `t0` conserva el 7.

1. El jugador escribe qué valor queda, completa una instrucción corta o indica a qué etiqueta salta el programa. Los desafíos que piden escribir código aceptan la instrucción concreta enseñada y toleran diferencias de espacios y comas.
2. Si acierta, la escena anima el cambio y resalta la siguiente línea. Si falla, recibe una pista de una oración y puede reintentar. Las pistas se abren a demanda.
3. Cada misión incluye una pregunta corta de teoría sobre lo que acaba de suceder. La explicación aparece después de responder y ocupa como máximo dos oraciones.
4. El cierre es un parcial con fragmentos nuevos. Se ocultan las pistas y los cambios intermedios hasta entregar. El jugador escribe los valores, el salto o la salida que vería en papel y recibe una corrección por línea.

## Misiones de la primera versión

| Misión | Acción del jugador | Teoría integrada |
|---|---|---|
| 1 · Encender la nave | Escribir `li`, seguir `add` y `addi`, anotar el registro que cambia. | Instrucción, registro, destino, código y datos. |
| 2 · Guardar coordenadas | Leer una etiqueta con `la`, seguir un `lw` y completar un `sw`. | Dirección frente a valor, palabra de 4 bytes y propósito de `.data`. |
| 3 · Activar consola y display | Preparar `a0` y `a7` para imprimir con `ecall`. Elegir el byte para encender un 7 y escribirlo con `sb` en el display derecho. | Llamada al sistema y E/S mapeada en memoria. En Digital Lab Sim derecho es `0xFFFF0010`, izquierdo es `0xFFFF0011` y el 7 usa `0x07`. |
| 4 · Detectar una colisión | Seguir un contador de dos vueltas, predecir `beq` o `bne` y completar una tabla corta de registros. | La comparación decide la siguiente instrucción. Una etiqueta identifica un destino de salto. |
| 5 · Volver a la nave | Seguir `jal` y `ret`, y ordenar el guardado y la recuperación de `ra` al llamar a otra rutina. | Dirección de retorno, `sp` y pila. Con instrucciones de 4 bytes, `jal` guarda la dirección de la siguiente instrucción. |
| 6 · Parcial de asteroides | Resolver fragmentos nuevos en papel, ingresar los resultados y corregirlos al final. | Registro y memoria, salto y bucle, salida de consola, retorno de subrutina. |

Base de estudio: [wiki de RARS de la URJC](https://github.com/myTeachingURJC/2019-20-LAB-AO/wiki), hasta L10. Primera pasada sugerida: 5 minutos de introducción, 25 de práctica y 10 de parcial y corrección.

En el cierre, el jugador reconstruye la secuencia del proyecto: leer la configuración y convertir caracteres ASCII, inicializar coordenadas, avanzar con sumas, comparar los tres pares y detectar la coincidencia triple, registrar un evento, actualizar el display y mostrar el resumen. Incluir un caso guiado y otro con valores distintos para resolver en papel. Para triple, mostrar A-B-C en consola y A-B en los displays. Repasar `lb`, `sb`, `lw`, `sw`, `ecall`, saltos, `jal`, `ret` y pila dentro de esas acciones.

## Reparto

| Responsable | Archivos | Entrega |
|---|---|---|
| Codex | `engine.mjs`, `lessons.mjs` | Escribe las misiones y el parcial. Define los estados, comprueba respuestas, expone los cambios para animación y verifica los resultados a mano. |
| Claude | `index.html`, `styles.css`, `ui.mjs`, `assets/` | Construye la escena, el editor de respuesta, los registros y memoria, el progreso, las pistas y la corrección. Puede usar datos de ejemplo locales en su rama mientras llega el motor. |

Una app estática con HTML, CSS y JavaScript, sin instalación de dependencias. Para usar módulos localmente, servir el directorio con `python -m http.server 8000` y abrir `http://localhost:8000`. Usar CSS y elementos de la página para las primeras animaciones. Priorizar una misión completa antes de pulir las demás.

## Interfaz acordada

`engine.mjs` expone funciones síncronas. La interfaz llama a `getState()` al iniciar y vuelve a dibujar con el estado devuelto por cada acción.

| Función | Resultado |
|---|---|
| `getState()` | Estado actual. |
| `startMission(id)` | Reinicia esa misión y devuelve su estado. |
| `submitAnswer(value)` | Recibe texto de la entrada o el identificador de una opción. Devuelve el nuevo estado. |
| `nextStep()` | Avanza después del ejemplo, una respuesta correcta o una respuesta registrada en modo parcial. Devuelve el estado. En la última pregunta del parcial, muestra la corrección. |

Forma del estado (JavaScript):

```js
{
  missions: [{ id, title }],                // índice para navegar
  missionId,
  mode: "practice" | "exam",
  phase: "demo" | "question" | "feedback" | "complete",
  stepIndex,                               // empieza en 0
  stepCount,
  code: ["li t0, 7", "addi t1, t0, 2"],
  activeLine: 0,                           // índice desde 0, o null
  registers: { t0: 7 },
  memory: [{ address: "0x10010000", value: 7 }],
  consoleText: "",
  displays: { left: 0, right: 0 },          // valores de byte
  prompt: { kind: "text" | "choice", text, choices: [{ id, label }] },
  hint: null,                              // texto disponible al pulsar Pista
  feedback: null,                          // o { correct: boolean, text }
  effects: [],                             // { type: "register" | "memory" |
                                            // "branch" | "console" | "display", target }
  canAdvance: false,
  results: []                              // { prompt, answer, expected, explanation }
}
```

`prompt` es `null` en el ejemplo y al completar la misión. `phase: "feedback"` permite mostrar una respuesta acertada o fallida. Tras un error, se mantiene la línea, se deja volver a enviar y `canAdvance` sigue en `false`. El motor entrega los efectos en la respuesta que provoca el cambio. La UI solo los anima una vez por acción. En modo parcial se registra la respuesta y se habilita Siguiente. `feedback`, `hint` y los cambios que revelarían la solución se mantienen ocultos hasta la entrega. Las preguntas usan estados precalculados para los fragmentos enseñados.

## Integración y verificación

1. Poner este archivo en la raíz de `main`. Abrir dos ramas desde ese punto: `codex/motor-contenido` y `claude/interfaz-animacion`.
2. Cada parte abre su PR con los archivos que le tocan. Si hay que cambiar una función o un campo, documentar el cambio en el PR y acordarlo antes de actualizar ambos lados.
3. Integrar motor e interfaz y probar desde el navegador. Codex revisa la traza y el contenido. Claude revisa presentación y animación.
4. Dar por lista la primera versión cuando sea posible terminar las seis misiones con teclado, reintentar tras un error, ver la línea y el valor correctos al avanzar, y recibir la corrección del parcial únicamente al finalizar. Probar también en un ancho de móvil y respetar la preferencia de movimiento reducido.
