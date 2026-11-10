import { dailyIndex, type Puzzle } from '@ia-ajedrez/core';
import puzzles from '../src/data/puzzles.json' with { type: 'json' };
import { expect, move, test } from './fixtures';

test('juega contra Stockfish y la IA responde', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Empezar' }).click();
  await move(page, 'e2e4');
  await expect(page.locator('.moves button')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId('play-status')).toHaveText('Te toca mover');
  // Segunda jugada arrastrando la pieza (Cg1-f3).
  const from = (await page.locator('[data-square="g1"]').boundingBox())!;
  const to = (await page.locator('[data-square="f3"]').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.moves button')).toHaveCount(4, { timeout: 30_000 });
  await expect(page.locator('.moves button').nth(2)).toHaveText('Nf3');
  await page.getByRole('button', { name: 'Abandonar' }).click();
  await expect(page.getByTestId('play-status')).toContainText('Abandono');
});

test('resuelve el puzzle del día y sube el rating', async ({ page }) => {
  const bank = puzzles as Puzzle[];
  const today = new Date().toISOString().slice(0, 10);
  const puzzle = bank[dailyIndex(today, bank.length)]!;
  await page.goto('/tactics?mode=daily');
  await expect(page.getByTestId('puzzle-status')).toContainText('encuentra la mejor jugada');
  await page.waitForTimeout(800); // animación de la jugada del rival
  for (let i = 1; i < puzzle.moves.length; i += 2) {
    await move(page, puzzle.moves[i]!);
    await page.waitForTimeout(600);
  }
  await expect(page.getByTestId('puzzle-status')).toHaveText('¡Resuelto!');
  await expect(page.getByTestId('rating-delta')).toContainText('+');
  await page.goto('/achievements');
  await expect(page.getByTestId('badge-firstPuzzle')).toHaveAttribute('data-earned', 'true');
});

test('completa una lección interactiva', async ({ page }) => {
  await page.goto('/lessons');
  await page.getByRole('button', { name: /Táctica: horquilla y clavada/ }).click();
  await move(page, 'd5c7');
  await expect(page.getByTestId('lesson-status')).toContainText('Jaque al rey');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await move(page, 'f1b5');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await move(page, 'a1a8');
  await expect(page.getByTestId('lesson-status')).toHaveText('¡Mate!');
  await page.getByRole('button', { name: 'Terminar lección' }).click();
  await expect(page.getByRole('button', { name: /✅ Táctica: horquilla y clavada/ })).toBeVisible();
});

test('analiza una partida en PGN y genera ejercicios', async ({ page }) => {
  await page.goto('/analysis');
  await page.getByRole('button', { name: 'Cargar ejemplo' }).click();
  await page.getByLabel('Profundidad').selectOption('8');
  await page.getByRole('button', { name: 'Analizar', exact: true }).click();
  await expect(page.getByTestId('analysis-summary')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('analysis-summary')).toContainText('Precisión');
  await page.locator('.moves button').nth(4).click();
  await expect(page.getByTestId('tutor-panel')).toContainText('3.');
});

test('un principiante completa las primeras lecciones del curso desde cero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('newbie-card')).toBeVisible();
  await page.getByRole('link', { name: 'Empezar el curso desde cero' }).click();
  await page.getByRole('button', { name: 'Empezar desde cero' }).click();
  // Lección 1: solo lectura.
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Terminar lección' }).click();
  await expect(page.getByText('1 de 14 lecciones completadas')).toBeVisible();
  // Lección 2 (peón): practicar, usar la ayuda y hacer la jugada.
  await page.getByRole('button', { name: 'Continuar el curso' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: /Muéstrame la jugada/ }).click();
  await move(page, 'e2e4');
  await expect(page.getByTestId('lesson-status')).toContainText('Muy bien');
});
