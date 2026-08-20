#!/bin/sh
# crude html-to-text
perl -0777 -pe 's/<script.*?<\/script>/ /gsi; s/<style.*?<\/style>/ /gsi; s/<[^>]+>/\n/g; s/&nbsp;/ /g; s/&amp;/&/g; s/&#39;/'"'"'/g; s/&quot;/"/g; s/&gt;/>/g; s/&lt;/</g;' "$1" | grep -v '^[[:space:]]*$'
