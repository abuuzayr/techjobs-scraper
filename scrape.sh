#!/bin/bash
dirpath=$HOME/techjobs-scraper

echo $(date -u)

echo "getting proxies.."

node "$dirpath/get-proxies.js"

echo "syncing company data.."

node "$dirpath/sync-company-data.js" > "$dirpath/logs/sync-company-data"

echo "getting jobs from stackoverflow.."

node "$dirpath/stackoverflow-parser.js" > "$dirpath/logs/stackoverflow-parser"

echo "getting jobs from techinasia.."

node "$dirpath/techinasia-scraper.js" 1 > "$dirpath/logs/techinasia-scraper"

echo "getting jobs from adzuna.."

node "$dirpath/adzuna-parser.js" 1 > "$dirpath/logs/adzuna-parser"

echo "getting jobs from mycareersfuture.."

node "$dirpath/mcf-parser.js" > "$dirpath/logs/mcf-parser"

echo "done!"

exit 0