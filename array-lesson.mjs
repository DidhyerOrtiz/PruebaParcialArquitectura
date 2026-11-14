function program(size, moveFirst = true) {
  return [
    '.eqv READ_INT 5',
    '.eqv PRINT_INT 1',
    '.eqv EXIT 10',
    '.data',
    'XD: .word ' + Array(size).fill(0).join(', '),
    '.text',
    'li s2, ' + size,
    'li s3, 0',
    'la t2, XD',
    'leer:',
    '  addi s3, s3, 1',
    '  bgt s3, s2, preparar',
    '  li a7, READ_INT',
    '  ecall',
    '  sw a0, 0(t2)',
    '  addi t2, t2, 4',
    '  j leer',
    'preparar:',
    '  li s3, 0',
    'imprimir:',
    '  addi s3, s3, 1',
    '  bgt s3, s2, fin',
    ...(moveFirst ? ['  addi t2, t2, -4', '  lw a0, 0(t2)']
      : ['  lw a0, -4(t2)', '  addi t2, t2, -4']),
    '  li a7, PRINT_INT',
    '  ecall',
    '  j imprimir',
    'fin:',
    '  li a7, EXIT',
    '  ecall',
  ];
}

const base = 0x10010000;
const address = index => '0x' + (base + index * 4).toString(16);
const example = program(2);
const paper = program(5, false);

const rows = [
  ['Inicio', '0', 'XD', 't2 apunta a la primera casilla.'],
  ['Lectura 1', '1', 'XD + 4', 'Guarda 4 y avanza un espacio.'],
  ['Lectura 2', '2', 'XD + 8', 'Guarda 9 y queda justo después del arreglo.'],
  ['Fin de lectura', '3', 'XD + 8', '3 > 2. Salta a preparar sin pedir otro número.'],
  ['Preparar', '0', 'XD + 8', 'Reinicia el contador. El puntero conserva su posición.'],
  ['Impresión 1', '1', 'XD + 4', 'Retrocede 4 bytes, lee 9 y lo imprime.'],
  ['Impresión 2', '2', 'XD', 'Retrocede 4 bytes, lee 4 y lo imprime.'],
  ['Fin', '3', 'XD', '3 > 2. Salta a fin sin leer ni imprimir otra vez.'],
];

const frames = [
  [8, 0, 0, [0, 0], '', 'Mira las dos casillas de XD. El puntero t2 guarda la dirección de la primera. Cada casilla ocupa 4 bytes.'],
  [15, 1, 1, [4, 0], '', 'La primera entrada es 4. sw lo deja en la primera casilla y addi mueve t2 a la segunda.'],
  [15, 2, 2, [4, 9], '', 'La segunda entrada es 9. Ahora t2 quedó justo después de la última casilla.'],
  [11, 3, 2, [4, 9], '', 'bgt pregunta si 3 es mayor que 2. Sí, así que salta a preparar. Hubo 2 lecturas y 3 comprobaciones.'],
  [18, 0, 2, [4, 9], '', 'li s3, 0 reinicia el contador. t2 se queda después del arreglo para empezar a recorrerlo hacia atrás.'],
  [25, 1, 1, [4, 9], '9', 'Primero t2 retrocede 4 bytes. Después lw copia 9 de memoria a a0 y ecall lo imprime.'],
  [25, 2, 0, [4, 9], '94', 'En la siguiente vuelta, t2 vuelve a retroceder, lw lee 4 y ecall lo imprime pegado al 9.'],
  [21, 3, 0, [4, 9], '94', 'Al llegar a 3, bgt salta a fin. En total se imprimieron 2 números y se comprobó la condición 3 veces.'],
].map(([activeLine, count, pointer, values, consoleText, narration], index) => ({
  code: example,
  activeLine,
  registers: { s2: 2, s3: count, t2: address(pointer) },
  memory: values.map((value, slot) => ({ address: address(slot), value })),
  consoleText,
  narration,
  traceRows: rows.slice(0, index + 1),
}));

const paperQuestion = (text, expected, hint, explanation, extra = {}) => ({
  code: paper,
  before: { traceRows: [] },
  text,
  expected,
  hint,
  explanation,
  ...extra,
});

export const arrayLesson = {
  id: 'arreglo',
  title: 'Reto de código completo',
  demo: frames,
  steps: [
    paperQuestion('Con entradas 4, 1, 7, 2 y 9, ¿cuántas veces se ejecuta el cuerpo del bucle leer?', '5',
      'El cuerpo empieza después del bgt. Cuando s3 llega a 5, comprueba si 5 es mayor que 5.',
      'Se guardan cinco números. Al llegar a 6, bgt salta antes de ejecutar otra lectura.'),
    paperQuestion('¿Cuántas veces se comprueba bgt en el bucle leer, contando la comprobación que provoca la salida?', '6',
      'Empieza en s3 = 1 y cuenta también la vuelta en que se toma el salto.',
      'Se comprueba con 1, 2, 3, 4, 5 y 6. Solo la última comprobación provoca la salida.'),
    paperQuestion('Tras guardar los cinco números y antes de imprimir, ¿a cuántos bytes de XD apunta t2?', '20',
      't2 empieza en XD. Cada escritura va seguida de un avance de 4 bytes.',
      'Cinco avances de 4 bytes suman 20. t2 apunta justo después de la última casilla.'),
    paperQuestion('En la primera vuelta de imprimir, ¿qué valor carga lw a0, -4(t2)?', '9',
      'Calcula la dirección de lectura tomando la de t2 y restando 4 bytes. Mira qué número se guardó al final.',
      'Lee en XD + 16 y carga 9. El lw usa ese desplazamiento y t2 se mueve con el addi de la línea siguiente.'),
    paperQuestion('¿En qué orden se imprimen los cinco números? Escríbelos separados por comas.', '9,2,7,1,4',
      'Empieza por la última casilla y retrocede una palabra de 4 bytes en cada vuelta.',
      'El arreglo se recorre de derecha a izquierda. En RARS se vería 92714 porque PRINT_INT no añade separadores.',
      { accept: ['92714'] }),
    paperQuestion('¿Cuántas veces se ejecuta PRINT_INT y cuántas veces se comprueba el bgt de imprimir? Responde impresiones, comprobaciones.', '5,6',
      'Una comprobación produce el salto a fin antes de imprimir.',
      'Se imprimen cinco números y se comprueba seis veces. Con s3 = 6 se toma el salto antes del ecall.'),
    paperQuestion('Reconstruye la otra versión. Aquí el puntero ya retrocedió. Completa el lw para cargar en a0 lo que hay justo en la dirección de t2.', 'lw a0, 0(t2)',
      'Con lw, el primer registro recibe el dato. Usa un desplazamiento de cero porque t2 ya retrocedió.',
      'Mover t2 antes y luego leer desde 0(t2) da el mismo valor que leer desde -4(t2) antes de moverlo.',
      { code: program(5).map((line, index) => index === 23 ? '  ___' : line), line: 23 }),
    paperQuestion('Ahora arma el bucle de lectura. Tras guardar el número, escribe el addi que hace avanzar t2 una casilla.', 'addi t2, t2, 4',
      'Cada .word ocupa 4 bytes. El destino y el registro que ya contiene la dirección son ambos t2.',
      't2 recibe su dirección anterior más 4. En la próxima vuelta, sw escribirá en la casilla siguiente.',
      { code: paper.map((line, index) => index === 15 ? '  ___' : line), line: 15 }),
  ],
};
