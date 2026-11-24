# Matrix

Matrix runs a hundred fictional futures for one person and the five people closest to them. Edit Jules’s profile, attach sample conversation archives, watch the six agents interact, and choose a life from its distribution to enter the chapel. Built for **HackwithBay 4.0**, November 24, 2026, under the theme _Thoughtful Agents for Productivity_.

## Run the demo

With Node 22 and npm, run `npm ci` and `npm run dev`. The Vite development server and the Vercel deployment both serve the same MCP handler at `/api/mcp`. Visit `/you` for setup or `/lives` for the reproducible sample results.

## Data and Nexla

Matrix exposes two read-only MCP tools. `list_conversations` returns fictional excerpts for a selected source and five cast slots. The browser assigns those excerpts to the people the user named, scores their language alongside the relationship notes and shows the evidence for each character. Account labels stay on the device.

`read_population_reference` supplies a dated US life-expectancy-at-birth measurement. A configured Nexla MCP tool takes precedence, followed by the public World Bank Indicators API and a dated bundled release. The interface reports the provider used. The simulator uses that measurement as a starting point for fiction. Marriage, family, wellbeing, lifespan bands and cohort percentages come from the generated lives.

To connect a Nexla workspace, expose a read-only Nexset with the columns `year`, `life_expectancy` and `source_url` using Nexla’s MCP Studio or Tools & Servers API. Set `NEXLA_MCP_URL`, `NEXLA_SERVICE_KEY` and `NEXLA_COHORT_TOOL` on the server. Matrix negotiates MCP, discovers the named tool and requests one row in `dataframe_columns` format. It validates the response before labeling the reference as Nexla data. [Nexla’s deployment tutorial](https://docs.nexla.com/tutorials/deploy-mcp-server) · [World Bank series](https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=US)

## From a life to its service

The chart groups 100 runs into five-year lifespan bands. The peak life represents a common combination of family and wellbeing outcomes inside the most frequent band. Each selected life carries six chapters, its messages, relationship scores, five farewells and a structured `life_outcome`. The result page saves that run and profile with the existing screening store before navigating to `/chapel?life=<run_id>`.

The source is Jules’s Eulogy deployment, commit `999ebbb`. Original recorded screenings are available at `/lives?screening=jules` and `/lives?screening=louis`. The inherited simulation APIs, Bruin pipeline, chapel assets and archive documentation remain in the repository. [Original deployment](https://eulogy-ochre.vercel.app/)

## Checks

Run `npm run lint && npm run typecheck && npm test && npm run build`. GitHub Actions also verifies the exported Bruin marts before merging.
