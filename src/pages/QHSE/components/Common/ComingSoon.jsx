import { Box, Typography } from "@mui/material";
import { Construction } from "lucide-react";

const ComingSoon = ({ title }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 2,
    }}
  >
    <Construction size={48} color="#888" />
    <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main" }}>
      {title || "Coming Soon"}
    </Typography>
    <Typography variant="body1" sx={{ color: "text.secondary" }}>
      This page is not yet available.
    </Typography>
  </Box>
);

export default ComingSoon;