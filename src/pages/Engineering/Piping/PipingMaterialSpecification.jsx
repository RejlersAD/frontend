import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Construction } from 'lucide-react';

/**
 * PipingMaterialSpecification (PMS) Component
 * Displays a "Coming Soon" message for the Piping Material Specification module
 */
const PipingMaterialSpecification = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 3,
          textAlign: 'center'
        }}
      >
        <Construction size={64} color="#f97316" strokeWidth={1.5} />
        
        <Box>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 700, 
              color: 'primary.main',
              mb: 1
            }}
          >
            Valve MTO
          </Typography>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 500, 
              color: 'text.secondary',
              mb: 3
            }}
          >
            Coming Soon
          </Typography>
        </Box>

        <Box sx={{ maxWidth: '600px' }}>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              mb: 2
            }}
          >
            This module is currently under development and will be available soon.
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              fontStyle: 'italic'
            }}
          >
            The Valve MTO module will provide comprehensive valve take-off management,
            including a valve register, per-line quantification, compliance tracking,
            and cost estimation.
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default PipingMaterialSpecification;
