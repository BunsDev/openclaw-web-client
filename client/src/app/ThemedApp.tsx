import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router';
import { themes } from './theme';
import { useAppSelector } from './store/hooks';
import App from './App.tsx';

export default function ThemedApp() {
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
