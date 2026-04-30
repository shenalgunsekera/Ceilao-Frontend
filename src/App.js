import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import TableSection from './components/TableSection';
import LoginPage from './components/LoginPage';
const ReportsPage = lazy(() => import('./components/ReportsPage'));
const AdminPanel  = lazy(() => import('./components/AdminPanel'));

/* ── MUI theme ───────────────────────────────────────────────────────────── */
const theme = createTheme({
  palette: {
    primary:    { main: '#E8472A', light: '#E8712A', dark: '#c93a20', contrastText: '#fff' },
    secondary:  { main: '#E89A2A', light: '#E8C42A', contrastText: '#fff' },
    success:    { main: '#10B981', contrastText: '#fff' },
    error:      { main: '#E8472A' },
    background: { default: '#F9F9FB', paper: '#FFFFFF' },
    text:       { primary: '#1A1A2E', secondary: '#6B7280' },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    h4: { fontWeight: 800 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          fontSize: 14,
          transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #E8472A 0%, #E8712A 100%)',
          boxShadow: '0 4px 12px rgba(232,71,42,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg, #c93a20 0%, #c85a20 100%)',
            boxShadow: '0 6px 18px rgba(232,71,42,0.35)',
            transform: 'translateY(-1px)',
          },
          '&:active': { transform: 'translateY(0)' },
          '&.Mui-disabled': { background: '#d8c8c4', boxShadow: 'none' },
        },
        containedSuccess: {
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
          boxShadow: '0 4px 12px rgba(16,185,129,0.22)',
          '&:hover': {
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            transform: 'translateY(-1px)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(232,113,42,0.45)',
          color: '#E8472A',
          '&:hover': { borderColor: '#E8472A', background: 'rgba(232,71,42,0.05)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 20px rgba(255,90,90,0.07)',
          borderRadius: 14,
          border: '1px solid rgba(255,139,90,0.10)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 14 },
        elevation1: { boxShadow: '0 2px 20px rgba(255,90,90,0.07)' },
        elevation2: { boxShadow: '0 4px 28px rgba(255,90,90,0.10)' },
        elevation6: { boxShadow: '0 8px 40px rgba(255,90,90,0.14)' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '&:hover fieldset': { borderColor: '#FF8B5A' },
            '&.Mui-focused fieldset': { borderColor: '#FF5A5A', borderWidth: 2 },
          },
          '& label.Mui-focused': { color: '#FF5A5A' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: { borderRadius: 10 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 18,
          boxShadow: '0 24px 64px rgba(255,90,90,0.18)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          background: '#1E1E2E',
          color: '#fff',
          fontWeight: 700,
          padding: '18px 24px',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            background: '#1E1E2E',
            color: '#C8C8D8',
            fontWeight: 700,
            fontSize: 11.5,
            letterSpacing: 0.7,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          },
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background 0.15s ease',
          '&:hover td': { background: 'rgba(255,139,90,0.05)' },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255,139,90,0.08)',
          fontSize: 13,
          padding: '12px 16px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
      },
    },
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': { borderRadius: 8, fontWeight: 600 },
          '& .Mui-selected': {
            background: 'linear-gradient(135deg, #FF5A5A, #FF8B5A)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(255,90,90,0.3)',
          },
        },
      },
    },
    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'right' } },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 500 },
        filledSuccess: { background: 'linear-gradient(135deg,#10B981,#059669)' },
        filledError:   { background: 'linear-gradient(135deg,#FF5A5A,#e04040)' },
      },
    },
  },
});

/* ── Auth context ────────────────────────────────────────────────────────── */
export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FF5A5A 0%, #FF8B5A 60%, #FFA95A 100%)',
    }}>
      <CircularProgress sx={{ color: '#fff' }} size={52} thickness={4} />
    </Box>
  );

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

/* ── App ─────────────────────────────────────────────────────────────────── */
function App() {
  const [user,        setUser]        = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        setUserProfile(snap.exists() ? snap.data() : null);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const authValue = useMemo(
    () => ({ user, userProfile, loading, setUser, setUserProfile, searchQuery, setSearchQuery }),
    [user, userProfile, loading, searchQuery]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthContext.Provider value={authValue}>
        <Router>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={
              <RequireAuth>
                <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#FFF8F5' }}>
                  <Sidebar />
                  <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    ml: { xs: 0, md: '260px' },
                    minWidth: 0,
                    transition: 'margin 0.3s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <Header />
                    <Box
                      className="page-enter"
                      sx={{ flex: 1, p: { xs: 2, sm: 3, md: 3 }, pt: { xs: 2, sm: 3 } }}
                    >
                      <Suspense fallback={null}>
                        <Routes>
                          <Route path="/"        element={<TableSection />} />
                          <Route path="/reports" element={<ReportsPage />} />
                          <Route path="/admin"   element={<AdminPanel />} />
                        </Routes>
                      </Suspense>
                    </Box>
                  </Box>
                </Box>
              </RequireAuth>
            } />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;
