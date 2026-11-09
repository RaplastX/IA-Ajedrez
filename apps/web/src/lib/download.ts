/** Descarga un texto como archivo (PGN, exportación de datos RGPD...). */
export function downloadText(filename: string, text: string, type = 'application/x-chess-pgn') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
