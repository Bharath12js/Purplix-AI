import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { Shell } from './components/Shell'
import { Landing } from './views/Landing'
import { Login } from './views/Login'
import { Dashboard } from './views/Dashboard'
import { Initiate } from './views/Initiate'
import { LiveRun } from './views/LiveRun'
import { Red } from './views/Red'
import { Blue } from './views/Blue'
import { Purple } from './views/Purple'
import { Evidence } from './views/Evidence'
import { Compliance } from './views/Compliance'

const router = createBrowserRouter([
  // Two routes sit OUTSIDE the shell, because neither wants the console's
  // chrome: the public landing page at `/`, and the sign-in page.
  //
  // The console therefore starts at `/dashboard` rather than `/`. Every other
  // app route (`/red`, `/blue`, `/purple`, …) keeps its path, so existing
  // links and bookmarks into the engines still resolve.
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  {
    element: <Shell />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'initiate', element: <Initiate /> },
      { path: 'live', element: <LiveRun /> },
      { path: 'red', element: <Red /> },
      { path: 'blue', element: <Blue /> },
      { path: 'purple', element: <Purple /> },
      { path: 'evidence', element: <Evidence /> },
      { path: 'compliance', element: <Compliance /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
