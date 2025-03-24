import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  CssBaseline,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import CategoryMenu from "./components/CategoryMenu";
import ProductList from "./components/ProductList";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <CategoryMenu />
              </Grid>
              <Grid item xs={12} md={9}>
                <ProductList />
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
