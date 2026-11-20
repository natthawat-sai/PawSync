import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pawsync.app",
  appName: "PawSync",
  webDir: "dist",
  server: { androidScheme: "https" },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#e8f2ff" },
  },
};

export default config;
