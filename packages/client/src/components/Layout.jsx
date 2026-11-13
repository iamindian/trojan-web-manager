
import { useEffect, useState, useRef, Fagment } from "react";
import { useSnackbar } from '@mui/base/useSnackbar';
import { ClickAwayListener } from '@mui/base/ClickAwayListener';
import { css, keyframes, styled } from '@mui/system';
import AxiosNavigator from './AxiosNavigator'
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import auth from '../auth';
import AppBar from '@mui/material/AppBar';
import { Box, Button, Container, Grid, Toolbar, ThemeProvider, IconButton, Paper, Menu, MenuItem } from "@mui/material";
import { createTheme } from '@mui/material/styles';
import AccountCircle from '@mui/icons-material/AccountCircle';


function Layout() {
  const navigate = useNavigate();
  const [accountMenu, setAccountMenu] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const theme = createTheme({
    palette: {
      primary: {
        light: '#757ce8',
        main: '#3f50b5',
        dark: '#002884',
        contrastText: '#fff',
      },
      secondary: {
        light: '#ff7961',
        main: '#f44336',
        dark: '#ba000d',
        contrastText: '#000',
      },
    },
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("isAuthenticated") || "false");
  const listener = useRef(null);
  const blue = {
    200: '#99CCF3',
    400: '#3399FF',
    500: '#007FFF',
  };
  const grey = {
    50: '#f6f8fa',
    100: '#eaeef2',
    200: '#d0d7de',
    300: '#afb8c1',
    400: '#8c959f',
    500: '#6e7781',
    600: '#57606a',
    700: '#424a53',
    800: '#32383f',
    900: '#24292f',
  };
  const snackbarInRight = keyframes`
      from {
        transform: translateX(100%);
      }
    
      to {
        transform: translateX(0);
      }
    `;
  const CustomSnackbar = styled('div')(
    ({ theme }) => css`
        position: fixed;
        z-index: 5500;
        display: flex;
        right: 16px;
        bottom: 16px;
        left: auto;
        justify-content: start;
        max-width: 560px;
        min-width: 300px;
        background-color: ${theme.palette.mode === 'dark' ? grey[900] : grey[50]};
        border-radius: 8px;
        border: 1px solid ${theme.palette.mode === 'dark' ? grey[700] : grey[200]};
        box-shadow: ${theme.palette.mode === 'dark'
        ? `0 2px 8px rgb(0 0 0 / 0.5)`
        : `0 2px 8px ${grey[200]}`};
        padding: 0.75rem;
        color: ${theme.palette.mode === 'dark' ? grey[50] : grey[900]};
        font-family: 'IBM Plex Sans', sans-serif;
        font-weight: 600;
        animation: ${snackbarInRight} 200ms;
        transition: transform 0.2s ease-out;
      `,
  );
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const { getRootProps, onClickAway } = useSnackbar({
    onClose: closeAlert,
    open,
    autoHideDuration: 5000,
  });
  function openAlert(content) {
    setOpen(true);
    setContent(content);
  }
  function closeAlert() {
    setOpen(false);
  }
  async function signOut() {
    setSigningOut(true);
    try {
      await auth.signout();
      setAccountMenu(null);
      navigate("/login");
    } catch (error) {
      setAccountMenu(null);
      openAlert("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  function updateAuthenticated() {
    setIsAuthenticated(sessionStorage.getItem("isAuthenticated"));
  }
  useEffect(() => {
    listener.current = window.addEventListener('storage', updateAuthenticated);
    window.dispatchEvent(new Event('storage'))
    return () => {
      window.removeEventListener('storage', updateAuthenticated);
    }
  }, [isAuthenticated])
  return (

    <div className="navigater">
      <ThemeProvider theme={theme}>
        <AppBar style={{ display: "flex", width: "100%", position: "fixed", left: "0px", top: "0px" }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters>

              <Box>
                <Button color="inherit" component={NavLink} to="/" >
                  Query
                  {/* <NavLink >Query</NavLink> */}
                </Button>
                {isAuthenticated == "true" ? <Button color="inherit" component={NavLink} to="/admin" end>Add</Button> : ""}
                {isAuthenticated == "true" ? <Button color="inherit" component={NavLink} to="/users" end>Users</Button> : ""}
                {isAuthenticated == "true" ? "" : <Button color="inherit" component={NavLink} to="/login" end>Sign In</Button>}
              </Box>
              <Box sx={{ flexGrow: 1 }} ></Box>
              {isAuthenticated == "true" && <Box>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  aria-expanded={Boolean(accountMenu)}
                  color="inherit"
                  onClick={(event) => setAccountMenu(event.currentTarget)}
                >
                  <AccountCircle />
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={accountMenu}
                  open={Boolean(accountMenu)}
                  onClose={() => setAccountMenu(null)}
                >
                  <MenuItem onClick={signOut} disabled={signingOut}>Sign out</MenuItem>
                </Menu>
              </Box>}


            </Toolbar>
          </Container>

        </AppBar>
        <div>
          <Outlet context={{ openAlert }} />
        </div>
        <AxiosNavigator></AxiosNavigator>
        {open ? <ClickAwayListener onClickAway={onClickAway}>
          <CustomSnackbar {...getRootProps()}>{content}</CustomSnackbar>
        </ClickAwayListener> : null}
      </ThemeProvider>
    </div >


  )
}
export default Layout;