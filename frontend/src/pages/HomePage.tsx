import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia,
  Container,
  Paper,
  Stack,
  Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ExploreOutlined, ShowChartOutlined, SatelliteAltOutlined, CloudOutlined, WarningAmberOutlined } from '@mui/icons-material';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box>
      {/* Hero Section */}
      <Paper 
        sx={{ 
          position: 'relative',
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          backgroundImage: 'url(https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1
          }
        }}
      >
        <Container sx={{ position: 'relative', zIndex: 2 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={7}>
              <Typography 
                variant="h2" 
                component="h1" 
                sx={{ 
                  fontWeight: 700, 
                  color: 'white',
                  mb: 2,
                  fontSize: { xs: '2.5rem', md: '3.5rem' }
                }}
              >
                Visualizing Earth's Data in Real-Time
              </Typography>
              <Typography 
                variant="h5" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                  mb: 4
                }}
              >
                An interactive 3D platform for monitoring and analyzing Earth's environmental data with AI-powered insights
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button 
                  variant="contained" 
                  size="large" 
                  color="primary"
                  startIcon={<ExploreOutlined />}
                  onClick={() => navigate('/earth')}
                  sx={{ fontWeight: 600 }}
                >
                  Explore Earth
                </Button>
                <Button 
                  variant="outlined" 
                  size="large"
                  sx={{ color: 'white', borderColor: 'white' }}
                  onClick={() => navigate('/anomalies')}
                >
                  View Anomalies
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Paper>

      {/* Features Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container>
          <Typography variant="h3" component="h2" align="center" gutterBottom>
            Platform Features
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" paragraph sx={{ mb: 6 }}>
            Comprehensive tools for environmental monitoring and analysis
          </Typography>

          <Grid container spacing={4}>
            {/* Feature 1 */}
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', backgroundColor: 'primary.dark' }}>
                  <SatelliteAltOutlined sx={{ fontSize: 60, color: 'white' }} />
                </Box>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography gutterBottom variant="h5" component="h3">
                    Satellite Data Integration
                  </Typography>
                  <Typography>
                    Access and visualize real-time satellite imagery from NASA, NOAA, and ESA Sentinel missions with customizable overlays.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Feature 2 */}
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', backgroundColor: 'primary.dark' }}>
                  <CloudOutlined sx={{ fontSize: 60, color: 'white' }} />
                </Box>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography gutterBottom variant="h5" component="h3">
                    Weather Visualization
                  </Typography>
                  <Typography>
                    Dynamic global weather patterns visualization with historical data and forecasting capabilities.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Feature 3 */}
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', backgroundColor: 'primary.dark' }}>
                  <WarningAmberOutlined sx={{ fontSize: 60, color: 'white' }} />
                </Box>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography gutterBottom variant="h5" component="h3">
                    Anomaly Detection
                  </Typography>
                  <Typography>
                    AI-powered detection of environmental anomalies including deforestation, wildfires, and pollution events.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Feature 4 */}
            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', backgroundColor: 'primary.dark' }}>
                  <ShowChartOutlined sx={{ fontSize: 60, color: 'white' }} />
                </Box>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography gutterBottom variant="h5" component="h3">
                    Time-Series Analysis
                  </Typography>
                  <Typography>
                    Track environmental changes over time with interactive time-series data visualization and comparison tools.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* More features would go here */}
          </Grid>
        </Container>
      </Box>

      {/* Recent Anomalies Section */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container>
          <Typography variant="h3" component="h2" align="center" gutterBottom>
            Recent Environmental Anomalies
          </Typography>
          <Typography variant="h6" align="center" color="text.secondary" paragraph sx={{ mb: 6 }}>
            AI-detected environmental events requiring attention
          </Typography>

          <Grid container spacing={4}>
            {/* Anomaly 1 */}
            <Grid item xs={12} md={6}>
              <Card sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
                <CardMedia
                  component="img"
                  sx={{ width: { sm: 200 }, height: { xs: 200, sm: 'auto' } }}
                  image="https://images.unsplash.com/photo-1615414037094-494fa44a6f50?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80"
                  alt="Wildfire"
                />
                <CardContent sx={{ flex: '1 0 auto' }}>
                  <Typography component="h3" variant="h5">
                    Wildfire Detected
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Amazon Rainforest, Brazil • 2 days ago
                  </Typography>
                  <Typography variant="body2" paragraph>
                    AI analysis detected a wildfire covering approximately 3.2 sq km. Confidence: 94%
                  </Typography>
                  <Button size="small" color="primary">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Anomaly 2 */}
            <Grid item xs={12} md={6}>
              <Card sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' } }}>
                <CardMedia
                  component="img"
                  sx={{ width: { sm: 200 }, height: { xs: 200, sm: 'auto' } }}
                  image="https://images.unsplash.com/photo-1621451497513-28595d129eef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                  alt="Deforestation"
                />
                <CardContent sx={{ flex: '1 0 auto' }}>
                  <Typography component="h3" variant="h5">
                    Deforestation Activity
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                    Congo Basin, DRC • 5 days ago
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Detected significant forest clearing activities covering 5.7 sq km. Confidence: 89%
                  </Typography>
                  <Button size="small" color="primary">
                    View Details
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              onClick={() => navigate('/anomalies')}
            >
              View All Anomalies
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Call to Action */}
      <Box 
        sx={{ 
          py: 8, 
          backgroundColor: 'primary.dark',
          color: 'white'
        }}
      >
        <Container>
          <Typography variant="h3" align="center" gutterBottom>
            Start Exploring Earth's Data
          </Typography>
          <Typography variant="h6" align="center" paragraph sx={{ mb: 4, opacity: 0.8 }}>
            Dive into our interactive 3D Earth viewer and discover environmental insights
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              color="secondary"
              size="large"
              onClick={() => navigate('/earth')}
              sx={{ fontWeight: 600, px: 4, py: 1.5 }}
            >
              Launch Earth Viewer
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
