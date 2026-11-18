#!/usr/bin/env bash
set -euo pipefail

apk=${1:?Provide the signed Android preview APK path}
package=africa.auratrade.terminal.preview
adb install -r "$apk"
adb shell am start -W -n "$package/africa.auratrade.terminal.MainActivity"
for ((attempt=0; attempt<12; attempt++)); do
  if adb shell uiautomator dump /sdcard/aura-ui.xml &&
    adb shell cat /sdcard/aura-ui.xml | grep -F 'Market Terminal' >/dev/null; then
    echo 'AuraTrade preview rendered Market Terminal on Android.'
    exit 0
  fi
  sleep 2
done
adb logcat -d -s AndroidRuntime Capacitor chromium | tail -80
printf '::error::Installed %s but Market Terminal did not appear in the Android view hierarchy.\n' "$package"
exit 1
