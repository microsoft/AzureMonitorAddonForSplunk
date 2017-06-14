export SPLUNK_HOME=/opt/splunk
apt-get update -q -y
wget https://bootstrap.pypa.io/get-pip.py
python get-pip.py
apt-get -q -y install build-essential libssl-dev libffi-dev python-dev
pip install six -I -q 
pip install PyJWT -q
pip install cryptography -q
pip install adal -q
pip install splunk-sdk -q
pip install futures -q
cp /usr/local/lib/python2.7/dist-packages/six.py $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /usr/local/lib/python2.7/dist-packages/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /usr/local/lib/python2.7/dist-packages/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
cp -R /usr/local/lib/python2.7/dist-packages/concurrent $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /usr/local/lib/python2.7/dist-packages/adal $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /usr/local/lib/python2.7/dist-packages/jwt $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /usr/local/lib/python2.7/dist-packages/dateutil $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
