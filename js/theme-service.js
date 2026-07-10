/**
 * Theme Service for Smart Task Flow
 * Handles Light/Dark mode state management and DOM manipulation.
 */
(function() {
    // Determine active theme on load
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Default active theme selection
    let activeTheme = savedTheme || (prefersDark ? 'dark' : 'light');

    /**
     * Apply the specified theme class to the HTML element
     * @param {string} theme - 'dark' or 'light'
     */
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
        activeTheme = theme;
        
        // Dispatch custom event to let other modules know theme changed
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    // Immediately apply theme to avoid Flash of Unstyled Content (FOUC)
    applyTheme(activeTheme);

    // Export service to global scope
    window.ThemeService = {
        getCurrentTheme: () => activeTheme,
        setTheme: (theme) => applyTheme(theme),
        toggleTheme: () => {
            const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
            return nextTheme;
        }
    };
})();
