export SPLUNK_HOME=/opt/splunk
export PYTHON_SITEPACKAGES=/usr/lib/python2.7/site-packages
wget https://bootstrap.pypa.io/get-pip.py
python get-pip.py
pip install msrestazure -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
pip install splunk-sdk  -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
pip install splunk-sdk  -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
pip install futures -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
