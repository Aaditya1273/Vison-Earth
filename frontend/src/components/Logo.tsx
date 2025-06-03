import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';

interface LogoProps {
  size?: number;
  withText?: boolean;
  color?: string;
}

const Logo: React.FC<LogoProps> = ({ 
  size = 40, 
  withText = true,
  color
}) => {
  const theme = useTheme();
  const logoColor = color || theme.palette.primary.main;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="100" cy="100" r="95" fill={logoColor} />
        <path
          d="M100 5C47.5 5 5 47.5 5 100C5 152.5 47.5 195 100 195C152.5 195 195 152.5 195 100C195 47.5 152.5 5 100 5ZM100 185C53 185 15 147 15 100C15 53 53 15 100 15C147 15 185 53 185 100C185 147 147 185 100 185Z"
          fill={logoColor}
        />
        <path
          d="M135 65C128.333 58.3333 116.4 45 100 45C83.6 45 71.6667 58.3333 65 65L60 85L65 100L75 115L85 125L95 130L105 125L115 115L125 100L130 85L135 65Z"
          fill="white"
        />
        <path
          d="M65 135C71.6667 141.667 83.6 155 100 155C116.4 155 128.333 141.667 135 135L140 115L135 100L125 85L115 75L105 70L95 75L85 85L75 100L70 115L65 135Z"
          fill="white"
        />
      </svg>
      
      {withText && (
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ 
            fontWeight: 'bold',
            color: logoColor,
            letterSpacing: '0.5px'
          }}
        >
          VisionEarth
        </Typography>
      )}
    </Box>
  );
};

export default Logo;
