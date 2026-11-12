import "./index.css";
import { createRoot } from "react-dom/client";
import { defer, createBrowserRouter, Outlet, RouterProvider, useRouteError, isRouteErrorResponse, redirect, NavLink } from "react-router-dom";
import { Provider } from "react-redux";
import configureStore from './configureStore'
import axios from "axios";
import Layout from './components/Layout'
const prefix = import.meta.env.VITE_API_PREFIX;
const store = configureStore();
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [

      {
        path: "/admin/:id?",
        lazy: () => import("./pages/Admin"),
        loader: async ({ params }) => {
          if (sessionStorage.getItem("isAuthenticated") === 'false') {
            return redirect("/login")
          }
          const { id } = params;
          if (!id) {
            return defer({
              userPromise: Promise.resolve(
                {
                  data: {
                    users: [{
                      username: "",
                    }],
                    total: 1,
                  }
                }
              )
            });
          }
          try {
            const userPromise = axios.get(`${prefix}/users`, { params: { offset: 0, limit: 1, id } });
            return defer({
              userPromise
            })
          } catch (e) {
            if (e.response.status === 401) {
              return redirect("/login")
            } else {
              throw e;
            }

          }



        }
      },
      {
        index: true,
        lazy: () => import("./pages/App"),
      },
      {
        path: "/login",
        lazy: () => import("./pages/Login"),
      },
      {
        path: "/users",
        lazy: () => import("./pages/Users"),
        loader: async () => {
          if (sessionStorage.getItem("isAuthenticated") === 'false') {
            return redirect("/login")
          }
          return {}
        }
      },
    ],
    // errorElement: <RootBoundary />,
  },

]);
function RootBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <div>This page doesn't exist!</div>;
    }

    if (error.status === 401) {
      return <div>You aren't authorized to see this</div>;
    }

    if (error.status === 503) {
      return <div>Looks like our API is down</div>;
    }

    if (error.status === 418) {
      return <div>🫖</div>;
    }
  }

  return <div>something wrong</div>;
}
createRoot(document.getElementById("root")).render(

  <Provider store={store}>
    <RouterProvider router={router}>
      
    </RouterProvider>
  </Provider>

);
