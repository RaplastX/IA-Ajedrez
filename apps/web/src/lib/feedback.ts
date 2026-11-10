/** Respuesta sensorial combinada (sonido + vibración + confeti) para aciertos y fallos. */
import { celebrate } from './fx';
import { notify } from './haptics';
import { play } from './sound';

export function success(withConfetti = true) {
  play('success');
  notify('success');
  if (withConfetti) celebrate();
}

export function failure() {
  play('error');
  notify('error');
}
