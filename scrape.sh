#!/bin/bash

echo $(date -u)

echo "getting proxies.."

node ./get-proxies.js

echo "syncing company data.."

node ./sync-company-data.js > ./logs/sync-company-data

echo "getting jobs from stackoverflow.."

node ./stackoverflow-parser.js > ./logs/stackoverflow-parser

echo "getting jobs from techinasia.."

node ./techinasia-scraper.js > ./logs/techinasia-scraper

echo "getting jobs from adzuna.."

node ./adzuna-parser.js > ./logs/adzuna-parser

echo "done!"

exit 0