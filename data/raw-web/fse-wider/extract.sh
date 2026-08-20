#!/bin/bash
topic=$1
for f in crawford-showposts-s*.html; do tr -d '\r' < "$f" | awk -v t="topic=${topic}[.]msg" '
  /<h5><strong>/ { inpost=($0 ~ t) }
  inpost && /<strong>on:<\/strong>/ { d=$0; sub(/.*on:<\/strong> /,"",d); sub(/&nbsp;.*/,"",d); print "### DATE: " d }
  inpost && /<div class="list_posts">/ { body=1 }
  body { print }
  body && /<br class="clear"/ { body=0; inpost=0; print "-----" }
  '
done | sed -e 's/<blockquote[^>]*>/[QUOTE]/g' -e 's/<\/blockquote>/[\/QUOTE]/g' -e 's/<br \/>/\n/g' -e 's/<[^>]*>//g' -e 's/&nbsp;/ /g' -e 's/&amp;/\&/g' -e 's/&quot;/"/g' -e "s/&#039;/'/g" | grep -v '^[[:space:]]*$'
