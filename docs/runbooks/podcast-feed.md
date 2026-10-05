# Podcast feed runbook

Subscribe: every reader page links `/podcast.xml` (`rel="alternate"`,
`application/rss+xml`); the footer links it directly. Episodes are the
published articles that have audio, newest-first, with a stable
article-URL GUID — replacing an audio file never creates a new episode.

Automatic sizes: `content:build` sends one `HEAD` request per published
audio URL and writes the enclosure lengths to
`generated/audio-byte-lengths.json`, keyed by exact audio URL. There is
no manual manifest — publishing new audio flows into the feed on the
next build with no extra step.

Requirements and failure mode: the build needs public media network
access for audio. A missing/unreachable audio object, redirect,
unexpected content type, or missing/zero/invalid `Content-Length`
fails the build loudly and preserves the last good `generated/`
output; the feed itself throws at prerender rather than emitting a
faked length. `content:validate` stays offline and read-only.

Out of scope: podcast directory submissions and cover artwork.
