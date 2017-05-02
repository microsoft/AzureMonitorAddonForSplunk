#!/bin/bash
echo $(date) "Logging break - apt-get update"
#
# eliminate Splunk from various environment settings
#
export LD_LIBRARY_PATH=""
export PYTHONPATH=""
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games
#
apt-get -qq update
#
# install node + npm outside Splunk context
#
echo $(date) "Logging break - install nodejs"
nodejs -v
if [[ $? -ne 0 ]]; then
    cd ~
    curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
    apt-get -y -qq install nodejs
fi
#
# install nodejs dependencies for the app
#
echo $(date) "Logging break - install node packages for add-on"
cd $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
npm --silent install
#
# test if pip is installed, if not, install it
#
echo $(date) "Logging break - install pip"
pip -V
if [[ $? -ne 0 ]]; then
    cd ~
    curl -o get-pip.py -O "https://bootstrap.pypa.io/get-pip.py"
    /usr/bin/python get-pip.py
fi
#
# test if build-essential is installed, if not, install it (required for building cryptography)
#
echo $(date) "Logging break - install packages for building cryptography"
dpkg -s build-essential
if [[ $? -ne 0 ]]; then
    apt-get -y -qq install build-essential
fi
#
# test if libssl-dev is installed, if not, install it (required for building cryptography)
#
dpkg -s libssl-dev
if [[ $? -ne 0 ]]; then
    apt-get -y -qq install libssl-dev
fi
#
# test if libffi-dev is installed, if not, install it (required for building cryptography)
#
dpkg -s libffi-dev
if [[ $? -ne 0 ]]; then
    apt-get -y -qq install libffi-dev
fi
#
# test if python-dev is installed, if not, install it (required for building cryptography)
#
dpkg -s python-dev
if [[ $? -ne 0 ]]; then
    apt-get -y -qq install python-dev
fi
#
# test if pyopenssl is installed, if not, install it (required for building splunk-sdk)
#
echo $(date) "Logging break - install packages for installing splunk-sdk"
pip show pyopenssl
if [[ $? -ne 0 ]]; then
    pip install pyopenssl
fi
#
# test if ndg-httpsclient is installed, if not, install it (required for building splunk-sdk)
#
pip show ndg-httpsclient
if [[ $? -ne 0 ]]; then
    pip install ndg-httpsclient
fi
#
# test if pyasn1 is installed, if not, install it (required for building splunk-sdk)
#
pip show pyasn1
if [[ $? -ne 0 ]]; then
    pip install pyasn1
fi
#
# test if adal is installed, if not, install it (builds cryptography and a couple of others)
#
echo $(date) "Logging break - build cryptogrpahy & install adal, splunk-sdk, futures"
pip show adal
if [[ $? -ne 0 ]]; then
    pip install adal
fi
#
# test if splunk-sdk is installed, if not, install it
#
pip show splunk-sdk
if [[ $? -ne 0 ]]; then
    pip install splunk-sdk
fi
#
# test if futures is installed, if not, install it
#
pip show futures
if [[ $? -ne 0 ]]; then
    pip install futures
fi
#
# copy the python packages into the app directory. this is needed because of how Splunk sets PYTHONPATH
#
echo $(date) "Logging break - copy libraries to add-on folder"
cp --no-clobber /usr/local/lib/python2.7/dist-packages/six.py $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp --no-clobber -R /usr/local/lib/python2.7/dist-packages/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp --no-clobber -R /usr/local/lib/python2.7/dist-packages/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
cp --no-clobber -R /usr/local/lib/python2.7/dist-packages/concurrent $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp --no-clobber -R /usr/local/lib/python2.7/dist-packages/adal $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp --no-clobber -R /usr/local/lib/python2.7/dist-packages/jwt $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp --no-clobber -R /usr/local/lib/python2.7/dist-packages/dateutil $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
