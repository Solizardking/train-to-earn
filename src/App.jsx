import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import Dashboard from './components/Dashboard';
import MusicPlayer from './components/MusicPlayer';
import { API_BASE_URL } from './utils/api';

import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
  const endpoint = useMemo(
    () => {
      const apiPath = `${API_BASE_URL}/api/solana/rpc`;
      if (typeof window === 'undefined') {
        return apiPath.startsWith('http') ? apiPath : `http://localhost:5001${apiPath}`;
      }
      return new URL(apiPath, window.location.origin).toString();
    },
    [],
  );

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      // BackpackWalletAdapter removed due to compatibility issues
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Dashboard />
          <MusicPlayer />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
