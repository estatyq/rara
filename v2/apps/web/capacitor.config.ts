/**
 * Capacitor 7 Native Wrapper Configuration (iOS & Android)
 * Wraps the compiled React/TS app for App Store & Google Play distribution
 * with native Local Alarms (USE_EXACT_ALARM), FCM/APNs Push, Keychain/Keystore Auth & Biometrics.
 */
const config = {
  appId: 'com.doselynx.app',
  appName: 'DoseLynx',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_doselynx',
      iconColor: '#0D9488',
      sound: 'doselynx_chime.wav',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
