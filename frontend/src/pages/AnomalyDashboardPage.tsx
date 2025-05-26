import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  ButtonGroup,
  Divider,
  IconButton,
  TextField,
  InputAdornment,
  Tab,
  Tabs,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  LinearProgress
} from '@mui/material';
import { 
  Search, 
  FilterList, 
  MapOutlined, 
  TableChartOutlined, 
  BarChartOutlined,
  NavigateNext,
  NavigateBefore,
  CalendarToday,
  Warning,
  Info,
  ErrorOutline,
  CheckCircleOutline,
  RestoreOutlined
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Mock data for anomalies
const mockAnomalies = [
  {
    id: 1,
    type: 'wildfire',
    location: 'Amazon Rainforest, Brazil',
    coordinates: [-59.85, -2.91],
    detectionDate: new Date(2025, 4, 22),
    severity: 'high',
    status: 'detected',
    confidenceScore: 0.94,
    description: 'Active wildfire detected covering approximately 3.2 sq km',
    imageUrl: 'https://images.unsplash.com/photo-1615414037094-494fa44a6f50?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80'
  },
  {
    id: 2,
    type: 'deforestation',
    location: 'Congo Basin, DRC',
    coordinates: [23.65, -0.23],
    detectionDate: new Date(2025, 4, 20),
    severity: 'medium',
    status: 'verified',
    confidenceScore: 0.89,
    description: 'Detected significant forest clearing activities covering 5.7 sq km',
    imageUrl: 'https://images.unsplash.com/photo-1621451497513-28595d129eef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
  },
  {
    id: 3,
    type: 'oil_spill',
    location: 'Gulf of Mexico',
    coordinates: [-90.28, 28.73],
    detectionDate: new Date(2025, 4, 18),
    severity: 'high',
    status: 'responding',
    confidenceScore: 0.92,
    description: 'Oil spill detected approximately 80 miles off the coast, covering 12.3 sq km',
    imageUrl: 'https://images.unsplash.com/photo-1581905192180-99cedf951aae?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2040&q=80'
  },
  {
    id: 4,
    type: 'flood',
    location: 'Mekong Delta, Vietnam',
    coordinates: [105.78, 10.03],
    detectionDate: new Date(2025, 4, 15),
    severity: 'medium',
    status: 'monitored',
    confidenceScore: 0.87,
    description: 'Unusual flooding detected in agricultural areas covering approximately 18.5 sq km',
    imageUrl: 'https://images.unsplash.com/photo-1547683906-3a7b01d78966?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
  },
  {
    id: 5,
    type: 'algal_bloom',
    location: 'Lake Erie, USA',
    coordinates: [-82.67, 41.65],
    detectionDate: new Date(2025, 4, 10),
    severity: 'low',
    status: 'resolved',
    confidenceScore: 0.85,
    description: 'Harmful algal bloom detected covering approximately 22.7 sq km',
    imageUrl: 'https://images.unsplash.com/photo-1572381235456-a72d911af084?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80'
  },
  {
    id: 6,
    type: 'drought',
    location: 'California Central Valley, USA',
    coordinates: [-119.27, 36.78],
    detectionDate: new Date(2025, 4, 5),
    severity: 'high',
    status: 'verified',
    confidenceScore: 0.91,
    description: 'Severe drought conditions detected across agricultural region',
    imageUrl: 'https://images.unsplash.com/photo-1589149736049-26a4b34bdf15?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2069&q=80'
  }
];

// Helper function for severity color
const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

// Helper function for status icon
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'detected':
      return <Warning color="error" />;
    case 'verified':
      return <Info color="info" />;
    case 'responding':
      return <ErrorOutline color="warning" />;
    case 'monitored':
      return <RestoreOutlined color="info" />;
    case 'resolved':
      return <CheckCircleOutline color="success" />;
    default:
      return null;
  }
};

const AnomalyDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State variables
  const [view, setView] = useState<number>(0); // 0=cards, 1=table, 2=map
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  
  // Filtered anomalies based on search and filters
  const filteredAnomalies = mockAnomalies.filter(anomaly => {
    // Search query filter
    if (searchQuery && !anomaly.location.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !anomaly.description.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !anomaly.type.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Type filter
    if (typeFilter !== 'all' && anomaly.type !== typeFilter) {
      return false;
    }
    
    // Severity filter
    if (severityFilter !== 'all' && anomaly.severity !== severityFilter) {
      return false;
    }
    
    // Status filter
    if (statusFilter !== 'all' && anomaly.status !== statusFilter) {
      return false;
    }
    
    // Date range filter (simplified for now)
    if (dateRange === 'today') {
      const today = new Date();
      return anomaly.detectionDate.toDateString() === today.toDateString();
    } else if (dateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return anomaly.detectionDate >= weekAgo;
    } else if (dateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return anomaly.detectionDate >= monthAgo;
    }
    
    return true;
  });
  
  // Handle filter changes
  const handleTypeFilterChange = (event: SelectChangeEvent) => {
    setTypeFilter(event.target.value);
  };
  
  const handleSeverityFilterChange = (event: SelectChangeEvent) => {
    setSeverityFilter(event.target.value);
  };
  
  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
  };
  
  const handleDateRangeChange = (event: SelectChangeEvent) => {
    setDateRange(event.target.value);
  };
  
  // Handle search query change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };
  
  // Handle view change
  const handleViewChange = (_event: React.SyntheticEvent, newValue: number) => {
    setView(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Environmental Anomaly Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          AI-detected environmental events requiring attention and monitoring
        </Typography>
      </Box>
      
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Total Anomalies
            </Typography>
            <Typography variant="h4" sx={{ my: 1 }}>
              {mockAnomalies.length}
            </Typography>
            <LinearProgress variant="determinate" value={100} color="primary" />
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" color="text.secondary">
              High Severity
            </Typography>
            <Typography variant="h4" sx={{ my: 1 }}>
              {mockAnomalies.filter(a => a.severity === 'high').length}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(mockAnomalies.filter(a => a.severity === 'high').length / mockAnomalies.length) * 100} 
              color="error" 
            />
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Active Monitoring
            </Typography>
            <Typography variant="h4" sx={{ my: 1 }}>
              {mockAnomalies.filter(a => a.status !== 'resolved').length}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(mockAnomalies.filter(a => a.status !== 'resolved').length / mockAnomalies.length) * 100} 
              color="warning" 
            />
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Avg. Confidence
            </Typography>
            <Typography variant="h4" sx={{ my: 1 }}>
              {(mockAnomalies.reduce((acc, cur) => acc + cur.confidenceScore, 0) / mockAnomalies.length * 100).toFixed(1)}%
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={(mockAnomalies.reduce((acc, cur) => acc + cur.confidenceScore, 0) / mockAnomalies.length) * 100} 
              color="info" 
            />
          </Paper>
        </Grid>
      </Grid>
      
      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              placeholder="Search anomalies..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="type-filter-label">Type</InputLabel>
              <Select
                labelId="type-filter-label"
                value={typeFilter}
                label="Type"
                onChange={handleTypeFilterChange}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="wildfire">Wildfire</MenuItem>
                <MenuItem value="deforestation">Deforestation</MenuItem>
                <MenuItem value="oil_spill">Oil Spill</MenuItem>
                <MenuItem value="flood">Flood</MenuItem>
                <MenuItem value="algal_bloom">Algal Bloom</MenuItem>
                <MenuItem value="drought">Drought</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="severity-filter-label">Severity</InputLabel>
              <Select
                labelId="severity-filter-label"
                value={severityFilter}
                label="Severity"
                onChange={handleSeverityFilterChange}
              >
                <MenuItem value="all">All Severities</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="status-filter-label">Status</InputLabel>
              <Select
                labelId="status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={handleStatusFilterChange}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="detected">Detected</MenuItem>
                <MenuItem value="verified">Verified</MenuItem>
                <MenuItem value="responding">Responding</MenuItem>
                <MenuItem value="monitored">Monitored</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="date-range-label">Date Range</InputLabel>
              <Select
                labelId="date-range-label"
                value={dateRange}
                label="Date Range"
                onChange={handleDateRangeChange}
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="week">Past Week</MenuItem>
                <MenuItem value="month">Past Month</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={1}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ButtonGroup size="small">
                <Button
                  variant={view === 0 ? "contained" : "outlined"}
                  onClick={() => setView(0)}
                >
                  <TableChartOutlined fontSize="small" />
                </Button>
                <Button
                  variant={view === 1 ? "contained" : "outlined"}
                  onClick={() => setView(1)}
                >
                  <MapOutlined fontSize="small" />
                </Button>
                <Button
                  variant={view === 2 ? "contained" : "outlined"}
                  onClick={() => setView(2)}
                >
                  <BarChartOutlined fontSize="small" />
                </Button>
              </ButtonGroup>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Tabs for different views */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={view} onChange={handleViewChange} aria-label="anomaly view tabs">
          <Tab label="Card View" />
          <Tab label="Map View" />
          <Tab label="Analytics" />
        </Tabs>
      </Paper>
      
      {/* Card View */}
      {view === 0 && (
        <Grid container spacing={3}>
          {filteredAnomalies.map(anomaly => (
            <Grid item key={anomaly.id} xs={12} md={6} lg={4}>
              <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={anomaly.imageUrl}
                  alt={anomaly.type}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography gutterBottom variant="h6" component="div">
                      {anomaly.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                    <Chip 
                      label={anomaly.severity.toUpperCase()} 
                      color={getSeverityColor(anomaly.severity) as any}
                      size="small"
                    />
                  </Box>
                  
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    {getStatusIcon(anomaly.status)}
                    <Typography variant="body2" color="text.secondary">
                      Status: {anomaly.status.replace(/\b\w/g, l => l.toUpperCase())}
                    </Typography>
                  </Stack>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Location: {anomaly.location}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Detected: {format(anomaly.detectionDate, 'PPP')}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Confidence: {(anomaly.confidenceScore * 100).toFixed(1)}%
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body1">
                    {anomaly.description}
                  </Typography>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <Button 
                    variant="contained" 
                    fullWidth
                    onClick={() => navigate(`/earth?anomaly=${anomaly.id}`)}
                  >
                    View on Earth
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
          
          {filteredAnomalies.length === 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">
                  No anomalies found matching your filters
                </Typography>
                <Button 
                  variant="outlined" 
                  sx={{ mt: 2 }}
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                    setSeverityFilter('all');
                    setStatusFilter('all');
                    setDateRange('all');
                  }}
                >
                  Clear Filters
                </Button>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
      
      {/* Map View - In a real implementation, this would be a map component */}
      {view === 1 && (
        <Paper sx={{ p: 2, height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <MapOutlined sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6">
              Map View
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In the full implementation, this would display anomalies on an interactive map
            </Typography>
            <Button 
              variant="contained" 
              sx={{ mt: 2 }}
              onClick={() => navigate('/earth')}
            >
              View in Earth Viewer
            </Button>
          </Box>
        </Paper>
      )}
      
      {/* Analytics View - In a real implementation, this would show charts and statistics */}
      {view === 2 && (
        <Paper sx={{ p: 2, height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <BarChartOutlined sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6">
              Analytics View
            </Typography>
            <Typography variant="body2" color="text.secondary">
              In the full implementation, this would display charts and statistics about anomalies
            </Typography>
          </Box>
        </Paper>
      )}
      
      {/* Pagination */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <ButtonGroup variant="outlined">
          <Button startIcon={<NavigateBefore />}>
            Previous
          </Button>
          <Button endIcon={<NavigateNext />}>
            Next
          </Button>
        </ButtonGroup>
      </Box>
    </Box>
  );
};

export default AnomalyDashboardPage;
