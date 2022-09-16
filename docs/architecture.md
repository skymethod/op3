## Architecture

- A deployment consists of a single cloudflare worker
  - Includes the entry-point worker, handles every incoming request, runs in every edge colo
  - Includes definition for a single backend Durable Object (BackendDO)

- Redirect requests are handled immediately by the edge colo (close to each user)
  - after the 302 response is returned, request attributes are saved to `request-log-${colo}` DOs asynchronously
  - most attributes are thrown away, and the raw ip addresses are hashed & encrypted before saving
  - One instance per edge colo - although DOs are not available in every cf colo, this ensures each instance will be as close as possible to the edge colo
  - A `combined-redirect-log` global singleton pulls from every `request-log-${colo}` periodically, and maintains indexes for api queries

```
                edge colos                               do colos
                
                                  /-----------------------------------------------------\
                                  |                        DFW                          |
                                  |                                                     |
                                  |                          /----------------------\   |
                                  |                          |      key-server      |   |
                                  |                          \----------------------/   |
                                  |                                                     |
                                  |                          /-----------------------\  |
                              / --------api requests ------->| combined-redirect-log |  |
                              |   |                          \-----------------------/  |
              /-----------\   |   |  /------------------\               ↑               |
requests ->   |    DFW    |---|----->| redirect-log-DFW |---------------|               |
              \-----------/   |   |  \------------------/               |               |
                              |   |                                     |               |
              /-----------\   |   |  /------------------\               |               |
requests ->   |    ATL    |---|----->| redirect-log-ATL |---------------|               |
              \-----------/       |  \------------------/               |               |
                                  |                                     |               |
                                  \-------------------------------------|---------------/
                                                                        |
                                  /-------------------------------------|---------------\                
                                  |                         CDG         |               |
                                  |                                     |               |
              /-----------\       |  /-------------------\              |               |
requests ->   |    CDG    |--------> |  redirect-log-CDG |--------------/               |
              \-----------/       |  \-------------------/                              |
                                  |                                                     |
                                  \-----------------------------------------------------/


etc...                            etc...

```
