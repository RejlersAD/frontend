import React from 'react'
import { Box } from "@mui/material"

export const PageLayout = ({ children }) => (
  <Box>
    <div className="flex flex-col gap-y-3 xl:gap-y-4"> {/* Reduced gap from gap-y-4 */}
      {children}
    </div>
  </Box>
)