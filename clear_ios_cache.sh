#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Killing Simulator..."
killall Simulator 2>/dev/null
echo "Clearing SpringBoard and SplashBoard cache..."
rm -rf ~/Library/Developer/CoreSimulator/Devices/*/data/Containers/Data/Application/*/Library/SplashBoard
rm -rf ~/Library/Developer/CoreSimulator/Devices/*/data/Library/Caches/com.apple.mobile.installd.staging
echo "Resolving SPM packages..."
xcodebuild -resolvePackageDependencies -project "$SCRIPT_DIR/ios/App/App.xcodeproj" -quiet
echo "Done"
