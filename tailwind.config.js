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
          primary: '#059669',
          primaryDark: '#047857',
          info: '#0284c7',
          warning: '#d97706',
          danger: '#dc2626',
          purple: '#7c3aed',
          magenta: '#c026d3',
          dark: '#0f172a',
        },
      },
    },
  },
  plugins: [],
}
