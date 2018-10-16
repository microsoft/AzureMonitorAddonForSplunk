export SPLUNK_HOME=/opt/splunk
export PYTHON_SITEPACKAGES=/usr/local/lib/python2.7/dist-packages
apt-get update -q -y
wget https://bootstrap.pypa.io/get-pip.py
python get-pip.py
pip install msrestazure -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
pip install Markdown -q -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
pip install splunk-sdk -q -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
pip install splunk-sdk -q -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin/app
pip install futures -q -t $SPLUNK_HOME/etc/apps/TA-Azure_Monitor/bin
