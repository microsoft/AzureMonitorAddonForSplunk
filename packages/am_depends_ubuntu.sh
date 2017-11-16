export SPLUNK_HOME=/opt/splunk
export PYTHON_SITEPACKAGES=/usr/local/lib/python2.7/dist-packages
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
cp $PYTHON_SITEPACKAGES/six.py $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/concurrent $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/adal $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/jwt $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/dateutil $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
