#!/bin/bash

set -e

version=$1
ta_folder="TA-Azure_Monitor"
version_folder="${ta_folder}_${version}"

# Set working directory to location of this script file.
cd "${0%/*}"

# Clean up any existing packages for this version.
if [ -x /tmp/$version_folder.spl ]; then rm /tmp/$version_folder.spl --force; fi
if [ -x ../packages/$version_folder.spl ]; then rm ../packages/$version_folder.spl --force; fi

# Create folder structure and file contents to put in package.
if [ -x $ta_folder ]; then rm $ta_folder --force --recursive; fi
mkdir $ta_folder 
cp -r ../bin $ta_folder
cp -r ../default $ta_folder
cp -r ../README $ta_folder
cp -r ../static $ta_folder
cp ../LICENSE $ta_folder
cp ../README.md $ta_folder

# Build the package file for this version
if command -v 7z 2>/dev/null; then
  7z a -ttar /tmp/$version_folder.tar $ta_folder/*
  cp /tmp/$version_folder.tar /tmp/$version_folder.spl
  7z a -tgzip ../packages/$version_folder.spl /tmp/$version_folder.spl
  # Clean up temporary working files used for packaging
  rm /tmp/$version_folder.tar
  rm /tmp/$version_folder.spl
else
  tar czf ../packages/$version_folder.spl $ta_folder/
fi

rm $ta_folder --force --recursive
