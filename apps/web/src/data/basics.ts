import type { Lesson } from './lessons';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Curso para quien nunca ha jugado: el tablero, cómo se mueve cada pieza, las reglas especiales,
 * cómo termina una partida y las primeras jugadas. Textos sencillos, sin jerga.
 */
export const BASICS: Lesson[] = [
  {
    id: 'b01-board',
    topic: 'basics',
    title: { es: '1. El tablero y las piezas', en: '1. The board and the pieces' },
    steps: [
      {
        fen: START,
        text: {
          es: 'El ajedrez es un juego de dos personas. Cada una tiene 16 piezas: 1 rey, 1 dama, 2 torres, 2 alfiles, 2 caballos y 8 peones. Tú siempre llevas las blancas, que están abajo, y mueves primero.',
          en: 'Chess is a game for two players. Each has 16 pieces: 1 king, 1 queen, 2 rooks, 2 bishops, 2 knights and 8 pawns. You play White, at the bottom, and move first.',
        },
      },
      {
        fen: START,
        text: {
          es: 'El tablero tiene 64 casillas, 8 columnas (letras de la a a la h) y 8 filas (números del 1 al 8). Cada casilla tiene un nombre: la marcada en azul es la e4 (columna e, fila 4). Las letras y números aparecen en el borde del tablero.',
          en: 'The board has 64 squares: 8 columns (letters a to h) and 8 rows (numbers 1 to 8). Every square has a name: the blue one is e4 (column e, row 4). The letters and numbers are shown on the board edge.',
        },
        highlights: ['e4'],
      },
      {
        fen: START,
        text: {
          es: 'El objetivo: dar jaque mate al rey rival, es decir, atacarlo de forma que no pueda escapar. Los jugadores mueven por turnos y solo se puede mover una pieza por turno. Ningún jugador puede pasar.',
          en: 'The goal: checkmate the enemy king, which means attacking it so it cannot escape. Players take turns and you move one piece per turn. You cannot skip a turn.',
        },
      },
    ],
  },
  {
    id: 'b02-pawn',
    topic: 'basics',
    title: { es: '2. El peón', en: '2. The pawn' },
    steps: [
      {
        fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
        text: {
          es: 'El peón avanza hacia delante, de una casilla en una casilla. Solo la primera vez que se mueve, puede avanzar dos. Toca el peón blanco para ver a dónde puede ir (los puntos) y prueba a moverlo.',
          en: 'The pawn moves forward one square at a time. Only on its first move it may go two squares. Tap the white pawn to see where it can go (the dots) and try it.',
        },
        explore: true,
      },
      {
        fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
        text: {
          es: 'Prueba tú: mueve el peón dos casillas, hasta e4.',
          en: 'Your turn: move the pawn two squares, to e4.',
        },
        accept: ['e4'],
        success: { es: '¡Muy bien! Esa es la jugada más común de todas.', en: 'Well done! That is the most common move of all.' },
      },
      {
        fen: '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
        text: {
          es: 'El peón NO captura hacia delante, sino en diagonal. Aquí hay un peón negro en d5, en diagonal al tuyo. Cómetelo moviendo tu peón a d5.',
          en: 'The pawn does NOT capture straight ahead but diagonally. A black pawn stands on d5, diagonal to yours. Capture it by moving your pawn to d5.',
        },
        accept: ['exd5'],
        success: { es: 'Capturar es quitar una pieza rival del tablero poniéndote en su casilla.', en: 'Capturing means removing an enemy piece by landing on its square.' },
      },
    ],
  },
  {
    id: 'b03-rook',
    topic: 'basics',
    title: { es: '3. La torre', en: '3. The rook' },
    steps: [
      {
        fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1',
        text: {
          es: 'La torre se mueve en línea recta: hacia delante, atrás, izquierda o derecha, todas las casillas que quiera mientras no haya piezas en medio. Toca la torre y prueba.',
          en: 'The rook moves in straight lines: forward, back, left or right, as many squares as it likes as long as nothing is in the way. Tap the rook and try.',
        },
        explore: true,
      },
      {
        fen: '4k3/8/8/8/3R4/8/8/4K3 w - - 0 1',
        text: {
          es: 'Lleva la torre hasta d8: así atacas al rey negro (eso se llama jaque).',
          en: 'Move the rook to d8: that attacks the black king (this is called check).',
        },
        accept: ['Rd8'],
        success: { es: '¡Jaque! El rey negro está en peligro y debe escapar.', en: 'Check! The black king is in danger and must escape.' },
      },
    ],
  },
  {
    id: 'b04-bishop',
    topic: 'basics',
    title: { es: '4. El alfil', en: '4. The bishop' },
    steps: [
      {
        fen: '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1',
        text: {
          es: 'El alfil se mueve en diagonal, todas las casillas que quiera si no hay nada en medio. Siempre se queda en casillas del mismo color con el que empezó. Prueba a moverlo.',
          en: 'The bishop moves diagonally, as far as it likes if nothing is in the way. It always stays on the same colour of squares it started on. Try it.',
        },
        explore: true,
      },
      {
        fen: '4k3/8/8/8/3B4/8/8/4K3 w - - 0 1',
        text: { es: 'Lleva el alfil hasta la esquina h8.', en: 'Move the bishop to the corner h8.' },
        accept: ['Bh8'],
        success: { es: 'Eso es: la diagonal larga atraviesa todo el tablero.', en: 'That is it: the long diagonal crosses the whole board.' },
      },
    ],
  },
  {
    id: 'b05-queen',
    topic: 'basics',
    title: { es: '5. La dama', en: '5. The queen' },
    steps: [
      {
        fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1',
        text: {
          es: 'La dama es la pieza más poderosa: se mueve como una torre y como un alfil a la vez (recto y en diagonal, todas las casillas que quiera). Toca la dama y mira cuántas casillas controla.',
          en: 'The queen is the most powerful piece: it moves like a rook and a bishop together (straight and diagonal, as far as it likes). Tap the queen and see how many squares it controls.',
        },
        explore: true,
      },
      {
        fen: '4k3/8/8/8/3Q4/8/8/4K3 w - - 0 1',
        text: { es: 'Da jaque al rey negro llevando la dama a d8.', en: 'Check the black king by moving the queen to d8.' },
        accept: ['Qd8'],
        success: { es: '¡Jaque con la dama!', en: 'Check with the queen!' },
      },
    ],
  },
  {
    id: 'b06-king',
    topic: 'basics',
    title: { es: '6. El rey', en: '6. The king' },
    steps: [
      {
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        text: {
          es: 'El rey se mueve una sola casilla en cualquier dirección. Es la pieza más importante: si te hacen jaque mate, pierdes. Un rey nunca puede ponerse en una casilla donde lo puedan capturar. Toca el rey y prueba.',
          en: 'The king moves one square in any direction. It is the most important piece: if you are checkmated, you lose. A king can never step onto a square where it could be captured. Tap the king and try.',
        },
        explore: true,
      },
      {
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        text: { es: 'Mueve el rey a e2.', en: 'Move the king to e2.' },
        accept: ['Ke2'],
        success: { es: 'Bien. Es lento, pero hay que cuidarlo.', en: 'Good. It is slow, but it needs protecting.' },
      },
    ],
  },
  {
    id: 'b07-knight',
    topic: 'basics',
    title: { es: '7. El caballo', en: '7. The knight' },
    steps: [
      {
        fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1',
        text: {
          es: 'El caballo se mueve en forma de "L": dos casillas en línea recta y una al lado. Es la única pieza que puede saltar por encima de las demás. Toca el caballo y mira sus ocho destinos.',
          en: 'The knight moves in an "L" shape: two squares straight and one to the side. It is the only piece that can jump over others. Tap the knight and see its eight destinations.',
        },
        explore: true,
      },
      {
        fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1',
        text: { es: 'Mueve el caballo a f5 (dos a la derecha... y una arriba).', en: 'Move the knight to f5 (two right... and one up).' },
        accept: ['Nf5'],
        success: { es: '¡Perfecto! La "L" puede apuntar en cualquier dirección.', en: 'Perfect! The "L" can point in any direction.' },
      },
    ],
  },
  {
    id: 'b08-values',
    topic: 'basics',
    title: { es: '8. Cuánto vale cada pieza', en: '8. How much each piece is worth' },
    steps: [
      {
        fen: START,
        text: {
          es: 'Para decidir si te conviene cambiar piezas, se usan puntos: peón = 1, caballo = 3, alfil = 3, torre = 5, dama = 9. El rey no tiene valor porque no se puede perder.',
          en: 'To decide whether a trade is good, we use points: pawn = 1, knight = 3, bishop = 3, rook = 5, queen = 9. The king has no value because it can never be lost.',
        },
      },
      {
        fen: START,
        text: {
          es: 'Ejemplo: cambiar tu caballo (3) por una torre rival (5) es buen negocio: ganas 2 puntos. Perder tu dama (9) por un peón (1) es muy mala idea. La app te muestra "+1", "+3" o "+9" cada vez que capturas.',
          en: 'Example: trading your knight (3) for an enemy rook (5) is a good deal: you gain 2 points. Losing your queen (9) for a pawn (1) is a terrible idea. The app shows "+1", "+3" or "+9" each time you capture.',
        },
      },
    ],
  },
  {
    id: 'b09-check',
    topic: 'basics',
    title: { es: '9. Jaque y jaque mate', en: '9. Check and checkmate' },
    steps: [
      {
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        text: {
          es: 'Jaque = el rey está atacado. Quien lo recibe debe librarse en su turno: moviendo el rey, tapando el ataque o capturando la pieza que ataca. Jaque mate = no hay ninguna forma de librarse: la partida termina y gana quien dio el mate.',
          en: 'Check = the king is attacked. The player must get out of it on their turn: move the king, block the attack, or capture the attacker. Checkmate = no way out: the game ends and the player who delivered it wins.',
        },
      },
      {
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        text: {
          es: 'Fíjate: el rey negro está encerrado por sus propios peones. Da jaque mate con la torre a a8.',
          en: 'Look: the black king is boxed in by its own pawns. Checkmate with the rook on a8.',
        },
        accept: ['Ra8'],
        success: { es: '¡JAQUE MATE! Es el famoso "mate del pasillo". Has ganado la partida.', en: 'CHECKMATE! This is the famous "back-rank mate". You won the game.' },
      },
    ],
  },
  {
    id: 'b10-special',
    topic: 'basics',
    title: { es: '10. Jugadas especiales', en: '10. Special moves' },
    steps: [
      {
        fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
        text: {
          es: 'ENROQUE: mueves el rey dos casillas hacia una torre y la torre salta al otro lado del rey. Sirve para poner el rey a salvo. Solo se puede si ni el rey ni esa torre se han movido, no hay piezas en medio y el rey no está en jaque. Enroca hacia la derecha: toca el rey y llévalo a g1.',
          en: 'CASTLING: you move the king two squares towards a rook and the rook jumps to the other side of the king. It tucks the king away safely. It is only allowed if neither the king nor that rook has moved, nothing is in between and the king is not in check. Castle to the right: tap the king and move it to g1.',
        },
        accept: ['O-O'],
        success: { es: '¡Enroque! El rey está en g1 y la torre en f1.', en: 'Castled! The king is on g1 and the rook on f1.' },
      },
      {
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
        text: {
          es: 'AL PASO: si un peón rival avanza dos casillas y queda justo a tu lado, puedes capturarlo en ese mismo turno como si solo hubiera avanzado una. El peón negro acaba de ir de d7 a d5. Captúralo moviendo tu peón a d6.',
          en: 'EN PASSANT: if an enemy pawn advances two squares and lands right beside yours, you may capture it on that very turn as if it had moved only one. The black pawn just went from d7 to d5. Capture it by moving your pawn to d6.',
        },
        accept: ['exd6'],
        success: { es: '¡Captura al paso! Solo se puede hacer justo después de que el peón avance.', en: 'En passant! It is only possible right after the pawn advances.' },
      },
      {
        fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
        text: {
          es: 'CORONACIÓN: cuando un peón llega a la última fila, se convierte en la pieza que elijas (casi siempre dama). Lleva el peón a a8 y elige la dama.',
          en: 'PROMOTION: when a pawn reaches the last row it becomes any piece you choose (almost always a queen). Move the pawn to a8 and choose the queen.',
        },
        accept: ['a8=Q'],
        success: { es: '¡Nueva dama! Por eso los peones valen más cuanto más avanzan.', en: 'A new queen! That is why pawns become more valuable as they advance.' },
      },
    ],
  },
  {
    id: 'b11-draws',
    topic: 'basics',
    title: { es: '11. Las tablas (empates)', en: '11. Draws' },
    steps: [
      {
        fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
        text: {
          es: 'Una partida puede acabar en tablas (empate). El caso más curioso es el AHOGADO: aquí juegan las negras, su rey NO está en jaque pero no puede moverse a ninguna casilla segura y no tiene otras piezas. Resultado: tablas, aunque tengas mucha más fuerza. ¡Cuidado al acorralar al rival!',
          en: 'A game can end in a draw. The most curious case is STALEMATE: here Black is to move, its king is NOT in check but has no safe square and Black has no other pieces. Result: a draw, even if you are far ahead. Be careful when cornering your opponent!',
        },
      },
      {
        fen: START,
        text: {
          es: 'Otras tablas: repetir la misma posición tres veces, 50 jugadas sin mover un peón ni capturar, quedar sin piezas suficientes para dar mate (por ejemplo, rey contra rey), o que los dos jugadores lo acuerden.',
          en: 'Other draws: the same position three times, 50 moves with no pawn move or capture, not enough pieces left to checkmate (for example king vs king), or both players agreeing.',
        },
      },
    ],
  },
  {
    id: 'b12-notation',
    topic: 'basics',
    title: { es: '12. Cómo leer las jugadas', en: '12. How to read moves' },
    steps: [
      {
        fen: START,
        text: {
          es: 'En las listas de jugadas verás cosas como "e4", "Nf3" o "Bc4". La letra es la pieza: N = caballo, B = alfil, R = torre, Q = dama, K = rey (en español se suele usar C, A, T, D, R). Sin letra es un peón. Lo siguiente es la casilla de destino.',
          en: 'In move lists you will see things like "e4", "Nf3" or "Bc4". The letter is the piece: N = knight, B = bishop, R = rook, Q = queen, K = king. No letter means a pawn. What follows is the destination square.',
        },
      },
      {
        fen: START,
        text: {
          es: 'Otros símbolos: "x" es una captura (Nxe5 = el caballo captura en e5), "+" es jaque, "#" es jaque mate, "O-O" es enroque corto y "O-O-O" enroque largo. No necesitas memorizarlo: la app siempre muestra el tablero.',
          en: 'Other symbols: "x" is a capture (Nxe5 = the knight captures on e5), "+" is check, "#" is checkmate, "O-O" is short castling and "O-O-O" long castling. You do not need to memorise it: the app always shows the board.',
        },
      },
    ],
  },
  {
    id: 'b13-first-moves',
    topic: 'basics',
    title: { es: '13. Tus primeras jugadas', en: '13. Your first moves' },
    steps: [
      {
        fen: START,
        text: {
          es: 'Al empezar tienes tres metas: 1) controlar el centro (casillas d4, e4, d5, e5), 2) sacar tus piezas (caballos y alfiles) y 3) poner el rey a salvo con el enroque. Vamos a hacerlo con una apertura clásica. Paso 1: mueve el peón del rey a e4.',
          en: 'At the start you have three goals: 1) control the centre (d4, e4, d5, e5), 2) bring out your pieces (knights and bishops) and 3) tuck your king away by castling. Let us do it with a classic opening. Step 1: move the king pawn to e4.',
        },
        accept: ['e4'],
        success: { es: 'Bien: ocupas el centro y abres camino a la dama y al alfil. Las negras respondieron e5.', en: 'Good: you hold the centre and open lines for the queen and bishop. Black replied e5.' },
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        text: {
          es: 'Paso 2: saca un caballo. Mueve el caballo de la derecha a f3: sale del rincón y ataca el peón negro de e5.',
          en: 'Step 2: bring out a knight. Move the right-hand knight to f3: it leaves the corner and attacks the black e5 pawn.',
        },
        accept: ['Nf3'],
        success: { es: 'Los caballos van antes que los alfiles. Las negras defendieron con Cc6.', en: 'Knights come out before bishops. Black defended with Nc6.' },
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        text: {
          es: 'Paso 3: saca el alfil. Llévalo a c4: desde ahí apunta a la casilla f7, el punto débil de las negras.',
          en: 'Step 3: bring out the bishop. Move it to c4: from there it aims at f7, Black\'s weak spot.',
        },
        accept: ['Bc4'],
        success: { es: 'Esta es la "Apertura Italiana". Las negras sacaron su alfil a c5.', en: 'This is the "Italian Game". Black developed its bishop to c5.' },
      },
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        text: {
          es: 'Paso 4: enroca para proteger al rey. Toca el rey y llévalo a g1 (dos casillas a la derecha).',
          en: 'Step 4: castle to protect your king. Tap the king and move it to g1 (two squares right).',
        },
        accept: ['O-O'],
        success: { es: '¡Listo! En cuatro jugadas desarrollaste piezas, controlaste el centro y pusiste a salvo el rey. Ahora ya puedes jugar una partida de verdad.', en: 'Done! In four moves you developed pieces, controlled the centre and made your king safe. Now you can play a real game.' },
      },
    ],
  },
  {
    id: 'b14-scholars-mate',
    topic: 'basics',
    title: { es: '14. El mate del pastor (y cómo evitarlo)', en: '14. Scholar\'s mate (and how to avoid it)' },
    steps: [
      {
        fen: START,
        text: {
          es: 'Es una trampa muy conocida que intentan los principiantes: dar mate en cuatro jugadas. Conviene conocerla para usarla y, sobre todo, para no caer en ella. Primero, e4.',
          en: 'A famous trap beginners try: checkmate in four moves. It is worth knowing both to use it and, above all, to avoid falling for it. First, e4.',
        },
        accept: ['e4'],
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        text: { es: 'Ahora el alfil a c4, apuntando al punto débil f7.', en: 'Now the bishop to c4, aiming at the weak point f7.' },
        accept: ['Bc4'],
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
        text: { es: 'Saca la dama a h5: ahora amenazas f7 con dos piezas.', en: 'Bring the queen out to h5: now you threaten f7 with two pieces.' },
        accept: ['Qh5'],
      },
      {
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        text: {
          es: 'Las negras no vieron la amenaza y jugaron Cf6. El peón de f7 solo está defendido por el rey. Captúralo con la dama.',
          en: 'Black missed the threat and played Nf6. The f7 pawn is defended only by the king. Capture it with the queen.',
        },
        accept: ['Qxf7'],
        success: {
          es: '¡JAQUE MATE en 4 jugadas! Para defenderte tú: no dejes el peón de f7 sin protección; si ves la dama y el alfil apuntando a f7, defiéndelo con ...g6, ...De7 o ...Ch6 (no con ...Cf6, que es el error de este ejemplo). Y mira siempre qué ataca el rival antes de mover.',
          en: 'CHECKMATE in 4 moves! To defend yourself: if the queen and bishop aim at f7, defend with ...g6, ...Qe7 or ...Nh6 (not ...Nf6, the mistake in this example). And always check what the opponent attacks before you move.',
        },
      },
    ],
  },
];
