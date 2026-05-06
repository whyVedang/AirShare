import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(true);

    // Initialize theme from localStorage
    useEffect(() => {
        const savedTheme = localStorage.getItem('airshare-theme');
        if (savedTheme) {
            const darkMode = savedTheme === 'dark';
            setIsDark(darkMode);
            applyTheme(darkMode);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setIsDark(prefersDark);
            applyTheme(prefersDark);
        }
    }, []);

    const applyTheme = (dark) => {
        const htmlElement = document.documentElement;
        if (dark) {
            htmlElement.classList.remove('light-theme');
            document.body.classList.remove('light-theme');
        } else {
            htmlElement.classList.add('light-theme');
            document.body.classList.add('light-theme');
        }
    };

    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        applyTheme(newTheme);
        localStorage.setItem('airshare-theme', newTheme ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
