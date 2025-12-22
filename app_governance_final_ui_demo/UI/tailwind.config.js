/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Add custom colors from dashboard if needed, or rely on defaults first
            }
        },
    },
    plugins: [],
}
