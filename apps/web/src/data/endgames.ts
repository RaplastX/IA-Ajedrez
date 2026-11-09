/**
 * Finales teóricos. Todos los resultados se verificaron con la tablebase Syzygy de Lichess
 * (ver test/content.test.ts y docs/DATOS.md).
 */
export interface EndgameDrill {
  id: string;
  title: { es: string; en: string };
  fen: string;
  goal: 'win' | 'draw';
  level: 1 | 2 | 3;
  hint: { es: string; en: string };
}

export const ENDGAMES: EndgameDrill[] = [
  {
    id: 'kq-k',
    title: { es: 'Mate con dama', en: 'Queen mate' },
    fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
    goal: 'win',
    level: 1,
    hint: {
      es: 'Usa la dama para encerrar al rey en una caja cada vez más pequeña y acerca tu rey. ¡Cuidado con el ahogado!',
      en: 'Use the queen to box the king in, then bring your king closer. Watch out for stalemate!',
    },
  },
  {
    id: 'kr-k',
    title: { es: 'Mate con torre', en: 'Rook mate' },
    fen: '8/8/8/4k3/8/8/8/4K2R w - - 0 1',
    goal: 'win',
    level: 1,
    hint: {
      es: 'Corta al rey con la torre y usa la oposición de reyes para empujarlo hacia el borde.',
      en: 'Cut the king off with the rook and use the opposition to push it to the edge.',
    },
  },
  {
    id: 'kp-k-sixth',
    title: { es: 'Rey en sexta: peón gana', en: 'King on the sixth wins' },
    fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
    goal: 'win',
    level: 1,
    hint: {
      es: 'Con el rey delante del peón en sexta, la victoria es segura: muévete a un lado del rey rival.',
      en: 'With your king in front of the pawn on the sixth rank it is a win: step to the side.',
    },
  },
  {
    id: 'kp-k-defend',
    title: { es: 'Defender con oposición', en: 'Defend with the opposition' },
    fen: '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1',
    goal: 'draw',
    level: 2,
    hint: {
      es: 'Coloca tu rey frente al rival con una casilla de por medio (oposición) y mantén el bloqueo.',
      en: 'Stand in front of the enemy king with one square between (opposition) and keep blocking.',
    },
  },
  {
    id: 'kbb-k',
    title: { es: 'Mate con dos alfiles', en: 'Two-bishop mate' },
    fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
    goal: 'win',
    level: 2,
    hint: {
      es: 'Los alfiles juntos forman una barrera diagonal; llévalo a una esquina con ayuda del rey.',
      en: 'Side by side the bishops form a diagonal wall; drive the king to a corner with your king.',
    },
  },
  {
    id: 'philidor',
    title: { es: 'Posición de Philidor', en: 'Philidor position' },
    fen: '4k3/R7/6r1/3KP3/8/8/8/8 b - - 0 1',
    goal: 'draw',
    level: 3,
    hint: {
      es: 'Mantén la torre en la sexta fila; cuando el peón avance, pásala atrás y da jaques desde lejos.',
      en: 'Keep the rook on the sixth rank; once the pawn advances, swing it back and check from afar.',
    },
  },
  {
    id: 'lucena',
    title: { es: 'Posición de Lucena', en: 'Lucena position' },
    fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1',
    goal: 'win',
    level: 3,
    hint: {
      es: '"Construye el puente": corta al rey, lleva la torre a la cuarta fila y protege a tu rey de los jaques.',
      en: '"Build the bridge": cut the king off, lift the rook to the fourth rank and shield your king.',
    },
  },
  {
    id: 'kbn-k',
    title: { es: 'Mate con alfil y caballo', en: 'Bishop and knight mate' },
    fen: '8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1',
    goal: 'win',
    level: 3,
    hint: {
      es: 'El mate solo es posible en la esquina del color del alfil. Técnica avanzada: paciencia.',
      en: 'Mate is only possible in the corner of the bishop’s colour. Advanced technique: be patient.',
    },
  },
];
