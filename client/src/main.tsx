import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux';
import { BrowserRouter } from "react-router";
import { ThemeProvider, CssBaseline } from '@mui/material';
import { store } from './store/store';
import { themes } from './theme';
import { useAppSelector } from './store/hooks';
import App from './App.tsx'

function ThemedApp() {
  const themeId = useAppSelector((s) => s.theme.themeId);
  return (
    <ThemeProvider theme={themes[themeId]}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemedApp />
    </Provider>
  </StrictMode>,
)
