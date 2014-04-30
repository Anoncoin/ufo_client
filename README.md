ufo_client
==========

Installing dependencies on Mac OS X:

```
sudo port install gmp-ecm     # no, there's no brew for this yet sadly
brew install node
cd ufo_client
npm install
```

Installing dependencies on Ubuntu (and Debian, and its derivatives):
```
sudo apt-get install gmp-ecm nodejs
cd ufo_client
npm install
```

Writing a new configuration file:
```
(umask 077 && node index.js > ~/ufo_config.yml)
nano ~/ufo_config.yml      # edit your nick
echo "Send the following two lines to Gnosis:"
egrep 'nick|pubkey' ~/ufo_config.yml
```

Running with the generated configuration file (after your nick has been added to our database):
```
node index.js ~/ufo_config.yml
```
