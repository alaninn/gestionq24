// =============================================
// ARCHIVO: tailwind.config.js
// FUNCIÓN: Le dice a Tailwind en qué archivos
//          tiene que buscar las clases CSS
// =============================================

/** @type {import('tailwindcss').Config} */
export default {
  // content = lista de archivos donde usamos clases de Tailwind
  // Tailwind lee estos archivos y genera solo el CSS necesario
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // todos los archivos dentro de src/
  ],
  theme: {
    extend: {
      // Acá podemos agregar colores o tamaños personalizados en el futuro
    },
  },
  plugins: [],
}