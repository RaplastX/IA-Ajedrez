/** Lecciones interactivas: curso desde cero (basics) y estrategia/táctica. */
import { BASICS } from './basics';
export interface LessonStep {
  fen: string;
  text: { es: string; en: string };
  /** Si existe, el usuario debe encontrar una de estas jugadas (SAN, sin +/#). */
  accept?: string[];
  success?: { es: string; en: string };
  arrows?: { from: string; to: string }[];
  /** Casillas que se marcan en azul para señalar algo. */
  highlights?: string[];
  /** Paso de práctica libre: el alumno prueba jugadas y el tablero se restablece. */
  explore?: boolean;
}

export interface Lesson {
  id: string;
  title: { es: string; en: string };
  topic: 'basics' | 'strategy' | 'tactics' | 'opening' | 'endgame';
  /** Tema de puzzles relacionado para seguir practicando. */
  practiceTheme?: string;
  steps: LessonStep[];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LESSONS: Lesson[] = [
  ...BASICS,
  {
    id: 'center',
    title: { es: 'Control del centro', en: 'Controlling the centre' },
    topic: 'opening',
    practiceTheme: 'opening',
    steps: [
      {
        fen: START,
        text: {
          es: 'Las casillas e4, d4, e5 y d5 son el centro. Las piezas centralizadas controlan más casillas y llegan antes a cualquier flanco.',
          en: 'e4, d4, e5 and d5 are the centre. Centralised pieces control more squares and reach either wing faster.',
        },
        arrows: [
          { from: 'e2', to: 'e4' },
          { from: 'd2', to: 'd4' },
        ],
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        text: {
          es: 'Las negras también ocupan el centro. Desarrolla una pieza atacando el peón de e5.',
          en: 'Black also claims the centre. Develop a piece while attacking the e5 pawn.',
        },
        accept: ['Nf3'],
        success: {
          es: '¡Bien! Nf3 desarrolla, ataca e5 y prepara el enroque.',
          en: 'Well done! Nf3 develops, hits e5 and prepares castling.',
        },
      },
      {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        text: {
          es: 'Golpea el centro con un peón para abrir líneas a tus piezas.',
          en: 'Strike the centre with a pawn to open lines for your pieces.',
        },
        accept: ['d4'],
        success: {
          es: 'Exacto: d4 cuestiona el peón de e5 y libera el alfil de c1.',
          en: 'Exactly: d4 challenges e5 and frees the c1 bishop.',
        },
      },
    ],
  },
  {
    id: 'development',
    title: { es: 'Desarrollo y enroque', en: 'Development and castling' },
    topic: 'opening',
    practiceTheme: 'opening',
    steps: [
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        text: {
          es: 'Reglas de oro: caballos antes que alfiles, no muevas la dama pronto y enroca rápido. Aquí ya puedes enrocar.',
          en: 'Golden rules: knights before bishops, do not bring the queen out early, castle quickly. You can castle now.',
        },
        accept: ['O-O'],
        success: {
          es: 'El rey queda a salvo y la torre se acerca al centro.',
          en: 'Your king is safe and the rook moves towards the centre.',
        },
      },
      {
        fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4',
        text: {
          es: 'Ahora juegas con negras. Desarrolla el último caballo o prepara la salida del alfil.',
          en: 'Now you are Black. Develop the last knight or prepare to develop the bishop.',
        },
        accept: ['Nf6', 'd6'],
        success: {
          es: 'Correcto: cada jugada de apertura debería mejorar una pieza.',
          en: 'Correct: every opening move should improve a piece.',
        },
      },
    ],
  },
  {
    id: 'open-files',
    title: { es: 'Torres en columnas abiertas', en: 'Rooks on open files' },
    topic: 'strategy',
    practiceTheme: 'middlegame',
    steps: [
      {
        fen: '2r2rk1/pp3ppp/2n1bn2/8/8/2N1BN2/PP3PPP/2R2RK1 w - - 0 15',
        text: {
          es: 'Las columnas d y e no tienen peones. Una torre en una columna abierta presiona hasta la séptima fila. Ocupa una.',
          en: 'The d- and e-files have no pawns. A rook on an open file pressures all the way to the seventh rank. Take one.',
        },
        accept: ['Rfd1', 'Rcd1', 'Rfe1', 'Rce1'],
        success: {
          es: 'Bien: tu torre controla la columna. El siguiente paso suele ser doblar torres.',
          en: 'Good: your rook owns the file. The next step is often doubling rooks.',
        },
      },
    ],
  },
  {
    id: 'pawn-structure',
    title: { es: 'Estructura de peones', en: 'Pawn structure' },
    topic: 'strategy',
    practiceTheme: 'pawnEndgame',
    steps: [
      {
        fen: '6k1/5ppp/8/1P6/8/8/5PPP/6K1 w - - 0 1',
        text: {
          es: 'Un peón pasado no tiene peones rivales delante ni en columnas vecinas. "Los peones pasados deben avanzar".',
          en: 'A passed pawn has no enemy pawns ahead of it or on adjacent files. "Passed pawns must be pushed."',
        },
        accept: ['b6'],
        success: {
          es: 'El rey negro está demasiado lejos: el peón corona.',
          en: 'The black king is too far away: the pawn will promote.',
        },
      },
      {
        fen: 'r1bq1rk1/pp2bppp/2n1pn2/8/2BP4/2N2N2/PP3PPP/R1BQ1RK1 b - - 0 9',
        text: {
          es: 'El peón blanco de d4 está aislado: no hay peones blancos en las columnas c ni e. La casilla delante de él es un puesto ideal. Bloquéala.',
          en: 'White’s d4 pawn is isolated: there are no white pawns on the c- or e-files. The square in front of it is an ideal outpost. Blockade it.',
        },
        accept: ['Nd5'],
        success: {
          es: 'Un caballo bloqueador no puede ser expulsado por peones.',
          en: 'A blockading knight cannot be chased away by pawns.',
        },
      },
    ],
  },
  {
    id: 'king-safety',
    title: { es: 'Seguridad del rey', en: 'King safety' },
    topic: 'strategy',
    practiceTheme: 'backRankMate',
    steps: [
      {
        fen: 'r5k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1',
        text: {
          es: 'Tu rey no tiene casillas de escape: un jaque en la primera fila sería mate. Dale "aire" con un peón.',
          en: 'Your king has no escape squares: a check on the first rank would be mate. Give it some air with a pawn.',
        },
        accept: ['h3', 'g3', 'h4'],
        success: {
          es: 'Ahora el rey tiene una casilla de escape y la amenaza del pasillo desaparece.',
          en: 'Now the king has an escape square and the back-rank threat is gone.',
        },
      },
      {
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
        text: {
          es: 'Al revés: el rey negro no tiene aire. Aprovéchalo.',
          en: 'The other way round: the black king has no air. Exploit it.',
        },
        accept: ['Ra8'],
        success: { es: '¡Mate del pasillo!', en: 'Back-rank mate!' },
      },
    ],
  },
  {
    id: 'basic-tactics',
    title: { es: 'Táctica: horquilla y clavada', en: 'Tactics: fork and pin' },
    topic: 'tactics',
    practiceTheme: 'fork',
    steps: [
      {
        fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
        text: {
          es: 'Una horquilla ataca dos piezas a la vez. Los caballos son expertos. Encuéntrala.',
          en: 'A fork attacks two pieces at once. Knights are experts. Find it.',
        },
        accept: ['Nc7'],
        success: {
          es: 'Jaque al rey y ataque a la torre: ganas material.',
          en: 'Check to the king and the rook is attacked: you win material.',
        },
      },
      {
        fen: '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1',
        text: {
          es: 'Una clavada inmoviliza una pieza que protege a otra más valiosa. Clava el caballo contra el rey.',
          en: 'A pin freezes a piece that shields a more valuable one. Pin the knight to the king.',
        },
        accept: ['Bb5'],
        success: {
          es: 'Clavada absoluta: el caballo no puede moverse porque dejaría al rey en jaque.',
          en: 'Absolute pin: the knight cannot move without exposing its king.',
        },
      },
      {
        fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1',
        text: {
          es: 'Rey y dama colaboran: da mate en una.',
          en: 'King and queen work together: mate in one.',
        },
        accept: ['Qa8'],
        success: { es: '¡Mate!', en: 'Checkmate!' },
      },
    ],
  },
];
