#!/bin/sh
./extract.sh "$1" | sed -n '/Showing [0-9]* to/,/Subscribe to RSS Feed/p' | grep -vE '^\s*(0|Rate up|Leave a comment|See [0-9]+ comments?|<|>|[0-9]+|\.\.\.)\s*$'
