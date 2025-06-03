import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Logo from './Logo';
import {
  Menu as MenuIcon,
  Public as EarthIcon,
  Dashboard as DashboardIcon,
  Storage as CatalogIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Search as SearchIcon,
  ChevronLeft as ChevronLeftIcon,
  Home as HomeIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from '@mui/icons-material';

interface LayoutProps {
  children: React.ReactNode;
}

const DRAWER_WIDTH = 240;

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerToggle = () => {
    // Sidebar toggle disabled
    // setDrawerOpen(!drawerOpen);
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Earth Viewer';
      case '/anomalies':
        return 'Anomaly Dashboard';
      case '/catalog':
        return 'Data Catalog';
      case '/settings':
        return 'Settings';
      default:
        return 'VisionEarth';
    }
  };

  const menuItems = [
    { text: 'Earth Viewer', icon: <EarthIcon />, path: '/' },
    { text: 'Anomaly Dashboard', icon: <DashboardIcon />, path: '/anomalies' },
    { text: 'Data Catalog', icon: <CatalogIcon />, path: '/catalog' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  const drawer = (
    <>
      <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap component="div">
          VisionEarth
        </Typography>
        {isMobile && (
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => navigate(item.path)}
            selected={location.pathname === item.path}
            sx={{
              '&.Mui-selected': {
                backgroundColor: 'rgba(92, 187, 242, 0.2)',
                '&:hover': {
                  backgroundColor: 'rgba(92, 187, 242, 0.3)',
                },
              },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', p: 2 }}>
        <Typography variant="body2" color="text.secondary" align="center">
          © 2025 VisionEarth
        </Typography>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Top AppBar removed */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar /> {/* Spacer for the AppBar */}
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
