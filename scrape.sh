#!/bin/bash

echo $0

node ./sync-company-data.js > ./logs/sync-company-data

node ./stackoverflow-parser.js > ./logs/stackoverflow-parser

node ./techinasia-scraper.js > ./logs/techinasia-scraper

node ./adzuna-parser.js > ./logs/adzuna-parser