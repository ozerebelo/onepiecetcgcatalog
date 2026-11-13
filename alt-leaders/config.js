// Configuração do site. É o único ficheiro que precisas de editar.

/** ID da Google Sheet (está no endereço: /spreadsheets/d/<ID>/edit). */
export const SHEET_ID = '1xTdYfFZ0vEUMkUF7N-71Q65k43wB6mTZ3YQ6MewK2XY';

/** gid do separador "Alt Leaders" (está no endereço depois de #gid=). */
export const SHEET_GID = '0';

/**
 * Link CSV de "Ficheiro → Partilhar → Publicar na Web" (separador "Alt Leaders", formato CSV).
 * Cola-o aqui, p. ex. 'https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=0&single=true&output=csv'.
 * Vazio = usa o endereço público da folha pelo ID acima (funciona assim que a folha estiver publicada).
 */
export const PUBLISHED_CSV_URL = '';

export const CSV_URL =
  PUBLISHED_CSV_URL ||
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?gid=${SHEET_GID}&single=true&output=csv`;

/** Link para abrir a folha (rodapé da página). */
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`;
