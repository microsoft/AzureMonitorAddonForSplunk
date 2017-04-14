export SPLUNK_HOME=/Applications/Splunk
curl "https://bootstrap.pypa.io/get-pip.py" -o "get-pip.py"
python get-pip.py
pip install python-dateutil -I
pip install PyJWT -q
pip install adal -q
pip install splunk-sdk -q
pip install futures -q
cp /Library/Python/2.7/site-packages/six.py $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /Library/Python/2.7/site-packages/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /Library/Python/2.7/site-packages/splunklib $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
cp -R /Library/Python/2.7/site-packages/concurrent $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /Library/Python/2.7/site-packages/adal $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /Library/Python/2.7/site-packages/jwt $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
cp -R /Library/Python/2.7/site-packages/dateutil $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
