ufo_client
==========

Installing dependencies on Mac OS X:

```
sudo port install gmp-ecm     # no, there's no brew for this yet sadly
brew install node
cd ufo_client
npm install
```

Mac OS X users: if the last step fails and your npm-debug.log contains "illegal text-relocation to '___gmp_binvert_limb_table'", try uninstalling and reinstalling libgmp:

```
sudo port clean gmp
sudo port upgrade gmp
```

Installing dependencies on Ubuntu 14.04 LTS:
```
        # update package repository
                sudo apt-get update

        # install dependencies
                sudo apt-get install -y gmp-ecm nodejs libgmp-dev build-essential git npm

        # install ufo_client
                git clone https://github.com/Anoncoin/ufo_client
                cd ufo_client
                npm config set registry https://registry.npmjs.org
                npm install
```

Installing dependencies on Ubuntu 12.x or 13.x:
```
        # add package repository
                sudo add-apt-repository ppa:chris-lea/node.js -y
        # update package repository
                sudo apt-get update
        # install dependencies
                sudo apt-get install -y gmp-ecm nodejs libgmp-dev build-essential git    
        # install ufo_client
                git clone https://github.com/Anoncoin/ufo_client
                cd ufo_client
                npm config set registry https://registry.npmjs.org
                npm install
```

Installing dependencies on Ubuntu, Debian, and its derivatives:
```
        # update package repository
                sudo apt-get update
        # install dependencies
                sudo apt-get install libgmp-dev gmp-ecm nodejs
        # install ufo_client
                cd ufo_client
                npm config set registry http://registry.npmjs.org    # the npm in Ubuntu needs this because it's old
                npm install
```

Writing a new configuration file:
```
        # create the config file. If this line fails replace "nodejs" with "node"
                (umask 077 && nodejs index.js > ~/ufo_config.yml)

        # edit your nick
                nano ~/ufo_config.yml

        # display the nick and pubkey lines from the config. Send these to Gnosis
                echo "Send these two nick and pubkey lines to Gnosis"
                egrep 'nick|pubkey' ~/ufo_config.yml
```

Running with the generated configuration file (after your nick has been added to our database):
```
nodejs index.js ~/ufo_config.yml    # if the command fails, replace "nodejs" with "node"
```
