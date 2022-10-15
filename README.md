# op3
OP3: The Open Podcast Prefix Project

<img width="366" alt="image" src="https://user-images.githubusercontent.com/47259736/190524974-3959056a-cb8c-40e5-8e46-2d4f0d5e6de5.png">

The Open Podcast Prefix Project (OP3) is a free and open-source podcast [prefix analytics service](https://soundsprofitable.com/update/prefix-analytics) committed to open data and listener privacy.

# TL;DR
Podcasters or podcast hosting companies can prepend

`https://op3.dev/e/`

to podcast episode urls in their feed to participate and start sending data.

Anyone can verify the data using the [OP3 API](https://op3.dev/api/docs).  Only a safe set of request attributes are currently stored and returned by this API.

The service is still in early development, but any and all data is appreciated and will help improve the system. 

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
  - Currently, only a minimal set of fields are saved for every request
    - Other data like rough geo-location is available, but should be first discussed with a wider community before saving
   
## Commitment to **auditable infrastructure**
  - Entire code base is open source, right here in this very GitHub repo
  - Deployments run entirely on GitHub, and are pushed directly to Cloudflare's CDN environment, no black boxes in the middle
  - Any IP lists will default to being public in the codebase
    - For those that cannot be public, a hash will be present in the codebase - so changes can be tracked and verified by other parties with the same list
  - The logs never leave Cloudflare's infrastructure, and stored in a storage product that _has no backend query api_, all access goes through the public code paths that are fully visible in this source repository
    
## Commitment to **high-performance redirects**
  - Since any prefix service is in the path of serving podcast episodes, it needs to be lightning-fast
  - Runs entirely on Cloudflare's CDN platform, a global infrastructure with edge nodes in over 275 cites in over 100 countries
  - The redirects always succeed, even if the backend storage is down. Logging is done in the background after the response is returned
 
## Commitment to **sustainable development**
  - Building a service like this will require a large amount of initial development (see work plan below)
  - Although the service runs on serverless infrastructure, there will still be monthly costs involved, and ongoing administration (combatting fraud and abuse, managing current IP lists)
  - [op3.dev](https://op3.dev) (and the [staging](https://staging.op3.dev) and [ci](https://ci.op3.dev) subdomains) run under a dedicated Cloudflare paid account, these are the only hosting costs
  - Monthly bills and usage details are [published](https://op3.dev/costs) as a public part of the project
  - Anyone interested in supporting the project can sponsor development and operational costs by purchasing sponsorships
    - For initial development, there is a [Pioneer Sponsorship](https://buy.stripe.com/aEU8z676n2fnfEQ148) as a way to gauge interest
    - Sponsors will be listed on the project page below (if desired)

# Roadmap
The production [op3.dev](https://op3.dev) prefix service is ready to use, it's been tested with large shows and is safely storing and returning episode request logs. 
Basic request-level data is available in the API, all other future features will build on top in a layered approach.

## Work plan
 - ✅ Launch highly-available, performant prefix redirect service
 - ✅ Make low-level minimized **request** data available in the API
 - 👨‍💻 Identify podcast show and episode information for each episode url using the service
 - 🔜 Publish documentation site with setup guides for every podcast hosting company and FAQs on how to audit the project claims and policies
 - 🔜 Make high-quality podcast and episode **download** data available in the API
   - (This will be the most useful data for podcast use cases such as verifying downloads for advertisers or comparing shows)
   - Filter out duplicate requests from the same listener
   - Distinguish apps from bots by User-Agent, building on the [public OPAWG User agent list](https://github.com/opawg/user-agents)
   - Categorize request IPs using known IP ranges of cloud services, vpns, tor traffic, etc, and exclude ranges representing automated traffic
   - Implement a solid first-pass calculation along the lines of the [Open Downloads](https://github.com/open-downloads/odl) criteria
 - 🔜 Build user-friendly charts and widgets for podcasters to easily reference and/or integrate into their own sites
 - 🔜 Build useful data exports to Google Sheets, Zapier, etc
 - 🔜 Build operational tools to support ongoing maintenance, data management, and abuse/fraud detection with minimal staffing needs

# Sponsors
Public list coming soon...

Support initial build-out and operations by purchasing a [Pioneer Sponsorship](https://buy.stripe.com/aEU8z676n2fnfEQ148).

# Questions?
Email [john@op3.dev](mailto:john@op3.dev) or [start a discussion](https://github.com/skymethod/op3/discussions).
