#!/usr/bin/env bash
set -euo pipefail

apk=${1:?Provide the signed Android account preview APK path}
package=africa.auratrade.terminal.accountpreview
callback="$package://auth/callback?error=access_denied"

expect_text() {
  local text=$1
  for ((attempt=0; attempt<12; attempt++)); do
    if adb shell uiautomator dump /sdcard/aura-ui.xml &&
      adb shell cat /sdcard/aura-ui.xml | grep -F "$text" >/dev/null; then
      return 0
    fi
    sleep 2
  done
  adb logcat -d -s AndroidRuntime Capacitor chromium | tail -80
  printf '::error::Installed %s but did not see "%s" in the Android view hierarchy.\n' "$package" "$text"
  return 1
}

if grep -q '"version": "1\.1\.0"' public/app/android.json; then
  adb install public/app/auratrade-east-africa-preview.apk
  legacy=true
fi
adb install -r "$apk"
if [[ ${legacy:-false} == true ]]; then
  adb shell pm path africa.auratrade.terminal.preview | grep -F 'package:'
  echo 'The 1.2 account preview can be installed without removing the 1.1 preview.'
fi
adb shell am start -W -n "$package/africa.auratrade.terminal.MainActivity"
expect_text 'Continue with GitHub'
expect_text 'Create account'
adb shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "$callback" "$package"
expect_text 'Try again, or sign in with your email.'
adb shell am force-stop "$package"
adb shell am start -W -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "$callback" "$package"
expect_text 'Try again, or sign in with your email.'
echo 'Android sign-in gate and warm/cold callback verified.'
