#!/bin/bash

set -e

version=$1
ta_folder="TA-Azure_Monitor"
version_folder="${ta_folder}_${version}"

# Set working directory to location of this script file.
cd "${0%/*}"

# Clean up any existing packages for this version.
rm /tmp/$version_folder.spl --force
rm ../packages/$version_folder.spl --force

# Create folder structure and file contents to put in package.
rm $ta_folder --force --recursive
mkdir $ta_folder 
cp -r ../bin $ta_folder
cp -r ../default $ta_folder
cp -r ../README $ta_folder
cp -r ../static $ta_folder
cp ../LICENSE $ta_folder
cp ../README.md $ta_folder

# Build the package file for this version
7z a -ttar /tmp/$version_folder.tar $ta_folder/*
cp /tmp/$version_folder.tar /tmp/$version_folder.spl
7z a -tgzip ../packages/$version_folder.spl /tmp/$version_folder.spl

# Clean up temporary working files used for packaging
rm /tmp/$version_folder.spl
rm /tmp/$version_folder.tar

rm $ta_folder --force --recursive
