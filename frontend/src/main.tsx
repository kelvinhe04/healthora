import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParallaxProvider } from 'react-scroll-parallax';
import './index.css';
import { App } from './App';
import { SSOCallbackPage } from './components/SSOCallback';
import { useNavigate } from 'react-router-dom';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 * 5 } },
});

const clerkPk = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

function SSOCallbackWrapper() {
  const navigate = useNavigate();
  return <SSOCallbackPage onSuccess={() => navigate('/')} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPk} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
          <ParallaxProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/sso-callback" element={<SSOCallbackWrapper />} />
                <Route path="/*" element={<App />} />
              </Routes>
            </BrowserRouter>
          </ParallaxProvider>
        </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
);