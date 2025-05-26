import React from 'react';
import { Box, Typography, Container, Grid, Card, CardContent, CardMedia, Chip, Stack } from '@mui/material';

const DataCatalogPage: React.FC = () => {
  // This would be fetched from an API in a real implementation
  const dataSources = [
    {
      id: 1,
      name: 'NASA MODIS',
      description: 'Moderate Resolution Imaging Spectroradiometer data providing global imagery',
      type: 'Satellite',
      updateFrequency: 'Daily',
      resolution: '250m-1km',
      coverage: 'Global',
      image: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg'
    },
    {
      id: 2,
      name: 'NOAA Weather Data',
      description: 'Global weather measurements including temperature, precipitation, and wind',
      type: 'Weather',
      updateFrequency: 'Hourly',
      resolution: 'Variable',
      coverage: 'Global',
      image: 'https://www.ncei.noaa.gov/sites/default/files/2023-04/FY21_NCEI_DataMap_ALL_0.jpg'
    },
    {
      id: 3,
      name: 'Sentinel-2',
      description: 'High-resolution optical imagery for land monitoring',
      type: 'Satellite',
      updateFrequency: '5 days',
      resolution: '10m',
      coverage: 'Global land surfaces',
      image: 'https://sentinels.copernicus.eu/documents/247904/2560237/Sentinel-2-image-Austria-Vienna.jpg'
    },
    {
      id: 4,
      name: 'Global Fire Data',
      description: 'Active fire detection and burned area mapping',
      type: 'Anomaly',
      updateFrequency: 'Daily',
      resolution: '375m',
      coverage: 'Global',
      image: 'https://earthobservatory.nasa.gov/ContentWOC/images/globalmaps/fire_avg_2001-2018.jpg'
    },
    {
      id: 5,
      name: 'Global Forest Watch',
      description: 'Deforestation and forest change monitoring',
      type: 'Anomaly',
      updateFrequency: 'Weekly',
      resolution: '30m',
      coverage: 'Global forests',
      image: 'https://wri-datalab.s3.amazonaws.com/manual/gfw-help-center/Forest_sideview.jpg'
    },
    {
      id: 6,
      name: 'Global Flood Database',
      description: 'Historical and real-time flood extent mapping',
      type: 'Anomaly',
      updateFrequency: 'As available',
      resolution: '30m',
      coverage: 'Global',
      image: 'https://reliefweb.int/sites/default/files/styles/large_landscape/public/previews/95/27/95271a71-f8fc-3c2d-91a5-9a3f57f95b5e.png'
    }
  ];

  // Group data sources by type
  const groupedSources = dataSources.reduce((acc, source) => {
    if (!acc[source.type]) {
      acc[source.type] = [];
    }
    acc[source.type].push(source);
    return acc;
  }, {} as Record<string, typeof dataSources>);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Data Catalog
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Browse the available data sources in the VisionEarth platform. These datasets are used to visualize environmental conditions and detect anomalies.
      </Typography>

      {Object.entries(groupedSources).map(([type, sources]) => (
        <Box key={type} sx={{ mb: 6 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2, mt: 4 }}>
            {type} Data
          </Typography>
          <Grid container spacing={3}>
            {sources.map((source) => (
              <Grid item xs={12} md={6} key={source.id}>
                <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={source.image}
                    alt={source.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {source.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {source.description}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      <Chip label={`Update: ${source.updateFrequency}`} size="small" />
                      <Chip label={`Resolution: ${source.resolution}`} size="small" />
                      <Chip label={`Coverage: ${source.coverage}`} size="small" />
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Container>
  );
};

export default DataCatalogPage;
