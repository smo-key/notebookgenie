![NotebookGenie][t2l-logo]
============

NodeJS web server that automagically converts a Trello board into a customizable PDF!

[![NodeJS Dependencies][dep-image]][dep-url]

# Installation

Some installation is required to get this running server-side. Run this on a Debian-based system to get started immediately:

``` bash
apt-get install nodejs npm
npm install -g bower gulp
cd <installdir>
npm install
git submodule init && git submodule update
```

You will also need to have special dependencies on your system, specifically *PrinceXML* and *PDFToolkit*.
On Ubuntu 16.04, installation looked like this (please note that this may change based on your particular system and time of installation):

``` bash
# create temp dir somewhere on disk
cd ~
mkdir tmp
# download and install Prince dependencies
apt-get install libcurl3
curl -O http://archive.ubuntu.com/ubuntu/pool/main/g/giflib/giflib_4.1.6.orig.tar.gz
tar -xzvf giflib_4.1.6.orig.tar.gz
cd giflib_4.1.6
./configure --prefix=/usr && make && make install
cd ..
# download and install Prince
curl -O http://www.princexml.com/download/prince-10r7-ubuntu14.04-amd64.tar.gz
tar -xzvf prince-10r7-ubuntu14.04-amd64.tar.gz
cd prince-10r7-ubuntu14.04-amd64
./install.sh
```

[dep-image]: https://david-dm.org/smo-key/notebookgenie.svg?style=flat
[dep-url]: https://david-dm.org/smo-key/notebookgenie
[t2l-logo]: https://raw.githubusercontent.com/smo-key/notebookgenie/master/img/trello2latex-rgb-96.png
