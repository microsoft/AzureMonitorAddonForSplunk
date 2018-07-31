export SPLUNK_HOME=/opt/splunk
export PYTHON_SITEPACKAGES=/usr/lib/python2.7/site-packages
wget https://bootstrap.pypa.io/get-pip.py
python get-pip.py
pip install six -I 
pip install adal 
pip install splunk-sdk 
pip install futures
pip install msrestazure -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp $PYTHON_SITEPACKAGES/six.py $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
cp -R $PYTHON_SITEPACKAGES/concurrent $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/adal $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/jwt $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R $PYTHON_SITEPACKAGES/dateutil $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
