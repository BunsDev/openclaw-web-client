import { createTheme } from '@mui/material/styles';

// Extend the palette to include sidebar and card colors
declare module '@mui/material/styles' {
  interface Palette {
    sidebar: {
      background: string;
      border: string;
      text: string;
      hover: string;
      selectedBg: string;
      selectedText: string;
      selectedBorder: string;
    };
    card: {
      background: string;
      selectedBackground: string;
      shadow: string;
      selectedShadow: string;
      hoverShadow: string;
    };
  }
  interface PaletteOptions {
    sidebar?: {
      background: string;
      border: string;
      text: string;
      hover: string;
      selectedBg: string;
      selectedText: string;
      selectedBorder: string;
    };
    card?: {
      background: string;
      selectedBackground: string;
      shadow: string;
      selectedShadow: string;
      hoverShadow: string;
    };
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#e8a840', // Golden yellow
      light: '#f0bc60',
      dark: '#c89030',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#4a9068', // Muted green
      light: '#60a880',
      dark: '#387850',
      contrastText: '#ffffff',
    },
    error: {
      main: '#d05040',
      light: '#e06858',
      dark: '#b04030',
    },
    warning: {
      main: '#e8a840',
      light: '#f0bc60',
      dark: '#c89030',
    },
    info: {
      main: '#5a90b8',
      light: '#78a8cc',
      dark: '#4878a0',
    },
    success: {
      main: '#4a9068',
      light: '#60a880',
      dark: '#387850',
    },
    background: {
      default: '#f5f3f0', // Light warm grey
      paper: '#ffffff',
    },
    text: {
      primary: '#2a2a2a',
      secondary: '#8a8a88',
    },
    divider: '#ebebeb',
    card: {
      background: '#ffffff',
      selectedBackground: '#faf8f4',
      shadow: 'none',
      selectedShadow: 'none',
      hoverShadow: 'none',
    },
    sidebar: {
      background: '#2a2a2a', // Dark charcoal
      border: '#363636',
      text: '#8a8a88',
      hover: '#363636',
      selectedBg: 'transparent',
      selectedText: '#ffffff',
      selectedBorder: '#e8a840', // Golden accent
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '1.75rem',
      fontWeight: 600,
      color: '#2a2a2a',
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#2a2a2a',
    },
    body1: {
      fontSize: '0.875rem',
      color: '#2a2a2a',
    },
    body2: {
      fontSize: '0.8125rem',
      color: '#8a8a88',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableRipple: true,
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
        },
        contained: {
          boxShadow: '0 2px 8px rgba(232, 168, 64, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(232, 168, 64, 0.4)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#ffffff',
            '& fieldset': {
              borderColor: '#ebebeb',
            },
            '&:hover fieldset': {
              borderColor: '#d0d0d0',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#e8a840',
            },
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
          border: 'none',
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
          backgroundColor: '#ffffff',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        },
        elevation2: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        },
        elevation3: {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: '#ebebeb',
          padding: '14px 16px',
        },
        head: {
          fontWeight: 600,
          color: '#8a8a88',
          backgroundColor: '#fafafa',
          fontSize: '0.8125rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: '#fafafa',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          fontSize: '0.75rem',
        },
        colorPrimary: {
          backgroundColor: '#e8a840',
          color: '#ffffff',
        },
        colorSecondary: {
          backgroundColor: '#4a9068',
          color: '#ffffff',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundColor: '#ffffff',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: '#8a8a88',
          '&:hover': {
            backgroundColor: '#f5f3f0',
          },
        },
        colorError: {
          color: '#d05040',
          '&:hover': {
            backgroundColor: 'rgba(208, 80, 64, 0.06)',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'transparent',
          },
        },
      },
    },
  },
});

export default theme;
