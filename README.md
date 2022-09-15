# op3
OP3: The Open Podcast Prefix Project

The Open Podcast Prefix Project (OP3) is a free and open-source podcast [prefix analytics service](https://soundsprofitable.com/update/prefix-analytics) committed to open data and listener privacy.

Podcasters or podcast hosting companies can prepend

`https://op3.dev/e/`

to podcast episode urls in their feed to participate and start sending data.

# The Vision
A free service for podcasters and podcast hosts to compute standard episode/show-level analytics and make them available to everyone
- Commitment to **safely store listener requests**
  - Raw IP addresses are never stored, but safely hashed using private keys (rotated monthly) that never leave the server
  - This provides a way to compute analytics without providing a way for anyone to identify a particular listener, even if their IP is known
- Commitment to **open data**
  - Podcasting is media publishing using an open platform, this project provides a way to open up a piece of the system that has not been available to date
  - Publish an [API](https://op3.dev/api/docs) of the low-level request logs for others to perform derived metrics such as downloads or other industry trends
  - Compute standard episode/show-level downloads/uniques, up to the [IAB](https://iabtechlab.com/compliance-programs/compliant-companies/#) standard
    - Goal would be eventually to obtain IAB certification, if someone sponsors it
    - This way non-IAB podcast hosts or independent podcasters could still report IAB-qualified downloads
  - Support emerging methods for improving download computation quality such as [ULIDs](https://podcastlistening.com)
- Commitment to **open development**
  - Anyone can get involved in the project [discussions](https://github.com/skymethod/op3/discussions)
  - Currently, only a minimal set of fields are saved for every request
    - Other data like rough geo-location is available, but should be first discussed with a wider community
- Commitment to **auditable infrastructure**
  - Entire code base is open source (here)
  - Deployments run entirely on GitHub, and are pushed directly to Cloudflare's CDN environment, no black boxes in the middle
  - Any IP lists will default to being public in the codebase
    - For those that cannot be public, a hash will be present in the codebase - so changes can be tracked and verified by other parties with the same list
- Commitment to **high-performance redirects**
  - Since any prefix service is in the path of serving podcast episodes, it needs to be lightning-fast
  - Runs entirely on Cloudflare's CDN platform, a global infrastructure with edge nodes in over 275 cites in over 100 countries
  - The redirects always succeed, even if the backend storage is down. Logging is done in the background after the response is returned.
- Commitment to **sustainable development**
  - Although the service runs on serverless infrastructure, there will still be monthly costs involved, and ongoing administration (combatting fraud and abuse, managing current IP lists)
  - op3.dev (and the staging and ci subdomains) run under a dedicated Cloudflare paid account, these are the only hosting costs
  - Monthly bills and usage details will be published once available
  - Anyone interested in supporting the project can sponsor development and operational costs by purchasing sponsorships
    - For initial development, there is a [Pioneer Sponsorship](https://buy.stripe.com/aEU8z676n2fnfEQ148) as a way to gauge interest
    - Sponsors will be listed on the project page if desired
