# Kairo: build the Android APK

1. Install Node.js (LTS) from https://nodejs.org
2. Open a terminal in this folder and run:
   npm install
   npm install -g eas-cli
3. Sign in to your free Expo account:
   eas login
4. Link the project (answer Y when asked to create it):
   eas init
5. Build the APK in the cloud (about 10 to 25 minutes):
   eas build -p android --profile preview
   - When asked "Generate a new Android Keystore?" answer Y.
6. When it finishes you get a link. Open it on your phone and download the .apk, then install it.

After installing: allow Notifications and Location, then in phone Settings > Apps > Kairo:
- Battery: set to Unrestricted / No restrictions
- Alarms & reminders: allow
