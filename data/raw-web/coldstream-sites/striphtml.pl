use strict; use HTML::Entities;
local $/; my $t = <>;
$t =~ s/<script[^>]*>.*?<\/script>//gis;
$t =~ s/<style[^>]*>.*?<\/style>//gis;
$t =~ s/<[^>]+>/ /g;
$t = decode_entities($t);
$t =~ s/\s+/ /g;
print $t;
