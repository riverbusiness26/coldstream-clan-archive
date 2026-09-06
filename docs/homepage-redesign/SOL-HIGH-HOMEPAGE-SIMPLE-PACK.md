# Coldstream Gaming — Homepage pack (SIMPLE) for Sol High

**Scope:** #/home only. Landing unchanged.
**Decision:** River rejected V1-V3. Ship this simple brief.
**Reference:** v4-simple.png

## Must ship
1. Join us button to https://discord.gg/75sfq5VPY
2. Member login via existing Discord OAuth signIn
3. Very brief who we are (2 sentences max)
4. History: stats strip + link to #/archive
5. Remove Steam from homepage entirely

## Do not ship
- Steam
- Feature card grids
- Enlist steps
- Medals/ranks
- Fake events
- Word clan

## Locked copy
Eyebrow: Est. 2011
H1: Welcome to Coldstream.
Who we are: Coldstream Gaming is a multi-gaming community established in 2011. We are the home of the 2nd Coldstream (2ndCS) Holdfast regiment.
CTAs: Join us | Member login
History: See our history to #/archive
Stats: 2011 | 4 eras | 315+ | 1,227+
Motto: Second to none.

## IA
SiteNav no Steam; AccountStrip; Hero; History strip; Footer

## Implement
Home.tsx + home CSS. Remove Steam from home. Build site. Update HANDOFF.md.

## Acceptance
1 Landing unchanged
2 Join us to Discord 75sfq5VPY
3 Member login works
4 Brief who-we-are
5 History stats + archive
6 No Steam on home
7 No card sprawl
8 Mobile OK
9 Clean build; not clan
