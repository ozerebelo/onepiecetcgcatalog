// Configuração do site. É o único ficheiro que precisas de editar.

/** ID da Google Sheet (está no endereço: /spreadsheets/d/<ID>/edit). */
export const SHEET_ID = '1xTdYfFZ0vEUMkUF7N-71Q65k43wB6mTZ3YQ6MewK2XY';

/** gid do separador "Alt Leaders" (está no endereço depois de #gid=). */
export const SHEET_GID = '0';

/**
 * Link CSV de "Ficheiro → Partilhar → Publicar na Web" (separador "Alt Leaders", formato CSV), se a
 * publicares. Opcional: a folha já está partilhada com "qualquer pessoa com o link", e isso chega.
 */
export const PUBLISHED_CSV_URL = '';

/**
 * Endereços tentados por ordem até um responder com a folha:
 *  1. o link publicado acima (se existir);
 *  2. a versão publicada pelo ID (só responde se a folha estiver publicada na Web);
 *  3. a exportação direta em CSV (responde porque a folha está partilhada por link).
 */
export const CSV_URLS = [
  PUBLISHED_CSV_URL,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?gid=${SHEET_GID}&single=true&output=csv`,
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
].filter(Boolean);

/** Link para abrir a folha (rodapé da página). */
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${SHEET_GID}`;
