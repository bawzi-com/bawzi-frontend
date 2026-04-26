/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Isso diz ao Tailwind para ler todos os seus arquivos dentro de src
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Aqui podemos adicionar as cores da Bawzi se quisermos usar nomes personalizados
      colors: {
        bawzi: {
          purple: '#8A05BE',
          magenta: '#C123E0',
          dark: '#0f172a',
        },
      },
    },
  },
  plugins: [],
}