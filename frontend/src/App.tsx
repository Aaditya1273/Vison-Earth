import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';

// Import components
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import EarthViewerPage from './pages/EarthViewerPage';
import AnomalyDashboardPage from './pages/AnomalyDashboardPage';
import DataCatalogPage from './pages/DataCatalogPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Create React Query client
const queryClient = new QueryClient();

// Create theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5cbbf2',
    },
    secondary: {
      main: '#4ade80',
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflow: 'hidden',
        },
      },
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/earth" element={<EarthViewerPage />} />
              <Route path="/anomalies" element={<AnomalyDashboardPage />} />
              <Route path="/catalog" element={<DataCatalogPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
