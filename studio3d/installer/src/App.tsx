import React, { useState } from 'react';
import Welcome from './screens/Welcome';
import SystemScan from './screens/SystemScan';
import TierSelect from './screens/TierSelect';
import CloudAPIKeys from './screens/CloudAPIKeys';
import DownloadProgress from './screens/DownloadProgress';
import Complete from './screens/Complete';
import Launcher from './screens/Launcher';
import type { SystemInfo } from './screens/SystemScan';

export type Screen =
  | 'welcome'
  | 'scan'
  | 'tier'
  | 'apikeys'
  | 'download'
  | 'complete'
  | 'launcher';

export interface InstallConfig {
  systemInfo: SystemInfo | null;
  tier: 'full' | 'lite' | 'cloud';
  installDir: string;
  falApiKey: string;
  threedApiKey: string;
  hfToken: string;
}

const defaultConfig: InstallConfig = {
  systemInfo: null,
  tier: 'full',
  installDir: '',
  falApiKey: '',
  threedApiKey: '',
  hfToken: '',
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [config, setConfig] = useState<InstallConfig>(defaultConfig);

  const update = (partial: Partial<InstallConfig>) =>
    setConfig(prev => ({ ...prev, ...partial }));

  // Check if already installed (in a real app this would check config.json)
  // For now always start from Welcome
  const isInstalled = false;

  if (isInstalled) {
    return <Launcher config={config} />;
  }

  switch (screen) {
    case 'welcome':
      return <Welcome onNext={() => setScreen('scan')} />;
    case 'scan':
      return (
        <SystemScan
          onNext={(info) => {
            update({ systemInfo: info });
            setScreen('tier');
          }}
          onBack={() => setScreen('welcome')}
        />
      );
    case 'tier':
      return (
        <TierSelect
          systemInfo={config.systemInfo}
          selected={config.tier}
          onSelect={tier => update({ tier })}
          onNext={() => setScreen(config.tier === 'cloud' ? 'apikeys' : 'download')}
          onBack={() => setScreen('scan')}
        />
      );
    case 'apikeys':
      return (
        <CloudAPIKeys
          config={config}
          onChange={update}
          onNext={() => setScreen('download')}
          onBack={() => setScreen('tier')}
        />
      );
    case 'download':
      return (
        <DownloadProgress
          config={config}
          onComplete={() => setScreen('complete')}
        />
      );
    case 'complete':
      return <Complete config={config} onLaunch={() => setScreen('launcher')} />;
    case 'launcher':
      return <Launcher config={config} />;
  }
}
