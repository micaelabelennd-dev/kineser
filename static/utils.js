// Utilidades para sanitizar texto y prevenir XSS
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Función para crear elementos de forma segura
function createSafeElement(tag, text, className = '') {
  const element = document.createElement(tag);
  if (text) {
    element.textContent = text; // Usar textContent en lugar de innerHTML para prevenir XSS
  }
  if (className) {
    element.className = className;
  }
  return element;
}

