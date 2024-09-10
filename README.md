# OP3: The Open Podcast Prefix Project

<img width="200" alt="OP3 logo on dark background" src="https://github.com/skymethod/op3/assets/47259736/3babd9f4-44bf-48ef-8162-1a14673cb5b1.png">
<br><br>

The [Open Podcast Prefix Project (OP3)](https://op3.dev/) is a free and open-source podcast [prefix analytics service](https://soundsprofitable.com/update/prefix-analytics) committed to open data and listener privacy.

# TL;DR
Podcasters or podcast hosting companies can prepend

`https://op3.dev/e/`

to podcast episode urls in their feed to participate and start sending data.

Anyone can verify the data using the [OP3 API](https://op3.dev/api/docs).  Only a safe set of request attributes are currently stored and returned by this API.

# The Vision
A free service for podcasters and podcast hosts to compute standard episode/show-level analytics and make them available to everyone

## Commitment to **safely store listener requests**
  - Raw IP addresses are never stored, but safely hashed using private keys (rotated monthly) that never leave the server
  - This provides a way to compute analytics without providing a way for anyone to identify a particular listener, even if their IP is known

## Commitment to **open data**
  - Podcasting is media publishing using an open platform, this project provides a way to open up a piece of the system that has not been available to date
  - Publish an [API](https://op3.dev/api/docs) of the low-level request logs for others to perform derived metrics such as downloads or other industry trends
  - Compute standard episode/show-level downloads/uniques, up to the [IAB](https://iabtechlab.com/compliance-programs/compliant-companies/#) standard
    - Goal would be eventually to obtain IAB certification, if someone sponsors it
    - This way non-IAB podcast hosts or independent podcasters could still report IAB-qualified downloads
  - Support emerging methods for improving download computation quality such as [ULIDs](https://podcastlistening.com)

## Commitment to **open development**
  - Anyone can get involved in the project [discussions](https://github.com/skymethod/op3/discussions)
   
## Commitment to **auditable infrastructure**
  - Entire code base is open source, right here in this very GitHub repo
  - Deployments run entirely on GitHub, and are pushed directly to Cloudflare's CDN environment, no black boxes in the middle
  - Any IP lists will default to being public in the codebase
    - For those that cannot be public, a hash will be present in the codebase - so changes can be tracked and verified by other parties with the same list
  - The logs never leave Cloudflare's infrastructure, and stored in a storage product that _has no backend query api_, all access goes through the public code paths that are fully visible in this source repository
    
## Commitment to **high-performance redirects**
  - Since any prefix service is in the path of serving podcast episodes, it needs to be lightning-fast
  - Runs entirely on Cloudflare's CDN platform, a global infrastructure with edge nodes in over 320 cities in over 120 countries
  - The redirects always succeed, even if the backend storage is down. Logging is done in the background after the response is returned
 
## Commitment to **sustainable development**
  - Building a service like this will require a large amount of initial development (see work plan below)
  - Although the service runs on serverless infrastructure, there will still be monthly costs involved, and ongoing administration (combatting fraud and abuse, managing current IP lists)
  - [op3.dev](https://op3.dev) (and the [staging](https://staging.op3.dev) and [ci](https://ci.op3.dev) subdomains) run under a dedicated Cloudflare paid account, these are the only hosting costs
  - Monthly bills and usage details are [published](https://op3.dev/costs) as a public part of the project
  - Anyone interested in supporting the project can sponsor development and operational costs by purchasing sponsorships (see [below](#sponsors))

# Roadmap
The production [op3.dev](https://op3.dev) prefix service is ready to use, it's been running since September 2022, currently measuring
over 1000 shows, large and small.
Basic request and download-level data is available in the API, all other future features will build on top in a layered approach.

Free public stats pages are available for every show using OP3 - see an [example](https://op3.dev/show/dc1852e4d1ee4bce9c4fb7f5d8be8908).

## Work plan
 - ✅ Launch highly-available, performant prefix redirect service
 - ✅ Make low-level minimized **request** data available in the API
 - ✅ Identify podcast show and episode information for each episode url using the service
 - ✅ Make high-quality podcast and episode **download** data available in the API
   - (This will be the most useful data for podcast use cases such as verifying downloads for advertisers or comparing shows)
   - Filter out duplicate requests from the same listener
   - Distinguish apps from bots by User-Agent, building on the [public OPAWG User agent list](https://github.com/opawg/user-agents)
   - Categorize request IPs using known IP ranges of cloud services, vpns, tor traffic, etc, and exclude ranges representing automated traffic
   - Implement a solid first-pass calculation along the lines of the [Open Downloads](https://github.com/open-downloads/odl) criteria
 - 👨‍💻 Publish documentation site with setup guides for every podcast hosting company and FAQs on how to audit the project claims and policies
 - 🔜 Build user-friendly charts and widgets for podcasters to easily reference and/or integrate into their own sites
 - 🔜 Build useful data exports to Google Sheets, Zapier, etc
 - 🔜 Build operational tools to support ongoing maintenance, data management, and abuse/fraud detection with minimal staffing needs

## Translation
🌎 Help us translate OP3 into as many languages as possible! See our [translation instructions](https://github.com/skymethod/op3/blob/master/translation.md) for more details.

# Sponsors
Anyone interested in supporting the project can sponsor development and [operational costs](https://op3.dev/costs) by purchasing sponsorships.  This is the only way OP3 can stay open and independent into the future.

There are two monthly sponsorship levels:
 - $500/mo [OP3 Gold Sponsorship](https://buy.stripe.com/aEU8z676n2fnfEQ148) to help fund development and drive future features
 - $100/mo [OP3 Sponsorship](https://buy.stripe.com/cN2eXueyP07f3W83ch) to help fund development
 - These sponsors are listed on [the OP3 home page](https://op3.dev/#sponsors)

For podcasters using OP3 or anyone else wanting to support this effort, consider our:
 - $10/mo [Early Supporter Sponsorship](https://buy.stripe.com/8wM6qYeyPg6d9gsdQW) to help offset monthly infrastructure costs

# Questions?
Email [john@op3.dev](mailto:john@op3.dev) or [start a discussion](https://github.com/skymethod/op3/discussions).
